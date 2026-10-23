// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { PanelRouter, routeKey } from '../src/content/panel/router'
import { ViewOutlet, clearViews, registerView, viewsOf } from '../src/content/panel/views'
import { mountPanel } from '../src/content/panel/host'
import { flushPanelState } from '../src/content/panel/store'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const deferred = <T,>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('panel router', () => {
  it('keys routes and returns from overlays and deep links', () => {
    expect(routeKey({ tab: 'today' })).toBe('today')
    expect(routeKey({ tab: 'schedule', sub: 'exams' })).toBe('schedule/exams')
    expect(routeKey({ overlay: 'settings' })).toBe('overlay/settings')

    const r = new PanelRouter({ tab: 'schedule', sub: 'week' })
    const seen: unknown[] = []
    r.subscribe((x) => seen.push(x))
    r.go({ tab: 'schedule', sub: 'exams' })
    expect(r.canGoBack()).toBe(false)
    r.go({ overlay: 'settings' })
    r.back()
    expect(r.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    r.go({ tab: 'info', sub: 'news' }, { source: 'deeplink' })
    expect(r.lastSource).toBe('deeplink')
    r.back()
    expect(r.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    expect(seen).toHaveLength(5)

    const o = new PanelRouter({ overlay: 'help' })
    o.back()
    expect(o.current()).toEqual({ tab: 'today' })
  })
})

describe('view outlet', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    document.body.innerHTML = ''
  })

  function render(router: PanelRouter) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => root.render(<ViewOutlet router={router} />))
    return { el, root }
  }

  it('shows a skeleton on first load, keeps the previous view while the next loads, then caches it', async () => {
    const week = deferred<() => JSX.Element>()
    const exams = deferred<() => JSX.Element>()
    let weekLoads = 0
    registerView({ tab: 'schedule', sub: 'week', label: 'Week', icon: 'calendar', component: () => { weekLoads++; return week.promise } })
    registerView({ tab: 'schedule', sub: 'exams', label: 'Exams', icon: 'school', component: () => exams.promise, count: () => 3 })
    expect(viewsOf('schedule').map((v) => v.label)).toEqual(['Week', 'Exams'])

    const router = new PanelRouter({ tab: 'schedule', sub: 'week' })
    const { el, root } = render(router)
    expect(el.querySelector('[aria-label="Loading"]')).toBeTruthy()
    week.resolve(() => <p>week view</p>)
    await tick()
    expect(el.textContent).toContain('week view')

    act(() => router.go({ tab: 'schedule', sub: 'exams' }))
    expect(el.textContent).toContain('week view')
    expect(el.querySelector('[aria-label="Loading"]')).toBeNull()
    exams.resolve(() => <p>exams view</p>)
    await tick()
    expect(el.textContent).toContain('exams view')

    act(() => router.go({ tab: 'schedule', sub: 'week' }))
    expect(el.textContent).toContain('week view')
    expect(weekLoads).toBe(1)
    act(() => root.unmount())
  })

  it('shows Try again when a chunk fails, and recovers', async () => {
    let fail = true
    registerView({ tab: 'info', sub: 'news', label: 'News', icon: 'news', component: async () => { if (fail) throw new Error('chunk'); return () => <p>news view</p> } })
    const { el, root } = render(new PanelRouter({ tab: 'info', sub: 'news' }))
    await tick()
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('did not load')
    fail = false
    act(() => el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
    await tick()
    expect(el.textContent).toContain('news view')
    act(() => root.unmount())
  })

  it('renders overlays with a back control', async () => {
    registerView({ overlay: 'settings', label: 'Settings', icon: 'settings', component: async () => () => <p>settings view</p> })
    const router = new PanelRouter({ tab: 'today' })
    const { el, root } = render(router)
    expect(el.textContent).toContain('not available yet')
    act(() => router.go({ overlay: 'settings' }))
    await tick()
    expect(el.querySelector('h2')!.textContent).toBe('Settings')
    act(() => el.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click())
    expect(router.current()).toEqual({ tab: 'today' })
    act(() => root.unmount())
  })
})

describe('route persistence', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    clearViews()
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  it('writes the route to panel.state and restores it on the next mount', async () => {
    await c.storage.local.set({ 'panel.prefs': { schemaVersion: 1, updatedAt: 0, data: { pageAware: false, keybinds: {}, recents: [], firstRun: 'done' } } })
    let m!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { m = await mountPanel(document, '') })
    act(() => m.shadow.querySelector<HTMLButtonElement>('[aria-label="Menu"]')!.click())
    act(() => m.shadow.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1]!.click())
    expect(m.router.current()).toEqual({ overlay: 'settings' })
    act(() => m.router.go({ tab: 'schedule', sub: 'exams' }))
    await flushPanelState()
    expect((c.storage.local.data['panel.state'] as { data: { route: unknown } }).data.route).toEqual({ tab: 'schedule', sub: 'exams' })
    act(() => m.root.unmount())
    await act(async () => { m = await mountPanel(document, '') })
    expect(m.router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    act(() => m.root.unmount())
  })
})
