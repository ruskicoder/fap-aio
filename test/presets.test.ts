// @vitest-environment happy-dom
// APP-3.2: the eleven presets (appearance R2.1 to R2.4).
import { describe, expect, it } from 'vitest'
import { PRESETS, presetById, type Preset } from '../src/features/appearance/themes/presets'
import { parseTheme, themeVars, toActiveStyle } from '../src/features/appearance/themes/model'
import { activeStyle } from '../src/features/appearance/state'
import { contrast, parseColor, toHex } from '../src/features/appearance/color'

const mix = (over: string, under: string, a: number) => {
  const x = parseColor(over)!
  const y = parseColor(under)!
  return toHex({ r: x.r * a + y.r * (1 - a), g: x.g * a + y.g * (1 - a), b: x.b * a + y.b * (1 - a) })
}

/**
 * Every colour text and controls sit on: the role surfaces, a solid card surface, and for glass presets
 * the frosted surface over each backdrop colour (text sits on glass; the page title has a glass backing).
 */
function grounds(p: Preset): string[] {
  const r = p.theme.roles
  const out = [r.surface, r.surfaceAlt]
  if (!p.backdrop) out.push(toHex(parseColor(p.look.surface)!))
  else for (const c of p.backdrop.colors) out.push(mix(p.backdrop.tint, c, p.backdrop.alpha))
  return [...new Set(out)]
}

describe('presets', () => {
  it('ship the seven light and four dark presets, the dark ones on true black', () => {
    // F-24: Glassmorphism is dimmed dark glass now and is listed with the dark themes (appearance R8.5).
    expect(PRESETS.filter((p) => p.theme.mode === 'light').map((p) => p.theme.name)).toEqual(['Neumorphism', 'Minimalist White', 'Frutiger Aero Green', 'Frutiger Aero Blue', 'Liquid Glass', 'Claymorphism'])
    expect(PRESETS.filter((p) => p.theme.mode === 'dark').map((p) => p.theme.name)).toEqual(['Glassmorphism', 'Glassmorphism Dark', 'Minimalist Black', 'Liquid Glass Dark', 'Claymorphism Vibrant Dark'])
    for (const p of PRESETS.filter((x) => x.theme.mode === 'dark' && x.theme.id !== 'glassmorphism')) {
      expect(p.theme.roles.surface).toBe('#000000')
      expect(p.look.body).toBe('#000000')
    }
    expect(presetById('neumorphism')?.theme.name).toBe('Neumorphism')
  })

  for (const p of PRESETS) {
    // F-24 thresholds (appearance R8.1 to R8.3): dark presets and glass surfaces put body text at 7:1, and dark
    // presets use near-white text; muted text 4.5:1 and controls 3:1 everywhere.
    const strict = p.theme.mode === 'dark' || p.backdrop !== null
    it(`${p.theme.name}: valid, with text at ${strict ? '7' : '4.5'}:1, muted text at 4.5:1 and controls at 3:1 on every surface`, () => {
      const parsed = parseTheme(p.theme)
      expect(parsed.ok ? '' : parsed.error).toBe('')
      expect(activeStyle.safeParse(toActiveStyle(p.theme)).success).toBe(true)
      const v = themeVars(p.theme)
      const r = p.theme.roles
      const fails: string[] = []
      for (const g of grounds(p)) {
        for (const [name, c, min] of [
          ['text', r.text, strict ? 7 : 4.5], ['textMuted', r.textMuted, 4.5], ['link', v['--ct-link-color']!, 4.5],
          ['primary', r.primary, 3], ['success', r.success, 3], ['warning', r.warning, 3], ['danger', r.danger, 3], ['info', r.info, 3],
          ['input border', p.look.inputBorder, 3],
        ] as const) {
          const ratio = contrast(c, g)
          if (ratio < min) fails.push(`${name} ${c} on ${g}: ${ratio.toFixed(2)}`)
        }
      }
      expect(fails).toEqual([])
      if (p.theme.mode === 'dark') {
        // Near-white body text, about #f2f2f2 to #fafafa (R8.1).
        const [rr, gg, bb] = [1, 3, 5].map((i) => parseInt(r.text.slice(i, i + 2), 16))
        expect(Math.min(rr!, gg!, bb!)).toBeGreaterThanOrEqual(0xf2)
        expect(Math.max(rr!, gg!, bb!)).toBeLessThanOrEqual(0xfa)
        expect(p.theme.effects).toContain('opacity: 1 !important')
      }
    })
  }

  it('realize each style in its effects', () => {
    const fx = (id: string) => presetById(id)!.theme.effects
    expect(fx('glassmorphism')).toMatch(/backdrop-filter: blur\(14px\) saturate\(120%\)/)
    expect(fx('glassmorphism')).toContain('1px solid rgba(255, 255, 255, 0.14)')
    // Calm backdrop: two related hues, low saturation (R8.5).
    expect(presetById('glassmorphism')!.backdrop!.colors).toEqual(['#2b2f52', '#1d3b44'])
    expect(fx('neumorphism')).toContain('8px 8px 16px #c5c9cf, -8px -8px 16px #ffffff')
    expect(fx('neumorphism')).toMatch(/\.btn:active[^{]*\{ box-shadow: inset/)
    expect(fx('minimalist-white')).toMatch(/box-shadow: none; border-radius: 6px/)
    expect(fx('frutiger-aero-green')).toContain('#bfe6ff 0%')
    expect(fx('frutiger-aero-blue')).toContain('#7cc8ff 100%')
    expect(fx('liquid-glass')).toMatch(/blur\(20px\) saturate\(180%\)/)
    expect(fx('liquid-glass')).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.53)')
    expect(fx('claymorphism')).toMatch(/border-radius: 24px/)
    expect(fx('claymorphism').match(/inset/g)!.length).toBeGreaterThanOrEqual(2)
    for (const p of PRESETS) {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(p.theme.effects)
      expect(sheet.cssRules.length).toBeGreaterThan(6)
      expect(p.theme.effects).not.toMatch(/url\(|@import/)
    }
  })
})
