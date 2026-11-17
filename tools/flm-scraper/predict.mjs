#!/usr/bin/env node
/*
 * Reference pass and tier predictor over one subject of subject-list.json.
 *
 *   node tools/flm-scraper/predict.mjs data/flm/subject-list.json PRF192 '{"0":[8],"1":[7],"2":[6,7]}' [attended/total] [coursera-done]
 *
 * scores: { "<assessment index>": [part1, part2, ...] }; a missing part is "not yet graded".
 * Aggregate rows that have sub-rows are scored through the sub-rows' indexes.
 * Rules: docs/10-context/constraints.md. Pure function `predict` is what the extension should reuse.
 */
import { readFileSync } from 'node:fs';

const EPS = 1e-9;
/** FAP shows the course average with one decimal, half up (8.45 shows as 8.5). */
const round1 = (x) => Math.round(x * 10 + EPS) / 10;
const meets = (score, c) => !c || (c.inclusive ? score >= c.value - EPS : score > c.value + EPS);
/** The stricter of two criteria. */
const maxCrit = (a, b) => (!a ? b : !b ? a : a.value > b.value || (a.value === b.value && a.inclusive === false) ? a : b);
/** Smallest score on a 0.1 grid that satisfies a criterion. */
const floorOf = (c) => (!c ? 0 : c.inclusive ? c.value : +(c.value + 0.1).toFixed(1));

/**
 * @param subject  entry of subject-list.json `subjects`
 * @param scores   { [assessmentIndex]: (number|null)[] } part scores
 * @param opts     { attendance?: { attended, total }, courseraDone?: boolean, rules? }
 */
export function predict(subject, scores = {}, opts = {}) {
  const rules = opts.rules || { tiers: [
    { id: 'pass', minAverage: subject.minAvgMarkToPass ?? 5 },
    { id: 'fair', minAverage: 7 }, { id: 'good', minAverage: 8 }, { id: 'excellent', minAverage: 9 },
  ], finalExamMin: 4, attendanceMinPercent: 80 };
  const scale = subject.scoringScale || 10;
  // An FE is never below 4, whatever the rules passed in say.
  const feMin = Math.max(4, rules.finalExamMin);
  const issues = [];
  const warnings = [];

  if (!subject) return { scored: null, note: 'No FLM syllabus and no graded items.' };
  if (!subject.scored) return { scored: false, note: 'Subject is not scored (pass/fail by completion).' };

  // Expand assessments into gradable parts. An aggregate row with sub-rows (parentIndex)
  // is graded through its sub-rows; its own criterion becomes a group constraint.
  const parts = [];
  const groups = [];
  const childrenOf = (i) => subject.assessments.filter((x) => x.parentIndex === i);
  const gradable = [];
  for (const a of subject.assessments.filter((x) => x.parentIndex == null && x.weight)) {
    const kids = childrenOf(a.index);
    if (kids.length) {
      groups.push({ label: a.category, index: a.index, criterion: a.type === 'final' && a.finalKind === 'FE' ? maxCrit(a.completion, { value: feMin, inclusive: true }) : a.completion, members: kids.map((k) => k.index) });
      gradable.push(...kids.map((k) => ({ ...k, groupFloor: groups[groups.length - 1].criterion })));
    } else gradable.push(a);
  }
  for (const a of gradable) {
    let crit = a.groupFloor ? maxCrit(a.completion, a.groupFloor) : a.completion;
    // Owner rule: FE needs >= 4 even if the syllabus leaves the cell empty.
    if (a.type === 'final' && a.finalKind === 'FE' && !a.groupFloor) crit = maxCrit(crit, { value: feMin, inclusive: true });
    // Owner rule: every progress score must be > 0.
    if (a.type !== 'final' && !crit) crit = { value: 0, inclusive: false };
    const given = scores[a.index] || [];
    for (let p = 0; p < a.parts; p++) {
      const v = given[p];
      const own = a.groupFloor ? a.completion || { value: 0, inclusive: false } : crit;
      parts.push({ index: a.index, part: p + 1, label: a.parts > 1 ? `${a.category} #${p + 1}` : a.category, kind: a.type === 'final' ? a.finalKind : 'ongoing', weight: a.weightPerPart, criterion: crit, ownCriterion: own, score: Number.isFinite(v) ? v : null });
    }
  }

  // Sub-rows are checked against their own cell; the aggregate floor applies to the group average.
  for (const p of parts) if (p.score != null && !meets(p.score, p.ownCriterion)) issues.push(`${p.label}: ${p.score} does not meet ${p.ownCriterion.inclusive ? '>=' : '>'} ${p.ownCriterion.value}`);

  for (const g of groups) {
    const members = parts.filter((p) => g.members.includes(p.index));
    if (g.criterion && members.every((p) => p.score != null)) {
      const w = members.reduce((s, p) => s + p.weight, 0);
      const avg = members.reduce((s, p) => s + p.weight * p.score, 0) / w;
      if (!meets(avg, g.criterion)) issues.push(`${g.label}: average ${avg.toFixed(2)} does not meet ${g.criterion.inclusive ? '>=' : '>'} ${g.criterion.value}`);
    }
  }

  if (opts.attendance && opts.attendance.total) {
    const minPct = subject.attendance?.minPercent ?? rules.attendanceMinPercent;
    const maxAbsent = Math.floor(opts.attendance.total * (1 - minPct / 100) + EPS);
    const absent = opts.attendance.total - opts.attendance.attended;
    if (absent > maxAbsent) issues.push(`Attendance: ${absent} absences exceed the ${maxAbsent} allowed (${minPct}% of ${opts.attendance.total} slots).`);
    else warnings.push(`Attendance: ${maxAbsent - absent} more absences allowed.`);
  }
  if (subject.coursera?.required && !opts.courseraDone) warnings.push('Coursera courses must be completed before the final exam, otherwise the FE score is not validated.');

  // Mark bonus (Coursera MOOC completion on c subjects) is added to the weighted average,
  // capped at the scale: FR = min(10, average + bonus) (FLM notes, verified on FAP 2026-10-10).
  const bonus = opts.bonus ?? subject.bonus ?? 0;
  const known = parts.filter((p) => p.score != null).reduce((s, p) => s + p.weight * p.score, 0);
  const remaining = parts.filter((p) => p.score == null);
  const remainingWeight = remaining.reduce((s, p) => s + p.weight, 0);

  const tiers = rules.tiers.map((t) => {
    const target = t.minAverage;
    if (!remaining.length) {
      const final = Math.min(scale, known + bonus);
      return { tier: t.id, target, reachable: issues.length === 0 && final >= target - EPS, final: +final.toFixed(2), displayed: round1(final) };
    }
    // Water-filling: smallest uniform score x so that sum w * max(x, floor) reaches the target.
    const total = (x) => known + bonus + remaining.reduce((s, p) => s + p.weight * Math.max(x, floorOf(p.criterion)), 0);
    let lo = 0;
    let hi = scale;
    if (total(hi) < target - EPS) return { tier: t.id, target, reachable: false, reason: `needs more than ${scale} on every remaining component` };
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (total(mid) >= target - EPS) hi = mid; else lo = mid;
    }
    const x = Math.ceil(hi * 10 - EPS) / 10; // grades are given to 0.1
    return {
      tier: t.id,
      target,
      reachable: issues.length === 0,
      uniformScore: x,
      required: remaining.map((p) => ({ index: p.index, part: p.part, label: p.label, kind: p.kind, weight: p.weight, min: +Math.max(x, floorOf(p.criterion)).toFixed(1) })),
    };
  });

  return {
    code: subject.code,
    scored: true,
    current: { weightedSoFar: +known.toFixed(3), bonus, gradedWeight: +(1 - remainingWeight).toFixed(4), remainingWeight: +remainingWeight.toFixed(4) },
    failed: issues.length > 0,
    issues,
    warnings,
    tiers,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [listPath, code, scoresJson = '{}', att, coursera] = process.argv.slice(2);
  if (!listPath || !code) {
    console.error('usage: predict.mjs <subject-list.json> <CODE> [scores-json] [attended/total] [coursera-done]');
    process.exit(2);
  }
  const subject = JSON.parse(readFileSync(listPath, 'utf8')).subjects[code];
  if (!subject) {
    console.error(`unknown subject ${code}`);
    process.exit(1);
  }
  const [attended, total] = att ? att.split('/').map(Number) : [];
  console.log(JSON.stringify(predict(subject, JSON.parse(scoresJson), { attendance: att ? { attended, total } : undefined, courseraDone: coursera === 'true' }), null, 2));
}
