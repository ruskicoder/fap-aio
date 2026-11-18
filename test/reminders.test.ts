// CORE-8.1: reminder alarms and notifications (core R10.1 to R10.4; platform R1.3, R1.7).
import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { MAX_ALARMS, PREFIX, fireReminder, installReminders, openFor, planReminders, rebuildReminders } from '../src/background/reminders'
import { read, write } from '../src/shared/storage/catalog'
import type { Exam, Session } from '../src/features/scheduler/types'

const NOW = Date.parse('2026-11-17T06:00:00+07:00')
const session = (date: string, start: string, p: Partial<Session> = {}): Session => ({
  id: `PRF192|${date}|${start}`, date, slot: 1, start, end: '09:00', code: 'PRF192', group: 'SE1', room: 'P.011', lecturer: 'AnhND3', online: false, scheduleType: null, attendance: 'not-yet', syncedAt: 1, ...p,
})
const exam = (date: string, p: Partial<Exam> = {}): Exam => ({
  id: `MAE101|FE|${date}`, date, start: '10:50', end: '12:20', room: 'NVH.302', code: 'MAE101', name: 'Maths', type: 'FE', typeRaw: 'FE', format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1, ...p,
})
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

describe('planReminders', () => {
  it('plans classes at the chosen offset and exams 1 day and 1 hour before, within 30 days, nearest first', () => {
    const plan = planReminders([session('2026-11-17', '07:30'), session('2026-11-16', '07:30'), session('2026-12-30', '07:30')], [exam('2026-11-19')], 15, NOW)
    expect(plan.map((p) => [p.name, new Date(p.when).toISOString()])).toEqual([
      [`${PREFIX}class:PRF192|2026-11-17|07:30:15`, '2026-11-17T00:15:00.000Z'],
      [`${PREFIX}exam:MAE101|FE|2026-11-19:1440`, '2026-11-18T03:50:00.000Z'],
      [`${PREFIX}exam:MAE101|FE|2026-11-19:60`, '2026-11-19T02:50:00.000Z'],
    ])
    expect(plan[0]).toMatchObject({ title: 'PRF192 starts in 15 minutes', message: 'P.011 · 07:30 to 09:00 · AnhND3', kind: 'class' })
    expect(plan[1]!.title).toBe('FE MAE101 in 1 day')
    expect(planReminders([session('2026-11-17', '07:30')], [], 30, NOW)[0]!.when).toBe(Date.parse('2026-11-17T07:00:00+07:00'))
  })

  it('stays under the alarm cap', () => {
    const many = Array.from({ length: 30 }, (_, d) => Array.from({ length: 20 }, (_, k) => session(new Date(NOW + (d + 1) * 86_400_000).toISOString().slice(0, 10), `${String(7 + (k % 12)).padStart(2, '0')}:${k < 12 ? '00' : '30'}`))).flat()
    expect(planReminders(many, [], 15, NOW)).toHaveLength(MAX_ALARMS)
  })
})

describe('reminder alarms', () => {
  let c: FakeChrome
  beforeEach(async () => {
    c = installFakeChrome()
    await write('timetable', { sessions: [session('2026-11-18', '07:30')], weeks: {}, lastSync: 1 })
    await write('exams', { exams: [exam('2026-11-20')], lastSync: 1 })
    await c.alarms.create('keepalive', { periodInMinutes: 7 })
    await c.alarms.create(`${PREFIX}old`, { when: NOW + 1000 })
  })
  const names = async () => (await c.alarms.getAll()).map((a) => a.name).sort()

  it('schedule nothing while off or without the permission, and rebuild when both hold', async () => {
    expect(await rebuildReminders(NOW)).toBe(0)
    expect(await names()).toEqual(['keepalive'])
    await write('settings', { 'schedule.reminders.enabled': true })
    expect(await rebuildReminders(NOW)).toBe(0)
    c.permissions._granted.add('notifications')
    expect(await rebuildReminders(NOW)).toBe(3)
    expect(await names()).toEqual(['keepalive', `${PREFIX}class:PRF192|2026-11-18|07:30:15`, `${PREFIX}exam:MAE101|FE|2026-11-20:1440`, `${PREFIX}exam:MAE101|FE|2026-11-20:60`].sort())
  })

  it('fire a notification and an inbox alert, and a click opens the right FAP page', async () => {
    await write('settings', { 'schedule.reminders.enabled': true })
    c.permissions._granted.add('notifications')
    await rebuildReminders(NOW)
    const name = `${PREFIX}exam:MAE101|FE|2026-11-20:60`
    expect(await fireReminder(name)).toBe(true)
    expect(c.notifications._shown.map((n) => n.id)).toEqual([name])
    const [a] = (await read('alerts'))!.items
    expect([a!.kind, a!.title, a!.link]).toEqual(['reminder', 'FE MAE101 in 1 hour', { tab: 'schedule', sub: 'exams' }])
    await openFor(name)
    expect((await c.tabs.get(1000)).url).toBe('https://fap.fpt.edu.vn/ExamSchedule')
    c.tabs._tabs.set(7, { id: 7, url: 'https://fap.fpt.edu.vn/Student.aspx', active: false, windowId: 2 })
    await chrome.storage.session.set({ 'tabs.known': { ready: { 7: 1 }, focused: 7 } })
    await openFor(`${PREFIX}class:PRF192|2026-11-18|07:30:15`)
    expect(c.tabs._tabs.get(7)).toMatchObject({ active: true, url: 'https://fap.fpt.edu.vn/WeeklyTimetable' })
    expect(c.tabs._tabs.size).toBe(2)
    await write('settings', { 'schedule.reminders.enabled': false })
    expect(await fireReminder(name)).toBe(false)
  })

  it('rebuild after the timetable, exams or settings change', async () => {
    // The install path plans from the real clock, so its class is two days from today (fix F-22).
    const day = new Date(Date.now() + 2 * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10)
    await write('timetable', { sessions: [session(day, '07:30')], weeks: {}, lastSync: 1 })
    c.permissions._granted.add('notifications')
    installReminders()
    await write('settings', { 'schedule.reminders.enabled': true, 'schedule.reminders.classOffset': 30 })
    await tick(700)
    expect(await names()).toContain(`${PREFIX}class:PRF192|${day}|07:30:30`)
  })
})
