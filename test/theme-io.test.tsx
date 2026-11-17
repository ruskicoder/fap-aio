// @vitest-environment happy-dom
// APP-5.1: theme management, export, import with sanitizing and preview (appearance R5.1 to R5.4; platform R7.4).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { sanitizeCss } from '../src/background/css-validate'
import { stillUnsafe } from '../src/shared/css-safety'
import { exportText, importTheme, newTheme, type Sanitize } from '../src/features/appearance/themes/io'
import { presetById } from '../src/features/appearance/themes/presets'
import { customThemes } from '../src/features/appearance/themes/store'
import { ThemeView } from '../src/features/appearance/views/ThemeView'
import type { Theme } from '../src/features/appearance/themes/model'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const local: Sanitize = async (css) => sanitizeCss(css)
const base = presetById('minimalist-white')!.theme

beforeEach(() => {
  installFakeChrome()
  document.body.innerHTML = ''
})

describe('sanitizer', () => {
  it('removes @import and web addresses, keeps data: images and the rest of the text as written', () => {
    const css = '@import url("https://evil.example/x.css");\n.card {\n  color: red;\n  background: url(https://evil.example/p.png?c=1) no-repeat;\n}\n.btn { background-image: url("data:image/png;base64,AAAA"); }\n'
    const r = sanitizeCss(css)
    if ('error' in r) throw new Error(r.error)
    expect(r.css).toBe('\n.card {\n  color: red;\n  background: none no-repeat;\n}\n.btn { background-image: url("data:image/png;base64,AAAA"); }\n')
    expect(r.removed).toEqual(['@import rule', 'web address https://evil.example/p.png?c=1'])
  })

  it('catches image-set, protocol-relative, upper case and web addresses in custom properties', () => {
    for (const css of [
      '.a { background: image-set("https://evil.example/a.png" 1x); }',
      '.a { background: URL(//evil.example/a.png); }',
      ':root { --x: url(https://evil.example/a.png); }',
      '.a { cursor: url(http://evil.example/c.cur), auto; }',
    ]) {
      const r = sanitizeCss(css)
      expect('error' in r ? r.error : r.removed.length).toBeGreaterThan(0)
      if (!('error' in r)) expect(stillUnsafe(r.css)).toBe(false)
    }
  })

  it('refuses what it cannot remove safely, such as escaped url()', () => {
    expect(stillUnsafe('.a { background: \\75 rl(https://evil.example/a.png) }')).toBe(true)
    expect(sanitizeCss('.a { background: \\75 rl(https://evil.example/a.png) }')).toEqual({ error: expect.stringContaining('could not be removed safely') })
    expect(stillUnsafe('.a { background: url(data:image/png;base64,AA) }')).toBe(false)
  })
})

describe('import and export', () => {
  it('exports a theme that imports back with a new id', async () => {
    const t: Theme = { ...base, id: 'paper', name: 'Paper', preset: 'minimalist-white', css: '.card { color: red; }' }
    const r = await importTheme(exportText(t), ['imported-paper'], local)
    if ('error' in r) throw new Error(r.error)
    expect(r.theme).toEqual({ ...t, id: 'imported-paper-2' })
    expect(r.removed).toEqual([])
  })

  it('sanitizes CSS, style rules and variables, and lists what was removed', async () => {
    const t = { ...base, id: 'x', name: 'Évil theme', css: '@import "a.css";\n.card{}', effects: '.btn { background: url(https://e.example/b.png) }', vars: { '--ct-body-bg': 'url(https://e.example/bg.png)', '--ct-primary': '#123456' } }
    const r = await importTheme(JSON.stringify(t), [], local)
    if ('error' in r) throw new Error(r.error)
    expect(r.theme.id).toBe('imported-evil-theme')
    expect(r.theme.css).toBe('\n.card{}')
    expect(r.theme.effects).toBe('.btn { background: none }')
    expect(r.theme.vars).toEqual({ '--ct-primary': '#123456' })
    expect(r.removed).toEqual(['@import rule (custom CSS)', 'web address https://e.example/b.png (style rules)', 'web address in --ct-body-bg'])
  })

  it('refuses files that are not themes, too large, or that cannot be cleaned', async () => {
    expect(await importTheme('nope', [], local)).toEqual({ error: expect.stringContaining('not JSON') })
    expect(await importTheme(JSON.stringify({ formatVersion: 2 }), [], local)).toEqual({ error: expect.stringContaining('not a FAP-AIO theme') })
    expect(await importTheme(JSON.stringify({ ...base, css: 'a'.repeat(200_001) }), [], local)).toEqual({ error: 'Its custom CSS is over 200 KB.' })
    expect(await importTheme('x'.repeat(2_000_001), [], local)).toEqual({ error: expect.stringContaining('over 2 MB') })
    expect(await importTheme(JSON.stringify({ ...base, css: '.a{background:\\75 rl(https://e.example)}' }), [], local)).toEqual({ error: expect.stringContaining('could not be removed safely') })
  })

  it('creates new themes with free ids', () => {
    expect(newTheme([]).id).toBe('custom-1')
    expect(newTheme(['custom-1']).name).toBe('My theme 2')
  })
})

describe('Theme view', () => {
  async function render() {
    const el = document.createElement('div')
    document.body.append(el)
    await act(async () => { createRoot(el).render(<ThemeView />) })
    await tick(); await tick()
    const b = (name: string) => [...el.querySelectorAll('button')].find((x) => x.textContent === name || x.getAttribute('aria-label') === name)!
    return { el, b }
  }

  it('creates a new theme and opens it in the editor', async () => {
    const { el, b } = await render()
    await act(async () => { b('New theme').click() })
    await tick()
    expect((await customThemes()).map((t) => t.name)).toEqual(['My theme'])
    expect(el.textContent).toContain('Custom CSS')
    expect(el.querySelector<HTMLInputElement>('input[maxlength="60"]')!.value).toBe('My theme')
  })

  it('imports with a warning and the removed list, and saves on request; exports through a blob link', async () => {
    const chrome = (globalThis as unknown as { chrome: { runtime: { onMessage: { addListener: (f: (m: { type: string; css: string }, s: unknown, r: (x: unknown) => void) => boolean) => void } } } }).chrome
    chrome.runtime.onMessage.addListener((m, _s, respond) => { if (m.type === 'css.sanitize') respond({ ok: true, value: sanitizeCss(m.css) }); return false })
    const { el, b } = await render()
    const file = new File([JSON.stringify({ ...base, id: 'z', name: 'Shared', css: '@import "x.css";\n.card{}' })], 'shared.json', { type: 'application/json' })
    const input = el.querySelector<HTMLInputElement>('input[type="file"][aria-label="Theme file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await tick(20)
    const region = el.querySelector('[role="region"][aria-label="Import a theme"]')!
    expect(region.textContent).toContain('Import Shared?')
    expect(region.textContent).toContain('This theme comes from outside FAP-AIO')
    expect(region.textContent).toContain('@import rule (custom CSS)')
    expect(await customThemes()).toEqual([])
    await act(async () => { b('Save to Your themes').click() })
    await tick()
    expect((await customThemes()).map((t) => [t.id, t.css])).toEqual([['imported-shared', '\n.card{}']])
    expect(el.textContent).toContain('Shared is in Your themes.')
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    await act(async () => { b('Export Shared').click() })
    expect(create).toHaveBeenCalledTimes(1)
    const blob = create.mock.calls[0]![0] as Blob
    expect(JSON.parse(await blob.text()).name).toBe('Shared')
    create.mockRestore()
  })
})
