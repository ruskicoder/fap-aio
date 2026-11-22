// Attendance in Grades (grades R16, GRD-7.4): per course of a term, sessions attended, absent, not yet and
// exempt, and the absence percentage against the limit (20 % by default, from the 80 % attendance rule;
// the FLM value where the syllabus states one), coloured by the attendance risk levels of INF-2.1. Reads go
// through the registry (paced queue, request budget, GET only), one course at a time, cache first.
import { useSyncExternalStore } from 'react'
import { peek, read } from '../../content/fap/registry'
import { errorText } from '../../content/panel/errors'
import { dataClient } from '../../content/data-client'
import type { SubjectRule } from '../../shared/data/schemas'
import { attendanceRisk, type AttendanceRisk, type RiskLevel } from '../info/analyze'
import { GRADES_ATTENDANCE, GRADES_ATTENDANCE_TERM } from './sources'
import { labelName } from './record-model'
import { BOM, csvCell } from './export'
import type { AttendanceCounts, AttendancePage, AttendanceSheet } from './parse/attendance'
import type { CourseRef, Term } from './types'

export interface AbsenceInfo {
  /** Absent sessions over every planned session, in percent, as FAP's summary computes it. */
  percent: number
  /** The allowed absence in percent (100 minus the attendance requirement). */
  limit: number
  risk: AttendanceRisk
}

export function absenceInfo(counts: AttendanceCounts | null | undefined, minPercent: number | null | undefined): AbsenceInfo | null {
  if (!counts || counts.total <= 0) return null
  const risk = attendanceRisk({ total: counts.total, absent: counts.absent, notYet: counts.notYet }, minPercent === null || minPercent === undefined ? null : { attendance: { minPercent } })
  return { percent: (counts.absent / counts.total) * 100, limit: 100 - risk.minPercent, risk }
}

/** `12.5`, `10`: one decimal at most. */
export const pct = (n: number) => String(Math.round(n * 10) / 10)

export const RISK_STYLE: Record<RiskLevel, string> = {
  safe: 'bg-green-50 text-green-800',
  warning: 'bg-amber-50 text-amber-900',
  'last-chance': 'bg-orange-100 text-orange-900',
  failed: 'bg-red-50 text-red-800',
}
export const RISK_TEXT: Record<RiskLevel, string> = { safe: 'Safe', warning: 'Warning', 'last-chance': 'Last chance', failed: 'Over the limit' }

/** "2 absences left", "No absence left", "1 absence over the limit". */
export function leftText(r: AttendanceRisk): string {
  if (r.left > 0) return `${r.left} ${r.left === 1 ? 'absence' : 'absences'} left`
  if (r.left === 0) return 'No absence left'
  return `${-r.left} ${r.left === -1 ? 'absence' : 'absences'} over the limit`
}

// ---- per-course attendance, shared by the Attendance view and the Courses cards ------------------

export interface AttendanceEntry { sheet: AttendanceSheet | null; fetchedAt: number | null; error: string | null }

let entries = new Map<string, AttendanceEntry>()
let version = 0
const entryListeners = new Set<() => void>()
function setEntry(id: string, e: AttendanceEntry): void {
  entries = new Map(entries).set(id, e)
  version++
  for (const l of entryListeners) l()
}
export const attendanceEntry = (courseId: string) => entries.get(courseId) ?? null
/** Re-renders when any course's attendance changes. */
export function useAttendanceEntries(): Map<string, AttendanceEntry> {
  useSyncExternalStore((l) => { entryListeners.add(l); return () => entryListeners.delete(l) }, () => version)
  return entries
}

const FATAL = new Set(['challenge', 'session-expired', 'feedback-required', 'forbidden'])

/** Reads each course's attendance partial, one at a time, cache first (R16.4). Stops on an error that stops reads. */
export async function readAttendance(refs: CourseRef[], opts: { force?: boolean } = {}): Promise<string | null> {
  for (const ref of refs) {
    const c = await peek<AttendanceSheet>(GRADES_ATTENDANCE, { termId: ref.termId, courseId: ref.id })
    if (c && !entries.has(ref.id)) setEntry(ref.id, { sheet: c.value, fetchedAt: c.fetchedAt, error: null })
  }
  for (const ref of refs) {
    const r = await read<AttendanceSheet>(GRADES_ATTENDANCE, { termId: ref.termId, courseId: ref.id }, { force: opts.force, priority: 'user' })
    if (r.ok) setEntry(ref.id, { sheet: r.value, fetchedAt: r.fetchedAt, error: null })
    else {
      setEntry(ref.id, { ...(entries.get(ref.id) ?? { sheet: null, fetchedAt: null }), error: errorText(r.error) })
      if (FATAL.has(r.error.kind)) return errorText(r.error)
    }
  }
  return null
}

// ---- the Attendance view's term ------------------------------------------------------------------

export interface AttendanceState {
  loading: boolean
  error: string | null
  terms: Term[]
  termId: string | null
  courses: CourseRef[]
  rules: Record<string, SubjectRule | null>
  fetchedAt: number | null
}

const EMPTY: AttendanceState = { loading: false, error: null, terms: [], termId: null, courses: [], rules: {}, fetchedAt: null }
let state: AttendanceState = EMPTY
const listeners = new Set<() => void>()
function set(next: Partial<AttendanceState>): void {
  state = { ...state, ...next }
  for (const l of listeners) l()
}
export const attendanceState = () => state
export function resetAttendance(): void { state = EMPTY; entries = new Map(); version++ }
export function useAttendance(): AttendanceState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => state)
}

type Rules = (codes: string[]) => Promise<{ ok: true; value: { subjects: Record<string, SubjectRule | null> } } | { ok: false }>

let running: Promise<void> | null = null
/** The term's course list, then each course one at a time (R16.1, R16.3). Without a term: FAP's current term. */
export function loadAttendance(opts: { termId?: string | null; force?: boolean; rules?: Rules } = {}): Promise<void> {
  if (running) return running
  running = (async () => {
    set({ loading: true, error: null })
    const p = await read<AttendancePage>(GRADES_ATTENDANCE_TERM, opts.termId ? { termId: opts.termId } : {}, { force: opts.force, priority: 'user' })
    if (!p.ok) { set({ loading: false, error: errorText(p.error) }); return }
    const termId = opts.termId ?? p.value.selectedTermId
    const courses = p.value.courses.filter((c) => !termId || !c.termId || c.termId === termId).map((c) => ({ ...c, termId: c.termId || termId || '' }))
    set({ terms: p.value.terms.length ? p.value.terms : state.terms, termId, courses, fetchedAt: p.fetchedAt })
    const codes = [...new Set(courses.map((c) => c.code).filter((c): c is string => !!c))]
    const rules = opts.rules ?? ((cs: string[]) => dataClient().rules(cs))
    const r = codes.length ? await rules(codes).catch(() => ({ ok: false as const })) : null
    if (r?.ok) set({ rules: { ...state.rules, ...r.value.subjects } })
    const error = await readAttendance(courses, { force: opts.force })
    set({ loading: false, error })
  })()
    .catch((e: unknown) => set({ loading: false, error: `Attendance could not be read: ${e instanceof Error ? e.message : String(e)}` }))
    .finally(() => { running = null })
  return running
}

// ---- export (R16.7) ------------------------------------------------------------------------------

const line = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(',')

export function attendanceCsv(termName: string, rows: { ref: CourseRef; sheet: AttendanceSheet | null; minPercent: number | null }[], now = new Date()): string {
  const out = [
    line(['FAP-AIO attendance export']),
    line(['Term', termName]),
    line(['Exported', now.toISOString()]),
    line(['Limit', 'Absent at most 20% of the sessions (80% attendance) unless the syllabus states another requirement']),
    '',
    line(['Subject code', 'Subject name', 'Attended', 'Absent', 'Not yet', 'Exempt', 'Unknown status', 'Total', 'Absent %', 'Allowed absent %', 'Absences left', 'Level']),
    ...rows.map(({ ref, sheet, minPercent }) => {
      const k = sheet?.counts
      const a = absenceInfo(k, minPercent)
      return line([ref.code, labelName(ref.label), k?.attended, k?.absent, k?.notYet, k?.exempt, k?.unknown, k?.total, a ? pct(a.percent) : null, a ? pct(a.limit) : null, a?.risk.left, a ? RISK_TEXT[a.risk.level] : 'Not read'])
    }),
  ]
  return BOM + out.join('\r\n') + '\r\n'
}
