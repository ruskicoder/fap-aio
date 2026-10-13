#!/usr/bin/env node
// Task orchestrator checker for .kiro/orchestrator.md and .kiro/specs/*/tasks.md.
// Commands: check (validate), next (next ready subtasks), waves (phase waves), status (progress per spec).
// Node standard library only. Read-only: it never edits the orchestrator or the task files.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const orchPath = join(root, '.kiro', 'orchestrator.md');
const specsDir = join(root, '.kiro', 'specs');
const SPEC_ORDER = ['PLT', 'CORE', 'PNL', 'GRD', 'INF', 'APP'];
const STATUSES = new Set(['todo', 'doing', 'done', 'blocked', 'fix']);
const GATE_STATUSES = new Set(['open', 'passed', 'waived']);

function section(md, heading) {
  const start = md.indexOf(`\n## ${heading}\n`);
  if (start < 0) return '';
  const rest = md.slice(start + heading.length + 5);
  const end = rest.search(/\n## /);
  return end < 0 ? rest : rest.slice(0, end);
}

function table(md) {
  const rows = md.split('\n').filter((l) => l.startsWith('|')).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.toLowerCase());
  return rows.slice(2).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').replace(/`/g, '')])));
}

const list = (cell) => (cell && cell !== '-' ? cell.split(',').map((s) => s.trim()).filter(Boolean) : []);

function loadTasks() {
  const units = new Map(); // id -> { id, spec, phase, sub, done, gates, file, line }
  for (const dir of readdirSync(specsDir)) {
    const file = join(specsDir, dir, 'tasks.md');
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    let current = null;
    lines.forEach((line, i) => {
      const m = line.match(/^- \[( |x|X|-)\] \d+(?:\.\d+)?\.? \[([A-Z]+-\d+(?:\.\d+)?)\]/);
      if (m) {
        const id = m[2];
        const [spec, num] = id.split('-');
        const [phase, sub] = num.split('.');
        current = { id, spec, phase: `${spec}-${phase}`, sub: sub ?? null, done: m[1].toLowerCase() === 'x', gates: [], file: `.kiro/specs/${dir}/tasks.md`, line: i + 1 };
        if (units.has(id)) units.get(id).duplicate = true;
        units.set(id, current);
        return;
      }
      const g = line.match(/Gate: ([^_)]+)/);
      if (g && current) current.gates.push(...g[1].split(/[,;]/).map((s) => s.replace(/\(.*$/, '').trim()).filter((s) => s.startsWith('G-')));
    });
  }
  return units;
}

function load() {
  const md = readFileSync(orchPath, 'utf8');
  const registry = table(section(md, 'Task registry'));
  const gates = table(section(md, 'Gates'));
  const fixes = table(section(md, 'Fix queue'));
  const control = Object.fromEntries([...section(md, 'Loop control').matchAll(/^([a-z_]+):\s*([^#\n]*)/gm)].map((m) => [m[1], m[2].trim()]));
  return { registry, gates, fixes, control, units: loadTasks() };
}

function validate(s) {
  const errors = [];
  const rows = new Map();
  for (const r of s.registry) {
    if (rows.has(r.id)) errors.push(`registry: duplicate id ${r.id}`);
    rows.set(r.id, r);
    if (!STATUSES.has(r.status)) errors.push(`registry: ${r.id} has unknown status "${r.status}"`);
  }
  const gateIds = new Set(s.gates.map((g) => g.gate));
  for (const g of s.gates) if (!GATE_STATUSES.has(g.status)) errors.push(`gates: ${g.gate} has unknown status "${g.status}"`);
  for (const u of s.units.values()) {
    if (u.duplicate) errors.push(`${u.file}:${u.line}: duplicate task id ${u.id}`);
    if (!u.sub && !rows.has(u.id)) errors.push(`${u.file}:${u.line}: phase ${u.id} has no registry row`);
    for (const g of u.gates) if (!gateIds.has(g)) errors.push(`${u.file}:${u.line}: unknown gate ${g}`);
  }
  for (const r of s.registry) {
    if (!s.units.has(r.id)) errors.push(`registry: ${r.id} not found in any tasks.md`);
    for (const d of list(r['depends on'])) if (!s.units.has(d)) errors.push(`registry: ${r.id} depends on unknown ${d}`);
    for (const g of list(r.gates)) if (!gateIds.has(g)) errors.push(`registry: ${r.id} uses unknown gate ${g}`);
    const subs = [...s.units.values()].filter((u) => u.phase === r.id && u.sub);
    const allDone = subs.length > 0 && subs.every((u) => u.done);
    if (!r.id.includes('.') && r.status === 'done' && !allDone) errors.push(`registry: ${r.id} is done but has unchecked subtasks`);
    if (!r.id.includes('.') && allDone && r.status !== 'done') errors.push(`registry: ${r.id} has all subtasks checked but status ${r.status}`);
  }
  for (const f of s.fixes) if (f.task && !s.units.has(f.task)) errors.push(`fix queue: ${f.fix} points to unknown task ${f.task}`);
  // cycle check on phase graph
  const phaseDeps = phaseGraph(s);
  const seen = new Map();
  const visit = (id, path) => {
    if (seen.get(id) === 1) { errors.push(`cycle: ${[...path, id].join(' -> ')}`); return; }
    if (seen.get(id) === 2) return;
    seen.set(id, 1);
    for (const d of phaseDeps.get(id) ?? []) visit(d, [...path, id]);
    seen.set(id, 2);
  };
  for (const id of phaseDeps.keys()) visit(id, []);
  return errors;
}

function phaseGraph(s) {
  const g = new Map();
  for (const r of s.registry) {
    const phase = r.id.split('.')[0];
    const deps = list(r['depends on']).map((d) => d.split('.')[0]).filter((d) => d !== phase);
    g.set(phase, [...new Set([...(g.get(phase) ?? []), ...deps])]);
  }
  return g;
}

function waves(s) {
  const g = phaseGraph(s);
  const wave = new Map();
  const w = (id) => {
    if (wave.has(id)) return wave.get(id);
    wave.set(id, 0);
    const v = Math.max(0, ...(g.get(id) ?? []).map((d) => w(d) + 1));
    wave.set(id, v);
    return v;
  };
  for (const id of g.keys()) w(id);
  return wave;
}

const order = (a, b, wave) => (wave.get(a.phase) - wave.get(b.phase)) || (SPEC_ORDER.indexOf(a.spec) - SPEC_ORDER.indexOf(b.spec)) || (parseInt(a.phase.split('-')[1]) - parseInt(b.phase.split('-')[1])) || (parseInt(a.sub ?? 0) - parseInt(b.sub ?? 0));

function next(s, limit = 5) {
  const wave = waves(s);
  const rows = new Map(s.registry.map((r) => [r.id, r]));
  const gateOpen = new Map(s.gates.map((g) => [g.gate, g.status === 'open']));
  const isDone = (id) => (id.includes('.') ? s.units.get(id)?.done : rows.get(id)?.status === 'done');
  const blocking = s.fixes.filter((f) => f.status === 'open' && f.severity === 'blocking');
  const ready = [];
  const waiting = [];
  for (const phase of [...rows.values()].filter((r) => !r.id.includes('.') && r.status !== 'done')) {
    const subs = [...s.units.values()].filter((u) => u.phase === phase.id && u.sub && !u.done).sort((a, b) => order(a, b, wave));
    const u = subs[0];
    if (!u) continue;
    const deps = [...list(phase['depends on']), ...list(rows.get(u.id)?.['depends on'])].filter((d) => !isDone(d));
    const gates = [...list(phase.gates), ...list(rows.get(u.id)?.gates), ...u.gates].filter((g) => gateOpen.get(g));
    const fix = blocking.filter((f) => f.task?.split('.')[0] === phase.id);
    const item = { ...u, deps, gates, fix: fix.map((f) => f.fix), status: phase.status };
    (deps.length || gates.length || fix.length || phase.status === 'blocked' ? waiting : ready).push(item);
  }
  ready.sort((a, b) => order(a, b, wave));
  return { ready: ready.slice(0, limit), waiting, fixes: s.fixes.filter((f) => f.status === 'open') };
}

const cmd = process.argv[2] ?? 'check';
const s = load();
const errors = validate(s);
if (cmd === 'check') {
  if (errors.length) { console.log(errors.join('\n')); console.log(`\n${errors.length} error(s)`); process.exit(1); }
  console.log(`ok: ${s.registry.length} registry rows, ${s.units.size} tasks, ${s.gates.length} gates, ${s.fixes.filter((f) => f.status === 'open').length} open fixes`);
} else if (cmd === 'waves') {
  const wave = waves(s);
  const by = new Map();
  for (const [id, w] of wave) by.set(w, [...(by.get(w) ?? []), id]);
  for (const w of [...by.keys()].sort((a, b) => a - b)) {
    const ids = by.get(w).sort((a, b) => (SPEC_ORDER.indexOf(a.split('-')[0]) - SPEC_ORDER.indexOf(b.split('-')[0])) || (parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])));
    console.log(`| ${w} | ${ids.join(', ')} |`);
  }
} else if (cmd === 'next') {
  if (errors.length) { console.log('orchestrator invalid; run `check` first'); process.exit(1); }
  const n = next(s, Number(process.argv[3] ?? 5));
  console.log(`mode: ${s.control.mode ?? 'step'}${s.control.paused === 'true' ? ', paused: true (the loop stops; owner sets paused: false)' : ''}`);
  if (n.fixes.length) console.log(`open fixes: ${n.fixes.map((f) => `${f.fix} (${f.severity}, ${f.task})`).join('; ')}`);
  console.log('ready:');
  for (const u of n.ready) console.log(`  ${u.id}  ${u.file}:${u.line}`);
  if (!n.ready.length) console.log('  none');
  const gated = n.waiting.filter((u) => u.gates.length && !u.deps.length);
  if (gated.length) console.log(`waiting on gates: ${gated.map((u) => `${u.id} [${u.gates.join(', ')}]`).join('; ')}`);
} else if (cmd === 'status') {
  for (const spec of SPEC_ORDER) {
    const subs = [...s.units.values()].filter((u) => u.spec === spec && u.sub);
    console.log(`${spec.padEnd(5)} ${subs.filter((u) => u.done).length}/${subs.length} subtasks`);
  }
} else {
  console.log('usage: orchestrator.mjs check | next [n] | waves | status');
  process.exit(2);
}
