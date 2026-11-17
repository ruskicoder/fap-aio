// @vitest-environment happy-dom
// APP-4.2: colour editor and background images (appearance R3.1, R3.2, R3.4 to R3.6, R4.4).
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { read } from '../src/shared/storage/catalog'
import { PREVIEW_EVENT } from '../src/features/appearance/preview'
import { userCss } from '../src/features/appearance/pipeline'
import { presetById } from '../src/features/appearance/themes/presets'
import { toActiveStyle, type Theme } from '../src/features/appearance/themes/model'
import { applyAuto, applyTheme, customThemes, duplicateTheme, saveCustom } from '../src/features/appearance/themes/store'
import { MAX_BYTES, REMOTE_REFUSED, encodeUnder, fitSize, isRemote } from '../src/features/appearance/editor/image'
import { checks, fixRole } from '../src/features/appearance/editor/checks'
import { contrast } from '../src/features/appearance/color'
import { ThemeView } from '../src/features/appearance/views/ThemeView'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const white = presetById('minimalist-white')!.theme

beforeEach(() => {
  installFakeChrome()
  document.body.innerHTML = ''
})

describe('images', () => {
  it('fit within 2560 px without enlarging, and refuse web addresses', () => {
    expect(fitSize(5120, 2880)).toEqual({ w: 2560, h: 1440 })
    expect(fitSize(1000, 4000)).toEqual({ w: 640, h: 2560 })
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 })
    expect(isRemote('https://example.com/a.png')).toBe(true)
    expect(isRemote('//cdn.example/a.png')).toBe(true)
    expect(isRemote('C:\\pictures\\a.png')).toBe(false)
    expect(REMOTE_REFUSED).toContain('FAP only allows images stored with the theme')
  })

  it('lower quality, then size, until the image is under 300 KB', async () => {
    const tried: string[] = []
    const enc = (bytes: (s: number, q: number) => number) => async (s: number, q: number) => { tried.push(`${s}/${q}`); return new Blob([new Uint8Array(bytes(s, q))]) }
    expect((await encodeUnder(enc((s, q) => Math.round(400_000 * s * s * q))))!.size).toBeLessThanOrEqual(MAX_BYTES)
    expect(tried).toEqual(['1/0.85', '1/0.7'])
    tried.length = 0
    expect(await encodeUnder(enc(() => MAX_BYTES + 1))).toBeNull()
    expect(tried).toHaveLength(16)
  })

  it('show the image over preset gradients: same specificity as the effects, later layer', () => {
    const css = userCss({ ...toActiveStyle(white), background: { dataUrl: 'data:image/webp;base64,AAAA', fit: 'tile', dim: 0.3 } }, false)
    expect(css).toMatch(/^html\[data-bs-theme\] body\{background-image:linear-gradient\(rgba\(0,0,0,0\.3\),rgba\(0,0,0,0\.3\)\),url\("data:image\/webp;base64,AAAA"\);background-size:auto;background-repeat:repeat/)
  })
})

describe('contrast checks', () => {
  it('measure text at 4.5:1 and controls at 3:1 on both surfaces, and fix a failing colour', () => {
    const r = { ...white.roles, textMuted: '#bbbbbb' }
    const bad = checks(r).filter((c) => !c.ok)
    expect(bad.map((c) => `${c.fg}/${c.bg}`)).toEqual(['textMuted/surface', 'textMuted/surfaceAlt'])
    const fixed = fixRole(r, 'textMuted', 4.5)
    expect(contrast(fixed, r.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(fixed, r.surfaceAlt)).toBeGreaterThanOrEqual(4.5)
    expect(checks(white.roles).every((c) => c.ok)).toBe(true)
  })
})

describe('saving', () => {
  it('saves a custom theme in place and refreshes the active style where it is in use', async () => {
    const copy = (await duplicateTheme(white)) as Theme
    await applyAuto(copy, presetById('minimalist-black')!.theme)
    expect(await saveCustom({ ...copy, name: 'Paper', roles: { ...copy.roles, primary: '#0f766e' } })).toBeNull()
    expect((await customThemes())[0]!.name).toBe('Paper')
    const a = (await read('appearance.active'))!.active
    expect(a.mode === 'auto' && a.light.vars['--ct-primary']).toBe('#0f766e')
    await applyTheme({ ...copy, name: 'Paper' })
    await saveCustom({ ...copy, name: 'Paper', css: '.card { color: red; }' })
    const s = (await read('appearance.active'))!.active
    expect(s.mode === 'single' && s.style.css).toBe('.card { color: red; }')
    expect(await saveCustom(white)).toMatch(/Presets cannot be changed/)
    expect(await saveCustom({ ...copy, id: 'gone' })).toMatch(/no longer/)
    expect(await saveCustom({ ...copy, vars: { '--ct-primary': 'x;y' } })).toMatch(/unsafe/)
  })
})

describe('editor', () => {
  async function open() {
    await duplicateTheme(white)
    const el = document.createElement('div')
    document.body.append(el)
    const root = createRoot(el)
    await act(async () => { root.render(<ThemeView />) })
    await tick(); await tick()
    const b = (name: string) => [...el.querySelectorAll('button')].find((x) => x.textContent === name || x.getAttribute('aria-label') === name)!
    await act(async () => { b('Edit Minimalist White copy').click() })
    await tick()
    return { el, root, b }
  }
  const type = async (input: HTMLInputElement | HTMLSelectElement, v: string) => {
    await act(async () => {
      const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, v)
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  it('edits colours with a live preview, fixes contrast, sets a variable and saves', async () => {
    const previews: string[] = []
    document.addEventListener(PREVIEW_EVENT, (e) => { const d = (e as CustomEvent<string | null>).detail; previews.push(d === null ? 'end' : JSON.parse(d).style?.vars['--ct-primary'] ?? 'fap') })
    const { el, b } = await open()
    const text = (label: string) => el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
    await type(text('Primary colour'), 'oklch(55% 0.15 160)')
    await tick(200)
    expect(previews.at(-1)).toMatch(/^#[0-9a-f]{6}$/)
    expect(previews.at(-1)).not.toBe(white.roles.primary)
    await type(text('Muted text colour'), '#cccccc')
    expect(el.textContent).toContain('Muted text on page background')
    await act(async () => { b('Fix muted text on page background').click() })
    await act(async () => { b('Fix muted text on panels and menus')?.click() })
    expect(el.textContent).toMatch(/All 14 pairs are readable/)
    await type(el.querySelector<HTMLSelectElement>('select[aria-label="Variable"]')!, '--ct-border-radius')
    expect(text('Value').value).toBe('6px')
    await type(text('Value'), '12px')
    await act(async () => { b('Set').click() })
    expect(el.textContent).toContain('--ct-border-radius')
    await act(async () => { b('Save').click() })
    await tick()
    const saved = (await customThemes())[0]!
    expect(saved.vars).toEqual({ '--ct-border-radius': '12px' })
    expect(contrast(saved.roles.textMuted, saved.roles.surface)).toBeGreaterThanOrEqual(4.5)
    expect(el.textContent).toContain('Minimalist White copy is saved.')
    expect(previews.at(-1)).toBe('end')
  })

  it('fills the colours from one base colour and harmony, refuses web images, and Cancel keeps the stored theme', async () => {
    const { el, b } = await open()
    const before = (await customThemes())[0]!
    await type(el.querySelector<HTMLInputElement>('input[aria-label="Base colour colour"]')!, '#16a34a')
    await type(el.querySelector<HTMLSelectElement>('#aio-scheme')!, 'complementary')
    expect(el.querySelectorAll('[aria-label="Harmony preview"] span')).toHaveLength(2)
    await act(async () => { b('Fill the colours').click() })
    expect(el.querySelector<HTMLInputElement>('input[aria-label="Primary colour"]')!.value).toBe('#16a34a')
    const zone = el.querySelector('.border-dashed')!
    const ev = new Event('drop', { bubbles: true }) as Event & { dataTransfer: unknown }
    ev.dataTransfer = { files: [], getData: (t: string) => (t === 'text/uri-list' ? 'https://example.com/cat.jpg' : '') }
    await act(async () => { zone.dispatchEvent(ev) })
    expect(el.textContent).toContain('Images from web addresses cannot be used')
    await act(async () => { b('Cancel').click() })
    expect(await customThemes()).toEqual([before])
    expect(el.textContent).toContain('Your themes (1 of 20)')
  })
})
