// Predictor (grades R5.1 to R5.8): a TypeScript port of `predict` in tools/flm-scraper/predict.mjs,
// validated against FAP on 2026-10-10. Pure. Rules: docs/10-context/constraints.md.
// - final = min(scale, Σ w·score + bonus); displayed = round1(final), half up. Pass and tier checks on a
//   complete sheet use `displayed`, so 4.95 passes and 4.94 fails (R5.1).
// - Criteria: the FLM value, an FE never below 4, progress rows above 0, a group criterion on the weighted
//   average of its children (R5.2, R4.3). Pass mark: minAvgMarkToPass or 5 (R5.3).
// - Remaining components: the smallest uniform score x on a 0.1 grid, each at least its own floor, with
//   known + bonus + Σ w·max(x, floor) at least the tier, as the reference computes it (R5.4).
import type { Criterion, ModelSubject, Scores } from './course-model'

export type TierId = 'pass' | 'fair' | 'good' | 'excellent'
export const TIERS: Record<TierId, number> = { pass: 5, fair: 7, good: 8, excellent: 9 }

const EPS = 1e-9
/** FAP shows the course average with one decimal, half up (8.45 shows as 8.5). */
export const round1 = (x: number) => Math.round(x * 10 + EPS) / 10
const meets = (score: number, c: Criterion | null | undefined) => !c || (c.inclusive ? score >= c.value - EPS : score > c.value + EPS)
/** The stricter of two criteria. */
const maxCrit = (a: Criterion | null | undefined, b: Criterion | null | undefined): Criterion | null =>
  (!a ? b ?? null : !b ? a : a.value > b.value || (a.value === b.value && a.inclusive === false) ? a : b)
/** Smallest score on a 0.1 grid that satisfies a criterion. */
export const floorOf = (c: Criterion | null | undefined) => (!c ? 0 : c.inclusive ? c.value : +(c.value + 0.1).toFixed(1))

export interface PredictOptions {
  attendance?: { attended: number; total: number }
  courseraDone?: boolean
  /** The user marked this course's MOOCs as completed on time (R5.8). */
  moocDone?: boolean
  /** Overrides the sheet's bonus. */
  bonus?: number
  rules?: { tiers: { id: TierId; minAverage: number }[]; finalExamMin: number; attendanceMinPercent: number }
}

export interface RequiredScore { index: number; part: number; label: string; kind: string; weight: number; min: number }

export type TierResult =
  | { tier: TierId; target: number; reachable: boolean; final: number; displayed: number }
  | { tier: TierId; target: number; reachable: boolean; uniformScore: number; required: RequiredScore[] }
  | { tier: TierId; target: number; reachable: false; reason: string }

export type PredictionStatus = 'failed' | 'passed' | 'in-progress' | 'unscored' | 'none'

export type Prediction =
  | { status: 'none'; scored: null; note: string }
  | { status: 'unscored'; scored: false; note: string }
  | {
      status: 'failed' | 'passed' | 'in-progress'
      code: string | null
      scored: true
      current: { weightedSoFar: number; bonus: number; assumedBonus: boolean; gradedWeight: number; remainingWeight: number }
      failed: boolean
      issues: string[]
      warnings: string[]
      tiers: TierResult[]
    }

interface Part { index: number; part: number; label: string; kind: string; weight: number; criterion: Criterion | null; ownCriterion: Criterion; score: number | null }

export function predict(subject: ModelSubject | null, scores: Scores = {}, opts: PredictOptions = {}): Prediction {
  if (!subject) return { status: 'none', scored: null, note: 'No FLM syllabus and no graded items.' }
  if (!subject.scored) return { status: 'unscored', scored: false, note: 'Subject is not scored (pass/fail by completion).' }
  const passMark = subject.minAvgMarkToPass ?? 5
  const rules = opts.rules ?? {
    tiers: [{ id: 'pass', minAverage: passMark }, { id: 'fair', minAverage: TIERS.fair }, { id: 'good', minAverage: TIERS.good }, { id: 'excellent', minAverage: TIERS.excellent }],
    finalExamMin: 4,
    attendanceMinPercent: 80,
  }
  const scale = subject.scoringScale || 10
  const issues: string[] = []
  const warnings: string[] = []

  // Expand assessments into gradable parts. An aggregate row with sub-rows (parentIndex) is graded
  // through its sub-rows; its own criterion becomes a group constraint.
  const parts: Part[] = []
  const groups: { label: string; index: number; criterion: Criterion | null; members: number[] }[] = []
  const childrenOf = (i: number) => subject.assessments.filter((x) => x.parentIndex === i)
  const gradable: (ModelSubject['assessments'][number] & { groupFloor?: Criterion | null })[] = []
  for (const a of subject.assessments.filter((x) => x.parentIndex == null && x.weight)) {
    const kids = childrenOf(a.index)
    if (kids.length) {
      const criterion = a.type === 'final' && a.finalKind === 'FE' ? maxCrit(a.completion, { value: rules.finalExamMin, inclusive: true }) : a.completion
      groups.push({ label: a.category, index: a.index, criterion, members: kids.map((k) => k.index) })
      gradable.push(...kids.map((k) => ({ ...k, groupFloor: criterion })))
    } else gradable.push(a)
  }
  for (const a of gradable) {
    let crit = a.groupFloor ? maxCrit(a.completion, a.groupFloor) : a.completion
    // Owner rule: an FE needs at least 4 even if the syllabus leaves the cell empty or lower.
    if (a.type === 'final' && a.finalKind === 'FE' && !a.groupFloor) crit = maxCrit(crit, { value: rules.finalExamMin, inclusive: true })
    // Owner rule: every progress score must be above 0.
    if (a.type !== 'final' && !crit) crit = { value: 0, inclusive: false }
    const given = scores[a.index] ?? []
    for (let p = 0; p < a.parts; p++) {
      const v = given[p]
      const own = a.groupFloor ? a.completion || { value: 0, inclusive: false } : crit ?? { value: 0, inclusive: false }
      parts.push({
        index: a.index, part: p + 1, label: a.parts > 1 ? `${a.category} #${p + 1}` : a.category,
        kind: a.type === 'final' ? a.finalKind ?? 'final' : 'ongoing', weight: a.weightPerPart, criterion: crit, ownCriterion: own,
        score: typeof v === 'number' && Number.isFinite(v) ? v : null,
      })
    }
  }

  // Sub-rows are checked against their own cell; the aggregate floor applies to the group average.
  for (const p of parts) if (p.score != null && !meets(p.score, p.ownCriterion)) issues.push(`${p.label}: ${p.score} does not meet ${p.ownCriterion.inclusive ? '>=' : '>'} ${p.ownCriterion.value}`)
  for (const g of groups) {
    const members = parts.filter((p) => g.members.includes(p.index))
    if (g.criterion && members.every((p) => p.score != null)) {
      const w = members.reduce((s, p) => s + p.weight, 0)
      const avg = members.reduce((s, p) => s + p.weight * p.score!, 0) / w
      if (!meets(avg, g.criterion)) issues.push(`${g.label}: average ${avg.toFixed(2)} does not meet ${g.criterion.inclusive ? '>=' : '>'} ${g.criterion.value}`)
    }
  }

  // Attendance (R5.6): maxAbsent = floor(total × (1 − minPercent/100)).
  if (opts.attendance && opts.attendance.total) {
    const minPct = subject.attendance?.minPercent ?? rules.attendanceMinPercent
    const maxAbsent = Math.floor(opts.attendance.total * (1 - minPct / 100) + EPS)
    const absent = opts.attendance.total - opts.attendance.attended
    if (absent > maxAbsent) issues.push(`Attendance: ${absent} absences exceed the ${maxAbsent} allowed (${minPct}% of ${opts.attendance.total} slots).`)
    else warnings.push(`Attendance: ${maxAbsent - absent} more absences allowed.`)
  }
  if (subject.coursera?.required && !opts.courseraDone) warnings.push('Coursera courses must be completed before the final exam, otherwise the FE score is not validated.')

  // Mark bonus: FR = min(10, average + bonus). A MOOC bonus of 1 is assumed before FAP shows it (R5.8).
  const sheetBonus = opts.bonus ?? subject.bonus ?? 0
  const assumedBonus = opts.bonus === undefined && !!opts.moocDone && !!subject.coursera?.bonus && sheetBonus === 0
  const bonus = assumedBonus ? 1 : sheetBonus
  const known = parts.filter((p) => p.score != null).reduce((s, p) => s + p.weight * p.score!, 0)
  const remaining = parts.filter((p) => p.score == null)
  const remainingWeight = remaining.reduce((s, p) => s + p.weight, 0)

  const tiers: TierResult[] = rules.tiers.map((t) => {
    const target = t.minAverage
    if (!remaining.length) {
      const final = Math.min(scale, known + bonus)
      const displayed = round1(final)
      return { tier: t.id, target, reachable: issues.length === 0 && displayed >= target - EPS, final: +final.toFixed(2), displayed }
    }
    // Water-filling: smallest uniform score x so that Σ w·max(x, floor) reaches the target.
    const total = (x: number) => known + bonus + remaining.reduce((s, p) => s + p.weight * Math.max(x, floorOf(p.criterion)), 0)
    let lo = 0
    let hi = scale
    if (total(hi) < target - EPS) return { tier: t.id, target, reachable: false, reason: `needs more than ${scale} on every remaining component` }
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (total(mid) >= target - EPS) hi = mid
      else lo = mid
    }
    // Grades are given to 0.1; `|| 0` turns a -0 from ceil into 0.
    const x = Math.ceil(hi * 10 - EPS) / 10 || 0
    return {
      tier: t.id, target, reachable: issues.length === 0, uniformScore: x,
      required: remaining.map((p) => ({ index: p.index, part: p.part, label: p.label, kind: p.kind, weight: p.weight, min: +Math.max(x, floorOf(p.criterion)).toFixed(1) })),
    }
  })

  const failed = issues.length > 0
  const passTier = tiers[0]
  const status: Prediction['status'] = failed
    ? 'failed'
    : remaining.length
      ? 'in-progress'
      : passTier && 'displayed' in passTier && passTier.reachable ? 'passed' : 'failed'
  return {
    status,
    code: subject.code,
    scored: true,
    current: { weightedSoFar: +known.toFixed(3), bonus, assumedBonus, gradedWeight: +(1 - remainingWeight).toFixed(4), remainingWeight: +remainingWeight.toFixed(4) },
    failed,
    issues,
    warnings,
    tiers,
  }
}

/** The highest tier a complete sheet reaches, or null (R5.5). */
export function highestTier(p: Prediction): TierId | null {
  if (p.status === 'none' || p.status === 'unscored') return null
  let best: TierId | null = null
  for (const t of p.tiers) if ('displayed' in t && t.reachable) best = t.tier
  return best
}
