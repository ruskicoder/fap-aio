// What-if simulator and target planner (grades R9.1 to R9.4, R10.1 to R10.3). Pure: no DOM, no storage.
// The simulator never changes its inputs: it builds a copy of the transcript rows with the expected
// results and runs the GPA engine on that copy.
import type { TranscriptRow } from '../types'
import type { CourseModel, Scores } from './course-model'
import { predict, round1, type PredictOptions, type RequiredScore } from './predict'
import { computeGpa, isExcluded } from './gpa'

export const PASS_MARK = 5

/** An expected result for an in-progress course: the average, and whether a criterion still fails it. */
export interface Expected { average: number; failed: boolean }
export interface Hypothetical { credits: number; average: number }

export interface SimulationInput {
  rows: TranscriptRow[]
  nonGpa: readonly string[]
  /** Keyed by transcript row id; a course without an entry stays in progress. */
  expected: Record<string, Expected | undefined>
  hypothetical: Hypothetical[]
}

export interface Simulation {
  term: { name: string | null; gpa: number | null; credits: number }
  cumulative: { gpa: number | null; credits: number }
  /** Ids of in-progress rows whose expected result would fail, so they do not count. */
  failing: string[]
}

/** The in-progress courses that can count toward GPA, in transcript order. */
export function simulatable(rows: TranscriptRow[], nonGpa: readonly string[]): TranscriptRow[] {
  return rows.filter((r) => r.status === 'in-progress' && r.credits > 0 && !isExcluded(r.code, nonGpa))
}

/** The term the in-progress courses belong to: the latest one when they span several. */
function currentTerm(rows: TranscriptRow[]): string | null {
  const names = [...new Set(rows.filter((r) => r.status === 'in-progress').map((r) => r.semester))]
  if (!names.length) return null
  const gpa = computeGpa({ rows, nonGpa: [] })
  return gpa.semesters.map((s) => s.name).filter((n) => names.includes(n)).pop() ?? names[names.length - 1]!
}

export const HYPOTHETICAL_SEMESTER = 'What-if future courses'

export function simulate({ rows, nonGpa, expected, hypothetical }: SimulationInput): Simulation {
  const failing: string[] = []
  const copy: TranscriptRow[] = rows.map((r) => {
    const e = expected[r.id]
    if (r.status !== 'in-progress' || !e) return r
    const grade = round1(Math.min(10, Math.max(0, e.average)))
    const passed = !e.failed && grade >= PASS_MARK
    if (!passed) failing.push(r.id)
    return { ...r, grade, status: passed ? 'passed' : 'not-passed' }
  })
  hypothetical.forEach((h, i) => {
    if (!(h.credits > 0)) return
    const grade = round1(Math.min(10, Math.max(0, h.average)))
    copy.push({
      id: `${HYPOTHETICAL_SEMESTER}|${i}`, term: null, semester: HYPOTHETICAL_SEMESTER, code: `WHATIF${i + 1}`, name: '', prerequisites: null, replaced: null,
      credits: h.credits, grade, status: grade >= PASS_MARK ? 'passed' : 'not-passed',
    })
  })
  const g = computeGpa({ rows: copy, nonGpa })
  const name = currentTerm(rows)
  const sem = g.semesters.find((s) => s.name === name)
  return { term: { name, gpa: sem?.gpa ?? null, credits: sem?.credits ?? 0 }, cumulative: { gpa: g.cumulative, credits: g.credits }, failing }
}

/** The remaining components of a course, as the predictor lists them; empty when none can be entered. */
export function remainingParts(model: CourseModel, opts: PredictOptions = {}): RequiredScore[] {
  const p = predict(model.subject, model.scores, opts)
  if (p.status !== 'in-progress') return []
  for (const t of p.tiers) if ('required' in t) return t.required
  return []
}

export const partKey = (index: number, part: number) => `${index}:${part}`

/**
 * The course average once the given marks fill the remaining components (R9.1), or null while one is
 * still empty. `failed` is set when a criterion (an FE under 4, a component floor) fails the course.
 */
export function averageWithMarks(model: CourseModel, marks: Record<string, number | undefined>, opts: PredictOptions = {}): Expected | null {
  const parts = remainingParts(model, opts)
  if (!parts.length || parts.some((r) => marks[partKey(r.index, r.part)] === undefined)) return null
  const scores: Scores = Object.fromEntries(Object.entries(model.scores).map(([k, v]) => [k, [...v]]))
  for (const r of parts) {
    // The predictor numbers parts from 1.
    const list = (scores[r.index] ??= [])
    while (list.length < r.part) list.push(null)
    list[r.part - 1] = marks[partKey(r.index, r.part)]!
  }
  const p = predict(model.subject, scores, opts)
  if (p.status !== 'passed' && p.status !== 'failed') return null
  const t = p.tiers[0]
  const average = t && 'displayed' in t ? t.displayed : round1(Math.min(10, p.current.weightedSoFar + p.current.bonus))
  return { average, failed: p.status === 'failed' }
}

export interface PlanInput {
  target: number
  done: { credits: number; points: number }
  remaining: number
  scale?: number
}

export interface Plan {
  /** The average needed over the remaining credits; null without remaining credits. */
  needed: number | null
  reachable: boolean
  /** The cumulative GPA with the scale on every remaining credit (R10.3). */
  highest: number | null
}

/** Needed average `(T·(D + R) − P) / R`; unreachable above the scale (R10.1, R10.3). */
export function planTarget({ target, done, remaining, scale = 10 }: PlanInput): Plan {
  const total = done.credits + remaining
  const highest = total > 0 ? (done.points + scale * remaining) / total : null
  if (!(remaining > 0)) {
    const now = done.credits > 0 ? done.points / done.credits : null
    return { needed: null, reachable: now !== null && now >= target - 1e-9, highest }
  }
  const needed = (target * total - done.points) / remaining
  return { needed, reachable: needed <= scale + 1e-9, highest }
}

/** Remaining credits by default: curriculum subjects not passed or exempt, minus the non-GPA list (R10.2). */
export function defaultRemaining(
  curriculum: { code: string; credits: number | null }[],
  rows: TranscriptRow[],
  nonGpa: readonly string[],
): { credits: number; unknown: string[] } {
  const done = new Set(rows.filter((r) => r.status === 'passed' || r.status === 'exempt').map((r) => r.code.toUpperCase()))
  const creditsOf = new Map(rows.filter((r) => r.credits > 0).map((r) => [r.code.toUpperCase(), r.credits]))
  let credits = 0
  const unknown: string[] = []
  for (const c of curriculum) {
    const code = c.code.toUpperCase()
    if (done.has(code) || isExcluded(c.code, nonGpa)) continue
    const n = c.credits ?? creditsOf.get(code) ?? null
    if (n === null) unknown.push(c.code)
    else credits += n
  }
  return { credits, unknown }
}
