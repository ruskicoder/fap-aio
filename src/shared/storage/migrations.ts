// Ordered schema migrations (platform R4.3, R4.4; core R5.3, R5.4). `migrations[key][from]`
// turns data of version `from` into version `from + 1`. The service worker runs them on
// update before features read; readers that see an old version wait for the result.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { entryFor, readRaw, remove, storedKeys, subscribe, update, type StoreKey, type Versioned } from './catalog'

declare module './catalog' {
  interface StoreMap { 'storage.discarded': { keys: string[] } }
}

export type Step = (old: any) => any
export const migrations: Record<string, Record<number, Step>> = {}

/** Registers a step; the catalog key pattern `cache:*` applies to every cache key. */
export function addMigration(key: string, from: number, step: Step): void {
  ;(migrations[key] ??= {})[from] = step
}

const stepsFor = (key: string) => migrations[key] ?? (key.startsWith('cache:') ? migrations['cache:*'] : undefined) ?? {}

export interface MigrationReport { migrated: string[]; discarded: string[] }

export async function runMigrations(): Promise<MigrationReport> {
  const report: MigrationReport = { migrated: [], discarded: [] }
  for (const key of await storedKeys()) {
    const entry = entryFor(key)
    if (!entry) continue
    const raw = await readRaw(key as StoreKey)
    if (!raw || raw.schemaVersion === entry.version) continue
    let data = raw.data
    let v = raw.schemaVersion
    try {
      if (v > entry.version) throw new Error('newer than this build')
      while (v < entry.version) {
        const step = stepsFor(key)[v]
        if (!step) throw new Error(`no step from ${v}`)
        data = step(data)
        v++
      }
      const next: Versioned<unknown> = { schemaVersion: v, updatedAt: Date.now(), data }
      await chrome.storage.local.set({ [key]: next })
      report.migrated.push(key)
    } catch {
      await remove(key as StoreKey)
      report.discarded.push(key)
    }
  }
  if (report.discarded.length) {
    await update('storage.discarded', (old) => ({ keys: [...new Set([...(old?.keys ?? []), ...report.discarded])] }))
  }
  return report
}

/**
 * Reads a store; if it holds an older schema version, waits (up to `timeoutMs`) for the service
 * worker's migration to rewrite or discard it. Returns null for a discarded or missing store.
 */
export async function readMigrated<T = unknown>(key: StoreKey, timeoutMs = 10_000): Promise<T | null> {
  const want = entryFor(key)!.version
  const raw = await readRaw(key)
  if (!raw) return null
  if (raw.schemaVersion === want) return raw.data as T
  if (raw.schemaVersion > want) return null
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => { off(); resolve(null) }, timeoutMs)
    const off = subscribe(key, (data) => {
      clearTimeout(timer)
      off()
      resolve(data as T | null)
    })
  })
}

/** Clears the "sync again" marker for keys that were filled again. */
export async function clearDiscarded(keys: string[]): Promise<void> {
  await update('storage.discarded', (old) => ({ keys: (old?.keys ?? []).filter((k) => !keys.includes(k)) }))
}
