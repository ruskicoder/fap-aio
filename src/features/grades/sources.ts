// Grade sources (grades design, "Sources"; core R4.4).
import { register } from '../../content/fap/registry'
import { parseTranscript } from './parse/transcript'
import { parseTermCourses } from './parse/term-courses'
import { parseMarkSheet } from './parse/marksheet'
import type { MarkSheet, TermCourses, Transcript } from './types'
import { parseAttendance, parseAttendanceSheet, type AttendancePage, type AttendanceSheet } from './parse/attendance'

export const GRADES_TRANSCRIPT = 'grades.transcript'
export const GRADES_TERM_COURSES = 'grades.termCourses'
export const GRADES_MARK_SHEET = 'grades.markSheet'
/** `/Report/Attendance` with or without a term: the term and course lists (GRD-7.4). */
export const GRADES_ATTENDANCE_TERM = 'grades.attendanceTerm'
/** The attendance partial of one course (GRD-7.4). */
export const GRADES_ATTENDANCE = 'grades.attendance'

const SIX_HOURS = 6 * 60 * 60_000

export function registerGradeSources(): void {
  register<Transcript>({
    id: GRADES_TRANSCRIPT,
    route: () => '/Report/Transcript',
    partial: false,
    parse: (doc) => parseTranscript(doc),
    cacheTtlMs: SIX_HOURS,
  })
  register<TermCourses>({
    id: GRADES_TERM_COURSES,
    route: (p) => (p.termId ? `/Report/Grade?termId=${encodeURIComponent(p.termId)}` : '/Report/Grade'),
    partial: false,
    parse: (doc, p) => parseTermCourses(doc, !p.termId),
    cacheTtlMs: SIX_HOURS,
  })
  register<MarkSheet>({
    id: GRADES_MARK_SHEET,
    route: (p) => `/Report/Grade?termId=${encodeURIComponent(p.termId ?? '')}&courseId=${encodeURIComponent(p.courseId ?? '')}`,
    partial: true,
    parse: (doc) => parseMarkSheet(doc),
    cacheTtlMs: 30 * 60_000,
  })
  register<AttendancePage>({
    id: GRADES_ATTENDANCE_TERM,
    route: (p) => (p.termId ? `/Report/Attendance?termId=${encodeURIComponent(p.termId)}` : '/Report/Attendance'),
    partial: false,
    parse: (doc) => parseAttendance(doc),
    cacheTtlMs: SIX_HOURS,
  })
  register<AttendanceSheet>({
    id: GRADES_ATTENDANCE,
    route: (p) => `/Report/Attendance?termId=${encodeURIComponent(p.termId ?? '')}&courseId=${encodeURIComponent(p.courseId ?? '')}`,
    partial: true,
    parse: (doc) => parseAttendanceSheet(doc),
    cacheTtlMs: 30 * 60_000,
  })
}
