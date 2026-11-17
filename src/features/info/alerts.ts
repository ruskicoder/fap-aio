// Info alerts (info R4.4, R7.7, R9.1 to R9.3): attendance level changes, important P1 news and Coursera
// before the FE, pushed to the inbox with the dedupe key `${kind}|${itemId}|${level}`. Clicks open the panel
// on the related section. Attendance and news wait for their sources (INF-1.2, gate G-SELECTORS); the
// Coursera check runs now from the term courses, the synced exams and the rubric.
import { peek } from '../../content/fap/registry'
import { alerts } from '../../content/panel/inbox/store'
import { dataClient } from '../../content/data-client'
import { read, subscribe } from '../../shared/storage/catalog'
import { todayVn } from '../../shared/dates'
import type { Route } from '../../shared/panel-state'
import { GRADES_TERM_COURSES } from '../grades/sources'
import type { TermCourses } from '../grades/types'
import { courseraDue, type AttendanceRisk, type CourseraWarning } from './analyze'
import { readInfoUser } from './lecturers'
import type { NewsClass } from './news'

export const dedupeKey = (kind: string, itemId: string, level: string) => `${kind}|${itemId}|${level}`
const LEVEL_TEXT = { warning: 'one absence left', 'last-chance': 'no absence left', failed: 'over the absence limit' } as const

/** One alert per course and level once it is warning or worse (R4.4). */
export async function alertAttendance(courses: { courseId: string; code: string; risk: AttendanceRisk }[], link: Route = { tab: 'schedule', sub: 'week' }): Promise<number> {
  let n = 0
  for (const c of courses) {
    if (c.risk.level === 'safe') continue
    const added = await alerts.push({
      kind: 'attendance', title: `${c.code}: ${LEVEL_TEXT[c.risk.level]}`,
      detail: `${c.risk.absent} absences of ${c.risk.allowed} allowed (${c.risk.minPercent}% attendance needed).`,
      link, dedupeKey: dedupeKey('attendance', c.courseId, c.risk.level),
    })
    if (added) n++
  }
  return n
}

export interface NewsItemRef { id: string; title: string; createdAt: string }

/**
 * P1 news alerts (R7.7, news convention step 4): P1 after personalization and one of a deadline within
 * 14 days, exam eligibility, the student's own subject code, or posted within the last 3 days. Hidden
 * (staff-only) items never alert.
 */
export function newsWorthAlert(item: NewsItemRef, c: NewsClass, now = Date.now()): boolean {
  if (c.hidden || c.priority !== 'P1') return false
  const today = Date.parse(`${todayVn(now)}T00:00:00Z`)
  const days = (iso: string) => (Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - today) / 86_400_000
  return (c.deadline !== null && days(c.deadline) >= 0 && days(c.deadline) <= 14)
    || c.families.includes('exam-eligibility')
    || c.personal.some((p) => p.startsWith('subject:'))
    || (days(item.createdAt) >= -3 && days(item.createdAt) <= 0)
}

export async function alertNews(items: { item: NewsItemRef; cls: NewsClass }[], now = Date.now()): Promise<number> {
  let n = 0
  for (const { item, cls } of items) {
    if (!newsWorthAlert(item, cls, now)) continue
    const added = await alerts.push({
      kind: 'news', title: item.title, detail: cls.deadline ? `Deadline ${cls.deadline}.` : undefined,
      link: { tab: 'info', sub: 'news', params: { id: item.id } }, dedupeKey: dedupeKey('news', item.id, cls.priority),
    })
    if (added) n++
  }
  return n
}

export async function alertCoursera(warnings: CourseraWarning[]): Promise<number> {
  let n = 0
  for (const w of warnings) {
    const added = await alerts.push({
      kind: 'coursera', title: `Finish the Coursera courses for ${w.code} before the final exam`,
      detail: `The final exam is on ${w.feDate}, in ${w.daysLeft} ${w.daysLeft === 1 ? 'day' : 'days'}. A late completion invalidates the exam score.`,
      link: { tab: 'schedule', sub: 'exams' }, dedupeKey: dedupeKey('coursera', w.courseId, w.feDate),
    })
    if (added) n++
  }
  return n
}

/** Coursera check from cached pages only: no FAP request. */
export async function checkCoursera(now = Date.now()): Promise<number> {
  const tc = await peek<TermCourses>(GRADES_TERM_COURSES)
  const exams = (await read('exams'))?.exams ?? []
  if (!tc || !exams.length) return 0
  const courses = tc.value.courses.map((c) => ({ courseId: c.id, code: c.code }))
  const codes = [...new Set(courses.map((c) => c.code).filter((c): c is string => !!c))]
  const r = codes.length ? await dataClient().rules(codes) : null
  const rules = r?.ok ? r.value.subjects : {}
  const done = (await readInfoUser()).courseraDone
  return alertCoursera(courseraDue(courses, exams, rules, done, now))
}

let wired = false
/** Runs the Coursera check now and whenever exams or the term courses change. */
export function wireInfoAlerts(): void {
  if (wired) return
  wired = true
  const run = () => void checkCoursera().catch(() => 0)
  run()
  subscribe('exams', run)
  subscribe(`cache:${GRADES_TERM_COURSES}`, run)
}
