// Custom themes and the active choice (appearance R1.4, R2.6, R5.5; design, "Data Models"): custom themes
// live in `appearance.themes` (up to 20); applying writes the resolved style to `appearance.active`, which
// the document_start entry applies on every FAP page.
import { read, update, write } from '../../../shared/storage/catalog'
import { parseActive, type AppearanceActive } from '../state'
import { parseTheme, toActiveStyle, type Theme } from './model'
import { PRESETS, presetById } from './presets'

declare module '../../../shared/storage/catalog' {
  interface StoreMap { 'appearance.themes': { themes: Theme[] } }
}

export const MAX_CUSTOM = 20

/** Stored custom themes that still validate. */
export async function customThemes(): Promise<Theme[]> {
  const raw = (await read('appearance.themes'))?.themes ?? []
  return raw.flatMap((t) => { const r = parseTheme(t); return r.ok ? [r.theme] : [] })
}

export async function allThemes(): Promise<Theme[]> {
  return [...PRESETS.map((p) => p.theme), ...(await customThemes())]
}

/** A copy of a preset or custom theme as a new custom theme (R2.6); an error text when 20 exist. */
export async function duplicateTheme(source: Theme): Promise<Theme | string> {
  let made: Theme | string = ''
  await update('appearance.themes', (old) => {
    const themes = old?.themes ?? []
    if (themes.length >= MAX_CUSTOM) { made = `You have ${MAX_CUSTOM} custom themes, the most there can be. Delete one first.`; return { themes } }
    const base = source.preset ?? source.id
    const ids = new Set([...PRESETS.map((p) => p.theme.id), ...themes.map((t) => t.id)])
    let n = 1
    while (ids.has(`${base}-copy-${n}`)) n++
    const names = new Set(themes.map((t) => t.name))
    let name = `${source.name} copy`
    for (let k = 2; names.has(name); k++) name = `${source.name} copy ${k}`
    made = { ...source, id: `${base}-copy-${n}`, name: name.slice(0, 60), preset: presetById(base) ? base : source.preset }
    return { themes: [...themes, made] }
  })
  return made
}

export async function deleteCustom(id: string): Promise<void> {
  await update('appearance.themes', (old) => ({ themes: (old?.themes ?? []).filter((t) => t.id !== id) }))
}

const keepSafe = async () => parseActive(await read('appearance.active')).safeMode

export async function applyTheme(t: Theme): Promise<void> {
  await write('appearance.active', { active: { mode: 'single', style: toActiveStyle(t) }, safeMode: await keepSafe() })
}

/** Auto mode follows `prefers-color-scheme` (R5.5). */
export async function applyAuto(light: Theme, dark: Theme): Promise<void> {
  await write('appearance.active', { active: { mode: 'auto', light: toActiveStyle(light), dark: toActiveStyle(dark) }, safeMode: await keepSafe() })
}

/** FAP's own look (R1.4). */
export async function applyFapDefault(): Promise<void> {
  await write('appearance.active', { active: { mode: 'fap-default' }, safeMode: await keepSafe() })
}

export type Choice = { mode: 'fap-default' } | { mode: 'single'; id: string } | { mode: 'auto'; light: string; dark: string }
export function choiceOf(a: AppearanceActive): Choice {
  const x = a.active
  if (x.mode === 'single') return { mode: 'single', id: x.style.id }
  if (x.mode === 'auto') return { mode: 'auto', light: x.light.id, dark: x.dark.id }
  return { mode: 'fap-default' }
}
