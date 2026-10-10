/*
 * FAP mark sheet (/Report/Grade, table.student-mark-sheet) to a course model that
 * predict() accepts, with completion criteria taken from the FLM subject.
 *
 * Weights and items come from FAP: they describe the class as it is actually graded,
 * which can follow an older syllabus than FLM's active one. FLM supplies the criteria
 * (> 0, >= 4, ...) and the exam kind. Groups without an FLM match fall back to the owner
 * rules (docs/10-context/constraints.md): finals >= 4, everything else > 0.
 *
 *   import { rowsFromTable, courseModel } from './marksheet.mjs';
 *   const { subject, scores, mapping } = courseModel(flmSubject, rowsFromTable(table));
 *   predict(subject, scores);
 */

/**
 * DOM adapter. Row shapes (fap-v2/data-model.md): first row of a group has 5 cells with a
 * rowspan group cell; further items have 4 cells; tr.sheet-row-total and tr.sheet-grand-total
 * are totals. Columns: Mark group, Mark name, Weight (%), Final mark, Comment.
 */
export function rowsFromTable(table) {
  const text = (c) => (c ? c.textContent.replace(/\s+/g, ' ').trim() : '');
  const rows = [];
  let group = '';
  for (const tr of table.querySelectorAll('tbody tr')) {
    const kind = tr.classList.contains('sheet-grand-total') ? 'grand-total' : tr.classList.contains('sheet-row-total') ? 'group-total' : 'item';
    const c = [...tr.cells];
    let o = 0;
    if (c[0] && (c[0].rowSpan > 1 || c[0].classList.contains('sheet-group-cell') || c.length >= 5)) {
      group = text(c[0]);
      o = 1;
    }
    rows.push({ kind, group, name: text(c[o]), weight: text(c[o + 1]), value: text(c[o + 2]) });
  }
  return rows;
}

const num = (s) => {
  const m = String(s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\(resit\)/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Abbreviations used on FAP mark sheets and FLM categories.
const ALIASES = [
  [/\bfe\b|final exam|final|thi cuoi ky|ket thuc hoc phan/, 'final'],
  [/\bpe\b|practical exam|practical|thuc hanh/, 'practical'],
  [/\bte\b|theory exam|theoretical/, 'theory'],
  [/\bpt\b|progress tests?|kiem tra/, 'progress'],
  [/assignments?|asm/, 'assignment'],
  [/labs?\b|lab /, 'lab'],
  [/workshops?/, 'workshop'],
  [/participation|attendance|chuyen can|tham gia/, 'participation'],
  [/presentation|thuyet trinh/, 'presentation'],
  [/quiz(zes)?/, 'quiz'],
  [/project|du an/, 'project'],
];

function tokens(s) {
  const n = norm(s);
  const t = new Set(n.split(' ').filter((w) => w && !/^\d+$/.test(w)));
  for (const [re, tag] of ALIASES) if (re.test(n)) t.add('#' + tag);
  return t;
}

function nameScore(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / Math.max(x.size, y.size);
}

const isResit = (g) => /\(\s*resit\s*\)|thi lại|\bresit\b/i.test(g);
const looksFinal = (g) => /\b(fe|pe|te)\b|final|thi cuối|kết thúc|practical exam/i.test(g);

/** FLM rows a FAP group can match: plain rows, aggregates and their sub-rows. */
function flmCandidates(subject) {
  return subject ? subject.assessments.filter((a) => a.weight) : [];
}

/**
 * Builds { subject, scores, mapping } from an FLM subject (or null) and mark-sheet rows.
 * subject.assessments follows the subject-list schema, one entry per FAP group.
 */
export function courseModel(flm, rows) {
  const items = rows.filter((r) => r.kind === 'item' && r.name && !/^total$/i.test(r.name));
  const groups = new Map();
  const resits = [];
  for (const r of items) {
    if (isResit(r.group)) {
      resits.push(r);
      continue;
    }
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group).push(r);
  }

  const candidates = flmCandidates(flm);
  const used = new Set();
  const mapping = [];
  const assessments = [];
  const scores = {};
  let i = 0;
  for (const [group, list] of groups) {
    const weights = list.map((r) => (num(r.weight) ?? 0) / 100);
    const total = weights.reduce((s, w) => s + w, 0);
    // Score each FLM row: name similarity plus weight and part-count agreement.
    let best = null;
    for (const a of candidates) {
      if (used.has(a.index)) continue;
      const s = nameScore(group, a.category) + (Math.abs(a.weight - total) < 0.005 ? 0.5 : 0) + (a.parts === list.length ? 0.25 : 0);
      if (!best || s > best.score) best = { a, score: s };
    }
    const match = best && best.score >= 0.5 ? best.a : null;
    if (match) {
      used.add(match.index);
      // An aggregate and its sub-rows describe the same marks; block the other side.
      for (const a of candidates) if (a.parentIndex === match.index || match.parentIndex === a.index) used.add(a.index);
    }
    const fapFinal = looksFinal(group);
    const type = match ? (match.type === 'final' ? 'final' : 'ongoing') : fapFinal ? 'final' : 'ongoing';
    const finalKind = type !== 'final' ? null : match?.finalKind || (/\bpe\b|practical/i.test(group) ? 'PE' : 'FE');
    const completion = match?.completion || (type === 'final' ? { value: 4, inclusive: true } : { value: 0, inclusive: false });
    const evenSplit = weights.every((w) => Math.abs(w - weights[0]) < 0.0005);
    if (evenSplit) {
      assessments.push({ index: i, category: group, type, finalKind, parts: list.length, weight: +total.toFixed(4), weightPerPart: +(weights[0] || 0).toFixed(4), completion, parentIndex: null });
      scores[i] = list.map((r) => num(r.value));
      mapping.push({ group, items: list.map((r) => r.name), flmIndex: match?.index ?? null, flmCategory: match?.category ?? null, confidence: best ? +best.score.toFixed(2) : 0, assessmentIndex: [i] });
      i++;
    } else {
      // Uneven item weights: a parent row carrying the group criterion (checked on the
      // weighted group average by predict) and one child row per item, each above 0
      // unless FLM has a sub-row with the same name.
      const parent = i++;
      assessments.push({ index: parent, category: group, type, finalKind, parts: list.length, weight: +total.toFixed(4), weightPerPart: +(total / list.length).toFixed(4), completion, parentIndex: null });
      const idx = [];
      list.forEach((r, k) => {
        const sub = candidates.find((a) => a.parentIndex != null && nameScore(r.name, a.category) >= 0.5);
        assessments.push({ index: i, category: `${group}: ${r.name}`, type, finalKind, parts: 1, weight: +weights[k].toFixed(4), weightPerPart: +weights[k].toFixed(4), completion: sub?.completion || { value: 0, inclusive: false }, parentIndex: parent });
        scores[i] = [num(r.value)];
        idx.push(i++);
      });
      mapping.push({ group, items: list.map((r) => r.name), flmIndex: match?.index ?? null, flmCategory: match?.category ?? null, confidence: best ? +best.score.toFixed(2) : 0, assessmentIndex: idx });
    }
  }

  // A graded resit replaces the score of its base group's item with the same name.
  for (const r of resits) {
    const v = num(r.value);
    if (v == null) continue;
    const base = r.group.replace(/\(\s*resit\s*\)/i, '').trim();
    const m = mapping.find((x) => norm(x.group) === norm(base));
    if (!m) continue;
    const pos = m.items.findIndex((n) => norm(n) === norm(r.name));
    const k = m.assessmentIndex.length > 1 ? m.assessmentIndex[Math.max(0, pos)] : m.assessmentIndex[0];
    const p = m.assessmentIndex.length > 1 ? 0 : Math.max(0, pos);
    scores[k][p] = v;
    m.resitApplied = true;
  }

  const weightSum = +assessments.filter((a) => a.parentIndex == null).reduce((s, a) => s + a.weight, 0).toFixed(4);
  const subject = {
    code: flm?.code ?? null,
    scored: true,
    scoringScale: 10,
    minAvgMarkToPass: flm?.minAvgMarkToPass ?? 5,
    attendance: flm?.attendance ?? { minPercent: 80, source: 'default' },
    coursera: flm?.coursera ?? { required: false },
    hasFinal: assessments.some((a) => a.type === 'final'),
    assessments,
    weightSum,
    flags: [...(flm?.flags ?? []), ...(Math.abs(weightSum - 1) > 0.001 ? ['fap-weights-not-100'] : []), ...(mapping.some((m) => m.flmIndex == null) ? ['unmatched-groups'] : [])],
    source: 'fap-marksheet',
  };
  return { subject, scores, mapping };
}
