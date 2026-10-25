// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { bottomRight, clampDockWidth, clampFloating, moveRect, resizeRect } from '../src/content/panel/geometry'
import { DOCK_CLASS, setPageDock } from '../src/content/panel/page-dock'
import { provideSyncAll, resetSyncAll, runSyncAll } from '../src/content/panel/actions'
import { StatusStrip, ViewStatusStrip, stampText } from '../src/content/panel/StatusStrip'
import { SettingsView } from '../src/content/panel/SettingsView'
import { PanelRouter } from '../src/content/panel/router'
import { clearViews, registerView } from '../src/content/panel/views'
import { FapQueue } from '../src/content/fap/queue'
import { readPrefs } from '../src/shared/panel-prefs'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

function render(node: JSX.Element) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(node))
  return { el, root }
}

describe('geometry', () => {
  const r = { x: 100, y: 100, width: 400, height: 500 }
  it('keeps floating rectangles inside the viewport and within the limits', () => {
    expect(clampFloating({ x: -50, y: 900, width: 100, height: 100 }, 1200, 800)).toEqual({ x: 0, y: 400, width: 320, height: 400 })
    expect(clampFloating({ x: 0, y: 0, width: 2000, height: 2000 }, 1200, 800)).toEqual({ x: 0, y: 0, width: 720, height: 800 })
    expect(clampFloating({ x: 0, y: 0, width: 400, height: 600 }, 300, 350)).toEqual({ x: 0, y: 0, width: 300, height: 350 })
  })
  it('snaps within 10 px and not beyond', () => {
    expect(moveRect(r, -91, 0, 1200, 800).x).toBe(0)
    expect(moveRect(r, -89, 0, 1200, 800).x).toBe(11)
    expect(moveRect(r, 691, 0, 1200, 800).x).toBe(800)
    expect(moveRect(r, 0, 191, 1200, 800).y).toBe(300)
  })
  it('resizes from corners keeping the opposite corner fixed', () => {
    expect(resizeRect(r, 'nw', -50, -50, 1200, 800)).toEqual({ x: 50, y: 50, width: 450, height: 550 })
    expect(resizeRect(r, 'se', 1000, 1000, 1200, 800)).toEqual({ x: 100, y: 100, width: 720, height: 700 })
    expect(resizeRect(r, 'ne', 0, 300, 1200, 800)).toEqual({ x: 100, y: 200, width: 400, height: 400 })
  })
  it('reopens at the bottom-right and clamps the docked width', () => {
    expect(bottomRight(r, 1200, 800)).toEqual({ x: 792, y: 292, width: 400, height: 500 })
    expect([clampDockWidth(100, 1200), clampDockWidth(900, 1200), clampDockWidth(500, 400)]).toEqual([320, 640, 400])
  })
})

describe('page narrowing', () => {
  it('adopts one stylesheet and toggles the class and width', () => {
    const before = document.adoptedStyleSheets.length
    setPageDock(420)
    setPageDock(380)
    expect(document.adoptedStyleSheets.length).toBe(before + 1)
    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--fap-aio-dock-w')).toBe('380px')
    expect(document.querySelectorAll('style')).toHaveLength(0)
    setPageDock(null)
    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false)
  })
})

describe('header sync and the status strip', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome(); resetSyncAll(); clearViews(); document.body.innerHTML = '' })

  it('shows progress while Sync runs, then the error with what to do', async () => {
    let finish!: (v: { ok: false; text: string }) => void
    provideSyncAll(() => new Promise((r) => { finish = r }))
    const { el, root } = render(<StatusStrip q={new FapQueue()} />)
    let run!: Promise<void>
    act(() => { run = runSyncAll() })
    expect(el.textContent).toContain('Syncing this week and exams…')
    await act(async () => { finish({ ok: false, text: 'Your FAP session ended. Sign in to FAP again, then retry.' }); await run })
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Sign in to FAP again')
    act(() => root.unmount())
  })

  it('stamps the open view: one store or several', async () => {
    expect(stampText([{ label: 'Classes', at: null }])).toBe('Not synced yet')
    expect(stampText([{ label: 'Classes', at: 0 }, { label: 'Exams', at: null }], 120_000)).toBe('Classes synced 2 min ago · Exams not synced yet')
    registerView({ tab: 'schedule', sub: 'exams', label: 'Exams', icon: 'x', component: async () => () => null, lastSync: [{ label: 'Exams', key: 'exams' }] })
    registerView({ tab: 'schedule', sub: 'week', label: 'Classes', icon: 'x', component: async () => () => null, lastSync: [{ label: 'Classes', key: 'timetable' }] })
    const router = new PanelRouter({ tab: 'schedule', sub: 'exams' })
    const { el, root } = render(<ViewStatusStrip router={router} q={new FapQueue()} />)
    await tick()
    expect(el.textContent).toContain('Not synced yet')
    await act(async () => { await c.storage.local.set({ exams: { schemaVersion: 1, updatedAt: 0, data: { exams: [], lastSync: Date.now() - 120_000 } } }) })
    await tick()
    expect(el.textContent).toContain('Synced 2 min ago')
    act(() => router.go({ tab: 'schedule', sub: 'week' }))
    await tick()
    expect(el.textContent).toContain('Not synced yet')
    act(() => root.unmount())
  })
})

describe('settings view', () => {
  beforeEach(() => { installFakeChrome(); document.body.innerHTML = '' })

  it('switches the docked behaviour between narrow and cover', async () => {
    const { el, root } = render(<SettingsView />)
    await tick()
    const radios = [...el.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios.map((r) => r.parentElement!.textContent)).toEqual(['Narrow the page', 'Cover the page'])
    expect(radios[0]!.checked).toBe(true)
    await act(async () => { radios[1]!.click() })
    await tick()
    expect((await readPrefs()).docked).toBe('cover')
    act(() => root.unmount())
  })
})
