// Status strip (panel-ux R3.4 via the design's StatusStrip; platform R3.9, R5.5; core error table):
// last sync, running range-sync progress, request-budget wait, data channel state, and the
// challenge banner with a reload button.
import { useEffect, useState } from 'react'
import { queue as defaultQueue, type FapQueue, type QueueState } from '../fap/queue'
import { onMessage } from '../../shared/call'
import { subscribe, read } from '../../shared/storage/catalog'
import type { MsgOf } from '../../shared/messages'

export interface SyncJobView { mondays: string[]; next: number }
declare module '../../shared/storage/catalog' {
  interface StoreMap { 'sync.job': SyncJobView & Record<string, unknown> }
}

export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export function StatusStrip({ lastSync, q = defaultQueue, reload = () => location.reload() }: { lastSync?: number | null; q?: FapQueue; reload?: () => void }) {
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

  const parts: string[] = []
  if (job && job.mondays.length) parts.push(`Syncing ${job.next}/${job.mondays.length} weeks`)
  if (qs.waiting) parts.push(`Waiting for FAP budget: ${qs.waiting.remaining} left, ${Math.ceil(qs.waiting.retryAfterMs / 1000)} s`)
  if (data?.state === 'syncing') parts.push('Syncing data')
  else if (data?.skipped) parts.push(`Data update skipped: ${data.skipped}`)
  else if (data?.version != null) parts.push(`Data v${data.version}`)
  const left = lastSync ? `Synced ${ago(lastSync)}` : 'Not synced yet'
  const pct = job && job.mondays.length ? Math.round((job.next / job.mondays.length) * 100) : null

  return (
    <div role="status" aria-live="polite" className="flex h-7 shrink-0 items-center gap-2 border-t border-gray-200 px-3 text-xs text-gray-600">
      <span className="truncate">{left}</span>
      {pct !== null && (
        <span aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded bg-gray-200">
          <span className="block h-full bg-orange-500" style={{ width: `${pct}%` }} />
        </span>
      )}
      <span className="ml-auto truncate">{parts.join(' · ')}</span>
    </div>
  )
}
