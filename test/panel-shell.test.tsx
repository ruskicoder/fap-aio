// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { PanelApp, clampFloating } from '../src/content/panel/PanelApp'
import { defaultPanelState, type PanelState } from '../src/shared/panel-state'
import { panelStateV1toV2 } from '../src/shared/storage/steps'
import { defaultPrefs, readPrefs, updatePrefs } from '../src/shared/panel-prefs'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

function render(state: PanelState, props: Partial<Parameters<typeof PanelApp>[0]> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<PanelApp initial={state} host={host} {...props} />))
  return { host, root, q: (s: string) => host.querySelector<HTMLElement>(s) }
}

describe('panel shell', () => {
  beforeEach(() => {
    installFakeChrome()
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  it('has the header controls and a gear menu', () => {
    const picked: string[] = []
    const { q, root } = render(defaultPanelState(), { unread: 3, onMenu: (m) => picked.push(m) })
    for (const l of ['Open command palette', 'Alerts, 3 unread', 'Dock panel', 'Menu', 'Minimize panel']) expect(q(`[aria-label="${l}"]`), l).toBeTruthy()
    act(() => q('[aria-label="Menu"]')!.click())
    const items = [...document.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent)
    expect(items).toEqual(['Theme', 'Settings', 'Help', 'Shortcuts'])
    act(() => (document.querySelectorAll('[role="menuitem"]')[1] as HTMLElement).click())
    expect(picked).toEqual(['settings'])
    act(() => root.unmount())
  })

  it('docks full height on the right and collapses to a 48 px rail', () => {
    const { q, host, root } = render(defaultPanelState())
    act(() => q('[aria-label="Dock panel"]')!.click())
    expect(host.style.getPropertyValue('left')).toBe('800px')
    expect(host.style.getPropertyValue('height')).toBe('100vh')
    act(() => q('[aria-label="Minimize panel"]')!.click())
    expect(q('nav[aria-label="FAP-AIO rail"]')).toBeTruthy()
    expect(host.style.getPropertyValue('width')).toBe('48px')
    act(() => q('[aria-label="Expand panel"]')!.click())
    expect(q('[aria-label="Undock panel"]')).toBeTruthy()
    act(() => root.unmount())
  })

  it('collapses a floating panel to a pill with the alert count', () => {
    const { q, root } = render({ ...defaultPanelState(), collapsed: true }, { unread: 2 })
    expect(q('[aria-label="Restore FAP-AIO panel, 2 unread alerts"]')).toBeTruthy()
    act(() => root.unmount())
  })

  it('applies the floating size limits', () => {
    expect(clampFloating({ x: 0, y: 0, width: 100, height: 100 }, 1200, 800)).toMatchObject({ width: 320, height: 360 })
    expect(clampFloating({ x: 0, y: 0, width: 2000, height: 2000 }, 1200, 800)).toMatchObject({ width: 720, height: 800 })
  })

  it('migrates panel state v1 to v2', () => {
    expect(panelStateV1toV2({ x: 10, y: 20, width: 380, height: 500, minimized: true, view: 'exams' })).toEqual({
      mode: 'floating', floating: { x: 10, y: 20, width: 380, height: 500 }, dockedWidth: 400, collapsed: true,
      route: { tab: 'schedule', sub: 'exams' }, density: 'comfortable',
    })
    expect(panelStateV1toV2({}).route).toEqual({ tab: 'today' })
  })

  it('stores prefs with defaults', async () => {
    expect(await readPrefs()).toEqual(defaultPrefs())
    await updatePrefs((p) => ({ ...p, recents: ['a'] }))
    expect((await readPrefs()).recents).toEqual(['a'])
  })
})
