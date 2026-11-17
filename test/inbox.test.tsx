// @vitest-environment happy-dom
// PNL-6.1: AlertStore and the inbox popover (panel-ux R6.1 to R6.5, R1.6).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { read, write } from '../src/shared/storage/catalog'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const { alerts, setInboxOpen } = await import('../src/content/panel/inbox/store')
const { ago } = await import('../src/content/panel/inbox/Inbox')
const { mountPanel } = await import('../src/content/panel/host')
const { registerView } = await import('../src/content/panel/views')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('AlertStore', () => {
  let c: FakeChrome
  const sent: unknown[] = []
  beforeEach(() => {
    c = installFakeChrome()
    sent.length = 0
    c.runtime.onMessage.addListener((m: unknown, _s: unknown, respond: (r: unknown) => void) => { sent.push(m); respond({ ok: true, value: { shown: false } }) })
  })

  it('pushes once per dedupeKey and asks the service worker to mirror it', async () => {
    const a = await alerts.push({ kind: 'grade', title: 'PRF192 is failing', detail: 'Final exam below 4', dedupeKey: 'grade:PRF192:fe' })
    expect(a).toMatchObject({ kind: 'grade', read: false })
    expect(await alerts.push({ kind: 'grade', title: 'again', dedupeKey: 'grade:PRF192:fe' })).toBeNull()
    expect((await read('alerts'))!.items).toHaveLength(1)
    expect(sent).toEqual([{ v: 1, type: 'notify', alert: { id: a!.id, kind: 'grade', title: 'PRF192 is failing', detail: 'Final exam below 4' } }])
  })

  it('marks one or all read and keeps at most 200 alerts of the last 60 days', async () => {
    const now = Date.now()
    const items = Array.from({ length: 205 }, (_, i) => ({ id: `a${i}`, kind: 'news' as const, title: `n${i}`, at: now - i * 1000, read: false, dedupeKey: `k${i}` }))
    await write('alerts', { items: [...items, { ...items[0]!, id: 'old', dedupeKey: 'old', at: now - 61 * 86_400_000 }] })
    expect((await read('alerts'))!.items).toHaveLength(200)
    await alerts.markRead('a3')
    expect((await read('alerts'))!.items.filter((x) => x.read).map((x) => x.id)).toEqual(['a3'])
    await alerts.markAllRead()
    expect((await read('alerts'))!.items.every((x) => x.read)).toBe(true)
  })

  it('formats times', () => {
    const now = Date.parse('2026-11-17T12:00:00Z')
    expect([ago(now - 5000, now), ago(now - 120_000, now), ago(now - 3 * 3600_000, now)]).toEqual(['just now', '2 min ago', '3 h ago'])
  })
})

describe('inbox in the panel', () => {
  beforeEach(() => {
    installFakeChrome()
    setInboxOpen(false)
    document.body.innerHTML = '<div class="wrapper"></div>'
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  it('shows the unread count, filters by kind, deep-links, marks read and closes on Escape', async () => {
    const now = Date.now()
    await write('alerts', { items: [
      { id: 'g', kind: 'grade', title: 'PRF192 is failing', at: now - 60_000, read: false, dedupeKey: 'g', link: { tab: 'schedule', sub: 'exams' } },
      { id: 's', kind: 'sync', title: 'Sync failed', detail: 'Try again later', at: now - 7200_000, read: false, dedupeKey: 's' },
      { id: 'r', kind: 'sync', title: 'Synced', at: now - 9000_000, read: true, dedupeKey: 'r' },
    ] })
    registerView({ tab: 'schedule', sub: 'exams', label: 'Exams', icon: 'school', component: async () => () => null })
    await write('panel.prefs', { pageAware: true, keybinds: {}, recents: [], firstRun: 'done', docked: 'narrow' })
    let m!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { m = await mountPanel(document, '') })
    await tick()
    const $ = (s: string) => m.shadow.querySelector<HTMLElement>(s)
    const bell = $('[data-inbox-toggle]')!
    expect(bell.getAttribute('aria-label')).toBe('Alerts, 2 unread')
    await act(async () => { bell.click() })
    const dialog = $('[role="dialog"][aria-label="Alerts"]')!
    expect(dialog.querySelectorAll('ul[aria-label="Alert list"] li')).toHaveLength(3)
    const chips = [...dialog.querySelectorAll('[aria-label="Filter by kind"] button')]
    expect(chips.map((b) => b.textContent)).toEqual(['All', 'Grades', 'Sync'])
    await act(async () => { (chips[2] as HTMLElement).click() })
    expect(dialog.querySelectorAll('ul[aria-label="Alert list"] li')).toHaveLength(2)
    await act(async () => { (chips[0] as HTMLElement).click() })
    const row = [...dialog.querySelectorAll<HTMLElement>('ul button')].find((b) => b.textContent?.includes('PRF192'))!
    await act(async () => { row.click() })
    await tick()
    expect(m.router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    expect($('[role="dialog"]')).toBeNull()
    expect((await read('alerts'))!.items.find((a) => a.id === 'g')!.read).toBe(true)
    await act(async () => { bell.click() })
    await act(async () => { [...$('[role="dialog"]')!.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === 'Mark all read')!.click() })
    await tick()
    expect(bell.getAttribute('aria-label')).toBe('Alerts')
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect($('[role="dialog"]')).toBeNull()
  })

  it('shows the unread count on the minimized edge tab', async () => {
    await write('alerts', { items: [{ id: 'g', kind: 'grade', title: 'x', at: Date.now(), read: false, dedupeKey: 'g' }] })
    await write('panel.state', { ...(await import('../src/shared/panel-state')).defaultPanelState({ width: 1200, height: 800 }), collapsed: true })
    await write('panel.prefs', { pageAware: true, keybinds: {}, recents: [], firstRun: 'done', docked: 'narrow' })
    let m!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { m = await mountPanel(document, '') })
    await tick()
    const tab = m.shadow.querySelector<HTMLElement>('button[aria-label^="Open FAP-AIO panel"]')!
    expect(tab.getAttribute('aria-label')).toBe('Open FAP-AIO panel, 1 unread alerts')
    expect(tab.textContent).toContain('1')
  })
})
