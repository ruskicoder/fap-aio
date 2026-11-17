// `data.status` handler: storage usage per key, the IndexedDB estimate (platform R4.6) and the data
// files in use (PLT-6.2), and the data channel's accepted version, last check and skip reason (PLT-7.2).
import { ok, register } from './router'
import { usage } from '../shared/storage/catalog'
import { dataFilesStatus } from './data/handlers'
import type { DataDeps } from './data/db'
import type { DataFileStatus } from '../shared/data/types'
import { channelStatus, type ChannelStatus } from './data-channel'

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

export interface DataStatus extends StorageStatus {
  data: { files: DataFileStatus[]; version: number | null } | null
  channel: ChannelStatus
}

export async function dataStatus(deps: DataDeps = {}): Promise<DataStatus> {
  const data = await dataFilesStatus(deps).catch(() => null)
  return { ...(await storageStatus()), data, channel: await channelStatus() }
}

export function installStatus(deps: DataDeps = {}): void {
  register('data.status', async () => ok(await dataStatus(deps)))
}
