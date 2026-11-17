// CORE-6.2: scheduler Today providers (panel-ux R3.1).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChrome } from './helpers/fake-chrome'
import type { Exam, Session } from '../src/features/scheduler/types'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const { countdown, daysText, examsSoonItems, laterTodayItems, nextClassItems, registerSchedulerToday } = await import('../src/features/scheduler/today')
const { clearTodayProviders, todayProviders } = await import('../src/content/panel/today/providers')
const { write } = await import('../src/shared/storage/catalog')

const NOW = Date.parse('2026-10-07T08:00:00+07:00') // Wednesday
const session = (date: string, start: string, end: string, p: Partial<Session> = {}): Session => ({
  id: `PRF192|${date}|${start}`, date, slot: 1, start, end, code: 'PRF192', group: 'SE1', room: '011', lecturer: 'abc',
  online: false, scheduleType: null, attendance: 'not-yet', syncedAt: 1, ...p,
})
const exam = (date: string, p: Partial<Exam> = {}): Exam => ({
  id: `PRF192|FE|${date}`, date, start: '10:50', end: '12:20', room: 'NVH 302', code: 'PRF192', name: 'Programming', type: 'FE', typeRaw: 'FE',
  format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1, ...p,
})

describe('countdowns', () => {
  it('reads now, minutes, hours, tomorrow and the weekday', () => {
    expect(countdown('2026-10-07', '07:30', '09:00', NOW)).toBe('now')
    expect(countdown('2026-10-07', '08:25', '09:55', NOW)).toBe('in 25 min')
    expect(countdown('2026-10-07', '11:10', '12:40', NOW)).toBe('in 3 h 10 min')
    expect(countdown('2026-10-07', '10:00', '11:30', NOW)).toBe('in 2 h')
    expect(countdown('2026-10-08', '07:30', '09:00', NOW)).toBe('tomorrow 07:30')
    expect(countdown('2026-10-12', '07:30', '09:00', NOW)).toBe('Mon 07:30')
    expect([daysText('2026-10-07', NOW), daysText('2026-10-08', NOW), daysText('2026-10-10', NOW)]).toEqual(['today', 'tomorrow', 'in 3 days'])
  })
})

describe('class providers', () => {
  const sessions = [
    session('2026-10-06', '07:30', '09:00'),
    session('2026-10-07', '12:50', '14:20', { code: 'MAE101', room: null, online: true, lecturer: null }),
    session('2026-10-07', '07:30', '09:00', { code: 'CSD201' }),
    session('2026-10-07', '15:00', '16:30', { code: 'SWE201' }),
    session('2026-10-08', '07:30', '09:00'),
  ]

  it('shows the running or next class with room, time, lecturer and countdown', () => {
    const [n] = nextClassItems(sessions, [exam('2026-10-20', { code: 'CSD201', name: 'Data structures' })], NOW)
    expect(n).toMatchObject({ title: 'CSD201 · Data structures', detail: 'P.011 · 07:30 to 09:00 · abc', when: 'now', link: { tab: 'schedule', sub: 'week' } })
    expect(nextClassItems([], [], NOW)).toEqual([])
  })

  it('lists the rest of today after the next class', () => {
    expect(laterTodayItems(sessions, [], NOW).map((i) => [i.title, i.detail, i.when])).toEqual([
      ['MAE101', 'Online · 12:50 to 14:20', '12:50'],
      ['SWE201', 'P.011 · 15:00 to 16:30 · abc', '15:00'],
    ])
  })
})

describe('exams within 14 days', () => {
  it('keeps upcoming exams in order, warns within 3 days and names the room site', () => {
    const items = examsSoonItems([
      exam('2026-10-21'), exam('2026-10-22', { id: 'late' }), exam('2026-10-09', { type: '2NDFE', id: 'b' }),
      exam('2026-10-06', { id: 'past' }), exam('2026-10-12', { room: null, id: 'c' }),
    ], NOW)
    expect(items.map((i) => [i.title, i.detail, i.tone, i.when])).toEqual([
      ['2NDFE · PRF192 · Programming', 'NVH.302 · 09/10 10:50 to 12:20', 'warning', 'in 2 days'],
      ['FE · PRF192 · Programming', 'Room not assigned yet · 12/10 10:50 to 12:20', 'neutral', 'in 5 days'],
      ['FE · PRF192 · Programming', 'NVH.302 · 21/10 10:50 to 12:20', 'neutral', 'in 14 days'],
    ])
  })
})

describe('registration', () => {
  beforeEach(() => { installFakeChrome(); clearTodayProviders() })

  it('registers three providers in the R3.1 order, exams as attention, reading the stores', async () => {
    registerSchedulerToday()
    const ps = todayProviders()
    expect(ps.map((p) => [p.id, p.order, p.attention, !!p.refresh])).toEqual([
      ['nextClass', 1, false, true], ['todayClasses', 2, false, false], ['examsSoon', 3, true, true],
    ])
    await write('timetable', { sessions: [session('2026-10-07', '09:10', '10:40')], weeks: {}, lastSync: 5 })
    await write('exams', { exams: [exam('2026-10-08')], lastSync: 7 })
    expect((await ps[0]!.items({ now: NOW })).map((i) => i.when)).toEqual(['in 1 h 10 min'])
    expect((await ps[2]!.items({ now: NOW })).map((i) => i.when)).toEqual(['tomorrow'])
    expect([await ps[0]!.syncedAt!(), await ps[2]!.syncedAt!()]).toEqual([5, 7])
  })
})
