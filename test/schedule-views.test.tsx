// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import type { Exam, Session } from '../src/features/scheduler/types'
import type { SyncEngine } from '../src/features/scheduler/sync'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))

const { WeekView, fullTitle } = await import('../src/features/scheduler/views/WeekView')
const { ExamsView, daysLeft } = await import('../src/features/scheduler/views/ExamsView')
const { registerSchedulerViews } = await import('../src/features/scheduler/index')
const { clearViews, tabViews, viewFor } = await import('../src/content/panel/views')

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

describe('card helpers', () => {
  it('titles with the name when known and counts down to exams', () => {
    expect(fullTitle('PRF192', 'Programming')).toBe('PRF192 · Programming')
    expect(fullTitle('PRF192', undefined)).toBe('PRF192')
    expect(daysLeft('2026-10-07', TODAY)).toBe('Today')
    expect(daysLeft('2026-10-08', TODAY)).toBe('Tomorrow')
    expect(daysLeft('2026-10-17', TODAY)).toBe('In 10 days')
    expect(daysLeft('2026-10-01', TODAY)).toBe('Done')
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

  it('shows this week under day headers as cards, and All with its count', async () => {
    await put(c, 'timetable', {
      sessions: [
        session('2026-10-05', '07:30'), session('2026-10-07', '07:30', { attendance: 'present', scheduleType: 'Lab' }),
        session('2026-10-07', '12:30', { id: 'X', code: 'SWE201', online: true, room: null, attendance: 'absent' }), session('2026-10-14', '07:30'),
      ],
      weeks: {}, lastSync: 1,
    })
    await put(c, 'exams', { exams: [exam('2026-10-20', 'FE')], lastSync: 1 })
    const { el, button, root } = render(<WeekView now={() => NOW} />)
    await tick()
    const heads = () => [...el.querySelectorAll('h3')].map((h) => h.textContent)
    expect(button('Sync Fall 2026')).toBeTruthy()
    expect(button('This week (3)').getAttribute('aria-pressed')).toBe('true')
    expect(heads()).toEqual(['Mon 5 Oct', 'Wed 7 Oct · today'])
    const cards = [...el.querySelectorAll('section')[1]!.querySelectorAll('li')].map((li) => li.textContent)
    expect(cards[0]).toBe('PRF192 · ProgrammingSlot 1PresentRoom: BE-301Time: 07:30–09:00Lecturer: abcGroup: SE1Type: Lab')
    expect(cards[1]).toBe('SWE201Slot 1AbsentRoom: OnlineTime: 12:30–09:00Lecturer: abcGroup: SE1')
    expect(el.querySelector('[class*="truncate"]')).toBeNull()
    act(() => button('All (4)').click())
    expect(heads()).toHaveLength(3)
    act(() => root.unmount())
  })

  it('shows an access error with what to do', async () => {
    await put(c, 'timetable', { sessions: [session('2026-10-07', '07:30')], weeks: {}, lastSync: 1 })
    const engine = { running: false, syncWeek: vi.fn(async () => ({ ok: false, error: { kind: 'session-expired' }, report: { synced: 0, failed: [], added: 0, updated: 0, unreadable: 0 } })) } as unknown as SyncEngine
    const { el, button, root } = render(<WeekView engine={engine} now={() => NOW} />)
    await tick()
    await act(async () => button('Sync this week').click())
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

  it('splits upcoming and past with counts, draws tags and filters by type chips', async () => {
    await put(c, 'exams', {
      exams: [exam('2026-10-01', 'PE'), exam('2026-10-09', 'FE', { format: 'Multiple choices', publishDate: '2026-10-20' }), exam('2026-10-20', '2NDFE', { room: null })],
      lastSync: 1,
    })
    const { el, button, root } = render(<ExamsView now={() => NOW} />)
    await tick()
    const cards = () => [...el.querySelectorAll('li')].map((li) => li.textContent)
    expect(button('Upcoming (2)').getAttribute('aria-pressed')).toBe('true')
    expect(cards()).toEqual([
      'PRF192 · ProgrammingFEIn 2 daysFormat: Multiple choicesRoom: R1Date: Fri 9 OctTime: 10:50–12:20Results: Tue 20 Oct',
      'PRF192 · Programming2NDFEIn 13 daysRoom: not assigned yetDate: Tue 20 OctTime: 10:50–12:20',
    ])
    expect([...el.querySelectorAll('li span')].find((t) => t.textContent === 'In 2 days')!.className).toContain('bg-red-50')
    expect([...el.querySelectorAll('li span')].find((t) => t.textContent === 'FE')!.className).toContain('bg-green-50')
    act(() => button('2NDFE').click())
    expect(button('Upcoming (1)')).toBeTruthy()
    act(() => button('Past (1)').click())
    expect(cards()).toEqual(['PRF192 · ProgrammingPEDoneRoom: R1Date: Thu 1 OctTime: 10:50–12:20'])
    act(() => button('PE').click())
    expect(el.textContent).toContain('No past exams.')
    act(() => root.unmount())
  })

  it('registers Classes, Exams and Export with their sync stamps and the upcoming count', async () => {
    clearViews()
    registerSchedulerViews()
    expect(tabViews().map((v) => v.label)).toEqual(['Classes', 'Exams', 'Export'])
    expect(viewFor({ tab: 'schedule', sub: 'export' })?.lastSync?.map((x) => x.key)).toEqual(['timetable', 'exams'])
    await tick()
    expect(viewFor({ tab: 'schedule', sub: 'exams' })?.count?.()).toBeNull()
    await put(c, 'exams', { exams: [exam('2099-01-01', 'FE'), exam('2000-01-01', 'PE')], lastSync: 1 })
    expect(viewFor({ tab: 'schedule', sub: 'exams' })?.count?.()).toBe(1)
  })
})
