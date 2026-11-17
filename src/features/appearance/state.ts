// The `appearance.active` record (appearance design, "Data Models"; platform storage catalog).
// It holds the resolved style of the active theme, so the document_start entry can apply it without
// loading the theme model or presets. The theme editor (APP-4) writes it when a theme is chosen.
// Values are validated before use: nothing in a variable value or image URL can close a rule.
import { z } from 'zod'

const cssValue = z.string().max(400).refine((v) => !/[;{}<>\\]/.test(v), 'unsafe CSS value')

export const PANEL_ROLES = ['surface', 'surfaceAlt', 'text', 'textMuted', 'border', 'primary', 'accent', 'success', 'warning', 'danger'] as const
export type PanelRole = (typeof PANEL_ROLES)[number]

export const activeStyle = z.object({
  id: z.string().min(1),
  mode: z.enum(['light', 'dark']),
  /** `--ct-*` values for FAP (roles already mapped, explicit overrides applied). */
  vars: z.record(z.string().regex(/^--ct-[a-z0-9-]+$/), cssValue),
  /** Preset style rules on FAP selectors. */
  effects: z.string().max(200_000),
  /** User CSS, applied last; dropped in safe mode. */
  css: z.string().max(200_000),
  background: z.object({
    dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/),
    fit: z.enum(['cover', 'contain', 'tile']),
    dim: z.number().min(0).max(1),
  }).nullable(),
  /** Theme roles the panel derives its colours from (R1.7). */
  roles: z.object(Object.fromEntries(PANEL_ROLES.map((r) => [r, cssValue.optional()])) as Record<PanelRole, z.ZodOptional<typeof cssValue>>),
})
export type ActiveStyle = z.infer<typeof activeStyle>

export const appearanceActive = z.object({
  active: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('fap-default') }),
    z.object({ mode: z.literal('single'), style: activeStyle }),
    z.object({ mode: z.literal('auto'), light: activeStyle, dark: activeStyle }),
  ]),
  /** Custom CSS off (R4.6). */
  safeMode: z.boolean(),
})
export type AppearanceActive = z.infer<typeof appearanceActive>

declare module '../../shared/storage/catalog' {
  interface StoreMap { 'appearance.active': AppearanceActive }
}

export const FAP_DEFAULT: AppearanceActive = { active: { mode: 'fap-default' }, safeMode: false }

/** Parses a stored value; anything invalid falls back to FAP default. */
export function parseActive(raw: unknown): AppearanceActive {
  const r = appearanceActive.safeParse(raw)
  return r.success ? r.data : FAP_DEFAULT
}

/** The style in effect: the single theme, or the light or dark one in auto mode (R5.5). */
export function resolveStyle(state: AppearanceActive, prefersDark: boolean): ActiveStyle | null {
  const a = state.active
  if (a.mode === 'single') return a.style
  if (a.mode === 'auto') return prefersDark ? a.dark : a.light
  return null
}
