// PanelRouter (panel-ux design, "PanelRouter"; R2.4, R1.8): the current route, a back stack for
// overlays and deep links, and listeners. The host persists every change in `panel.state.route`.
import { useSyncExternalStore } from 'react'
import type { Route } from '../../shared/panel-state'

export type TabId = 'today' | 'schedule' | 'grades' | 'info'
export type OverlayId = 'theme' | 'settings' | 'help' | 'shortcuts'
export type RouteSource = 'user' | 'page' | 'deeplink'

export const isOverlay = (r: Route): r is Extract<Route, { overlay: OverlayId }> => 'overlay' in r
/** Registry key of a route: `schedule/week`, `today`, `overlay/settings`. */
export const routeKey = (r: Route): string => (isOverlay(r) ? `overlay/${r.overlay}` : 'sub' in r ? `${r.tab}/${r.sub}` : r.tab)

export class PanelRouter {
  private route: Route
  private stack: Route[] = []
  private listeners = new Set<(r: Route) => void>()
  /** Where the last change came from; the page-aware map yields to a later user pick (R4.2). */
  lastSource: RouteSource = 'page'

  constructor(initial: Route = { tab: 'today' }) {
    this.route = initial
  }

  current(): Route { return this.route }

  go(r: Route, opts: { source?: RouteSource } = {}): void {
    if (JSON.stringify(r) === JSON.stringify(this.route)) return
    if (opts.source === 'page') this.stack = []
    else if (isOverlay(r) || isOverlay(this.route) || opts.source === 'deeplink') this.stack.push(this.route)
    else this.stack = []
    this.set(r, opts.source ?? 'user')
  }

  /** Returns from an overlay or deep link; without history, an overlay goes to Today. */
  back(): void {
    const prev = this.stack.pop()
    if (prev) this.set(prev, 'user')
    else if (isOverlay(this.route)) this.set({ tab: 'today' }, 'user')
  }

  canGoBack(): boolean { return this.stack.length > 0 || isOverlay(this.route) }

  subscribe(cb: (r: Route) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private set(r: Route, source: RouteSource) {
    this.route = r
    this.lastSource = source
    for (const l of this.listeners) l(r)
  }
}

export function useRoute(router: PanelRouter): Route {
  return useSyncExternalStore((cb) => router.subscribe(cb), () => router.current())
}
