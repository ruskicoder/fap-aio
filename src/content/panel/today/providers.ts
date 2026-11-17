// TodayProvider registry (panel-ux R3.1 to R3.4; design "Today"): modules add providers; the view shows
// them in the R3.1 order and hides those without items.
import type { Route } from '../../../shared/panel-state'
import type { StoreKey } from '../../../shared/storage/catalog'

export interface TodayItem {
  id: string
  title: string
  detail?: string
  tone: 'neutral' | 'warning' | 'danger' | 'success'
  /** A short time text such as "in 25 min" or "Fri 21 Nov". */
  when?: string
  link: Route
}

export interface TodayContext { now: number }

export interface TodayProvider {
  id: string
  /** Position in the R3.1 order; see TODAY_ORDER. */
  order: number
  /** Section heading, sentence case. */
  label: string
  /** False for informational sections (the next class, today's classes): they do not break the calm state. */
  attention: boolean
  /** Stores whose changes re-read the items. */
  keys?: StoreKey[]
  items(ctx: TodayContext): TodayItem[] | Promise<TodayItem[]>
  /** Refreshes the provider's sources through the core registry and request budget (R3.4). */
  refresh?: () => Promise<{ ok: boolean; text?: string }>
  /** When the provider's data was last synced. */
  syncedAt?: () => Promise<number | null>
}

/** R3.1 order. */
export const TODAY_ORDER = { nextClass: 1, todayClasses: 2, examsSoon: 3, attendanceRisk: 4, gradeRisk: 5, newsP1: 6, courseraDue: 7 } as const

const providers = new Map<string, TodayProvider>()
const listeners = new Set<() => void>()

export function registerTodayProvider(p: TodayProvider): void {
  providers.set(p.id, p)
  for (const l of listeners) l()
}
export const todayProviders = (): TodayProvider[] => [...providers.values()].sort((a, b) => a.order - b.order)
export function clearTodayProviders(): void {
  providers.clear()
}
export function onProvidersChanged(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Runs every provider's refresh one after the other; the registry queue applies the budget. */
export async function refreshAll(list = todayProviders()): Promise<{ ok: boolean; text?: string }> {
  for (const p of list) {
    if (!p.refresh) continue
    const r = await p.refresh()
    if (!r.ok) return r
  }
  return { ok: true }
}
