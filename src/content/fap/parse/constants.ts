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
