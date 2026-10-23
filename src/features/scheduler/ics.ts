// IcsExporter (core R9.1 to R9.6): a pure RFC 5545 writer. Events use TZID Asia/Ho_Chi_Minh with
// a fixed +07:00 VTIMEZONE, UIDs are sha1 of the record identity so a newer import updates events,
// text is escaped and lines are folded at 75 octets without splitting a UTF-8 sequence.
import type { Exam, Session } from './types'

export const TZID = 'Asia/Ho_Chi_Minh'
export type SessionFilter = 'all' | 'offline' | 'online'
export interface IcsOptions {
  /** Export reminders (R9.6): classes get one alarm this many minutes before; exams 1 day and 1 hour. */
  reminders?: { classOffsetMin: number } | null
  now?: number
}

const VTIMEZONE = ['BEGIN:VTIMEZONE', `TZID:${TZID}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:+07', 'END:STANDARD', 'END:VTIMEZONE']

export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Folds one content line at 75 octets; continuation lines start with a space (R9.5). */
export function fold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    const limit = out.length ? 74 : 75 // a continuation line's leading space counts
    if (bytes + n > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

export async function sha1(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const local = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const alarm = (trigger: string, text: string) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(text)}`, `TRIGGER:${trigger}`, 'END:VALARM']

interface Ev { uid: string; date: string; start: string; end: string; summary: string; location: string | null; description: string; alarms: string[][] }

async function calendar(events: Ev[], now: number): Promise<string> {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FAP-AIO//FAP-AIO 2.0//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...VTIMEZONE]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${await sha1(e.uid)}@fap-aio`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;TZID=${TZID}:${local(e.date, e.start)}`,
      `DTEND;TZID=${TZID}:${local(e.date, e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    )
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    for (const a of e.alarms) lines.push(...a)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export const filterSessions = (list: Session[], f: SessionFilter) => list.filter((s) => f === 'all' || (f === 'online') === s.online)

/** Classes (R9.1). The UID identity is `code|date|start` (R9.4). */
export function sessionsIcs(sessions: Session[], opts: IcsOptions = {}): Promise<string> {
  const r = opts.reminders
  return calendar(sessions.map((s) => ({
    uid: `${s.code}|${s.date}|${s.start}`,
    date: s.date, start: s.start, end: s.end,
    summary: s.group ? `${s.code} (${s.group})` : s.code,
    location: s.online ? 'Online' : s.room,
    description: [s.lecturer && `Lecturer: ${s.lecturer}`, `Slot ${s.slot}`, s.scheduleType].filter(Boolean).join('\n'),
    alarms: r ? [alarm(`-PT${r.classOffsetMin}M`, `${s.code} starts in ${r.classOffsetMin} minutes`)] : [],
  })), opts.now ?? Date.now())
}

/** Upcoming exams with an assigned room (R9.2), the type in the title; UID `code|date|start|type`. */
export function examsForExport(exams: Exam[], today: string): Exam[] {
  return exams.filter((e) => e.date >= today && e.room)
}
export function examsIcs(exams: Exam[], opts: IcsOptions = {}): Promise<string> {
  return calendar(exams.map((e) => {
    const type = e.type === 'other' ? e.typeRaw : e.type
    return {
      uid: `${e.code}|${e.date}|${e.start}|${e.type}`,
      date: e.date, start: e.start, end: e.end,
      summary: `${type} ${e.code}${e.name ? ` ${e.name}` : ''}`,
      location: e.room,
      description: [e.format && `Format: ${e.format}`, e.publishDate && `Results: ${e.publishDate}`, e.note].filter(Boolean).join('\n'),
      alarms: opts.reminders ? [alarm('-P1D', `${type} ${e.code} tomorrow`), alarm('-PT1H', `${type} ${e.code} in 1 hour`)] : [],
    }
  }), opts.now ?? Date.now())
}

/** Starts the download from a blob link inside the panel (platform amendment: no `downloads`). */
export function download(container: Node, name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.hidden = true
  container.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
