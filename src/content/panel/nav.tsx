// Tab bar (panel-ux R2.1, R2.2, R2.5; agreed visual ui/shell.html): one tab per shipped view, in
// registration order, hidden while an overlay (Settings) is open. APG tabs with manual activation:
// arrows, Home and End move focus, Enter or Space activates, a click activates directly.
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { isOverlay, routeKey, useRoute, type PanelRouter } from './router'
import { routeOfView, tabViews, useCounts, viewFor } from './views'

interface Item { id: string; label: string }

/** A tablist with roving focus and manual activation. */
export function Tablist({ label, items, active, onActivate }: { label: string; items: Item[]; active: string | null; onActivate: (id: string) => void }) {
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
    <div role="tablist" aria-label={label} className="flex shrink-0 overflow-x-auto border-b border-gray-200">
      {items.map((it, i) => {
        const on = it.id === active
        return (
          <button key={it.id} ref={(el) => { refs.current[i] = el }} type="button" role="tab" aria-selected={on}
            tabIndex={i === tabStop ? 0 : -1} onClick={() => onActivate(it.id)} onKeyDown={(e) => onKey(e, i)}
            className={`inline-flex h-10 min-w-max flex-1 items-center justify-center whitespace-nowrap border-b-2 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 ${on ? 'border-orange-600 font-semibold text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

export function Navigation({ router }: { router: PanelRouter }) {
  const route = useRoute(router)
  useCounts()
  const tabs = tabViews()
  const overlay = isOverlay(route)
  // A route without a shipped view (Today, or a page-aware tab of a later milestone) opens the first tab.
  useEffect(() => {
    if (!overlay && !viewFor(route) && tabs[0]) router.go(routeOfView(tabs[0]), { source: 'page' })
  })
  if (overlay || !tabs.length) return null
  return (
    <nav aria-label="Panel sections" className="shrink-0">
      <Tablist label="Sections" active={routeKey(route)}
        onActivate={(key) => { const d = tabs.find((t) => routeKey(routeOfView(t)) === key); if (d) router.go(routeOfView(d)) }}
        items={tabs.map((t) => ({ id: routeKey(routeOfView(t)), label: t.label }))} />
    </nav>
  )
}
