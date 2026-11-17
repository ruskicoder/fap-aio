// SettingsRegistry (panel-ux R8.1 to R8.3; design "SettingsRegistry and Settings view"): every module
// declares its settings here. Values live in the `settings` store; a few panel preferences that the shell
// already keeps in `panel.prefs` are bound to their field there.
import { useEffect, useState, type ComponentType } from 'react'
import { read, subscribe, update } from '../../../shared/storage/catalog'
import { readPrefs, updatePrefs, type PanelPrefs } from '../../../shared/panel-prefs'

export const SECTIONS = ['general', 'schedule', 'grades', 'info', 'session', 'appearance', 'shortcuts', 'data', 'about'] as const
export type SectionId = (typeof SECTIONS)[number]
export const SECTION_LABELS: Record<SectionId, string> = {
  general: 'General', schedule: 'Schedule', grades: 'Grades', info: 'Info and alerts', session: 'Session',
  appearance: 'Appearance', shortcuts: 'Shortcuts', data: 'Data and privacy', about: 'About',
}

export interface SettingDef<T = unknown> {
  /** For example `schedule.reminders.enabled`. */
  key: string
  section: SectionId
  label: string
  /** One line, sentence case (R8.3). */
  description: string
  type: 'toggle' | 'select' | 'number' | 'list' | 'text' | 'custom'
  default: T
  options?: { value: T; label: string }[]
  min?: number
  max?: number
  /** Returns an error text, or null when the value is valid. */
  validate?: (v: T) => string | null
  component?: ComponentType<{ def: SettingDef<T>; value: T; set: (v: T) => void }>
  /** Bind to a `panel.prefs` field instead of the `settings` store. */
  prefs?: keyof PanelPrefs
}

const defs = new Map<string, SettingDef>()

export function registerSetting<T>(def: SettingDef<T>): void {
  defs.set(def.key, def as SettingDef)
}
export const settingDefs = (): SettingDef[] => [...defs.values()]
export const settingDef = (key: string): SettingDef | undefined => defs.get(key)
export function clearSettings(): void {
  defs.clear()
}

/** Sections in the R8.1 order that have at least one setting. */
export function activeSections(): SectionId[] {
  const used = new Set(settingDefs().map((d) => d.section))
  return SECTIONS.filter((s) => used.has(s))
}

/** Settings whose label, description or key contain every word of the query (R8.2). */
export function searchSettings(q: string): SettingDef[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  return settingDefs().filter((d) => {
    const hay = `${d.label} ${d.description} ${d.key}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

export const isModified = (def: SettingDef, value: unknown) => JSON.stringify(value) !== JSON.stringify(def.default)

export async function readSetting<T>(def: SettingDef<T>): Promise<T> {
  if (def.prefs) return ((await readPrefs())[def.prefs] as unknown as T) ?? def.default
  const all = await read('settings')
  return all && def.key in all ? (all[def.key] as T) : def.default
}

/** Saves at once (R8.3) after validation; returns the error text when the value is refused. */
export async function writeSetting<T>(def: SettingDef<T>, value: T): Promise<string | null> {
  const error = def.validate?.(value) ?? null
  if (error) return error
  if (def.prefs) await updatePrefs((p) => ({ ...p, [def.prefs!]: value }))
  else await update('settings', (old) => ({ ...(old ?? {}), [def.key]: value }))
  return null
}

/** The current value of a setting, following storage changes. */
export function useSetting<T>(def: SettingDef<T>): T {
  const [value, setValue] = useState<T>(def.default)
  useEffect(() => {
    let live = true
    const load = () => void readSetting(def).then((v) => { if (live) setValue(v) })
    load()
    const off = subscribe(def.prefs ? 'panel.prefs' : 'settings', load)
    return () => { live = false; off() }
  }, [def])
  return value
}
