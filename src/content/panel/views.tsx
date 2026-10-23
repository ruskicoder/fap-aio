// View registry and ViewOutlet (panel-ux design, "View registry"; R2.4, R10.6). Modules register
// lazy views per tab and sub-view or overlay. A loaded view is cached, so a later switch renders at
// once; while the next view loads, the previous one stays mounted, and only a first load shows a
// skeleton. A chunk that fails shows an inline "Try again"; the rest of the panel keeps working.
import { useEffect, useState, useSyncExternalStore, type ComponentType } from 'react'
import type { Route } from '../../shared/panel-state'
import { isOverlay, routeKey, useRoute, type OverlayId, type PanelRouter, type TabId } from './router'

export type ViewDef = {
  label: string
  icon: string
  component: () => Promise<ComponentType>
  /** Badge on the segmented control (R2.2); null hides it. */
  count?: () => number | null
} & ({ tab: TabId; sub?: string } | { overlay: OverlayId })

const defs = new Map<string, ViewDef>()
const loaded = new Map<string, ComponentType>()

const keyOf = (d: ViewDef) => ('overlay' in d ? `overlay/${d.overlay}` : d.sub ? `${d.tab}/${d.sub}` : d.tab)

export function registerView(def: ViewDef): void {
  defs.set(keyOf(def), def)
}
export const viewFor = (r: Route): ViewDef | undefined => defs.get(routeKey(r))
export const viewsOf = (tab: TabId): ViewDef[] => [...defs.values()].filter((d) => 'tab' in d && d.tab === tab)
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
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-gray-200 px-2">
          <button type="button" aria-label="Back" className="inline-flex h-7 min-w-7 items-center justify-center rounded px-1 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => router.back()}>←</button>
          <h2 className="text-sm font-semibold">{def?.label ?? ''}</h2>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto" aria-busy={!!def && !failed && shown?.key !== key}>{body}</div>
    </div>
  )
}
