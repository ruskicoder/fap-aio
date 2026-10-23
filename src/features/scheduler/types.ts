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

export interface TimetableStore {
  sessions: Session[]
  /** Synced weeks by Monday; `empty` records FAP's empty state (core R6.5). */
  weeks: Record<string, { syncedAt: number; empty: boolean }>
  lastSync: number | null
}

export interface ExamStore {
  exams: Exam[]
  lastSync: number | null
}

/** A range sync written before the first request so a reload can resume it (core R6.2, R6.6). */
export interface SyncJob {
  kind: 'range'
  mondays: string[]
  /** Weeks processed so far; the next week to read is `mondays[next]`. */
  next: number
  failed: string[]
  added: number
  updated: number
  unreadable: number
  startedAt: number
  /** Lease of the content script running the job, cleared on pagehide. */
  runner?: string
  beatAt?: number
}

declare module '../../shared/storage/catalog' {
  interface StoreMap {
    timetable: TimetableStore
    exams: ExamStore
    'sync.job': SyncJob
  }
}
