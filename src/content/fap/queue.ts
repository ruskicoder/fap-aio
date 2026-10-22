// Per-tab request queue with the shared budget grant (core R3.8; platform R3.1, R3.4, R3.5, R3.9).
// Requests run one at a time; each obtains a grant from the service worker first and releases it
// with the outcome. A challenge, reported here or by any tab, stops all reads until `reads.resume`.
import { call, onMessage } from '../../shared/call'
import type { AcquireResult } from '../../background/budget'
import { fapGet, fapGetJson, type FapError, type FapResult, type GetOpts } from './access'

export type Priority = 'user' | 'background'
export interface QueueState {
  pending: number
  waiting: { remaining: number; retryAfterMs: number; until: number } | null
  stopped: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const outcomeOf = (e: FapError | null): 'ok' | 'error' | 'challenge' =>
  !e ? 'ok' : e.kind === 'challenge' ? 'challenge' : e.kind === 'network' || e.kind === 'forbidden' ? 'error' : 'ok'

export class FapQueue {
  private chain: Promise<unknown> = Promise.resolve()
  private state: QueueState = { pending: 0, waiting: null, stopped: false }
  private listeners = new Set<(s: QueueState) => void>()

  get current(): QueueState { return this.state }

  subscribe(cb: (s: QueueState) => void): () => void {
    this.listeners.add(cb)
    cb(this.state)
    return () => this.listeners.delete(cb)
  }

  private set(patch: Partial<QueueState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  stop(): void { this.set({ stopped: true, waiting: null }) }
  resume(): void { this.set({ stopped: false }) }

  run<T>(priority: Priority, source: string, fn: () => Promise<FapResult<T>>): Promise<FapResult<T>> {
    this.set({ pending: this.state.pending + 1 })
    const job = this.chain.then(() => this.exec(priority, source, fn))
    this.chain = job.catch(() => {})
    return job.finally(() => this.set({ pending: this.state.pending - 1 }))
  }

  private async exec<T>(priority: Priority, source: string, fn: () => Promise<FapResult<T>>): Promise<FapResult<T>> {
    const stopped: FapResult<T> = { ok: false, error: { kind: 'challenge' } }
    for (;;) {
      if (this.state.stopped) return stopped
      const r = await call<AcquireResult>({ type: 'budget.acquire', priority, source })
      if (!r.ok) {
        if (r.error.kind === 'challenge') { this.stop(); return stopped }
        return { ok: false, error: { kind: 'network', message: `request budget unavailable (${r.error.kind})` } }
      }
      const a = r.value
      if (a.kind === 'grant') {
        this.set({ waiting: null })
        const result = await fn()
        const outcome = outcomeOf(result.ok ? null : result.error)
        await call({ type: 'budget.release', grantId: a.grantId, outcome })
        if (outcome === 'challenge') this.stop()
        return result
      }
      if (a.kind === 'challenge') { this.stop(); return stopped }
      this.set({ waiting: { remaining: a.remaining, retryAfterMs: a.retryAfterMs, until: Date.now() + a.retryAfterMs } })
      await sleep(a.retryAfterMs)
    }
  }
}

export const queue = new FapQueue()

let wired = false
/** Listens for the service worker's stop and resume broadcasts. */
export function wireQueue(q: FapQueue = queue): void {
  if (wired && q === queue) return
  if (q === queue) wired = true
  onMessage('reads.stop', () => q.stop())
  onMessage('reads.resume', () => q.resume())
}

export interface QueuedOpts extends GetOpts { priority?: Priority; source: string }

export function queuedGet(path: string, opts: QueuedOpts): Promise<FapResult<Document>> {
  return queue.run(opts.priority ?? 'user', opts.source, () => fapGet(path, opts))
}

export function queuedGetJson<T = unknown>(path: string, opts: QueuedOpts): Promise<FapResult<T>> {
  return queue.run(opts.priority ?? 'user', opts.source, () => fapGetJson<T>(path, opts))
}
