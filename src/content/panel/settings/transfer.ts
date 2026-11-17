// Settings export, import and reset (panel-ux R8.4, R8.5; design "SettingsRegistry"): JSON
// `{ formatVersion: 1, settings: { key: value } }`. An import is checked key by key against the registry
// and shown as a list of changes before it is applied. Imported files are untrusted input.
import { readSetting, settingDef, settingDefs, writeSetting, type SectionId, type SettingDef } from './registry'

export const FORMAT_VERSION = 1

export interface SettingsFile { formatVersion: 1; exportedAt: string; settings: Record<string, unknown> }
export interface Change { key: string; label: string; from: unknown; to: unknown }
export interface ImportPlan { changes: Change[]; refused: { key: string; reason: string }[]; unknown: string[] }

export async function exportSettings(now = new Date()): Promise<SettingsFile> {
  const settings: Record<string, unknown> = {}
  for (const d of settingDefs()) if (!d.component || d.type !== 'custom') settings[d.key] = await readSetting(d)
  return { formatVersion: FORMAT_VERSION, exportedAt: now.toISOString(), settings }
}

/** Checks a value against the setting's type, options, range and own validation. */
export function checkValue(def: SettingDef, v: unknown): string | null {
  switch (def.type) {
    case 'toggle':
      if (typeof v !== 'boolean') return 'not on or off'
      break
    case 'select':
      if (!def.options?.some((o) => JSON.stringify(o.value) === JSON.stringify(v))) return 'not one of the choices'
      break
    case 'number':
      if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) return 'not a number'
      if (typeof v === 'number' && ((def.min !== undefined && v < def.min) || (def.max !== undefined && v > def.max))) return 'out of range'
      break
    case 'list':
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) return 'not a list of texts'
      break
    case 'text':
      if (typeof v !== 'string') return 'not a text'
      break
    default:
      break
  }
  return def.validate ? (def.validate as (x: unknown) => string | null)(v) : null
}

export async function planImport(text: string): Promise<ImportPlan | { error: string }> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: 'This file is not JSON. Choose a settings file exported by FAP-AIO.' }
  }
  const f = raw as Partial<SettingsFile> | null
  if (!f || typeof f !== 'object' || f.formatVersion !== FORMAT_VERSION || !f.settings || typeof f.settings !== 'object' || Array.isArray(f.settings)) {
    return { error: 'This is not a FAP-AIO settings file (format version 1).' }
  }
  const plan: ImportPlan = { changes: [], refused: [], unknown: [] }
  for (const [key, to] of Object.entries(f.settings)) {
    const def = settingDef(key)
    if (!def) { plan.unknown.push(key); continue }
    const reason = checkValue(def, to)
    if (reason) { plan.refused.push({ key, reason }); continue }
    const from = await readSetting(def)
    if (JSON.stringify(from) !== JSON.stringify(to)) plan.changes.push({ key, label: def.label, from, to })
  }
  return plan
}

export async function applyChanges(changes: Change[]): Promise<void> {
  for (const c of changes) {
    const def = settingDef(c.key)
    if (def) await writeSetting(def, c.to)
  }
}

/** Restores the defaults of one section, or of every section. */
export async function resetSettings(section: SectionId | null): Promise<void> {
  for (const d of settingDefs()) if (section === null || d.section === section) await writeSetting(d, d.default)
}

/** Starts a download from a blob link inside the panel (platform amendment: no `downloads`). */
export function downloadJson(container: Node, name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.hidden = true
  container.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
