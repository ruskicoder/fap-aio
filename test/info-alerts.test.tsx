// @vitest-environment happy-dom
// INF-6.1: info alerts and the notification settings (info R4.4, R7.7, R9.1 to R9.3; platform R1.3).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(async () => ({ ok: false, error: { kind: 'network' } })), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const { alertAttendance, checkCoursera, dedupeKey, newsWorthAlert } = await import('../src/features/info/alerts')
const { attendanceRisk } = await import('../src/features/info/analyze')
const { NotifyToggle, registerInfoSettings } = await import('../src/features/info/settings')
const { clearSettings } = await import('../src/content/panel/settings/registry')
const { read, write } = await import('../src/shared/storage/catalog')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const NOW = Date.parse('2026-11-17T09:00:00+07:00')
const titles = async () => ((await read('alerts'))?.items ?? []).map((a) => [a.kind, a.title, a.dedupeKey])

let c: FakeChrome
let granted = true
beforeEach(() => {
  c = installFakeChrome()
  granted = true
  c.runtime.onMessage.addListener((m: { type: string; codes?: string[] }, _s: unknown, respond: (r: unknown) => void) => {
    if (m.type === 'data.rules') respond({ ok: true, value: { dataVersion: 1, scrapedAt: '', rules: {}, subjects: Object.fromEntries((m.codes ?? []).map((k) => [k, { coursera: { required: k.endsWith('c') } }])) } })
    else if (m.type === 'perm.request') respond({ ok: true, value: { granted } })
    else respond({ ok: true, value: { shown: false } })
    return false
  })
})

describe('attendance alerts', () => {
  it('alert once per course and level, from warning on', async () => {
    const at = (absent: number) => [{ courseId: 'c1', code: 'PRF192', risk: attendanceRisk({ total: 20, absent }, null) }]
    expect(await alertAttendance(at(2))).toBe(0)
    expect(await alertAttendance(at(3))).toBe(1)
    expect(await alertAttendance(at(3))).toBe(0)
    expect(await alertAttendance(at(4))).toBe(1)
    expect(await titles()).toEqual([
      ['attendance', 'PRF192: no absence left', 'attendance|c1|last-chance'],
      ['attendance', 'PRF192: one absence left', 'attendance|c1|warning'],
    ])
    expect(dedupeKey('news', 'n1', 'P1')).toBe('news|n1|P1')
  })
})

describe('news alerts', () => {
  const cls = (p: Partial<import('../src/features/info/news').NewsClass>) => ({ tag: 'other', families: [], priority: 'P1' as const, deadline: null, term: {}, campus: null, expires: null, personal: [], hidden: false, reposted: false, ...p })
  const item = (createdAt: string) => ({ id: 'n', title: 't', createdAt })

  it('alert only P1 items with a near deadline, exam eligibility, an own subject or a recent post', () => {
    expect(newsWorthAlert(item('2026-10-01'), cls({ deadline: '2026-11-25' }), NOW)).toBe(true)
    expect(newsWorthAlert(item('2026-10-01'), cls({ deadline: '2026-12-25' }), NOW)).toBe(false)
    expect(newsWorthAlert(item('2026-10-01'), cls({ families: ['exam-eligibility'] }), NOW)).toBe(true)
    expect(newsWorthAlert(item('2026-10-01'), cls({ personal: ['subject:PRF192'] }), NOW)).toBe(true)
    expect(newsWorthAlert(item('2026-11-15'), cls({}), NOW)).toBe(true)
    expect(newsWorthAlert(item('2026-11-15'), cls({ priority: 'P2' }), NOW)).toBe(false)
    expect(newsWorthAlert(item('2026-11-15'), cls({ hidden: true }), NOW)).toBe(false)
  })
})

describe('Coursera alerts', () => {
  it('warn for unticked Coursera courses with a synced FE, once, from cached pages only', async () => {
    await write('cache:grades.termCourses', { entries: { '[]': { value: { terms: [], selectedTermId: 't', courses: [{ id: 'c1', termId: 't', label: 'Marketing (MKT101c) (G1)', code: 'MKT101c' }, { id: 'c2', termId: 't', label: 'P (PRF192) (G1)', code: 'PRF192' }] }, fetchedAt: NOW } } })
    await write('exams', { exams: [
      { id: 'a', date: '2026-11-27', start: '07:30', end: '09:00', room: null, code: 'MKT101c', name: 'M', type: 'FE', typeRaw: 'FE', format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1 },
      { id: 'b', date: '2026-11-28', start: '07:30', end: '09:00', room: null, code: 'PRF192', name: 'P', type: 'FE', typeRaw: 'FE', format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1 },
    ], lastSync: 1 })
    expect(await checkCoursera(NOW)).toBe(1)
    expect(await checkCoursera(NOW)).toBe(0)
    const [a] = (await read('alerts'))!.items
    expect([a!.kind, a!.title, a!.dedupeKey, a!.link]).toEqual(['coursera', 'Finish the Coursera courses for MKT101c before the final exam', 'coursera|c1|2026-11-27', { tab: 'schedule', sub: 'exams' }])
    expect(a!.detail).toContain('in 10 days')
    await write('alerts', { items: [] })
    await write('info.user', { lecturerNotes: {}, watchKeywords: [], courseraDone: { c1: true } })
    expect(await checkCoursera(NOW)).toBe(0)
  })
})

describe('notification settings', () => {
  beforeEach(() => { clearSettings(); registerInfoSettings() })

  async function render() {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<NotifyToggle kind="grade" />) })
    await wait()
    return el
  }

  it('ask for the notifications permission when turned on, and stay off when refused', async () => {
    const el = await render()
    const sw = el.querySelector<HTMLButtonElement>('[role="switch"]')!
    expect(sw.getAttribute('aria-checked')).toBe('false')
    granted = false
    await act(async () => { sw.click() })
    await wait()
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Chrome did not grant the notifications permission')
    granted = true
    await act(async () => { sw.click() })
    await wait()
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect((await read('settings'))!['alerts.notify.grade']).toBe(true)
    await act(async () => { sw.click() })
    await wait()
    expect((await read('settings'))!['alerts.notify.grade']).toBe(false)
  })
})
