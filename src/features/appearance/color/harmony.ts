// Harmony helper and gamut mapping (appearance R3.2, R3.3): hue rotation in OKLCH with lightness and
// chroma held; a colour outside sRGB is brought in by lowering chroma (bisection) and marked adjusted.
import { inGamut, normHue, oklchToRgb, toHex, type Oklch, type Rgb } from './convert'

export type Scheme = 'complementary' | 'analogous' | 'triadic' | 'split-complementary' | 'tetradic' | 'square'

/** Hue offsets from the base, base first (design, "Harmony maths"). */
export const SCHEMES: Record<Scheme, readonly number[]> = {
  complementary: [0, 180],
  analogous: [0, -30, 30],
  triadic: [0, 120, 240],
  'split-complementary': [0, 150, 210],
  tetradic: [0, 60, 180, 240],
  square: [0, 90, 180, 270],
}

export interface Mapped { oklch: Oklch; rgb: Rgb; hex: string; adjusted: boolean }

/** The colour itself when inside sRGB, else the same lightness and hue with the most chroma that fits. */
export function toGamut(c: Oklch): Mapped {
  const l = Math.min(1, Math.max(0, c.l))
  const want = { l, c: Math.max(0, c.c), h: normHue(c.h) }
  const direct = oklchToRgb(want)
  if (inGamut(direct)) return { oklch: want, rgb: direct, hex: toHex(direct), adjusted: false }
  let lo = 0
  let hi = want.c
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToRgb({ ...want, c: mid }))) lo = mid
    else hi = mid
  }
  const oklch = { ...want, c: lo }
  const rgb = oklchToRgb(oklch)
  return { oklch, rgb, hex: toHex(rgb), adjusted: true }
}

/** The palette for a scheme: the base and its rotations, each in gamut. */
export function harmony(base: Oklch, scheme: Scheme): Mapped[] {
  return SCHEMES[scheme].map((d) => toGamut({ ...base, h: normHue(base.h + d) }))
}
