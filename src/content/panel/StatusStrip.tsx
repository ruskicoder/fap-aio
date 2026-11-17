// Status strip (panel-ux R2.6; platform R3.9, R5.5; core error table): always at the bottom. Shows the
// last sync of the open view's data, header Sync and range-sync progress, the request-budget wait,
// the data channel state, and the challenge banner with a reload button.
import { useEffect, useState } from 'react'
import { queue as defaultQueue, type FapQueue, type QueueState } from '../fap/queue'
import { onMessage } from '../../shared/call'
import { subscribe, read, type StoreKey } from '../../shared/storage/catalog'
import { useSyncAll } from './actions'
import { useRoute, type PanelRouter } from './router'
import { useCounts, viewFor } from './views'
import type { MsgOf } from '../../shared/messages'

export interface SyncJobView { mondays: string[]; next: number }

export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export interface SyncStamp { label: string; at: number | null }

/** `Synced 2 min ago`, or one stamp per store: `Classes synced 2 min ago · Exams not synced yet`. */
export function stampText(stamps: SyncStamp[], now = Date.now()): string {
  if (stamps.length === 1) return stamps[0]!.at != null ? `Synced ${ago(stamps[0]!.at, now)}` : 'Not synced yet'
  return stamps.map((s) => `${s.label} ${s.at != null ? `synced ${ago(s.at, now)}` : 'not synced yet'}`).join(' · ')
}

export function StatusStrip({ lastSync, stamps, q = defaultQueue, reload = () => location.reload() }: { lastSync?: number | null; stamps?: SyncStamp[]; q?: FapQueue; reload?: () => void }) {
  const sync = useSyncAll()
  const [qs, setQs] = useState<QueueState>(q.current)
  const [job, setJob] = useState<SyncJobView | null>(null)
  const [data, setData] = useState<MsgOf<'data.progress'> | null>(null)
  const [, tick] = useState(0)

  useEffect(() => q.subscribe(setQs), [q])
  useEffect(() => {
    void read('sync.job').then(setJob)
    return subscribe('sync.job', setJob)
  }, [])
  useEffect(() => onMessage('data.progress', (m) => { setData(m) }), [])
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (qs.stopped) {
    return (
      <div role="alert" className="flex shrink-0 items-center gap-2 border-t border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
        <span className="flex-1">FAP asked your browser to verify. Reload this page to continue.</span>
        <button type="button" className="rounded border border-amber-400 px-2 py-0.5 font-medium hover:bg-amber-100 focus:outline-none focus-visible:ring-2" onClick={reload}>Reload</button>
      </div>
    )
  }

  if (sync.error) {
    return (
      <div role="alert" className="flex min-h-[34px] shrink-0 items-center gap-2 border-t border-red-200 bg-red-50 px-3 py-1 text-xs text-red-800">{sync.error}</div>
    )
  }
  const parts: string[] = []
  if (sync.running) parts.push('Syncing this week and exams…')
  if (job && job.mondays.length) parts.push(`Syncing ${job.next}/${job.mondays.length} weeks`)
  if (qs.waiting) parts.push(`Waiting for FAP budget: ${qs.waiting.remaining} left, ${Math.ceil(qs.waiting.retryAfterMs / 1000)} s`)
  if (data?.state === 'syncing') parts.push('Syncing data')
  else if (data?.skipped) parts.push(`Data update skipped: ${data.skipped}`)
  else if (data?.version != null) parts.push(`Data v${data.version}`)
  const left = stamps?.length ? stampText(stamps) : lastSync ? `Synced ${ago(lastSync)}` : 'Not synced yet'
  const pct = job && job.mondays.length ? Math.round((job.next / job.mondays.length) * 100) : null

  return (
    <div role="status" aria-live="polite" className="flex min-h-[34px] shrink-0 flex-wrap items-center gap-x-2 border-t border-gray-200 px-3 py-1 text-xs text-gray-600">
      <span>{left}</span>
      {pct !== null && (
        <span aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded bg-gray-200">
          <span className="block h-full bg-orange-500" style={{ width: `${pct}%` }} />
        </span>
      )}
      <span className="ml-auto">{parts.join(' · ')}</span>
    </div>
  )
}

/** The strip for the open view: reads `lastSync` of the stores its view declares (R2.6). */
/** A store's `lastSync`, or for a registry cache (`cache:<source>`) its latest read (fix F-13). */
export async function syncedAt(key: StoreKey): Promise<number | null> {
  const d = (await read(key)) as { lastSync?: number | null; entries?: Record<string, { fetchedAt: number }> } | null
  if (!d) return null
  if (key.startsWith('cache:')) {
    const at = Object.values(d.entries ?? {}).map((e) => e.fetchedAt)
    return at.length ? Math.max(...at) : null
  }
  return d.lastSync ?? null
}

export function ViewStatusStrip({ router, q, reload }: { router: PanelRouter; q?: FapQueue; reload?: () => void }) {
  const route = useRoute(router)
  useCounts()
  const def = viewFor(route)
  const keys = def?.lastSync ?? []
  const sig = keys.map((k) => `${k.label}=${k.key}`).join('|')
  const [stamps, setStamps] = useState<SyncStamp[]>([])
  useEffect(() => {
    let live = true
    const load = () => Promise.all(keys.map(async (k) => ({ label: k.label, at: await syncedAt(k.key) })))
      .then((s) => { if (live) setStamps(s) })
    void load()
    const offs = keys.map((k) => subscribe(k.key as StoreKey, () => void load()))
    return () => { live = false; offs.forEach((o) => o()) }
  }, [sig])
  return <StatusStrip stamps={keys.length ? stamps : undefined} q={q} reload={reload} />
}
