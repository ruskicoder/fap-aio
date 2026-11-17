// Curated swatches (appearance R3.1): 8 families from pastel to vivid, 12 hues each, at fixed OKLCH
// lightness and chroma bands, mapped into sRGB once at load. Neutrals are 12 lightness steps instead.
import { toGamut } from './harmony'

export type Family = 'pastel' | 'soft' | 'muted' | 'earthy' | 'vivid' | 'neon' | 'deep' | 'neutrals'
export const FAMILY_LABELS: Record<Family, string> = {
  pastel: 'Pastel', soft: 'Soft', muted: 'Muted', earthy: 'Earthy', vivid: 'Vivid', neon: 'Neon', deep: 'Deep', neutrals: 'Neutrals',
}

const BANDS: Record<Exclude<Family, 'neutrals'>, { l: number; c: number; from: number }> = {
  pastel: { l: 0.9, c: 0.06, from: 0 },
  soft: { l: 0.8, c: 0.09, from: 0 },
  muted: { l: 0.62, c: 0.06, from: 0 },
  earthy: { l: 0.52, c: 0.08, from: 15 },
  vivid: { l: 0.64, c: 0.22, from: 0 },
  neon: { l: 0.86, c: 0.24, from: 0 },
  deep: { l: 0.38, c: 0.13, from: 0 },
}

export const HUES = Array.from({ length: 12 }, (_, i) => i * 30)

function build(): Record<Family, readonly string[]> {
  const out = {} as Record<Family, readonly string[]>
  for (const [f, b] of Object.entries(BANDS) as [Exclude<Family, 'neutrals'>, (typeof BANDS)[keyof typeof BANDS]][]) {
    out[f] = Object.freeze(HUES.map((h) => toGamut({ l: b.l, c: b.c, h: h + b.from }).hex))
  }
  out.neutrals = Object.freeze(Array.from({ length: 12 }, (_, i) => toGamut({ l: 0.98 - i * 0.08, c: 0.005, h: 250 }).hex))
  return out
}

export const SWATCHES: Readonly<Record<Family, readonly string[]>> = Object.freeze(build())
