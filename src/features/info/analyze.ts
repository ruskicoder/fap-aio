// Info analyzers (info R4.2, R4.3, R4.5, R5.2, R5.3; design "Analyzers"). Pure functions.
import type { Exam } from '../scheduler/types'
import { todayVn } from '../../shared/dates'

export type RiskLevel = 'safe' | 'warning' | 'last-chance' | 'failed'

export interface AttendanceRisk {
  /** Planned sessions: every row of the course's attendance table, not-yet sessions included. */
  total: number
  absent: number
  notYet: number
  minPercent: number
  allowed: number
  /** Absences still allowed; negative when the limit is exceeded. */
  left: number
  level: RiskLevel
}

const EPS = 1e-9

/**
 * allowed = floor(total × (1 − minPercent/100)) with the subject's FLM requirement (80% by default,
 * 100% where FLM says so); safe with 2 or more left, warning with 1, last chance with 0, failed below 0.
 */
export function attendanceRisk(a: { total: number; absent: number; notYet?: number }, flm: { attendance?: { minPercent: number } } | null): AttendanceRisk {
  const minPercent = flm?.attendance?.minPercent ?? 80
  const allowed = Math.floor(a.total * (1 - minPercent / 100) + EPS)
  const left = allowed - a.absent
  const level: RiskLevel = left < 0 ? 'failed' : left === 0 ? 'last-chance' : left === 1 ? 'warning' : 'safe'
  return { total: a.total, absent: a.absent, notYet: a.notYet ?? 0, minPercent, allowed, left, level }
}

/** The figures in the form the grades predictor takes (R4.5). */
export const predictorAttendance = (r: AttendanceRisk) => ({ attended: r.total - r.absent, total: r.total })

export interface CourseraWarning {
  courseId: string
  code: string
  feDate: string
  daysLeft: number
}

/**
 * A warning for each current course whose syllabus requires Coursera, whose Coursera item is not ticked,
 * and whose first final exam is synced and still ahead (R5.3), soonest first.
 */
export function courseraDue(
  courses: { courseId: string; code: string | null }[],
  exams: Exam[],
  rules: Record<string, { coursera: { required: boolean } } | null | undefined>,
  done: Record<string, boolean>,
  now = Date.now(),
): CourseraWarning[] {
  const today = todayVn(now)
  const out: CourseraWarning[] = []
  for (const c of courses) {
    if (!c.code || !rules[c.code]?.coursera.required || done[c.courseId] || done[c.code]) continue
    const fe = exams.filter((e) => e.code === c.code && e.type === 'FE' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (!fe) continue
    const daysLeft = Math.round((Date.parse(`${fe.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    out.push({ courseId: c.courseId, code: c.code, feDate: fe.date, daysLeft })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}
