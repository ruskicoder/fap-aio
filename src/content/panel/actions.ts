// Shell actions that modules provide (header Sync, panel-ux R2.3) and their running state for the
// header and the status strip.
import { useSyncExternalStore } from 'react'

export type SyncAllResult = { ok: true } | { ok: false; text: string }
export interface SyncAllState { running: boolean; error: string | null }

let provider: (() => Promise<SyncAllResult>) | null = null
let state: SyncAllState = { running: false, error: null }
const listeners = new Set<() => void>()
const set = (s: SyncAllState) => {
  state = s
  for (const l of listeners) l()
}

/** The scheduler provides "this week's classes and the exams" (R2.3). */
export function provideSyncAll(fn: () => Promise<SyncAllResult>): void {
  provider = fn
}

export async function runSyncAll(): Promise<void> {
  if (!provider || state.running) return
  set({ running: true, error: null })
  let r: SyncAllResult
  try {
    r = await provider()
  } catch (e) {
    r = { ok: false, text: `Sync failed: ${e instanceof Error ? e.message : String(e)}` }
  }
  set({ running: false, error: r.ok ? null : r.text })
}

export function useSyncAll(): SyncAllState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}

/** Test hook. */
export function resetSyncAll(): void {
  provider = null
  set({ running: false, error: null })
}
