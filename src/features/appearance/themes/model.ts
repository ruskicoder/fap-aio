// Theme model (appearance R1.2, R3.6; design, "Theme model and presets"): the zod schema of a theme,
// and its resolution to the `appearance.active` style the document_start entry applies: role variables,
// then token variables, then the theme's explicit `--ct-*` overrides, which win.
import { z } from 'zod'
import { parseColor, toHex } from '../color/convert'
import { ROLE_NAMES, type Roles } from '../color/roles'
import { roleVars, tokenVars } from './role-map'
import { PANEL_ROLES, type ActiveStyle } from '../state'

const SAFE = /[;{}<>\\]/
export const cssValue = z.string().max(400).refine((v) => !SAFE.test(v), 'unsafe CSS value')
/** Any colour the picker reads (hex, rgb(), hsl(), oklch()), stored as `#rrggbb`. */
export const color = z.string().refine((v) => parseColor(v) !== null, 'not a colour').transform((v) => toHex(parseColor(v)!))

export const themeSchema = z.object({
  formatVersion: z.literal(1),
  id: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  mode: z.enum(['light', 'dark']),
  roles: z.object(Object.fromEntries(ROLE_NAMES.map((r) => [r, color])) as Record<(typeof ROLE_NAMES)[number], typeof color>),
  vars: z.record(z.string().regex(/^--ct-[a-z0-9-]+$/), cssValue),
  tokens: z.object({
    radius: z.number().min(0).max(32),
    shadow: z.enum(['none', 'soft', 'dual', 'clay', 'glow']),
    blur: z.number().min(0).max(40),
    surfaceOpacity: z.number().min(0).max(1),
    fontFamily: cssValue,
  }),
  effects: z.string().max(200_000),
  background: z.object({
    dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/),
    fit: z.enum(['cover', 'contain', 'tile']),
    dim: z.number().min(0).max(1),
  }).nullable(),
  css: z.string().max(200_000),
  preset: z.string().optional(),
})
export type Theme = z.infer<typeof themeSchema>
export type ThemeInput = z.input<typeof themeSchema>

/** Validates a theme; the error lists the first problems by path. */
export function parseTheme(raw: unknown): { ok: true; theme: Theme } | { ok: false; error: string } {
  const r = themeSchema.safeParse(raw)
  if (r.success) return { ok: true, theme: r.data }
  return { ok: false, error: r.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || 'theme'}: ${i.message}`).join('; ') }
}

/** Every `--ct-*` value of a theme: roles, then tokens, then explicit overrides (R3.6). */
export function themeVars(t: Theme): Record<string, string> {
  return { ...roleVars(t.roles as Roles, t.mode), ...tokenVars(t.tokens, t.roles.primary, t.mode), ...t.vars }
}

/** The resolved style stored in `appearance.active` for the document_start entry (APP-1.1). */
export function toActiveStyle(t: Theme): ActiveStyle {
  return {
    id: t.id, mode: t.mode, vars: themeVars(t), effects: t.effects, css: t.css, background: t.background,
    roles: Object.fromEntries(PANEL_ROLES.map((r) => [r, t.roles[r]])),
  }
}
