// `data.status` handler: storage usage per key and the IndexedDB estimate (platform R4.6).
// The data channel fields are added with the data service (PLT-6).
import { ok, register } from './router'
import { usage } from '../shared/storage/catalog'

export interface StorageStatus {
  usage: { perKey: Record<string, number>; total: number }
  idb: { usage: number | null; quota: number | null }
}

export async function storageStatus(): Promise<StorageStatus> {
  let idb: StorageStatus['idb'] = { usage: null, quota: null }
  try {
    const est = await navigator.storage?.estimate?.()
    if (est) idb = { usage: est.usage ?? null, quota: est.quota ?? null }
  } catch {
    // estimate unavailable: report nulls
  }
  return { usage: await usage(), idb }
}

export function installStatus(): void {
  register('data.status', async () => ok(await storageStatus()))
}
