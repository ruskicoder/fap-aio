// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { PanelApp } from '../src/content/panel/PanelApp'
import { defaultPanelState, type PanelState } from '../src/shared/panel-state'
import { panelStateV1toV2 } from '../src/shared/storage/steps'
import { defaultPrefs, readPrefs, updatePrefs } from '../src/shared/panel-prefs'
import { DOCK_CLASS } from '../src/content/panel/page-dock'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const VW = 1200
const VH = 800
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

function render(state: PanelState, props: Partial<Parameters<typeof PanelApp>[0]> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<PanelApp initial={state} host={host} version="2.0.0" {...props} />))
  const q = (s: string) => host.querySelector<HTMLElement>(s)
  const px = (p: string) => parseFloat(host.style.getPropertyValue(p))
  const ptr = (el: Element, type: string, x: number, y: number) => act(() => { el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 })) })
  const drag = (el: Element, from: [number, number], to: [number, number]) => {
    ptr(el, 'pointerdown', ...from)
    ptr(el, 'pointermove', ...to)
    ptr(el, 'pointerup', ...to)
  }
  return { host, root, q, px, ptr, drag }
}

describe('panel shell', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    document.body.innerHTML = ''
    document.documentElement.className = ''
    Object.defineProperty(window, 'innerWidth', { value: VW, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: VH, configurable: true })
  })

  it('has the agreed header: title, version, Sync, Dock, Settings, Minimize and nothing else', () => {
    let synced = 0
    let settings = 0
    const { q, host, root } = render(defaultPanelState({ width: VW, height: VH }), { onSync: () => synced++, onSettings: () => settings++ })
    const header = q('header')!
    expect(header.textContent).toContain('FAP-AIO')
    expect(header.textContent).toContain('v2.0.0')
    expect([...header.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Sync this week and exams', 'Dock panel', 'Settings', 'Minimize panel'])
    expect(host.textContent).not.toMatch(/⌘|Ctrl|palette/i)
    act(() => q('[aria-label="Sync this week and exams"]')!.click())
    act(() => q('[aria-label="Settings"]')!.click())
    expect([synced, settings]).toEqual([1, 1])
    act(() => root.unmount())
  })

  it('opens at the bottom-right corner by default', () => {
    const { px, root } = render(defaultPanelState({ width: VW, height: VH }))
    expect([px('left'), px('top'), px('width'), px('height')]).toEqual([VW - 400 - 8, VH - 600 - 8, 400, 600])
    act(() => root.unmount())
  })

  it('drags by the whole header, stays inside the viewport and snaps to an edge', () => {
    const { q, px, drag, root } = render(defaultPanelState({ width: VW, height: VH }))
    const title = q('header div')!
    drag(title, [900, 200], [100, 50])
    expect([px('left'), px('top')]).toEqual([0, 42])
    drag(title, [10, 10], [-500, -500])
    expect([px('left'), px('top')]).toEqual([0, 0])
    drag(title, [10, 10], [VW + 500, VH + 500])
    expect([px('left'), px('top')]).toEqual([VW - 400, VH - 600])
    drag(title, [10, 10], [-196, -90])
    expect([px('left'), px('top')]).toEqual([594, 100])
    act(() => root.unmount())
  })

  it('snaps weakly: within 10 px of an edge sticks, farther does not', () => {
    const s = defaultPanelState({ width: VW, height: VH })
    const { q, px, drag, root } = render({ ...s, floating: { x: 300, y: 100, width: 400, height: 600 } })
    const title = q('header div')!
    drag(title, [400, 120], [400 - 292, 120])
    expect(px('left')).toBe(0)
    drag(title, [10, 10], [10 + 20, 10])
    expect(px('left')).toBe(20)
    act(() => root.unmount())
  })

  it('does not start a drag from a header button', () => {
    const { q, px, drag, root } = render(defaultPanelState({ width: VW, height: VH }))
    const left = px('left')
    drag(q('[aria-label="Settings"]')!, [900, 200], [100, 50])
    expect(px('left')).toBe(left)
    act(() => root.unmount())
  })

  it('resizes from all four edges and corners within the limits and the viewport', () => {
    const s = defaultPanelState({ width: VW, height: VH })
    const { q, px, drag, root } = render({ ...s, floating: { x: 400, y: 100, width: 400, height: 500 } })
    const dirs = [...q('section')!.querySelectorAll('[data-dir]')].map((e) => e.getAttribute('data-dir'))
    expect(dirs.sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'])
    drag(q('[data-dir="e"]')!, [800, 300], [900, 300])
    expect(px('width')).toBe(500)
    drag(q('[data-dir="w"]')!, [400, 300], [100, 300])
    expect([px('left'), px('width')]).toEqual([180, 720])
    drag(q('[data-dir="n"]')!, [600, 100], [600, 400])
    expect([px('top'), px('height')]).toEqual([200, 400])
    drag(q('[data-dir="se"]')!, [900, 600], [VW + 100, VH + 100])
    expect(px('left') + px('width')).toBeLessThanOrEqual(VW)
    expect(px('top') + px('height')).toBe(VH)
    act(() => root.unmount())
  })

  it('docks full height on the right, narrows the page, resizes from the left edge and undocks by dragging left', async () => {
    const { q, px, drag, host, root } = render(defaultPanelState({ width: VW, height: VH }))
    act(() => q('[aria-label="Dock panel"]')!.click())
    await tick()
    expect([px('left'), px('width')]).toEqual([VW - 400, 400])
    expect(host.style.getPropertyValue('height')).toBe('100vh')
    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--fap-aio-dock-w')).toBe('400px')
    expect([...q('section')!.querySelectorAll('[data-dir]')].map((e) => e.getAttribute('data-dir'))).toEqual(['w'])
    drag(q('[data-dir="w"]')!, [VW - 400, 300], [VW - 700, 300])
    expect(px('width')).toBe(640)
    drag(q('header div')!, [VW - 300, 20], [VW - 330, 20])
    expect(q('[aria-label="Undock panel"]')).toBeTruthy()
    drag(q('header div')!, [VW - 300, 20], [VW - 400, 20])
    expect(q('[aria-label="Dock panel"]')).toBeTruthy()
    await tick()
    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false)
    act(() => root.unmount())
  })

  it('covers the page instead when the user chose cover', async () => {
    await c.storage.local.set({ 'panel.prefs': { schemaVersion: 1, updatedAt: 0, data: { ...defaultPrefs(), docked: 'cover' } } })
    const { q, root } = render({ ...defaultPanelState({ width: VW, height: VH }), mode: 'docked' })
    await tick()
    expect(q('[aria-label="Undock panel"]')).toBeTruthy()
    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false)
    act(() => root.unmount())
  })

  it('becomes an overlay drawer below 900 px that closes on Escape', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    const { px, host, root } = render({ ...defaultPanelState({ width: 800, height: VH }), mode: 'docked' })
    await tick()
    expect([px('left'), px('width')]).toEqual([0, 800])
    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false)
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(host.querySelector('[aria-label="Open FAP-AIO panel"]')).toBeTruthy()
    act(() => root.unmount())
  })

  it('minimizes to a draggable edge tab that reopens at the bottom-right with the last size', () => {
    const s = defaultPanelState({ width: VW, height: VH })
    const { q, px, ptr, root } = render({ ...s, floating: { x: 50, y: 40, width: 500, height: 450 } })
    act(() => q('[aria-label="Minimize panel"]')!.click())
    const tab = q('[aria-label="Open FAP-AIO panel"]')!
    expect(tab.textContent).toBe('FAP-AIO')
    expect([px('left'), px('width'), px('height')]).toEqual([VW - 32, 32, 100])
    const top = px('top')
    ptr(tab, 'pointerdown', VW - 10, top + 50)
    ptr(tab, 'pointermove', VW - 10, top - 150)
    ptr(tab, 'pointerup', VW - 10, top - 150)
    act(() => tab.click())
    expect(px('top')).toBe(top - 200)
    expect(q('[aria-label="Open FAP-AIO panel"]')).toBeTruthy()
    act(() => q('[aria-label="Open FAP-AIO panel"]')!.click())
    expect([px('left'), px('top'), px('width'), px('height')]).toEqual([VW - 500 - 8, VH - 450 - 8, 500, 450])
    act(() => root.unmount())
  })

  it('keeps the edge tab inside the viewport and moves it with arrow keys', () => {
    const { q, px, ptr, root } = render({ ...defaultPanelState({ width: VW, height: VH }), collapsed: true, edgeTabTop: 300 })
    const tab = q('[aria-label="Open FAP-AIO panel"]')!
    act(() => { tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })) })
    expect(px('top')).toBe(284)
    ptr(tab, 'pointerdown', VW - 10, 300)
    ptr(tab, 'pointermove', VW - 10, 5000)
    ptr(tab, 'pointerup', VW - 10, 5000)
    expect(px('top')).toBe(VH - 100)
    act(() => root.unmount())
  })

  it('reopens a docked panel docked', () => {
    const { q, px, root } = render({ ...defaultPanelState({ width: VW, height: VH }), mode: 'docked', collapsed: true })
    act(() => q('[aria-label="Open FAP-AIO panel"]')!.click())
    expect([px('left'), px('width')]).toEqual([VW - 400, 400])
    act(() => root.unmount())
  })

  it('migrates panel state v1 to v2', () => {
    expect(panelStateV1toV2({ x: 10, y: 20, width: 380, height: 500, minimized: true, view: 'exams' })).toEqual({
      mode: 'floating', floating: { x: 10, y: 20, width: 380, height: 500 }, dockedWidth: 400, collapsed: true,
      route: { tab: 'schedule', sub: 'exams' }, density: 'comfortable',
    })
    expect(panelStateV1toV2({}).route).toEqual({ tab: 'today' })
  })

  it('stores prefs with defaults, and fills the docked default into older prefs', async () => {
    expect(await readPrefs()).toEqual(defaultPrefs())
    await c.storage.local.set({ 'panel.prefs': { schemaVersion: 1, updatedAt: 0, data: { pageAware: true, keybinds: {}, recents: [], firstRun: 'done' } } })
    expect((await readPrefs()).docked).toBe('narrow')
    await updatePrefs((p) => ({ ...p, recents: ['a'] }))
    expect(await readPrefs()).toMatchObject({ recents: ['a'], docked: 'narrow' })
  })
})
