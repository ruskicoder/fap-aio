// Current-term course data for the Grades views (grades R8.1, R8.2, R7.3 to R7.6): the term course
// list, then each course's mark sheet one at a time through the core registry (cache first, so only stale
// sheets are read again), the rubric entry from the data service, the course model and the prediction.
// The state is kept in memory per tab, so a tab switch renders at once from it.
import { useSyncExternalStore } from 'react'
import { peek, read } from '../../content/fap/registry'
import { errorText } from '../../content/panel/errors'
import { dataClient } from '../../content/data-client'
import type { SubjectRule } from '../../shared/data/schemas'
import { courseModel, type CourseModel, type RulesLookup } from './engine/course-model'
import { predict, type Prediction, type TierId } from './engine/predict'
import { courseGoal, effectiveTarget, gpaGoal, maxAverage, type EffectiveTarget } from './engine/goals'
import { computeGpa, isExcluded } from './engine/gpa'
import { GRADES_MARK_SHEET, GRADES_TERM_COURSES, GRADES_TRANSCRIPT } from './sources'
import { readGradeSettings, type GradeSettings } from './settings'
import type { CourseRef, MarkSheet, TermCourses, Transcript } from './types'

export interface CourseRow {
  ref: CourseRef
  name: string
  rule: SubjectRule | null
  sheet: MarkSheet | null
  model: CourseModel | null
  prediction: Prediction | null
  goal: TierId
  target: EffectiveTarget | null
  error: string | null
}

export interface CoursesState {
  loading: boolean
  error: string | null
  term: string | null
  rows: CourseRow[]
  /** The term list was read at this time. */
  fetchedAt: number | null
}

let state: CoursesState = { loading: false, error: null, term: null, rows: [], fetchedAt: null }
const listeners = new Set<() => void>()
function set(next: Partial<CoursesState>): void {
  state = { ...state, ...next }
  for (const l of listeners) l()
}
export const coursesState = () => state
export function resetCourses(): void {
  state = { loading: false, error: null, term: null, rows: [], fetchedAt: null }
}
export function useCourses(): CoursesState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => state)
}

/** `Name (CODE) (Group)` to `Name`. */
export const courseName = (label: string) => label.replace(/\s*\([^()]*\)\s*\([^()]*\)\s*$/, '').trim() || label

/** Failed first, then in progress, passed, not scored and no prediction (R8.5). */
const RANK: Record<string, number> = { failed: 0, 'in-progress': 1, passed: 2, unscored: 3, none: 4 }
export const sortRows = (rows: CourseRow[]) =>
  [...rows].sort((a, b) => (RANK[a.prediction?.status ?? 'none']! - RANK[b.prediction?.status ?? 'none']!) || a.ref.label.localeCompare(b.ref.label))

function predictRow(ref: CourseRef, rule: SubjectRule | null, sheet: MarkSheet | null, s: GradeSettings, error: string | null): CourseRow {
  const model = sheet ? courseModel(rule, sheet.rows) : null
  const prediction = model ? predict(model.subject, model.scores, { moocDone: s.moocDone[ref.id] === true }) : null
  return { ref, name: courseName(ref.label), rule, sheet, model, prediction, goal: courseGoal(ref.id, s.courseGoals, s.defaultTier), target: null, error }
}

/**
 * GPA goal targets (R7.3 to R7.6): done credits and points from the cached transcript, the courses that
 * count toward GPA with their highest reachable average, and the higher of tier and derived target.
 */
export function withTargets(rows: CourseRow[], s: GradeSettings, transcript: Transcript | null): CourseRow[] {
  const derived: Record<string, number> = {}
  if (s.gpaGoal !== null && transcript) {
    const g = computeGpa({ rows: transcript.rows, nonGpa: s.nonGpa })
    const courses = rows.flatMap((r) => {
      const code = r.ref.code
      const credits = r.rule?.credits ?? 0
      const m = r.prediction ? maxAverage(r.prediction) : null
      if (!code || !credits || m === null || isExcluded(code, s.nonGpa) || r.prediction?.status === 'failed') return []
      return [{ id: r.ref.id, credits, maxAverage: m }]
    })
    const result = gpaGoal({ goal: s.gpaGoal, done: { credits: g.credits, points: (g.cumulative ?? 0) * g.credits }, courses })
    Object.assign(derived, result.targets)
  }
  return rows.map((r) => ({ ...r, target: r.prediction && r.prediction.status !== 'none' && r.prediction.status !== 'unscored' ? effectiveTarget(r.goal, derived[r.ref.id] ?? null) : null }))
}

/** Recomputes predictions and targets from what is loaded, after a settings change (R2.3). */
export async function recompute(): Promise<void> {
  const s = await readGradeSettings()
  const transcript = (await peek<Transcript>(GRADES_TRANSCRIPT))?.value ?? null
  set({ rows: sortRows(withTargets(state.rows.map((r) => predictRow(r.ref, r.rule, r.sheet, s, r.error)), s, transcript)) })
  notify(state.rows)
}

/** Rows from cached pages only, with no FAP request (for Today before Courses has run). */
export async function cachedRows(rules: RulesLookup = (codes) => dataClient().rules(codes)): Promise<CourseRow[]> {
  if (state.rows.length) return state.rows
  const tc = await peek<TermCourses>(GRADES_TERM_COURSES)
  if (!tc) return []
  const refs = tc.value.courses.filter((c) => !tc.value.selectedTermId || c.termId === tc.value.selectedTermId)
  const codes = [...new Set(refs.map((c) => c.code).filter((c): c is string => !!c))]
  const r = codes.length ? await rules(codes) : null
  const s = await readGradeSettings()
  const transcript = (await peek<Transcript>(GRADES_TRANSCRIPT))?.value ?? null
  const rows = await Promise.all(refs.map(async (ref) => {
    const sheet = (await peek<MarkSheet>(GRADES_MARK_SHEET, { termId: ref.termId, courseId: ref.id }))?.value ?? null
    return predictRow(ref, ref.code && r?.ok ? r.value.subjects[ref.code] ?? null : null, sheet, s, null)
  }))
  return sortRows(withTargets(rows, s, transcript))
}

// Alerts and Today listen for new course results (GRD-5.2).
const resultListeners = new Set<(rows: CourseRow[]) => void>()
export function onCourseResults(l: (rows: CourseRow[]) => void): () => void {
  resultListeners.add(l)
  return () => resultListeners.delete(l)
}
function notify(rows: CourseRow[]): void {
  for (const l of resultListeners) l(rows)
}

let running: Promise<void> | null = null

/** Loads the current term's courses; with `force`, every sheet is read again. One request at a time. */
export function loadCourses(opts: { force?: boolean; rules?: RulesLookup } = {}): Promise<void> {
  if (running) return running
  running = (async () => {
    set({ loading: true, error: null })
    const rules = opts.rules ?? ((codes: string[]) => dataClient().rules(codes))
    const tc = await read<TermCourses>(GRADES_TERM_COURSES, {}, { force: opts.force, priority: 'user' })
    if (!tc.ok) { set({ loading: false, error: errorText(tc.error) }); return }
    const term = tc.value.terms.find((t) => t.id === tc.value.selectedTermId)?.name ?? null
    const refs = tc.value.courses.filter((c) => !tc.value.selectedTermId || c.termId === tc.value.selectedTermId)
    const codes = [...new Set(refs.map((c) => c.code).filter((c): c is string => !!c))]
    const r = codes.length ? await rules(codes) : null
    const ruleOf = (code: string | null) => (code && r?.ok ? r.value.subjects[code] ?? null : null)
    const s = await readGradeSettings()
    const transcript = (await peek<Transcript>(GRADES_TRANSCRIPT))?.value ?? null
    let rows: CourseRow[] = refs.map((ref) => predictRow(ref, ruleOf(ref.code), state.rows.find((x) => x.ref.id === ref.id)?.sheet ?? null, s, null))
    set({ term, rows: sortRows(withTargets(rows, s, transcript)), fetchedAt: tc.fetchedAt })
    // One course at a time; fresh cached sheets cost no request (R8.2).
    for (const ref of refs) {
      const ms = await read<MarkSheet>(GRADES_MARK_SHEET, { termId: ref.termId, courseId: ref.id }, { force: opts.force, priority: 'user' })
      rows = rows.map((x) => (x.ref.id === ref.id ? predictRow(ref, ruleOf(ref.code), ms.ok ? ms.value : x.sheet, s, ms.ok ? null : errorText(ms.error)) : x))
      set({ rows: sortRows(withTargets(rows, s, transcript)) })
      if (!ms.ok && ['challenge', 'session-expired', 'feedback-required'].includes(ms.error.kind)) break
    }
    set({ loading: false })
    notify(state.rows)
  })().finally(() => { running = null })
  return running
}

/** The FLM syllabus page of a subject (info R2.3). */
export const flmLink = (sylId: number) => `https://flm.fpt.edu.vn/gui/role/student/SyllabusDetails?sylID=${sylId}`
