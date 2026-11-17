// Text-to-meaning tables for FAP values that can only be read as text (core R2.3, R2.4).
// Keys are normalized (NFC, lowercase, single spaces, trimmed); each entry covers vi and en.
// `verified: false` marks values not yet observed on FAP.

export const normText = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

export interface ConstEntry<V> { value: V; en: string[]; vi: string[]; verified: boolean }
export type Unknown = { kind: 'unknown'; raw: string }

export type Attendance = 'present' | 'absent' | 'not-yet' | 'exempt' | Unknown

export const ATTENDANCE: ConstEntry<Exclude<Attendance, Unknown>>[] = [
  { value: 'present', en: ['Present'], vi: ['Có mặt'], verified: true },
  { value: 'absent', en: ['Absent'], vi: ['Vắng mặt', 'Vắng'], verified: false },
  { value: 'not-yet', en: ['Not yet', 'Not taken'], vi: ['Chưa điểm danh', 'Chưa'], verified: false },
  { value: 'exempt', en: ['Attendance exempt'], vi: ['Miễn điểm danh'], verified: true },
]

const logged = new Set<string>()
/** Unknown values are kept raw and logged once each (R2.4). */
export function logUnknownOnce(table: string, raw: string): void {
  const k = `${table}:${raw}`
  if (logged.has(k)) return
  logged.add(k)
  console.info(`[fap-aio] unknown ${table} value kept raw: "${raw}"`)
}

export function lookup<V>(table: string, entries: ConstEntry<V>[], text: string): V | Unknown {
  const n = normText(text)
  for (const e of entries) if ([...e.en, ...e.vi].some((t) => normText(t) === n)) return e.value
  logUnknownOnce(table, text.trim())
  return { kind: 'unknown', raw: text.trim() }
}

export const attendanceOf = (text: string): Attendance => lookup('attendance', ATTENDANCE, text)

export type TranscriptStatus = 'passed' | 'exempt' | 'in-progress' | 'not-passed' | Unknown

/** Transcript status badges (grades R1.3). `bg-danger` with Not passed has not been seen on FAP yet. */
export const TRANSCRIPT_STATUS: (ConstEntry<Exclude<TranscriptStatus, Unknown>> & { badge: string })[] = [
  { value: 'passed', en: ['Passed'], vi: ['Đạt'], badge: 'bg-success', verified: true },
  { value: 'exempt', en: ['Exempt'], vi: ['Exempt', 'Miễn'], badge: 'bg-success', verified: true },
  { value: 'in-progress', en: ['In progress'], vi: ['Đang học'], badge: 'bg-info', verified: true },
  { value: 'not-passed', en: ['Not passed'], vi: ['Không đạt', 'Chưa đạt'], badge: 'bg-danger', verified: false },
]

/**
 * Status from the badge text through the table; an unlisted text on a `bg-info` or `bg-danger` badge
 * takes that badge's meaning, any other unlisted text is kept raw (grades R1.3, R1.4).
 */
export function transcriptStatusOf(text: string, badgeClass: string): TranscriptStatus {
  const n = normText(text)
  for (const e of TRANSCRIPT_STATUS) if ([...e.en, ...e.vi].some((t) => normText(t) === n)) return e.value
  const classes = badgeClass.split(/\s+/)
  const byBadge = TRANSCRIPT_STATUS.find((e) => e.badge !== 'bg-success' && classes.includes(e.badge))
  if (byBadge) return byBadge.value
  logUnknownOnce('transcript status', text.trim())
  return { kind: 'unknown', raw: text.trim() }
}
