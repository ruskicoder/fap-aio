// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import type { Exam, Session } from '../src/features/scheduler/types'
import type { SyncEngine } from '../src/features/scheduler/sync'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))

const { WeekView, inRange } = await import('../src/features/scheduler/views/WeekView')
const { ExamsView, daysLeft } = await import('../src/features/scheduler/views/ExamsView')
const { registerSchedulerViews } = await import('../src/features/scheduler/index')
const { clearViews, viewFor } = await import('../src/content/panel/views')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const NOW = Date.parse('2026-10-07T09:00:00+07:00') // Wednesday
const TODAY = '2026-10-07'
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

const session = (date: string, start: string, p: Partial<Session> = {}): Session => ({
  id: `PRF192|${date}|${start}`, date, slot: 1, start, end: '09:00', code: 'PRF192', group: 'SE1', room: 'BE-301',
  lecturer: 'abc', online: false, scheduleType: null, attendance: 'not-yet', syncedAt: 1, ...p,
})
const exam = (date: string, type: Exam['type'], p: Partial<Exam> = {}): Exam => ({
  id: `PRF192|${type}|${date}`, date, start: '10:50', end: '12:20', room: 'R1', code: 'PRF192', name: 'Programming',
  type, typeRaw: type, format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1, ...p,
})
const put = (c: FakeChrome, key: string, data: unknown) => act(async () => { await c.storage.local.set({ [key]: { schemaVersion: 1, updatedAt: 0, data } }) })

function render(node: JSX.Element) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(node))
  return { el, root, button: (t: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === t)! }
}

describe('range filter', () => {
  it('covers today, this week, next two weeks, this month and all', () => {
    expect(inRange(TODAY, 'today', TODAY)).toBe(true)
    expect(inRange('2026-10-05', 'week', TODAY)).toBe(true)
    expect(inRange('2026-10-11', 'week', TODAY)).toBe(true)
    expect(inRange('2026-10-12', 'week', TODAY)).toBe(false)
    expect(inRange('2026-10-20', 'next2', TODAY)).toBe(true)
    expect(inRange('2026-10-21', 'next2', TODAY)).toBe(false)
    expect(inRange('2026-10-06', 'next2', TODAY)).toBe(false)
    expect(inRange('2026-10-31', 'month', TODAY)).toBe(true)
    expect(inRange('2026-11-01', 'month', TODAY)).toBe(false)
    expect(inRange('2020-01-01', 'all', TODAY)).toBe(true)
    expect(daysLeft('2026-10-07', TODAY)).toBe('Today')
    expect(daysLeft('2026-10-08', TODAY)).toBe('Tomorrow')
    expect(daysLeft('2026-10-17', TODAY)).toBe('In 10 days')
  })
})

describe('week view', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome(); document.body.innerHTML = '' })

  it('offers the sync action when empty and reports the result', async () => {
    const engine = { running: false, syncWeek: vi.fn(async () => ({ ok: true, report: { synced: 1, failed: [], added: 4, updated: 0, unreadable: 0 } })) } as unknown as SyncEngine
    const { el, button, root } = render(<WeekView engine={engine} now={() => NOW} />)
    await tick()
    expect(el.textContent).toContain('No classes synced yet')
    await act(async () => button('Sync this week').click())
    expect(engine.syncWeek).toHaveBeenCalledWith(TODAY)
    expect(el.querySelector('[role="status"]')!.textContent).toBe('1 week synced, 4 added, 0 updated.')
    act(() => root.unmount())
  })

  it('groups sessions by day in date and time order and filters by range', async () => {
    await put(c, 'timetable', {
      sessions: [session('2026-10-05', '07:30'), session('2026-10-07', '07:30', { attendance: 'present' }), session('2026-10-07', '12:30', { id: 'X', code: 'SWE201', online: true }), session('2026-10-14', '07:30')],
      weeks: {}, lastSync: Date.now() - 120_000,
    })
    const { el, root } = render(<WeekView now={() => NOW} />)
    await tick()
    const heads = () => [...el.querySelectorAll('h3')].map((h) => h.textContent)
    expect(heads()).toEqual(['Mon 5 Oct', 'Wed 7 Oct · Today'])
    const today = el.querySelectorAll('section')[1]!
    expect([...today.querySelectorAll('li')].map((li) => li.textContent?.slice(0, 11))).toEqual(['07:30–09:00', '12:30–09:00'])
    expect(today.textContent).toContain('Present')
    expect(today.textContent).toContain('Online')
    expect(el.textContent).toContain('Classes synced 2 min ago')
    const sel = el.querySelector<HTMLSelectElement>('#aio-week-range')!
    act(() => { sel.value = 'all'; sel.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(heads()).toHaveLength(3)
    act(() => { sel.value = 'today'; sel.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(heads()).toEqual(['Wed 7 Oct · Today'])
    act(() => root.unmount())
  })

  it('shows an access error with what to do', async () => {
    await put(c, 'timetable', { sessions: [session('2026-10-07', '07:30')], weeks: {}, lastSync: 1 })
    const engine = { running: false, syncWeek: vi.fn(async () => ({ ok: false, error: { kind: 'session-expired' }, report: { synced: 0, failed: [], added: 0, updated: 0, unreadable: 0 } })) } as unknown as SyncEngine
    const { el, button, root } = render(<WeekView engine={engine} now={() => NOW} />)
    await tick()
    await act(async () => button('Sync week').click())
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Sign in to FAP again')
    act(() => root.unmount())
  })
})

describe('exams view', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome(); document.body.innerHTML = '' })

  it('offers the sync action when empty', async () => {
    const sync = vi.fn(async () => ({ ok: true as const, added: 2, updated: 0, total: 2 }))
    const { el, button, root } = render(<ExamsView sync={sync} now={() => NOW} />)
    await tick()
    expect(el.textContent).toContain('No exams synced yet')
    await act(async () => button('Sync exams').click())
    expect(el.textContent).toContain('2 exams stored, 2 added, 0 updated.')
    act(() => root.unmount())
  })

  it('splits upcoming and past, shows days left and filters by type', async () => {
    await put(c, 'exams', { exams: [exam('2026-10-01', 'PE'), exam('2026-10-09', 'FE'), exam('2026-10-20', '2NDFE', { room: null })], lastSync: Date.now() })
    const { el, root } = render(<ExamsView now={() => NOW} />)
    await tick()
    const [up, past] = [...el.querySelectorAll('section')]
    expect(up!.querySelector('h3')!.textContent).toBe('Upcoming (2)')
    expect(up!.textContent).toContain('In 2 days')
    expect(up!.textContent).toContain('Room not assigned')
    expect(past!.querySelector('h3')!.textContent).toBe('Past (1)')
    expect(el.textContent).toContain('Exams synced just now')
    const sel = el.querySelector<HTMLSelectElement>('#aio-exam-type')!
    act(() => { sel.value = 'FE'; sel.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(el.querySelectorAll('section')[0]!.querySelector('h3')!.textContent).toBe('Upcoming (1)')
    expect(el.querySelectorAll('section')[1]!.textContent).toContain('No past exams.')
    act(() => root.unmount())
  })

  it('registers Week and Exams with an upcoming count badge', async () => {
    clearViews()
    registerSchedulerViews()
    expect(viewFor({ tab: 'schedule', sub: 'week' })?.label).toBe('Week')
    await tick()
    expect(viewFor({ tab: 'schedule', sub: 'exams' })?.count?.()).toBeNull()
    await put(c, 'exams', { exams: [exam('2099-01-01', 'FE'), exam('2000-01-01', 'PE')], lastSync: 1 })
    expect(viewFor({ tab: 'schedule', sub: 'exams' })?.count?.()).toBe(1)
  })
})
