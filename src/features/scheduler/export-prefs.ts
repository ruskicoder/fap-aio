// Export date ranges and selection (core R9.3 to R9.5): which classes and exams the agreed Export form
// writes. Pure; the options themselves are in export-options.ts.
import { addDays, mondayOf, parseIso } from '../../shared/dates'
import { termOf, termRange } from './sync'
import type { Exam, Session } from './types'
import type { ExportPrefs } from './export-options'

export * from './export-options'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** `01 Sep 2026` from yyyy-mm-dd. */
export const longDate = (d: string) => `${d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`

/** The current term's name, e.g. `Fall 2026`. */
export function termName(today: string): string {
  const { term, year } = termOf(today)
  return `${term[0]!.toUpperCase()}${term.slice(1)} ${year}`
}

/** First and last day of the range, both included. A custom range missing a bound uses today. */
export function rangeBounds(p: Pick<ExportPrefs, 'range' | 'from' | 'to'>, today: string): [string, string] {
  switch (p.range) {
    case 'week': { const m = mondayOf(today); return [m, addDays(m, 6)] }
    case 'next2': return [today, addDays(today, 13)]
    case 'month': {
      const first = `${today.slice(0, 7)}-01`
      const next = parseIso(first)
      next.setUTCMonth(next.getUTCMonth() + 1)
      return [first, addDays(next.toISOString().slice(0, 10), -1)]
    }
    case 'term': { const { term, year } = termOf(today); return termRange(term, year) }
    case 'custom': {
      const a = p.from ?? today
      const b = p.to ?? today
      return a <= b ? [a, b] : [b, a]
    }
  }
}

const byTime = <T extends { date: string; start: string }>(a: T, b: T) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)

/** Subject codes of the classes in the range and mode, before the subject filter (R9.4). */
export function subjectsInRange(sessions: Session[], p: ExportPrefs, today: string): string[] {
  const [a, b] = rangeBounds(p, today)
  const codes = sessions.filter((s) => s.date >= a && s.date <= b && (p.classMode === 'all' || (p.classMode === 'online') === s.online)).map((s) => s.code)
  return [...new Set(codes)].sort()
}

/** Classes and exams the export writes, in date and time order (R9.2 to R9.5). */
export function selectForExport(sessions: Session[], exams: Exam[], p: ExportPrefs, today: string): { classes: Session[]; exams: Exam[] } {
  const [a, b] = rangeBounds(p, today)
  const inRange = (d: string) => d >= a && d <= b
  const excluded = new Set(p.excludedSubjects)
  return {
    classes: p.classes
      ? sessions.filter((s) => inRange(s.date) && (p.classMode === 'all' || (p.classMode === 'online') === s.online) && !excluded.has(s.code)).sort(byTime)
      : [],
    exams: p.exams
      ? exams.filter((e) => inRange(e.date) && p.examTypes.includes(e.type) && (p.examNoRoom || e.room) && (p.examPast || e.date >= today)).sort(byTime)
      : [],
  }
}

/** Subject names by code, from the synced exam list (R9.6). */
export function subjectNames(exams: Exam[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const e of exams) if (e.name && !m.has(e.code)) m.set(e.code, e.name)
  return m
}
