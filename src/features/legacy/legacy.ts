// Legacy page storage (core R12.1 to R12.4; design "Legacy cleanup"): keys an older FAP-AIO build left in
// FAP's localStorage. Only keys on the list or matching its patterns are ever exported or removed.
// This folder is the only place allowed to touch FAP's localStorage (ESLint rule, platform R4.7).
import { read, write } from '../../shared/storage/catalog'

declare module '../../shared/storage/catalog' {
  interface StoreMap { legacy: { dismissed: boolean } }
}

export const LEGACY_KEYS = ['weeklySchedule', 'examSchedule', 'examFilter', 'semesterSyncState', 'pendingSemesterSync', 'selectedSemester', 'expireAt'] as const
/** MoveOut subject keys: `CODE - Name`. */
const MOVEOUT = /^[A-Z]{2,4}\d{3}[a-z]? - \S.*$/

export function isLegacyKey(key: string): boolean {
  return (LEGACY_KEYS as readonly string[]).includes(key) || key.startsWith('fap-aio:') || MOVEOUT.test(key)
}

export function scanLegacy(storage: Storage = window.localStorage): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k !== null && isLegacyKey(k)) keys.push(k)
  }
  return keys.sort()
}

export interface LegacyExport { formatVersion: 1; exportedAt: string; origin: string; items: Record<string, string> }

export function exportLegacy(keys: string[], storage: Storage = window.localStorage, now = new Date(), origin = location.origin): LegacyExport {
  const items: Record<string, string> = {}
  for (const k of keys) if (isLegacyKey(k)) { const v = storage.getItem(k); if (v !== null) items[k] = v }
  return { formatVersion: 1, exportedAt: now.toISOString(), origin, items }
}

/** Removes the listed keys only; a key off the legacy list is never removed (R12.3). */
export function removeLegacy(keys: string[], storage: Storage = window.localStorage): number {
  let n = 0
  for (const k of keys) {
    if (!isLegacyKey(k)) continue
    storage.removeItem(k)
    n++
  }
  return n
}

export async function isDismissed(): Promise<boolean> {
  return (await read('legacy'))?.dismissed === true
}
export const setDismissed = (dismissed: boolean) => write('legacy', { dismissed })
