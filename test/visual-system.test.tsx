// @vitest-environment happy-dom
// PNL-3.1: tokens and density, icon sprite, focus ring, targets, motion and the virtualized list (panel-ux R10).
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'
import { mountPanel } from '../src/content/panel/host'
import { ICON_NAMES, Icon, IconSprite } from '../src/content/panel/icons'
import { VirtualList, visibleRange } from '../src/content/panel/VirtualList'
import { setSettings } from '../src/shared/settings'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const css = readFileSync('src/content/panel/panel.css', 'utf8')
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('panel tokens', () => {
  it('define both densities with the design values', () => {
    const block = (sel: string) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)))
    const host = block(':host {')
    expect(host).toMatch(/--aio-font-size: 14px/)
    expect(host).toMatch(/--aio-control-h: 32px/)
    expect(host).toMatch(/--aio-hit: 24px/)
    const compact = block(":host([data-density='compact'])")
    for (const v of ['--aio-font-size: 13px', '--aio-line: 1.4', '--aio-small: 11.5px', '--aio-control-h: 28px', '--aio-row-py: 4px', '--aio-gap: 10px']) expect(compact).toContain(v)
  })

  it('give every control a focus ring and a 24 px target, and drop motion on request', () => {
    expect(css).toMatch(/:focus-visible \{\s*outline: 2px solid var\(--aio-accent\)/)
    expect(css).toMatch(/min-height: var\(--aio-hit\);\s*min-width: var\(--aio-hit\)/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 0\.01ms !important/)
  })
})

describe('density on the host', () => {
  beforeEach(() => {
    installFakeChrome()
    document.body.innerHTML = '<div class="wrapper"></div>'
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  it('follows the general.density setting, comfortable by default', async () => {
    let host!: HTMLElement
    await act(async () => { host = (await mountPanel(document, '')).host })
    expect(host.getAttribute('data-density')).toBe('comfortable')
    await act(async () => { await setSettings({ 'general.density': 'compact' }); await tick() })
    expect(host.getAttribute('data-density')).toBe('compact')
  })

  it('draws the icon sprite once in the shadow root', async () => {
    let shadow!: ShadowRoot
    await act(async () => { shadow = (await mountPanel(document, '')).shadow })
    expect(shadow.querySelectorAll('symbol')).toHaveLength(ICON_NAMES.length)
    const uses = [...shadow.querySelectorAll('svg[data-icon] use')].map((u) => u.getAttribute('href')!.slice(1))
    expect(uses.length).toBeGreaterThan(0)
    for (const id of uses) expect(shadow.getElementById(id)).toBeTruthy()
  })
})

describe('icons', () => {
  it('refer to sprite symbols', async () => {
    const el = document.createElement('div')
    await act(async () => { createRoot(el).render(<><IconSprite /><Icon name="bell" size={16} /></>) })
    const svg = el.querySelector('svg[data-icon="bell"]')!
    expect(svg.getAttribute('width')).toBe('16')
    expect(svg.querySelector('use')!.getAttribute('href')).toBe('#aio-i-bell')
    expect(el.querySelector('#aio-i-bell')).toBeTruthy()
  })
})

describe('VirtualList', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => `Item ${i}`)
  const mount = async (n: number) => {
    const el = document.createElement('div')
    await act(async () => {
      createRoot(el).render(<VirtualList items={items(n)} rowHeight={20} height={200} label="Items" itemKey={(x) => x} render={(x) => <span>{x}</span>} />)
    })
    return el
  }

  it('renders short lists in full and long lists as a window that follows scrolling', async () => {
    expect((await mount(100)).querySelectorAll('li')).toHaveLength(100)
    const el = await mount(1000)
    const rows = () => [...el.querySelectorAll('li')].map((li) => li.textContent)
    expect(rows().length).toBeLessThanOrEqual(10 + 6 + 1)
    expect(rows()[0]).toBe('Item 0')
    const box = el.querySelector('[data-virtual]') as HTMLElement
    await act(async () => { box.scrollTop = 4000; box.dispatchEvent(new Event('scroll')) })
    expect(rows()).toContain('Item 200')
    expect(rows()).not.toContain('Item 0')
    expect(el.querySelector('ul')!.getAttribute('aria-rowcount')).toBe('1000')
  })

  it('computes the visible range with overscan', () => {
    expect(visibleRange(1000, 20, 200, 0, 6)).toEqual([0, 16])
    expect(visibleRange(1000, 20, 200, 4000, 6)).toEqual([194, 216])
    expect(visibleRange(30, 20, 200, 500, 6)).toEqual([19, 30])
  })
})
