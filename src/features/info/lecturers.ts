// Lecturer directory (info R3.1 to R3.3, R3.6, R3.7; design "Lecturer directory"): collected from synced
// timetable sessions and attendance rows, keyed case-insensitively with the latest casing for display,
// with derived addresses only for values that look like a shortcode. Notes and display names are local.
import { read, update } from '../../shared/storage/catalog'
import type { Session } from '../scheduler/types'

export interface Sighting { lecturer: string | null; code: string; group: string; date: string }

export interface Lecturer {
  key: string
  /** The most recent casing seen. */
  display: string
  validShortcode: boolean
  subjects: { code: string; group: string }[]
  lastSeen: string
  /** `@fe.edu.vn` first (preferred), then `@fpt.edu.vn`; empty when the value is not a shortcode. */
  emails: string[]
  /** The user's local display name and note (R3.7). */
  name?: string
  note?: string
}

export interface LecturerNote { displayName?: string; note?: string }
export interface InfoUser { lecturerNotes: Record<string, LecturerNote>; watchKeywords: string[]; courseraDone: Record<string, boolean> }

declare module '../../shared/storage/catalog' {
  interface StoreMap { 'info.user': InfoUser }
}

/** First name plus initials plus an optional counter: letters then digits, at least two capitals, or all lower case. */
export function isShortcode(raw: string): boolean {
  const s = raw.trim()
  if (!/^[A-Za-z]+\d*$/.test(s)) return false
  return (s.match(/[A-Z]/g)?.length ?? 0) >= 2 || s === s.toLowerCase()
}

export const sightingsFromSessions = (sessions: Session[]): Sighting[] =>
  sessions.map((s) => ({ lecturer: s.lecturer, code: s.code, group: s.group, date: s.date }))

export function buildDirectory(sightings: Sighting[]): Lecturer[] {
  const by = new Map<string, Lecturer>()
  for (const s of [...sightings].sort((a, b) => a.date.localeCompare(b.date))) {
    const raw = (s.lecturer ?? '').trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    const cur = by.get(key) ?? { key, display: raw, validShortcode: false, subjects: [], lastSeen: s.date, emails: [] }
    // Sorted by date: a later sighting sets the display casing and the last-seen date.
    cur.display = raw
    cur.lastSeen = s.date
    if (!cur.subjects.some((x) => x.code === s.code && x.group === s.group)) cur.subjects.push({ code: s.code, group: s.group })
    by.set(key, cur)
  }
  return [...by.values()]
    .map((l) => {
      const valid = isShortcode(l.display)
      return { ...l, validShortcode: valid, emails: valid ? [`${l.display}@fe.edu.vn`, `${l.display}@fpt.edu.vn`] : [] }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function withNotes(list: Lecturer[], notes: Record<string, LecturerNote>): Lecturer[] {
  return list.map((l) => {
    const n = notes[l.key]
    return n ? { ...l, ...(n.displayName ? { name: n.displayName } : {}), ...(n.note ? { note: n.note } : {}) } : l
  })
}

const EMPTY: InfoUser = { lecturerNotes: {}, watchKeywords: [], courseraDone: {} }

export async function readInfoUser(): Promise<InfoUser> {
  return { ...EMPTY, ...((await read('info.user')) ?? {}) }
}

/** Saves a lecturer's local display name and note; empty values remove them (R3.7). */
export function setLecturerNote(key: string, n: LecturerNote): Promise<InfoUser> {
  const displayName = (n.displayName ?? '').trim().slice(0, 60)
  const note = (n.note ?? '').trim().slice(0, 500)
  return update('info.user', (old) => {
    const lecturerNotes = { ...(old?.lecturerNotes ?? {}) }
    const k = key.toLowerCase()
    if (displayName || note) lecturerNotes[k] = { ...(displayName ? { displayName } : {}), ...(note ? { note } : {}) }
    else delete lecturerNotes[k]
    return { ...EMPTY, ...old, lecturerNotes }
  })
}
