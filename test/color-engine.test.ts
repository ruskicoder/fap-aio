// APP-2.1: colour conversions, harmony, gamut mapping, contrast and roles (appearance R3.1 to R3.5).
import { describe, expect, it } from 'vitest'
import {
  ROLE_NAMES, SCHEMES, SWATCHES, assignRoles, contrast, fixLightness, formatHsl, formatOklch, formatRgb, harmony, inGamut,
  oklabToRgb, oklchToRgb, parseColor, rgbToOklab, rgbToOklch, toGamut, toHex,
} from '../src/features/appearance/color'

const hex = (s: string) => toHex(parseColor(s)!)

describe('conversions', () => {
  it('match reference OKLab and OKLCH values', () => {
    const red = rgbToOklch(parseColor('#ff0000')!)
    expect(red.l).toBeCloseTo(0.62796, 4)
    expect(red.c).toBeCloseTo(0.25768, 4)
    expect(red.h).toBeCloseTo(29.2339, 2)
    const white = rgbToOklab(parseColor('#fff')!)
    expect(white.L).toBeCloseTo(1, 5)
    expect(Math.abs(white.a) + Math.abs(white.b)).toBeLessThan(1e-4)
    expect(rgbToOklch(parseColor('#808080')!).c).toBeLessThan(1e-4)
    const blue = rgbToOklch(parseColor('#0000ff')!)
    expect([blue.l, blue.c, blue.h].map((x) => +x.toFixed(3))).toEqual([0.452, 0.313, 264.052])
  })

  it('round-trip hex through OKLab and OKLCH', () => {
    for (const h of ['#000000', '#ffffff', '#f36f21', '#123456', '#00ff7f', '#7f00ff', '#c0c0c0', '#ea580c']) {
      const c = parseColor(h)!
      expect(toHex(oklabToRgb(rgbToOklab(c)))).toBe(h)
      expect(toHex(oklchToRgb(rgbToOklch(c)))).toBe(h)
    }
  })

  it('parse hex, rgb(), hsl() and oklch(), and format them back', () => {
    expect(hex('#F36')).toBe('#ff3366')
    expect(hex('#ff336680')).toBe('#ff3366')
    expect(hex('rgb(243, 111, 33)')).toBe('#f36f21')
    expect(hex('rgb(100% 0% 0%)')).toBe('#ff0000')
    expect(hex('hsl(22 90% 54%)')).toBe(hex(formatHsl(parseColor('hsl(22 90% 54%)')!)))
    expect(hex('hsl(120, 100%, 25%)')).toBe('#008000')
    expect(hex('oklch(62.8% 0.2577 29.23)')).toBe('#ff0000')
    expect(hex('oklch(0.628 0.2577 29.23deg)')).toBe('#ff0000')
    expect(parseColor('red')).toBeNull()
    expect(parseColor('#12345')).toBeNull()
    expect(parseColor('rgb(1, 2)')).toBeNull()
    expect(formatRgb(parseColor('#f36f21')!)).toBe('rgb(243 111 33)')
    expect(formatOklch(rgbToOklch(parseColor('#ff0000')!))).toBe('oklch(62.8% 0.258 29.2)')
  })
})

describe('harmony and gamut', () => {
  it('rotate hue with lightness and chroma held, base first', () => {
    const base = { l: 0.7, c: 0.1, h: 40 }
    for (const [scheme, offsets] of Object.entries(SCHEMES)) {
      const p = harmony(base, scheme as keyof typeof SCHEMES)
      expect(p).toHaveLength(offsets.length)
      p.forEach((m, i) => {
        expect(m.oklch.h).toBeCloseTo(((40 + offsets[i]!) % 360 + 360) % 360, 6)
        expect(m.oklch.l).toBe(0.7)
        if (!m.adjusted) expect(m.oklch.c).toBe(0.1)
      })
    }
    expect(harmony(base, 'triadic').map((m) => m.oklch.h)).toEqual([40, 160, 280])
  })

  it('bring out-of-gamut colours in by lowering chroma and mark them adjusted', () => {
    const wild = { l: 0.7, c: 0.37, h: 150 }
    expect(inGamut(oklchToRgb(wild))).toBe(false)
    const m = toGamut(wild)
    expect(m.adjusted).toBe(true)
    expect(m.oklch.c).toBeLessThan(0.37)
    expect(m.oklch.c).toBeGreaterThan(0.1)
    expect([m.oklch.l, m.oklch.h]).toEqual([0.7, 150])
    expect(inGamut(m.rgb)).toBe(true)
    expect(inGamut(oklchToRgb({ ...m.oklch, c: m.oklch.c + 0.005 }))).toBe(false)
    expect(toGamut({ l: 0.5, c: 0.05, h: 200 }).adjusted).toBe(false)
  })
})

describe('contrast', () => {
  it('give known WCAG ratios', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 6)
    expect(contrast('#fff', '#fff')).toBe(1)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
    expect(contrast('#ea580c', '#ffffff')).toBeCloseTo(3.56, 2)
  })

  it('fix lightness to the target with as small a move as needed, keeping the hue', () => {
    const f = fixLightness('#ea580c', '#ffffff', 4.5)
    expect(f).toMatchObject({ changed: true, met: true })
    expect(f.ratio).toBeGreaterThanOrEqual(4.5)
    expect(f.ratio).toBeLessThan(4.6)
    expect(rgbToOklch(parseColor(f.hex)!).h).toBeCloseTo(rgbToOklch(parseColor('#ea580c')!).h, 0)
    const dark = fixLightness('#3b82f6', '#000000', 7)
    expect(dark.ratio).toBeGreaterThanOrEqual(7)
    expect(rgbToOklch(parseColor(dark.hex)!).l).toBeGreaterThan(rgbToOklch(parseColor('#3b82f6')!).l)
    expect(fixLightness('#000000', '#ffffff')).toMatchObject({ hex: '#000000', changed: false })
    expect(fixLightness('#777777', '#777777', 21).met).toBe(false)
  })
})

describe('roles and swatches', () => {
  it('assign every role with text at 4.5:1 and status colours at 3:1 on both surfaces', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const base of ['#f36f21', '#2563eb', '#16a34a', '#ffff00', '#808080']) {
        const r = assignRoles(harmony(rgbToOklch(parseColor(base)!), 'triadic').map((m) => m.hex), mode)
        expect(Object.keys(r).sort()).toEqual([...ROLE_NAMES].sort())
        for (const s of [r.surface, r.surfaceAlt]) {
          expect(contrast(r.text, s)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(r.textMuted, s)).toBeGreaterThanOrEqual(4.5)
          for (const k of ['success', 'warning', 'danger', 'info'] as const) expect(contrast(r[k], s)).toBeGreaterThanOrEqual(3)
        }
        if (mode === 'dark') expect(r.surface).toBe('#000000')
        expect(r.primary).toBe(toGamut(rgbToOklch(parseColor(base)!)).hex)
      }
    }
    const light = assignRoles(['#f36f21'], 'light')
    expect(rgbToOklch(parseColor(light.surface)!).l).toBeCloseTo(0.98, 2)
    expect(rgbToOklch(parseColor(assignRoles(['#f36f21'], 'dark').surfaceAlt)!).l).toBeCloseTo(0.14, 2)
  })

  it('offer 8 families of 12 distinct in-gamut swatches', () => {
    expect(Object.keys(SWATCHES)).toEqual(['pastel', 'soft', 'muted', 'earthy', 'vivid', 'neon', 'deep', 'neutrals'])
    for (const list of Object.values(SWATCHES)) {
      expect(list).toHaveLength(12)
      expect(new Set(list).size).toBe(12)
      for (const h of list) expect(h).toMatch(/^#[0-9a-f]{6}$/)
    }
    const l = (h: string) => rgbToOklch(parseColor(h)!).l
    expect(l(SWATCHES.pastel[0]!)).toBeGreaterThan(l(SWATCHES.deep[0]!))
    expect(rgbToOklch(parseColor(SWATCHES.vivid[0]!)!).c).toBeGreaterThan(rgbToOklch(parseColor(SWATCHES.muted[0]!)!).c)
  })
})
