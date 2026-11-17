// The contrast pairs the editor measures (appearance R3.5): text on both surfaces at 4.5:1, and the
// primary and status colours as UI components at 3:1. A failing pair offers a lightness fix of its colour.
import { contrast, fixLightness, TEXT_RATIO, UI_RATIO } from '../color/contrast'
import type { RoleName, Roles } from '../color/roles'

export interface Check { fg: RoleName; bg: 'surface' | 'surfaceAlt'; min: number; ratio: number; ok: boolean }

const PAIRS: [RoleName, number][] = [['text', TEXT_RATIO], ['textMuted', TEXT_RATIO], ['primary', UI_RATIO], ['success', UI_RATIO], ['warning', UI_RATIO], ['danger', UI_RATIO], ['info', UI_RATIO]]

export function checks(r: Roles): Check[] {
  return PAIRS.flatMap(([fg, min]) => (['surface', 'surfaceAlt'] as const).map((bg) => {
    const ratio = contrast(r[fg], r[bg])
    return { fg, bg, min, ratio, ok: ratio >= min }
  }))
}

/** The foreground of a failing pair moved until it meets the target on both surfaces. */
export function fixRole(r: Roles, fg: RoleName, min: number): string {
  let hex = r[fg]
  for (const bg of ['surface', 'surfaceAlt'] as const) if (contrast(hex, r[bg]) < min) hex = fixLightness(hex, r[bg], min).hex
  return contrast(hex, r.surface) >= min ? hex : fixLightness(hex, r.surface, min).hex
}
