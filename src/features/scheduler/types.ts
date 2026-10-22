// Scheduler records (core design, "Data Models").
import type { Attendance } from '../../content/fap/parse/constants'

export interface Session {
  id: string // `${code}|${date}|${start}`
  date: string // yyyy-mm-dd
  slot: number
  start: string // HH:mm
  end: string
  code: string
  group: string
  room: string | null
  lecturer: string | null
  online: boolean
  scheduleType: string | null
  attendance: Attendance
  syncedAt: number
}

export interface WeekResult {
  monday: string
  empty: boolean
  sessions: Session[]
  unreadable: number
  /** Set when the response is not the requested week (core R6.4). */
  rejected?: string
}

export type ExamType = 'FE' | 'PE' | '2NDFE' | '2NDPE' | 'other'
export interface Exam {
  id: string // `${code}|${type}|${date}`
  date: string
  start: string
  end: string
  room: string | null
  code: string
  name: string
  type: ExamType
  typeRaw: string
  format: string | null
  publishDate: string | null
  attendanceNote: string
  note: string
  past: boolean
  syncedAt: number
}
