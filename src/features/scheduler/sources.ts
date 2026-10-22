// Scheduler sources (core R4.4).
import { register } from '../../content/fap/registry'
import { parseWeek } from '../../content/fap/parse/timetable'
import { parseExams } from '../../content/fap/parse/exams'
import type { Exam, WeekResult } from './types'

export const TIMETABLE_WEEK = 'timetable.week'
export const EXAM_LIST = 'exam.list'

export function registerSchedulerSources(): void {
  register<WeekResult>({
    id: TIMETABLE_WEEK,
    route: (p) => `/WeeklyTimetable/WeekPartial?referenceDate=${encodeURIComponent(p.referenceDate ?? '')}`,
    partial: true,
    parse: (doc, p) => parseWeek(doc, p),
    cacheTtlMs: 10 * 60_000,
  })
  register<Exam[]>({
    id: EXAM_LIST,
    route: () => '/ExamSchedule',
    partial: false,
    parse: (doc) => parseExams(doc),
    cacheTtlMs: 30 * 60_000,
  })
}
