// @vitest-environment happy-dom
// APP-9.1 (fix F-24): the dark panel palette and the scheme switch (appearance R8.1 to R8.4).
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'
import { contrast } from '../src/features/appearance/color'
import { installPanelTheme } from '../src/features/appearance/panel-theme'
import { toActiveStyle } from '../src/features/appearance/themes/model'
import { PRESETS, presetById } from '../src/features/appearance/themes/presets'
import { write } from '../src/shared/storage/catalog'

const css = readFileSync('src/content/panel/panel.css', 'utf8')
const block = /:host\(\[data-scheme='dark'\]\)\s*\{([^}]*)\}/.exec(css)![1]!
const vars = Object.fromEntries([...block.matchAll(/--c-([a-z]+(?:-\d+)?):\s*(\d+) (\d+) (\d+);/g)].map((m) => [m[1]!, `rgb(${m[2]}, ${m[3]}, ${m[4]})`]))
const c = (k: string) => { const v = vars[k]; if (!v) throw new Error(`missing --c-${k}`); return v }
const FAMILIES = ['orange', 'red', 'green', 'amber', 'blue', 'violet']
const SURFACES = ['white', 'gray-50', 'gray-100']

describe('dark panel palette', () => {
  it('defines every shade the light palette has', () => {
    for (const f of ['gray', ...FAMILIES]) for (const s of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']) expect(vars[`${f}-${s}`]).toBeTruthy()
    expect(block).toContain('color-scheme: dark')
  })

  it('puts body text at 7:1, secondary text at 4.5:1 and icons and outlines at 3:1 on every surface', () => {
    const fails: string[] = []
    const need = (fg: string, grounds: string[], min: number) => { for (const g of grounds) { const r = contrast(c(fg), c(g)); if (r < min) fails.push(`${fg} on ${g}: ${r.toFixed(2)} < ${min}`) } }
    const tints = FAMILIES.flatMap((f) => [`${f}-50`, `${f}-100`])
    for (const s of ['700', '800', '900', '950']) need(`gray-${s}`, [...SURFACES, ...tints], 7)
    for (const s of ['500', '600']) need(`gray-${s}`, SURFACES, 4.5)
    for (const s of ['300', '400']) need(`gray-${s}`, SURFACES, 3)
    for (const f of FAMILIES) {
      for (const s of ['700', '800', '900']) need(`${f}-${s}`, [...SURFACES, `${f}-50`, `${f}-100`], 7)
      for (const s of ['400', '500', '600']) need(`${f}-${s}`, [...SURFACES, `${f}-50`, `${f}-100`], 4.5)
      // Labels on filled buttons: text-white is the dark surface colour in this scheme.
      for (const s of ['600', '700']) need('white', [`${f}-${s}`], 4.5)
    }
    expect(fails).toEqual([])
  })
})

describe('panel scheme', () => {
  beforeEach(() => { installFakeChrome() })

  it('turns dark with a dark theme and back with a light one or FAP default', async () => {
    const host = document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    installPanelTheme(shadow, window)
    await new Promise((r) => setTimeout(r, 0))
    expect(host.hasAttribute('data-scheme')).toBe(false)
    for (const p of PRESETS) {
      await write('appearance.active', { active: { mode: 'single', style: toActiveStyle(p.theme) }, safeMode: false })
      await new Promise((r) => setTimeout(r, 0))
      expect([p.theme.name, host.getAttribute('data-scheme')]).toEqual([p.theme.name, p.theme.mode === 'dark' ? 'dark' : null])
    }
    await write('appearance.active', { active: { mode: 'fap-default' }, safeMode: false })
    await new Promise((r) => setTimeout(r, 0))
    expect(host.hasAttribute('data-scheme')).toBe(false)
    expect(presetById('glassmorphism')!.theme.mode).toBe('dark')
  })
})
