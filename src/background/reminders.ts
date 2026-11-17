// Reminders (core R10.1 to R10.4; design "Reminders"; platform R1.3, R1.7): while enabled and the
// notifications permission is held, one alarm per class (15 or 30 minutes before) and per exam (1 day and
// 1 hour before) within 30 days, nearest first, below Chrome's 500-alarm cap. Rebuilt whenever the
// timetable, the exams or the settings change. On fire: a notification and an inbox alert; a click focuses
// a FAP tab on the timetable or exam page, or opens one.
import { pushAlert } from '../shared/alerts'
import { read } from '../shared/storage/catalog'
import { PERMS } from '../shared/permissions'
import { addDays, todayVn } from '../shared/dates'
import { knownTabs } from './tabs'
import type { Exam, Session } from '../features/scheduler/types'

export const PREFIX = 'reminder:'
export const MAX_ALARMS = 450
const MIN = 60_000
const PLAN_KEY = 'reminders.plan'
const at = (date: string, hm: string) => Date.parse(`${date}T${hm}:00+07:00`)

export interface Planned { name: string; when: number; title: string; message: string; kind: 'class' | 'exam' }

const roomOf = (room: string | null, online = false) => (online ? 'Online' : room ?? 'room not set')
const before = (m: number) => (m >= 1440 ? `${m / 1440} day` : m >= 60 ? `${m / 60} hour` : `${m} minutes`)

/** Pure plan: classes and exams starting within 30 days, nearest first, capped. */
export function planReminders(sessions: Session[], exams: Exam[], classOffset: number, now = Date.now()): Planned[] {
  const end = at(addDays(todayVn(now), 30), '23:59')
  const out: Planned[] = []
  for (const s of sessions) {
    const start = at(s.date, s.start)
    const when = start - classOffset * MIN
    if (when > now && start <= end) out.push({ name: `${PREFIX}class:${s.id}:${classOffset}`, when, kind: 'class', title: `${s.code} starts in ${before(classOffset)}`, message: `${roomOf(s.room, s.online)} · ${s.start} to ${s.end}${s.lecturer ? ` · ${s.lecturer}` : ''}` })
  }
  for (const e of exams) {
    const start = at(e.date, e.start)
    for (const m of [1440, 60]) {
      const when = start - m * MIN
      if (when > now && start <= end) out.push({ name: `${PREFIX}exam:${e.id}:${m}`, when, kind: 'exam', title: `${e.type === 'other' ? 'Exam' : e.type} ${e.code} in ${before(m)}`, message: `${roomOf(e.room)} · ${e.date.slice(8, 10)}/${e.date.slice(5, 7)} ${e.start}` })
    }
  }
  return out.sort((a, b) => a.when - b.when).slice(0, MAX_ALARMS)
}

async function enabled(): Promise<{ on: boolean; offset: number }> {
  const s = (await read('settings')) ?? {}
  const offset = s['schedule.reminders.classOffset'] === 30 ? 30 : 15
  const on = s['schedule.reminders.enabled'] === true && (await chrome.permissions.contains(PERMS.notifications).catch(() => false))
  return { on, offset }
}

/** Clears every reminder alarm and schedules the plan again (R10.3). */
export async function rebuildReminders(now = Date.now()): Promise<number> {
  for (const a of await chrome.alarms.getAll()) if (a.name.startsWith(PREFIX)) await chrome.alarms.clear(a.name)
  const { on, offset } = await enabled()
  if (!on) { await chrome.storage.session.remove(PLAN_KEY); return 0 }
  const plan = planReminders((await read('timetable'))?.sessions ?? [], (await read('exams'))?.exams ?? [], offset, now)
  for (const p of plan) await chrome.alarms.create(p.name, { when: p.when })
  await chrome.storage.session.set({ [PLAN_KEY]: Object.fromEntries(plan.map((p) => [p.name, p])) })
  return plan.length
}

export async function fireReminder(name: string): Promise<boolean> {
  const plan = ((await chrome.storage.session.get(PLAN_KEY)) as Record<string, Record<string, Planned> | undefined>)[PLAN_KEY] ?? {}
  const p = plan[name]
  if (!p || !(await enabled()).on) return false
  await chrome.notifications.create(name, { type: 'basic', iconUrl: chrome.runtime.getURL('img/logo-128.png'), title: p.title, message: p.message })
  await pushAlert({ kind: 'reminder', title: p.title, detail: p.message, link: { tab: 'schedule', sub: p.kind === 'exam' ? 'exams' : 'week' }, dedupeKey: name })
  return true
}

/** A click focuses a FAP tab on the timetable or the exam page, or opens one (R10.4). */
export async function openFor(name: string): Promise<void> {
  const url = `https://fap.fpt.edu.vn/${name.startsWith(`${PREFIX}exam:`) ? 'ExamSchedule' : 'WeeklyTimetable'}`
  const id = (await knownTabs())[0]
  if (id !== undefined) {
    const t = await chrome.tabs.update(id, { active: true, url }).catch(() => null)
    if (t?.windowId !== undefined) await chrome.windows.update(t.windowId, { focused: true }).catch(() => undefined)
    if (t) return
  }
  await chrome.tabs.create({ url })
}

const WATCH = new Set(['timetable', 'exams', 'settings'])

export function installReminders(): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = () => { clearTimeout(timer); timer = setTimeout(() => void rebuildReminders(), 500) }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.keys(changes).some((k) => WATCH.has(k))) soon()
  })
  chrome.permissions.onAdded?.addListener(soon)
  chrome.runtime.onStartup?.addListener(soon)
  chrome.alarms.onAlarm.addListener((a) => { if (a.name.startsWith(PREFIX)) void fireReminder(a.name) })
  chrome.notifications?.onClicked?.addListener((id) => { if (id.startsWith(PREFIX)) void openFor(id) })
  soon()
}
