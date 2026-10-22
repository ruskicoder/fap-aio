// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { mountPanel, HOST_ID } from '../src/content/panel/host'
import { flushPanelState } from '../src/content/panel/store'
import { clampRect, defaultPanelState } from '../src/shared/panel-state'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('panel host', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    document.body.innerHTML = '<div class="wrapper"><div class="content-page"><p id="fap">FAP</p></div></div>'
    document.head.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  it('mounts in a shadow root with an adopted stylesheet and leaves the page styles alone', async () => {
    const before = getComputedStyle(document.getElementById('fap')!).color
    let mounted!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { mounted = await mountPanel(document, '.x { color: red } p { color: red }') })
    expect(document.getElementById(HOST_ID)).toBe(mounted.host)
    expect(mounted.shadow.adoptedStyleSheets).toHaveLength(1)
    expect(document.querySelectorAll('style, link[rel="stylesheet"]')).toHaveLength(0)
    expect(document.body.querySelectorAll('style')).toHaveLength(0)
    expect(getComputedStyle(document.getElementById('fap')!).color).toBe(before)
    expect(mounted.shadow.querySelector('[aria-label="Minimize panel"]')).toBeTruthy()
    act(() => mounted.root.unmount())
  })

  it('minimizes to a handle, restores, and persists the state', async () => {
    let mounted!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { mounted = await mountPanel(document, '') })
    const min = mounted.shadow.querySelector<HTMLButtonElement>('[aria-label="Minimize panel"]')!
    act(() => min.click())
    const restore = mounted.shadow.querySelector<HTMLButtonElement>('[aria-label="Restore FAP-AIO panel"]')!
    expect(restore).toBeTruthy()
    expect(mounted.host.style.getPropertyValue('width')).toBe('40px')
    await flushPanelState()
    expect((c.storage.local.data['panel.state'] as { schemaVersion: number; data: { collapsed: boolean } })).toMatchObject({ schemaVersion: 2, data: { collapsed: true } })
    act(() => restore.click())
    expect(mounted.shadow.querySelector('[aria-label="Minimize panel"]')).toBeTruthy()
    act(() => mounted.root.unmount())
  })

  it('reopens with the saved state and clamps it into the viewport on resize', async () => {
    const saved = { ...defaultPanelState(), floating: { x: 900, y: 300, width: 400, height: 600 } }
    await c.storage.local.set({ 'panel.state': { schemaVersion: 2, updatedAt: 0, data: saved } })
    let mounted!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { mounted = await mountPanel(document, '') })
    expect(mounted.host.style.getPropertyValue('left')).toBe('800px') // 1200 - 400
    expect(mounted.host.style.getPropertyValue('top')).toBe('200px') // 800 - 600
    Object.defineProperty(window, 'innerWidth', { value: 700, configurable: true })
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(mounted.host.style.getPropertyValue('left')).toBe('300px')
    act(() => mounted.root.unmount())
  })

  it('clampRect keeps a rectangle inside the viewport', () => {
    expect(clampRect({ x: -10, y: 5000, width: 400, height: 600 }, 1000, 700)).toEqual({ x: 0, y: 100, width: 400, height: 600 })
    expect(clampRect({ x: 0, y: 0, width: 400, height: 600 }, 300, 500)).toEqual({ x: 0, y: 0, width: 300, height: 500 })
  })
})
