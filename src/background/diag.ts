// Diagnostic counters (platform R2.3, R7.3): counts only, never message content.
import { read, update } from '../shared/storage/catalog'

declare module '../shared/storage/catalog' {
  interface StoreMap { 'diag.counters': Record<string, number> }
}

export function count(name: string, by = 1): Promise<void> {
  return update('diag.counters', (old) => ({ ...(old ?? {}), [name]: (old?.[name] ?? 0) + by }))
    .then(() => undefined)
    .catch(() => undefined)
}

export async function readCounters(): Promise<Record<string, number>> {
  await count('diag.reads', 0)
  return (await read('diag.counters')) ?? {}
}
