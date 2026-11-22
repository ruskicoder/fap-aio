// Attendance report reader (grades R16.4, R16.5; GRD-7.4): `/Report/Attendance` and its course partial.
// Sessions are read by the documented classes (pages.md, "Attendance report"): rows of
// `table.attendance-session-sheet`, status from `attendance-status--present|absent|pending|exempt`.
// Raw fallback: an unknown status keeps its text and counts as neither attended nor absent; when the table
// cannot be read, the counts come from the summary line (`Absent 0% (0/10 sessions), 0 sessions not taken.`,
// the same numbers in vi). The live selectors wait on gate G-SELECTORS (a live check is on the vet list).
import { LayoutChangedError } from '../../../content/fap/registry'
import { courseCodeOf } from './term-courses'
import { headerOf } from './marksheet'
import type { CourseRef, MarkSheetHeader, Term } from '../types'

export type AttendanceState = 'present' | 'absent' | 'pending' | 'exempt' | { raw: string }
const STATES = ['present', 'absent', 'pending', 'exempt'] as const

export interface AttendanceSession {
  index: number | null
  date: string
  slot: string
  room: string
  lecturer: string
  group: string
  status: AttendanceState
  comment: string
}

export interface AttendanceCounts {
  attended: number
  absent: number
  /** Not taken yet (`pending`). */
  notYet: number
  exempt: number
  /** Rows whose status could not be read. */
  unknown: number
  /** Every planned session, as FAP's summary counts them. */
  total: number
}

export interface AttendanceSheet {
  header: MarkSheetHeader | null
  sessions: AttendanceSession[]
  counts: AttendanceCounts
  /** True when the counts come from the summary line because the table could not be read. */
  fromSummary: boolean
  summaryText: string | null
}

export interface AttendancePage {
  terms: Term[]
  selectedTermId: string | null
  courses: CourseRef[]
  selectedCourseId: string | null
  /** The selected course's sessions, when the page shows them. */
  sheet: AttendanceSheet | null
}

const clean = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

function stateOf(td: Element | undefined): AttendanceState {
  const el = td?.querySelector('[class*="attendance-status--"]')
  const cls = [...(el?.classList ?? [])].find((c) => c.startsWith('attendance-status--'))?.slice('attendance-status--'.length)
  const known = STATES.find((s) => s === cls)
  return known ?? { raw: clean(el ?? td) }
}

export function countSessions(sessions: AttendanceSession[]): AttendanceCounts {
  const n = (s: (typeof STATES)[number]) => sessions.filter((x) => x.status === s).length
  const unknown = sessions.filter((x) => typeof x.status === 'object').length
  return { attended: n('present'), absent: n('absent'), notYet: n('pending'), exempt: n('exempt'), unknown, total: sessions.length }
}

/** `Absent 10% (2/20 sessions), 5 sessions not taken.`: the counts in any culture. */
export function summaryCounts(text: string): AttendanceCounts | null {
  const m = /(\d+(?:[.,]\d+)?)\s*%\s*\(\s*(\d+)\s*\/\s*(\d+)[^)]*\)\D*(\d+)?/.exec(text)
  if (!m) return null
  const absent = Number(m[2])
  const total = Number(m[3])
  const notYet = m[4] === undefined ? 0 : Number(m[4])
  return { attended: Math.max(0, total - absent - notYet), absent, notYet, exempt: 0, unknown: 0, total }
}

export function sheetOf(root: ParentNode): AttendanceSheet | null {
  const table = root.querySelector('table.attendance-session-sheet')
  const summaryEl = root.querySelector('.attendance-summary')
  const summaryText = summaryEl ? clean(summaryEl) : null
  if (!table) {
    const counts = summaryText ? summaryCounts(summaryText) : null
    return counts ? { header: headerOf(root), sessions: [], counts, fromSummary: true, summaryText } : null
  }
  const sessions: AttendanceSession[] = [...table.querySelectorAll('tbody tr')].flatMap((tr) => {
    const td = [...tr.querySelectorAll('td')]
    if (td.length < 7) return []
    const idx = Number(clean(td[0]))
    return [{
      index: Number.isFinite(idx) && clean(td[0]) !== '' ? idx : null,
      date: clean(td[1]), slot: clean(td[2]), room: clean(td[3]), lecturer: clean(td[4]), group: clean(td[5]),
      status: stateOf(td[6]), comment: clean(td[7]),
    }]
  })
  // A table whose rows all lost their status class falls back to the summary's numbers.
  const counts = countSessions(sessions)
  if (sessions.length && counts.unknown === sessions.length && summaryText) {
    const s = summaryCounts(summaryText)
    if (s) return { header: headerOf(root), sessions, counts: { ...s, unknown: counts.unknown }, fromSummary: true, summaryText }
  }
  return { header: headerOf(root), sessions, counts, fromSummary: false, summaryText }
}

export function parseAttendance(doc: Document): AttendancePage {
  const termSel = doc.querySelector('#attendance-report-term')
  const courseSel = doc.querySelector('#attendance-report-course')
  const sheet = sheetOf(doc)
  if (!termSel && !sheet) {
    if (doc.querySelector('.fap-empty-state, .fap-empty-card')) return { terms: [], selectedTermId: null, courses: [], selectedCourseId: null, sheet: null }
    throw new LayoutChangedError('no #attendance-report-term and no attendance sheet on /Report/Attendance')
  }
  let selectedTermId: string | null = null
  const terms = [...(termSel?.querySelectorAll('option') ?? [])].flatMap((o) => {
    const id = o.getAttribute('value') ?? ''
    if (!id) return []
    if (o.hasAttribute('selected')) selectedTermId = id
    return [{ id, name: clean(o), current: false }]
  })
  let selectedCourseId: string | null = null
  const courses: CourseRef[] = [...(courseSel?.querySelectorAll('option') ?? [])].flatMap((o) => {
    const id = o.getAttribute('value') ?? ''
    if (!id) return []
    if (o.hasAttribute('selected')) selectedCourseId = id
    const label = clean(o)
    return [{ id, termId: o.getAttribute('data-report-term-id') ?? selectedTermId ?? '', label, code: courseCodeOf(label) }]
  })
  return { terms, selectedTermId, courses, selectedCourseId, sheet }
}

/** The partial of one course: its sheet, or an empty sheet when FAP lists no session yet. */
export function parseAttendanceSheet(doc: Document): AttendanceSheet {
  const sheet = sheetOf(doc)
  if (sheet) return sheet
  if (doc.querySelector('.fap-empty-state, .fap-empty-card')) return { header: headerOf(doc), sessions: [], counts: countSessions([]), fromSummary: false, summaryText: null }
  throw new LayoutChangedError('no table.attendance-session-sheet or .attendance-summary in the /Report/Attendance partial')
}
