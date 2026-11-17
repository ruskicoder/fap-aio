// The `settings` store: one map of setting keys to values (panel-ux design, SettingsRegistry). The
// registry (PNL-8.1) declares keys, defaults and labels; this module only reads and writes values.
import { read, update } from './storage/catalog'

export type SettingsMap = Record<string, unknown>

declare module './storage/catalog' {
  interface StoreMap { settings: SettingsMap }
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const all = await read('settings')
  return all && key in all ? (all[key] as T) : fallback
}

export function setSettings(patch: SettingsMap): Promise<SettingsMap> {
  return update('settings', (old) => ({ ...(old ?? {}), ...patch }))
}
