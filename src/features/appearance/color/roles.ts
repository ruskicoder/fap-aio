// Role assignment (appearance R3.4; design, ColorEngine): the base colour is primary and the next
// harmony colours secondary and accent; surfaces come from the base hue (light: L 0.98, C 0.01; dark:
// true black with surfaceAlt at L 0.14); text and muted text are fixed to 4.5:1 on both surfaces, and
// the status colours to 3:1 as UI components.
import { parseColor, rgbToOklch, normHue, type Oklch } from './convert'
import { contrast, fixLightness, TEXT_RATIO, UI_RATIO } from './contrast'
import { toGamut } from './harmony'

export type Mode = 'light' | 'dark'
export const ROLE_NAMES = ['primary', 'secondary', 'accent', 'surface', 'surfaceAlt', 'text', 'textMuted', 'border', 'success', 'warning', 'danger', 'info'] as const
export type RoleName = (typeof ROLE_NAMES)[number]
export type Roles = Record<RoleName, string>

/** Status hues in OKLCH degrees: green, amber, red, blue. */
const STATUS: Record<'success' | 'warning' | 'danger' | 'info', number> = { success: 150, warning: 75, danger: 27, info: 245 }

const hexOf = (c: Oklch) => toGamut(c).hex

/** Fixed against the less contrasting of two backgrounds, then checked against the other. */
function onBoth(fg: string, a: string, b: string, target: number): string {
  const worst = contrast(fg, a) < contrast(fg, b) ? a : b
  const first = fixLightness(fg, worst, target).hex
  const other = worst === a ? b : a
  return contrast(first, other) >= target ? first : fixLightness(first, other, target).hex
}

export function assignRoles(palette: readonly string[], mode: Mode): Roles {
  const base = parseColor(palette[0] ?? '') ?? parseColor('#f36f21')!
  const b = rgbToOklch(base)
  const second = palette[1] ? parseColor(palette[1]) : null
  const third = palette[2] ? parseColor(palette[2]) : null
  const h = b.h
  const light = mode === 'light'
  const surface = light ? hexOf({ l: 0.98, c: 0.01, h }) : '#000000'
  const surfaceAlt = light ? hexOf({ l: 0.95, c: 0.015, h }) : hexOf({ l: 0.14, c: 0.01, h })
  const text = onBoth(hexOf({ l: light ? 0.22 : 0.96, c: 0.015, h }), surface, surfaceAlt, TEXT_RATIO)
  const textMuted = onBoth(hexOf({ l: light ? 0.48 : 0.74, c: 0.02, h }), surface, surfaceAlt, TEXT_RATIO)
  const status = (k: keyof typeof STATUS) => onBoth(hexOf({ l: light ? 0.56 : 0.74, c: 0.15, h: STATUS[k] }), surface, surfaceAlt, UI_RATIO)
  return {
    primary: toGamut(b).hex,
    secondary: second ? toGamut(rgbToOklch(second)).hex : hexOf({ ...b, h: normHue(h + 180) }),
    accent: third ? toGamut(rgbToOklch(third)).hex : hexOf({ ...b, h: normHue(h + 120) }),
    surface,
    surfaceAlt,
    text,
    textMuted,
    border: hexOf({ l: light ? 0.88 : 0.3, c: 0.01, h }),
    success: status('success'),
    warning: status('warning'),
    danger: status('danger'),
    info: status('info'),
  }
}
