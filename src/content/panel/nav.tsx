// Navigation (panel-ux R2.1, R2.2, R2.5; design "four primary tabs with segmented sub-views"; fix F-18):
// the section tabs Today, Schedule, Grades and Info, each shown once it has a shipped view, and under
// them the open section's views in the sub-view bar of the agreed shell (ui/shell.html). A row with one
// item is not shown, so a lone section shows its views directly. Nothing scrolls sideways or clips.
// APG tabs with manual activation: arrows, Home and End move focus, Enter or Space activates, a click
// activates directly. Both rows are hidden while an overlay (Settings) is open.
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { Route } from '../../shared/panel-state'
import { isOverlay, routeKey, useRoute, type PanelRouter, type TabId } from './router'
import { routeOfView, tabViews, useCounts, viewFor, viewsOf } from './views'
import { Icon, type IconName } from './icons'

export const GROUPS: readonly { id: TabId; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
  { id: 'grades', label: 'Grades', icon: 'chart' },
  { id: 'info', label: 'Info', icon: 'info' },
]

/** The sections with at least one shipped view, in the fixed order. */
export const shippedGroups = () => GROUPS.filter((g) => viewsOf(g.id).length > 0)

// The view last open in each section this page load, so a section tab returns to it.
const lastView = new Map<TabId, string>()
export function rememberView(r: Route): void {
  if (!isOverlay(r) && viewFor(r)) lastView.set(r.tab, routeKey(r))
}
/** Test hook. */
export const forgetViews = () => lastView.clear()

/** The route a section tab opens: its last open view, else its first. Null when it has none. */
export function groupRoute(id: TabId): Route | null {
  const views = viewsOf(id)
  if (!views.length) return null
  const last = lastView.get(id)
  return routeOfView(views.find((v) => routeKey(routeOfView(v)) === last) ?? views[0]!)
}

/** Where a route without a shipped view goes: the first view of its section, else the first section. */
export function fallbackRoute(r: Route): Route | null {
  if (!isOverlay(r)) { const g = groupRoute(r.tab); if (g) return g }
  const first = shippedGroups()[0]
  return first ? groupRoute(first.id) : null
}

interface Item { id: string; label: string; icon?: IconName }

/** A tablist with roving focus and manual activation; items share the width and never scroll. */
export function Tablist({ label, items, active, onActivate, primary = false }: { label: string; items: Item[]; active: string | null; onActivate: (id: string) => void; primary?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // As in the APG manual-activation example, the selected tab is the tab stop; arrows move focus only.
  const tabStop = Math.max(0, items.findIndex((i) => i.id === active))
  const move = (i: number) => refs.current[(i + items.length) % items.length]?.focus()
  const onKey = (e: KeyboardEvent, i: number) => {
    const k = e.key
    if (k === 'ArrowRight') move(i + 1)
    else if (k === 'ArrowLeft') move(i - 1)
    else if (k === 'Home') move(0)
    else if (k === 'End') move(items.length - 1)
    else if (k === 'Enter' || k === ' ') onActivate(items[i]!.id)
    else return
    e.preventDefault()
  }
  return (
    <div role="tablist" aria-label={label} className={`flex shrink-0 border-b border-gray-200 ${primary ? 'bg-gray-50' : ''}`}>
      {items.map((it, i) => {
        const on = it.id === active
        return (
          <button key={it.id} ref={(el) => { refs.current[i] = el }} type="button" role="tab" aria-selected={on}
            tabIndex={i === tabStop ? 0 : -1} onClick={() => onActivate(it.id)} onKeyDown={(e) => onKey(e, i)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 ${primary ? 'h-11' : 'h-10'} ${on ? 'border-orange-600 font-semibold text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {it.icon && <Icon name={it.icon} size={18} />}
            <span>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Navigation({ router }: { router: PanelRouter }) {
  const route = useRoute(router)
  useCounts()
  const groups = shippedGroups()
  const overlay = isOverlay(route)
  useEffect(() => {
    if (overlay) return
    // A route without a shipped view (a page-aware view of a later milestone, a stored view since
    // removed) opens its section's first view, else the first section.
    if (!viewFor(route)) {
      const to = fallbackRoute(route)
      if (to) router.go(to, { source: 'page' })
      return
    }
    rememberView(route)
  })
  if (overlay || !tabViews().length) return null
  const tab = route.tab
  const group = GROUPS.find((g) => g.id === tab)
  const views = viewsOf(tab)
  return (
    <nav aria-label="Panel sections" className="shrink-0">
      {groups.length > 1 && (
        <Tablist label="Sections" primary active={tab}
          onActivate={(id) => { const r = groupRoute(id as TabId); if (r) router.go(r) }}
          items={groups.map((g) => ({ id: g.id, label: g.label, icon: g.icon }))} />
      )}
      {views.length > 1 && (
        <Tablist label={`${group?.label ?? 'Section'} views`} active={routeKey(route)}
          onActivate={(key) => { const d = views.find((v) => routeKey(routeOfView(v)) === key); if (d) router.go(routeOfView(d)) }}
          items={views.map((v) => ({ id: routeKey(routeOfView(v)), label: v.label }))} />
      )}
    </nav>
  )
}
