// @vitest-environment happy-dom
// APP-4.1: the Theme view, preview on this page, duplicate, FAP default and auto mode (appearance R2.5,
// R2.6, R1.4, R5.5).
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { read, write } from '../src/shared/storage/catalog'
import { PREVIEW_EVENT, readPreview, sendPreview } from '../src/features/appearance/preview'
import { startAppearance } from '../src/features/appearance/early'
import { toActiveStyle } from '../src/features/appearance/themes/model'
import { PRESETS, presetById } from '../src/features/appearance/themes/presets'
import { MAX_CUSTOM, applyAuto, applyFapDefault, applyTheme, customThemes, deleteCustom, duplicateTheme } from '../src/features/appearance/themes/store'
import { ThemeView } from '../src/features/appearance/views/ThemeView'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const glass = presetById('glassmorphism')!.theme
const black = presetById('minimalist-black')!.theme

beforeEach(() => {
  installFakeChrome()
  document.adoptedStyleSheets = []
  document.documentElement.removeAttribute('data-bs-theme')
  document.body.innerHTML = ''
})

describe('theme store', () => {
  it('duplicate into custom themes with unique ids and names, up to 20, and delete', async () => {
    const a = await duplicateTheme(glass)
    const b = await duplicateTheme(glass)
    expect(typeof a !== 'string' && [a.id, a.name, a.preset]).toEqual(['glassmorphism-copy-1', 'Glassmorphism copy', 'glassmorphism'])
    expect(typeof b !== 'string' && [b.id, b.name]).toEqual(['glassmorphism-copy-2', 'Glassmorphism copy 2'])
    for (let i = 2; i < MAX_CUSTOM; i++) await duplicateTheme(black)
    expect(await duplicateTheme(black)).toMatch(/20 custom themes/)
    expect(await customThemes()).toHaveLength(MAX_CUSTOM)
    await deleteCustom('glassmorphism-copy-1')
    expect((await customThemes()).map((t) => t.id)).not.toContain('glassmorphism-copy-1')
  })

  it('apply one theme, light and dark, or FAP default, keeping safe mode', async () => {
    await write('appearance.active', { active: { mode: 'fap-default' }, safeMode: true })
    await applyTheme(glass)
    expect(await read('appearance.active')).toEqual({ active: { mode: 'single', style: toActiveStyle(glass) }, safeMode: true })
    await applyAuto(glass, black)
    const auto = (await read('appearance.active'))!.active
    expect(auto.mode === 'auto' && [auto.light.id, auto.dark.id]).toEqual(['glassmorphism', 'minimalist-black'])
    await applyFapDefault()
    expect(await read('appearance.active')).toEqual({ active: { mode: 'fap-default' }, safeMode: true })
  })
})

describe('preview on this page', () => {
  it('shows a theme without storing it, and ends back on the stored choice', async () => {
    await applyTheme(black)
    const a = startAppearance(document, window)
    await a.ready
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
    // A light glass preset (Glassmorphism is dark since F-24).
    sendPreview({ kind: 'style', style: toActiveStyle(presetById('liquid-glass')!.theme) })
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
    expect(a.pipeline.get('effects')).toContain('backdrop-filter: blur(20px)')
    sendPreview({ kind: 'fap-default' })
    expect(a.pipeline.get('vars')).toBeNull()
    sendPreview(null)
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
    expect(a.pipeline.get('effects')).toBe(black.effects)
    expect((await read('appearance.active'))!.active).toMatchObject({ mode: 'single', style: { id: 'minimalist-black' } })
  })

  it('ignores a malformed preview', () => {
    const ev = (detail: unknown) => new CustomEvent(PREVIEW_EVENT, { detail })
    expect(readPreview(ev('{"kind":"style","style":{"id":"x"}}'))).toBeNull()
    expect(readPreview(ev('nope'))).toBeNull()
    expect(readPreview(ev({ kind: 'fap-default' }))).toBeNull()
    expect(readPreview(ev('{"kind":"fap-default"}'))).toEqual({ kind: 'fap-default' })
  })
})

describe('Theme view', () => {
  async function render() {
    const el = document.createElement('div')
    document.body.append(el)
    const root = createRoot(el)
    await act(async () => { root.render(<ThemeView />) })
    await tick(); await tick()
    return { el, root }
  }
  const btn = (el: Element, name: string, within?: string) => {
    const scope = within ? [...el.querySelectorAll('li')].find((li) => li.querySelector('p')?.textContent?.startsWith(within))! : el
    return [...scope.querySelectorAll('button')].find((b) => b.textContent === name || b.getAttribute('aria-label') === name)!
  }
  const click = async (b: HTMLElement) => { await act(async () => { b.click() }); await tick() }

  it('list the light and dark presets, preview one, apply it, and end the preview on close', async () => {
    const previews: (string | null)[] = []
    document.addEventListener(PREVIEW_EVENT, (e) => previews.push((e as CustomEvent<string | null>).detail === null ? null : JSON.parse((e as CustomEvent<string>).detail).kind))
    const { el, root } = await render()
    expect(el.textContent).toContain('In use: FAP default')
    const names = (label: string) => [...el.querySelectorAll(`section[aria-label="${label}"] li p`)].map((p) => p.textContent)
    expect(names('Light themes')).toEqual(PRESETS.filter((p) => p.theme.mode === 'light').map((p) => p.theme.name))
    expect(names('Dark themes')).toHaveLength(5)
    await click(btn(el, 'Preview', 'Neumorphism'))
    expect(previews).toEqual(['style'])
    expect(el.querySelector('[role="status"]')!.textContent).toContain('Previewing Neumorphism on this page')
    await click(btn(el, 'Apply', 'Neumorphism'))
    expect((await read('appearance.active'))!.active).toMatchObject({ mode: 'single', style: { id: 'neumorphism' } })
    expect(el.textContent).toContain('In use: Neumorphism')
    expect(el.textContent).toContain('Neumorphism is on for every FAP page.')
    expect(previews.at(-1)).toBeNull()
    await click(btn(el, 'Preview', 'Liquid Glass'))
    act(() => root.unmount())
    expect(previews.at(-1)).toBeNull()
  })

  it('set light and dark themes in auto mode, duplicate into Your themes, and go back to FAP default', async () => {
    const { el } = await render()
    await click(btn(el, 'Light and dark'))
    const applyPair = btn(el, 'Apply light and dark')
    expect(applyPair.disabled).toBe(true)
    await click(btn(el, 'Use for light', 'Claymorphism'))
    await click(btn(el, 'Use for dark', 'Glassmorphism Dark'))
    await click(btn(el, 'Apply light and dark'))
    const a = (await read('appearance.active'))!.active
    expect(a.mode === 'auto' && [a.light.id, a.dark.id]).toEqual(['claymorphism', 'glassmorphism-dark'])
    expect(el.textContent).toContain('In use: Claymorphism (light) and Glassmorphism Dark (dark)')
    await click(btn(el, 'Duplicate Minimalist White'))
    expect(el.querySelector('section[aria-label^="Your themes"]')!.textContent).toContain('Minimalist White copy')
    expect(el.textContent).toContain('Your themes (1 of 20)')
    await click(btn(el, 'Delete Minimalist White copy'))
    expect(el.querySelector('section[aria-label^="Your themes"]')).toBeNull()
    await click(btn(el, 'Use FAP default'))
    expect((await read('appearance.active'))!.active).toEqual({ mode: 'fap-default' })
  })
})
