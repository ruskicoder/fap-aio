// Shared FAP request budget (platform R3.1 to R3.7): at most 30 grants per rolling 5 minutes
// per browser, one in flight at a time, background reads at most 12 of them, user reads first.
// The ledger lives in storage.session so it survives service worker restarts.

export const WINDOW_MS = 5 * 60_000
export const MAX_GRANTS = 30
export const MAX_BACKGROUND = 12
export const LEASE_MS = 15_000
export const GAP_MS = 400
export const GAP_AFTER_ERROR_MS = 1_500
export const USER_PRIORITY_MS = 5_000
const KEY = 'budget.ledger'

export type Outcome = 'ok' | 'error' | 'challenge'
export interface Ledger {
  grants: { at: number; bg: boolean }[]
  inflight: { grantId: string; tabId: number | null; at: number } | null
  lastEndAt: number
  lastOutcome: Outcome
  challenged: boolean
  userWaitingUntil: number
}

export type AcquireResult =
  | { kind: 'grant'; grantId: string; remaining: number }
  | { kind: 'wait'; retryAfterMs: number; remaining: number; reason: 'inflight' | 'gap' | 'window' | 'background' }
  | { kind: 'challenge' }

const empty = (): Ledger => ({ grants: [], inflight: null, lastEndAt: 0, lastOutcome: 'ok', challenged: false, userWaitingUntil: 0 })

export class Budget {
  private chain: Promise<unknown> = Promise.resolve()
  constructor(
    private area: chrome.storage.StorageArea = chrome.storage.session,
    private newId: () => string = () => crypto.randomUUID(),
  ) {}

  private async load(): Promise<Ledger> {
    return ((await this.area.get(KEY))[KEY] as Ledger | undefined) ?? empty()
  }

  private tx<T>(fn: (l: Ledger) => T): Promise<T> {
    const p = this.chain.then(async () => {
      const l = await this.load()
      const out = fn(l)
      await this.area.set({ [KEY]: l })
      return out
    })
    this.chain = p.catch(() => {})
    return p
  }

  ledger(): Promise<Ledger> {
    return this.chain.then(() => this.load())
  }

  acquire(priority: 'user' | 'background', tabId: number | null, now = Date.now()): Promise<AcquireResult> {
    return this.tx((l) => {
      l.grants = l.grants.filter((g) => now - g.at < WINDOW_MS)
      const bg = priority === 'background'
      const used = l.grants.length
      const usedBg = l.grants.filter((g) => g.bg).length
      const remaining = Math.max(0, bg ? Math.min(MAX_GRANTS - used, MAX_BACKGROUND - usedBg) : MAX_GRANTS - used)
      const wait = (retryAfterMs: number, reason: 'inflight' | 'gap' | 'window' | 'background'): AcquireResult => {
        if (!bg) l.userWaitingUntil = now + USER_PRIORITY_MS
        return { kind: 'wait', retryAfterMs: Math.max(1, Math.ceil(retryAfterMs)), remaining, reason }
      }
      // 1. challenge stops everything
      if (l.challenged) return { kind: 'challenge' }
      // 2. one request at a time; a lease older than 15 s is treated as lost
      if (l.inflight) {
        if (now - l.inflight.at < LEASE_MS) return wait(GAP_MS, 'inflight')
        l.inflight = null
      }
      // 3. pause after the previous request
      const gap = (l.lastOutcome === 'error' ? GAP_AFTER_ERROR_MS : GAP_MS) - (now - l.lastEndAt)
      if (gap > 0) return wait(gap, 'gap')
      // 4. rolling window
      if (used >= MAX_GRANTS) return wait(l.grants[0]!.at + WINDOW_MS - now, 'window')
      // 5. background cap and user priority
      if (bg) {
        if (usedBg >= MAX_BACKGROUND) return wait(l.grants.find((g) => g.bg)!.at + WINDOW_MS - now, 'background')
        if (now < l.userWaitingUntil) return wait(l.userWaitingUntil - now, 'background')
      }
      // 6. grant
      const grantId = this.newId()
      l.grants.push({ at: now, bg })
      l.inflight = { grantId, tabId, at: now }
      return { kind: 'grant', grantId, remaining: remaining - 1 }
    })
  }

  /** Ends a grant. Returns true when this release put the browser under a challenge. */
  release(grantId: string, outcome: Outcome, now = Date.now()): Promise<boolean> {
    return this.tx((l) => {
      if (l.inflight?.grantId === grantId) l.inflight = null
      l.lastEndAt = now
      l.lastOutcome = outcome
      if (outcome === 'challenge' && !l.challenged) {
        l.challenged = true
        return true
      }
      return false
    })
  }

  /** Clears a challenge (a FAP page finished loading). Returns true if one was cleared. */
  clearChallenge(): Promise<boolean> {
    return this.tx((l) => {
      const was = l.challenged
      l.challenged = false
      return was
    })
  }
}
