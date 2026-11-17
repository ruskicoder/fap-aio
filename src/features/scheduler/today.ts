// Scheduler Today providers (core CORE-6.2; panel-ux R3.1): the next class (time, room, lecturer,
// countdown), today's remaining classes, and exams within 14 days. Times are Vietnam local (+07:00).
import { read } from '../../shared/storage/catalog'
import { addDays, todayVn } from '../../shared/dates'
import { errorText } from '../../content/panel/errors'
import { TODAY_ORDER, registerTodayProvider, type TodayItem } from '../../content/panel/today/providers'
import { siteRoom } from './rooms'
import { engine, syncExams } from './sync'
import { subjectNames } from './export-prefs'
import type { Exam, Session } from './types'

export const EXAMS_WITHIN_DAYS = 14
const MIN = 60_000

export const at = (date: string, hm: string) => Date.parse(`${date}T${hm}:00+07:00`)

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayName = (date: string) => DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()]!

/** Countdown to a start: "now" while it runs, "in 25 min", "in 3 h 10 min", then "tomorrow 07:30" or "Mon 07:30". */
export function countdown(date: string, start: string, end: string, now: number): string {
  const s = at(date, start)
  const e = at(date, end)
  if (now >= s && now < e) return 'now'
  const m = Math.ceil((s - now) / MIN)
  if (m < 60) return `in ${m} min`
  const today = todayVn(now)
  if (date === today) return m % 60 ? `in ${Math.floor(m / 60)} h ${m % 60} min` : `in ${m / 60} h`
  if (date === addDays(today, 1)) return `tomorrow ${start}`
  return `${dayName(date)} ${start}`
}

/** Days to an exam as text: "today", "tomorrow", "in 3 days". */
export function daysText(date: string, now: number): string {
  const d = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayVn(now)}T00:00:00Z`)) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
}

const title = (code: string, names: Map<string, string>) => (names.get(code) ? `${code} · ${names.get(code)}` : code)
const roomText = (s: { room: string | null; online?: boolean }) => (s.online ? 'Online' : siteRoom(s.room) ?? 'Room not set')

function sessionItem(s: Session, names: Map<string, string>, now: number, id: string): TodayItem {
  const parts = [roomText(s), `${s.start} to ${s.end}`, s.lecturer].filter(Boolean)
  return { id, title: title(s.code, names), detail: parts.join(' · '), tone: 'neutral', when: countdown(s.date, s.start, s.end, now), link: { tab: 'schedule', sub: 'week' } }
}

/** Upcoming or running sessions in start order. */
export function upcoming(sessions: Session[], now: number): Session[] {
  return sessions.filter((s) => at(s.date, s.end) > now).sort((a, b) => at(a.date, a.start) - at(b.date, b.start))
}

export function nextClassItems(sessions: Session[], exams: Exam[], now: number): TodayItem[] {
  const next = upcoming(sessions, now)[0]
  return next ? [sessionItem(next, subjectNames(exams), now, `next:${next.id}`)] : []
}

/** Today's classes after the next one. */
export function laterTodayItems(sessions: Session[], exams: Exam[], now: number): TodayItem[] {
  const today = todayVn(now)
  const [, ...rest] = upcoming(sessions, now)
  const names = subjectNames(exams)
  return rest.filter((s) => s.date === today).map((s) => ({ ...sessionItem(s, names, now, `today:${s.id}`), when: s.start }))
}

export function examsSoonItems(exams: Exam[], now: number): TodayItem[] {
  const today = todayVn(now)
  const last = addDays(today, EXAMS_WITHIN_DAYS)
  return exams
    .filter((e) => e.date >= today && e.date <= last && at(e.date, e.end) > now)
    .sort((a, b) => at(a.date, a.start) - at(b.date, b.start))
    .map((e) => {
      const near = Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`) <= 3 * 86_400_000
      const room = siteRoom(e.room) ?? 'Room not assigned yet'
      return {
        id: `exam:${e.id}`,
        title: `${e.type === 'other' ? e.typeRaw || 'Exam' : e.type} · ${e.name ? `${e.code} · ${e.name}` : e.code}`,
        detail: `${room} · ${e.date.slice(8, 10)}/${e.date.slice(5, 7)} ${e.start} to ${e.end}`,
        tone: near ? 'warning' : 'neutral',
        when: daysText(e.date, now),
        link: { tab: 'schedule', sub: 'exams' },
      } satisfies TodayItem
    })
}

const sessionsNow = async () => (await read('timetable'))?.sessions ?? []
const examsNow = async () => (await read('exams'))?.exams ?? []

export function registerSchedulerToday(): void {
  registerTodayProvider({
    id: 'nextClass', order: TODAY_ORDER.nextClass, label: 'Next class', attention: false, keys: ['timetable', 'exams'],
    items: async ({ now }) => nextClassItems(await sessionsNow(), await examsNow(), now),
    // The week sync serves both class sections; it runs once, here.
    refresh: async () => {
      const r = await engine.syncWeek(todayVn())
      return r.ok ? { ok: true } : { ok: false, text: errorText(r.error) }
    },
    syncedAt: async () => (await read('timetable'))?.lastSync ?? null,
  })
  registerTodayProvider({
    id: 'todayClasses', order: TODAY_ORDER.todayClasses, label: 'Later today', attention: false, keys: ['timetable', 'exams'],
    items: async ({ now }) => laterTodayItems(await sessionsNow(), await examsNow(), now),
  })
  registerTodayProvider({
    id: 'examsSoon', order: TODAY_ORDER.examsSoon, label: `Exams within ${EXAMS_WITHIN_DAYS} days`, attention: true, keys: ['exams'],
    items: async ({ now }) => examsSoonItems(await examsNow(), now),
    refresh: async () => {
      const r = await syncExams()
      return r.ok ? { ok: true } : { ok: false, text: errorText(r.error) }
    },
    syncedAt: async () => (await read('exams'))?.lastSync ?? null,
  })
}
