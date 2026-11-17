// Grade Today provider and inbox alerts (grades GRD-5.2; panel-ux R3.1, R6.1): courses that are failing
// or below their goal on Today, and an inbox alert for a newly failed criterion or a goal that is out
// of reach. Today reads cached pages only; its Refresh reads stale mark sheets one at a time.
import { peek } from '../../content/fap/registry'
import { TODAY_ORDER, registerTodayProvider, type TodayItem } from '../../content/panel/today/providers'
import { alerts } from '../../content/panel/inbox/store'
import type { Route } from '../../shared/panel-state'
import { TIERS } from './engine/predict'
import { cachedRows, loadCourses, onCourseResults, coursesState, type CourseRow } from './courses'
import { GRADES_TERM_COURSES } from './sources'

const TIER_LABELS = { pass: 'Pass', fair: 'Fair', good: 'Good', excellent: 'Excellent' } as const

const link = (r: CourseRow): Route => ({ tab: 'grades', sub: 'courses', params: { courseId: r.ref.id } })
const title = (r: CourseRow) => (r.ref.code ? `${r.ref.code} · ${r.name}` : r.name)

/** Below the goal: the goal tier is out of reach, or not reached on a complete sheet. */
export function belowGoal(r: CourseRow): boolean {
  const p = r.prediction
  if (!p || p.status === 'none' || p.status === 'unscored' || p.status === 'failed') return false
  const t = p.tiers.find((x) => x.tier === r.goal)
  return !!t && !t.reachable
}

export function riskItems(rows: CourseRow[]): TodayItem[] {
  const out: TodayItem[] = []
  for (const r of rows) {
    const p = r.prediction
    if (p?.status === 'failed') {
      out.push({ id: `grade-fail:${r.ref.id}`, title: title(r), detail: p.issues[0] ?? 'A pass criterion is not met.', tone: 'danger', when: 'failing', link: link(r) })
    } else if (belowGoal(r)) {
      out.push({ id: `grade-goal:${r.ref.id}`, title: title(r), detail: `${TIER_LABELS[r.goal]} (${TIERS[r.goal]}) is out of reach.`, tone: 'warning', when: 'below goal', link: link(r) })
    }
  }
  return out
}

/** One alert per failed criterion set and per goal that falls out of reach (deduplicated). */
export async function alertRows(rows: CourseRow[]): Promise<void> {
  for (const r of rows) {
    const p = r.prediction
    if (p?.status === 'failed') {
      await alerts.push({ kind: 'grade', title: `${r.ref.code ?? r.name} is failing`, detail: p.issues.join(' '), link: link(r), dedupeKey: `grade-fail:${r.ref.id}:${p.issues.join('|')}` })
    } else if (belowGoal(r)) {
      await alerts.push({ kind: 'grade', title: `${TIER_LABELS[r.goal]} is out of reach in ${r.ref.code ?? r.name}`, detail: 'Pick a lower goal for this course, or check the needed scores.', link: link(r), dedupeKey: `grade-goal:${r.ref.id}:${r.goal}` })
    }
  }
}

export function registerGradeToday(): void {
  registerTodayProvider({
    id: 'gradeRisk', order: TODAY_ORDER.gradeRisk, label: 'Courses at risk', attention: true,
    keys: ['settings', 'grades.settings', 'cache:grades.markSheet', 'cache:grades.termCourses'],
    items: async () => riskItems(await cachedRows()),
    refresh: async () => {
      await loadCourses()
      const e = coursesState().error
      return e ? { ok: false, text: e } : { ok: true }
    },
    syncedAt: async () => (await peek(GRADES_TERM_COURSES))?.fetchedAt ?? null,
  })
  if (!wired) {
    wired = true
    onCourseResults((rows) => void alertRows(rows))
  }
}
let wired = false
