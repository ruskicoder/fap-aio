// Role to variable map (appearance R1.2, R3.6; design, "Theme model and presets"): each theme role sets a
// group of `--ct-*` variables, theme tokens set the radius, shadow and font variables, and every other
// variable of the inventory is left alone on purpose. The test checks that each inventory name is in
// exactly one of the three.
import { contrast, fixLightness, TEXT_RATIO } from '../color/contrast'
import { parseColor, rgbToOklch, toHex, type Rgb } from '../color/convert'
import { toGamut } from '../color/harmony'
import type { Mode, RoleName, Roles } from '../color/roles'

const status = (k: 'success' | 'warning' | 'danger' | 'info', extra: string[]) =>
  [`--ct-${k}`, `--ct-${k}-rgb`, `--ct-${k}-text-emphasis`, `--ct-${k}-bg-subtle`, `--ct-${k}-border-subtle`, ...extra]

export const ROLE_MAP: Readonly<Record<RoleName, readonly string[]>> = {
  primary: ['--ct-primary', '--ct-primary-rgb', '--ct-primary-text-emphasis', '--ct-primary-bg-subtle', '--ct-primary-border-subtle',
    '--ct-link-color', '--ct-link-color-rgb', '--ct-link-hover-color', '--ct-link-hover-color-rgb', '--ct-focus-ring-color',
    '--ct-menu-item-active-color', '--ct-menu-item-hover-color', '--ct-topbar-item-hover-color'],
  secondary: ['--ct-secondary', '--ct-secondary-rgb', '--ct-secondary-text-emphasis', '--ct-secondary-bg-subtle', '--ct-secondary-border-subtle'],
  accent: ['--ct-code-color', '--ct-highlight-bg', '--ct-highlight-color'],
  surface: ['--ct-body-bg', '--ct-body-bg-rgb', '--ct-light', '--ct-light-rgb', '--ct-light-bg-subtle', '--ct-light-border-subtle', '--ct-light-text-emphasis'],
  surfaceAlt: ['--ct-secondary-bg', '--ct-secondary-bg-rgb', '--ct-tertiary-bg', '--ct-tertiary-bg-rgb', '--ct-menu-bg', '--ct-topbar-bg',
    '--ct-topbar-search-bg', '--ct-topbar-user-bg', '--ct-help-box-bg'],
  text: ['--ct-body-color', '--ct-body-color-rgb', '--ct-emphasis-color', '--ct-emphasis-color-rgb', '--ct-heading-color'],
  textMuted: ['--ct-secondary-color', '--ct-secondary-color-rgb', '--ct-tertiary-color', '--ct-tertiary-color-rgb', '--ct-menu-item-color', '--ct-topbar-item-color'],
  border: ['--ct-border-color', '--ct-border-color-translucent', '--ct-topbar-user-border'],
  success: status('success', ['--ct-form-valid-color', '--ct-form-valid-border-color']),
  warning: status('warning', []),
  danger: status('danger', ['--ct-form-invalid-color', '--ct-form-invalid-border-color']),
  info: status('info', []),
}

export const TOKEN_VARS = [
  '--ct-border-radius', '--ct-border-radius-sm', '--ct-border-radius-lg', '--ct-border-radius-xl', '--ct-border-radius-xxl', '--ct-border-radius-2xl',
  '--ct-box-shadow', '--ct-box-shadow-sm', '--ct-box-shadow-lg', '--ct-body-font-family',
] as const

/**
 * Left alone: the named palette and grays (utility classes such as `.text-bg-dark` keep their meaning),
 * black and white, the dark utility group, sizes, weights, line height, borders' width and style, the
 * inset shadow, the pill radius, the monospace font, the gradient, the focus ring geometry and the link
 * decoration. A theme can still set any of them as an explicit variable (R3.6).
 */
export const LEFT_ALONE = [
  '--ct-black', '--ct-black-rgb', '--ct-white', '--ct-white-rgb',
  '--ct-blue', '--ct-indigo', '--ct-purple', '--ct-pink', '--ct-red', '--ct-orange', '--ct-yellow', '--ct-green', '--ct-teal', '--ct-cyan',
  '--ct-gray', '--ct-gray-dark', '--ct-gray-100', '--ct-gray-200', '--ct-gray-300', '--ct-gray-400', '--ct-gray-500', '--ct-gray-600',
  '--ct-gray-700', '--ct-gray-800', '--ct-gray-900',
  '--ct-dark', '--ct-dark-rgb', '--ct-dark-bg-subtle', '--ct-dark-border-subtle', '--ct-dark-text-emphasis',
  '--ct-body-font-size', '--ct-body-font-weight', '--ct-body-line-height', '--ct-font-sans-serif', '--ct-font-monospace',
  '--ct-border-width', '--ct-border-style', '--ct-border-radius-pill', '--ct-box-shadow-inset', '--ct-gradient',
  '--ct-focus-ring-opacity', '--ct-focus-ring-width', '--ct-link-decoration',
] as const

const rgbOf = (hex: string): Rgb => parseColor(hex) ?? { r: 0, g: 0, b: 0 }
const triplet = (hex: string) => { const c = rgbOf(hex); return [c.r, c.g, c.b].map((v) => Math.round(v * 255)).join(', ') }
/** Mixes `a` toward `b` by `t` (0 keeps a) in OKLab-like steps through sRGB; enough for tints. */
const mix = (a: string, b: string, t: number) => {
  const x = rgbOf(a)
  const y = rgbOf(b)
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}
const shiftL = (hex: string, by: number) => { const c = rgbToOklch(rgbOf(hex)); return toGamut({ ...c, l: Math.min(1, Math.max(0, c.l + by)) }).hex }

/** A colour's full group: base, rgb triplet, a subtle background and border, and text readable on the background. */
function family(color: string, surface: string, mode: Mode) {
  const bgSubtle = mix(color, surface, mode === 'light' ? 0.8 : 0.75)
  const borderSubtle = mix(color, surface, mode === 'light' ? 0.6 : 0.5)
  const emphasis = fixLightness(shiftL(color, mode === 'light' ? -0.2 : 0.2), bgSubtle, TEXT_RATIO).hex
  return { base: color, rgb: triplet(color), bgSubtle, borderSubtle, emphasis }
}

/** The `--ct-*` values for a set of roles (R3.6); keys are exactly the names in ROLE_MAP. */
export function roleVars(r: Roles, mode: Mode): Record<string, string> {
  const out: Record<string, string> = {}
  const put = (name: string, v: string) => { out[name] = v }
  const fam = (k: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info') => {
    const f = family(r[k], r.surface, mode)
    put(`--ct-${k}`, f.base); put(`--ct-${k}-rgb`, f.rgb); put(`--ct-${k}-text-emphasis`, f.emphasis)
    put(`--ct-${k}-bg-subtle`, f.bgSubtle); put(`--ct-${k}-border-subtle`, f.borderSubtle)
  }
  for (const k of ['primary', 'secondary', 'success', 'warning', 'danger', 'info'] as const) fam(k)
  // Links must read as text on the page (4.5:1).
  const link = fixLightness(r.primary, r.surface, TEXT_RATIO).hex
  const hover = fixLightness(shiftL(link, mode === 'light' ? -0.08 : 0.08), r.surface, TEXT_RATIO).hex
  put('--ct-link-color', link); put('--ct-link-color-rgb', triplet(link))
  put('--ct-link-hover-color', hover); put('--ct-link-hover-color-rgb', triplet(hover))
  put('--ct-focus-ring-color', `rgba(${triplet(r.primary)}, 0.25)`)
  put('--ct-menu-item-active-color', link); put('--ct-menu-item-hover-color', hover); put('--ct-topbar-item-hover-color', hover)
  put('--ct-code-color', fixLightness(r.accent, r.surface, TEXT_RATIO).hex)
  const hl = mix(r.accent, r.surface, 0.7)
  put('--ct-highlight-bg', hl)
  put('--ct-highlight-color', contrast(r.text, hl) >= TEXT_RATIO ? r.text : fixLightness(r.text, hl, TEXT_RATIO).hex)
  put('--ct-body-bg', r.surface); put('--ct-body-bg-rgb', triplet(r.surface))
  put('--ct-light', r.surfaceAlt); put('--ct-light-rgb', triplet(r.surfaceAlt))
  put('--ct-light-bg-subtle', mix(r.surfaceAlt, r.surface, 0.5)); put('--ct-light-border-subtle', r.border)
  put('--ct-light-text-emphasis', r.text)
  for (const n of ['--ct-secondary-bg', '--ct-tertiary-bg']) { put(n, r.surfaceAlt); put(`${n}-rgb`, triplet(r.surfaceAlt)) }
  for (const n of ['--ct-menu-bg', '--ct-topbar-bg', '--ct-topbar-search-bg', '--ct-topbar-user-bg', '--ct-help-box-bg']) put(n, r.surfaceAlt)
  put('--ct-body-color', r.text); put('--ct-body-color-rgb', triplet(r.text))
  put('--ct-emphasis-color', r.text); put('--ct-emphasis-color-rgb', triplet(r.text)); put('--ct-heading-color', r.text)
  put('--ct-secondary-color', r.textMuted); put('--ct-secondary-color-rgb', triplet(r.textMuted))
  put('--ct-tertiary-color', `rgba(${triplet(r.textMuted)}, 0.75)`); put('--ct-tertiary-color-rgb', triplet(r.textMuted))
  put('--ct-menu-item-color', r.textMuted); put('--ct-topbar-item-color', r.textMuted)
  put('--ct-border-color', r.border); put('--ct-border-color-translucent', `rgba(${triplet(r.border)}, 0.6)`); put('--ct-topbar-user-border', r.border)
  put('--ct-form-valid-color', out['--ct-success-text-emphasis']!); put('--ct-form-valid-border-color', r.success)
  put('--ct-form-invalid-color', out['--ct-danger-text-emphasis']!); put('--ct-form-invalid-border-color', r.danger)
  return out
}

export interface Tokens { radius: number; shadow: 'none' | 'soft' | 'dual' | 'clay' | 'glow'; blur: number; surfaceOpacity: number; fontFamily: string }

const SHADOWS: Record<Tokens['shadow'], (primaryRgb: string, mode: Mode) => [string, string, string]> = {
  none: () => ['none', 'none', 'none'],
  soft: (_, m) => { const a = m === 'light' ? 0.08 : 0.5; return [`0 2px 8px rgba(0, 0, 0, ${a})`, `0 1px 3px rgba(0, 0, 0, ${a})`, `0 8px 24px rgba(0, 0, 0, ${a * 1.5})`] },
  dual: (_, m) => (m === 'light'
    ? ['6px 6px 12px rgba(0, 0, 0, 0.12), -6px -6px 12px rgba(255, 255, 255, 0.8)', '3px 3px 6px rgba(0, 0, 0, 0.1), -3px -3px 6px rgba(255, 255, 255, 0.8)', '10px 10px 20px rgba(0, 0, 0, 0.14), -10px -10px 20px rgba(255, 255, 255, 0.85)']
    : ['6px 6px 12px rgba(0, 0, 0, 0.6), -6px -6px 12px rgba(255, 255, 255, 0.05)', '3px 3px 6px rgba(0, 0, 0, 0.6), -3px -3px 6px rgba(255, 255, 255, 0.04)', '10px 10px 20px rgba(0, 0, 0, 0.7), -10px -10px 20px rgba(255, 255, 255, 0.06)']),
  clay: () => ['inset -6px -6px 12px rgba(0, 0, 0, 0.1), inset 6px 6px 12px rgba(255, 255, 255, 0.7), 10px 14px 24px rgba(0, 0, 0, 0.12)', 'inset -3px -3px 6px rgba(0, 0, 0, 0.1), inset 3px 3px 6px rgba(255, 255, 255, 0.7), 4px 6px 12px rgba(0, 0, 0, 0.1)', 'inset -8px -8px 16px rgba(0, 0, 0, 0.1), inset 8px 8px 16px rgba(255, 255, 255, 0.7), 14px 20px 32px rgba(0, 0, 0, 0.14)'],
  glow: (p) => [`0 0 16px rgba(${p}, 0.35)`, `0 0 8px rgba(${p}, 0.3)`, `0 0 28px rgba(${p}, 0.4)`],
}

/** Radius, shadow and font variables from the theme tokens; keys are exactly TOKEN_VARS. */
export function tokenVars(t: Tokens, primary: string, mode: Mode): Record<string, string> {
  const r = Math.max(0, t.radius)
  const px = (x: number) => `${Math.round(x * 10) / 10}px`
  const [base, sm, lg] = SHADOWS[t.shadow](triplet(primary), mode)
  return {
    '--ct-border-radius': px(r), '--ct-border-radius-sm': px(r * 0.66), '--ct-border-radius-lg': px(r * 1.33),
    '--ct-border-radius-xl': px(r * 2), '--ct-border-radius-xxl': px(r * 2.66), '--ct-border-radius-2xl': px(r * 4),
    '--ct-box-shadow': base, '--ct-box-shadow-sm': sm, '--ct-box-shadow-lg': lg,
    '--ct-body-font-family': t.fontFamily,
  }
}
