// IcsExporter (core R9.1 to R9.6): a pure RFC 5545 writer. Events use TZID Asia/Ho_Chi_Minh with
// a fixed +07:00 VTIMEZONE, UIDs are sha1 of the record identity so a newer import updates events,
// text is escaped and lines are folded at 75 octets without splitting a UTF-8 sequence.
import type { Exam, Session } from './types'
import type { ClassPiece, Detail, ExamPiece, ExportPrefs, TitleSpec } from './export-options'
import { siteRoom } from './rooms'

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

/** One calendar event before writing; the Export preview renders the same object (R9.9). */
export interface IcsEvent { uid: string; date: string; start: string; end: string; summary: string; location: string | null; description: string; category?: string | null; alarms: string[][] }
type Ev = IcsEvent

/** Writes one VCALENDAR (R9.2, R9.11 to R9.13). */
export function buildIcs(events: IcsEvent[], now = Date.now()): Promise<string> {
  return calendar(events, now)
}

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
    if (e.category) lines.push(`CATEGORIES:${escapeText(e.category)}`)
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

const ATTENDANCE: Record<string, string> = { present: 'Present', absent: 'Absent', 'not-yet': 'Not yet', exempt: 'Exempt' }
export const attendanceText = (a: Session['attendance']) => (typeof a === 'string' ? ATTENDANCE[a]! : a.raw ? `${a.raw} (unknown)` : '')
export const examTypeText = (e: Exam) => (e.type === 'other' ? e.typeRaw || 'Exam' : e.type)

/** `15 minutes`, `1 hour`, `1 day` for an alarm offset in minutes. */
export function offsetText(min: number): string {
  const [n, unit] = min % 1440 === 0 ? [min / 1440, 'day'] : min % 60 === 0 ? [min / 60, 'hour'] : [min, 'minute']
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}
const trigger = (min: number) => (min % 1440 === 0 ? `-P${min / 1440}D` : min % 60 === 0 ? `-PT${min / 60}H` : `-PT${min}M`)

/** Joins the chosen pieces with the separator, leaving out empty ones; the code when all are empty (R9.6). */
export function buildTitle<P extends string>(spec: TitleSpec<P>, value: (p: P) => string | null | undefined, code: string): string {
  const parts = spec.pieces.map(value).filter((v): v is string => !!v)
  return parts.length ? parts.join(spec.sep) : code
}

const descLines = (p: ExportPrefs, line: (d: Detail) => string | null | undefined | false) =>
  p.details.map(line).filter((v): v is string => !!v)

/** A class event from the export options (R9.6 to R9.8). The UID ignores title and details (R9.12). */
export function classEvent(s: Session, p: ExportPrefs, names: Map<string, string>): IcsEvent {
  const room = s.online ? 'Online' : siteRoom(s.room)
  const att = attendanceText(s.attendance)
  const value = (k: ClassPiece) => ({ room, code: s.code, name: names.get(s.code), group: s.group, slot: `Slot ${s.slot}`, lecturer: s.lecturer, time: s.start })[k]
  return {
    uid: `${s.code}|${s.date}|${s.start}`,
    date: s.date, start: s.start, end: s.end,
    summary: buildTitle(p.classTitle, value, s.code),
    location: p.details.includes('room') ? room : null,
    description: [
      ...descLines(p, (d) => ({ room: null, lecturer: s.lecturer && `Lecturer: ${s.lecturer}`, slot: `Slot ${s.slot}`, group: s.group && `Group: ${s.group}`, attendance: att && `Attendance: ${att}`, format: null, results: null })[d]),
      s.scheduleType,
    ].filter(Boolean).join('\n'),
    category: (s.online ? p.categories.online : p.categories.offline) || null,
    alarms: p.classReminders.map((m) => alarm(trigger(m), `${s.code} starts in ${offsetText(m)}`)),
  }
}

/** An exam event: title pieces include the exam type (R9.6); one alarm per tier (R9.8). */
export function examEvent(e: Exam, p: ExportPrefs, names: Map<string, string>): IcsEvent {
  const type = examTypeText(e)
  const room = siteRoom(e.room)
  const value = (k: ExamPiece) => ({ room, type, code: e.code, name: e.name || names.get(e.code), format: e.format, time: e.start })[k]
  return {
    uid: `${e.code}|${e.date}|${e.start}|${e.type}`,
    date: e.date, start: e.start, end: e.end,
    summary: buildTitle(p.examTitle, value, `${type} ${e.code}`),
    location: p.details.includes('room') ? room : null,
    description: [
      ...descLines(p, (d) => ({ room: null, lecturer: null, slot: null, group: null, attendance: null, format: e.format && `Format: ${e.format}`, results: e.publishDate && `Results: ${e.publishDate}` })[d]),
      e.note,
    ].filter(Boolean).join('\n'),
    category: p.categories.exam || null,
    alarms: p.examReminders.map((m) => alarm(trigger(m), `${type} ${e.code} in ${offsetText(m)}`)),
  }
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
