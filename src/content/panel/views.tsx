// View registry and ViewOutlet (panel-ux design, "View registry"; R2.4, R10.6). Modules register
// lazy views per tab and sub-view or overlay. A loaded view is cached, so a later switch renders at
// once; while the next view loads, the previous one stays mounted, and only a first load shows a
// skeleton. A chunk that fails shows an inline "Try again"; the rest of the panel keeps working.
import { useEffect, useState, useSyncExternalStore, type ComponentType } from 'react'
import type { Route } from '../../shared/panel-state'
import type { StoreKey } from '../../shared/storage/catalog'
import { isOverlay, routeKey, useRoute, type OverlayId, type PanelRouter, type TabId } from './router'
import { Icon } from './icons'

export type ViewDef = {
  label: string
  icon: string
  component: () => Promise<ComponentType>
  /** Badge count; null hides it. Not shown in M1 (agreed shell has no tab badges). */
  count?: () => number | null
  /** Stores whose `lastSync` the status strip shows while this view is open (R2.6). */
  lastSync?: { label: string; key: StoreKey }[]
} & ({ tab: TabId; sub?: string } | { overlay: OverlayId })

const defs = new Map<string, ViewDef>()
const loaded = new Map<string, ComponentType>()

const keyOf = (d: ViewDef) => ('overlay' in d ? `overlay/${d.overlay}` : d.sub ? `${d.tab}/${d.sub}` : d.tab)

export function registerView(def: ViewDef): void {
  defs.set(keyOf(def), def)
  notifyCounts() // views register after the panel mounts
}
export const viewFor = (r: Route): ViewDef | undefined => defs.get(routeKey(r))
export const viewsOf = (tab: TabId): ViewDef[] => [...defs.values()].filter((d) => 'tab' in d && d.tab === tab)
/** Every registered non-overlay view, in registration order: the tabs of the panel (R2.1, R2.2). */
export type TabViewDef = Extract<ViewDef, { tab: TabId }>
export const tabViews = (): TabViewDef[] => [...defs.values()].filter((d): d is TabViewDef => 'tab' in d)
export const routeOfView = (d: TabViewDef): Route => (d.sub ? { tab: d.tab, sub: d.sub } : { tab: d.tab }) as Route
// Bumped when a view registers or a badge count changes.
let countsVersion = 0
const countListeners = new Set<() => void>()
/** Views call this when a badge count changes, so the segmented control re-reads it (R2.2). */
export function notifyCounts(): void {
  countsVersion++
  for (const l of countListeners) l()
}
export function useCounts(): number {
  return useSyncExternalStore((cb) => { countListeners.add(cb); return () => countListeners.delete(cb) }, () => countsVersion)
}

/** Test hook. */
export function clearViews(): void {
  defs.clear()
  loaded.clear()
}

export function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3 p-3">
      {[70, 90, 55].map((w) => (
        <div key={w} className="h-4 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

type Shown = { key: string; Comp: ComponentType } | null

export function ViewOutlet({ router }: { router: PanelRouter }) {
  const route = useRoute(router)
  useCounts()
  const key = routeKey(route)
  const def = viewFor(route)
  const [shown, setShown] = useState<Shown>(() => (loaded.has(key) ? { key, Comp: loaded.get(key)! } : null))
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setFailed(null)
    if (!def) return
    const cached = loaded.get(key)
    if (cached) {
      setShown({ key, Comp: cached })
      return
    }
    let live = true
    def.component().then(
      (Comp) => {
        loaded.set(key, Comp)
        if (live) setShown({ key, Comp })
      },
      () => { if (live) setFailed(key) },
    )
    return () => { live = false }
  }, [key, def, attempt])

  const overlay = isOverlay(route)
  let body
  if (!def) body = <p className="p-3 text-sm text-gray-600">This view is not available yet.</p>
  else if (failed === key) {
    body = (
      <div role="alert" className="flex items-center gap-2 p-3 text-sm">
        <span className="flex-1">This view did not load. Try again, or reload the page if it keeps failing.</span>
        <button type="button" className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
      </div>
    )
  } else if (shown) body = <shown.Comp key={shown.key} />
  else body = <Skeleton />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {overlay && (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 px-2">
          <button type="button" aria-label="Back" title="Back" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => router.back()}><Icon name="back" /></button>
          <h2 className="text-base font-semibold">{def?.label ?? ''}</h2>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto" aria-busy={!!def && !failed && shown?.key !== key}>{body}</div>
    </div>
  )
}
