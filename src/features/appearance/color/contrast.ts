// WCAG contrast and the one-click lightness fix (appearance R3.4, R3.5): ratio (L1 + 0.05) / (L2 + 0.05)
// on relative luminance; the fix moves the foreground's OKLCH lightness away from the background, as
// little as needed, keeping hue and chroma (chroma lowered only to stay in sRGB).
import { parseColor, rgbToOklch, toLinear, type Rgb } from './convert'
import { toGamut } from './harmony'

export const TEXT_RATIO = 4.5
export const UI_RATIO = 3

export const luminance = ({ r, g, b }: Rgb) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

const rgbOf = (c: string | Rgb): Rgb => {
  if (typeof c !== 'string') return c
  const p = parseColor(c)
  if (!p) throw new Error(`Not a colour: ${c}`)
  return p
}

/** The WCAG contrast ratio, from 1 to 21. */
export function contrast(a: string | Rgb, b: string | Rgb): number {
  const [x, y] = [luminance(rgbOf(a)), luminance(rgbOf(b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

export interface Fixed { hex: string; ratio: number; changed: boolean; met: boolean }

/**
 * The foreground with its lightness moved away from the background until the ratio meets the target.
 * Darker on a light background, lighter on a dark one; the other way only when that side cannot reach it.
 */
export function fixLightness(fg: string, bg: string, target = TEXT_RATIO): Fixed {
  const f = rgbToOklch(rgbOf(fg))
  const b = rgbOf(bg)
  const start = toGamut(f)
  const now = contrast(start.rgb, b)
  if (now >= target) return { hex: start.hex, ratio: now, changed: false, met: true }
  const at = (l: number) => toGamut({ ...f, l })
  const ok = (l: number) => contrast(at(l).rgb, b) >= target
  const darkFirst = luminance(b) > 0.18
  for (const end of darkFirst ? [0, 1] : [1, 0]) {
    if (!ok(end)) continue
    let near = f.l
    let far = end
    for (let i = 0; i < 30; i++) {
      const mid = (near + far) / 2
      if (ok(mid)) far = mid
      else near = mid
    }
    const m = at(far)
    return { hex: m.hex, ratio: contrast(m.rgb, b), changed: true, met: true }
  }
  const best = [0, 1].map(at).sort((x, y) => contrast(y.rgb, b) - contrast(x.rgb, b))[0]!
  return { hex: best.hex, ratio: contrast(best.rgb, b), changed: true, met: false }
}
