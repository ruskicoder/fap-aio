// Tab bar and segmented sub-views (panel-ux R2.1, R2.2, R2.5; core R1.8). Both follow the APG
// tabs pattern with manual activation: arrows, Home and End move focus, Enter or Space activates,
// a click activates directly, because a view may trigger FAP reads.
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Route } from '../../shared/panel-state'
import { isOverlay, useRoute, type PanelRouter, type TabId } from './router'
import { useCounts, viewFor } from './views'

const svg = (d: ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)
export const TAB_ICONS: Record<TabId, ReactNode> = {
  today: svg(<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>),
  schedule: svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M16 3v4M8 3v4M4 11h16" /></>),
  grades: svg(<><path d="M3 9l9-5 9 5-9 5z" /><path d="M7 11v5c3 2 7 2 10 0v-5" /></>),
  info: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></>),
}

export const TABS: { id: TabId; label: string; subs: { id: string; label: string }[] }[] = [
  { id: 'today', label: 'Today', subs: [] },
  { id: 'schedule', label: 'Schedule', subs: [{ id: 'week', label: 'Week' }, { id: 'exams', label: 'Exams' }, { id: 'export', label: 'Export' }] },
  { id: 'grades', label: 'Grades', subs: [{ id: 'courses', label: 'Courses' }, { id: 'gpa', label: 'GPA' }, { id: 'whatif', label: 'What-if' }, { id: 'planner', label: 'Planner' }] },
  { id: 'info', label: 'Info', subs: [{ id: 'subjects', label: 'Subjects' }, { id: 'lecturers', label: 'Lecturers' }, { id: 'news', label: 'News' }, { id: 'status', label: 'Status' }] },
]

export function routeOf(tab: TabId, sub?: string): Route {
  const t = TABS.find((x) => x.id === tab)!
  return (t.subs.length ? { tab, sub: sub ?? t.subs[0]!.id } : { tab }) as Route
}

interface Item { id: string; label: ReactNode; name: string; icon?: ReactNode }

/** A tablist with roving focus and manual activation. */
export function Tablist({ label, items, active, onActivate, size }: { label: string; items: Item[]; active: string | null; onActivate: (id: string) => void; size: 'tab' | 'segment' }) {
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
  const base = size === 'tab'
    ? 'inline-flex h-9 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500'
    : 'inline-flex h-7 min-w-6 items-center gap-1 rounded px-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
  return (
    <div role="tablist" aria-label={label} className={size === 'tab' ? 'flex shrink-0 border-b border-gray-200' : 'flex shrink-0 gap-1 border-b border-gray-200 px-2 py-1'}>
      {items.map((it, i) => {
        const on = it.id === active
        const look = size === 'tab'
          ? on ? 'border-orange-600 font-semibold text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'
          : on ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
        return (
          <button key={it.id} ref={(el) => { refs.current[i] = el }} type="button" role="tab" aria-selected={on} aria-label={it.name}
            tabIndex={i === tabStop ? 0 : -1} className={`${base} ${look}`}
            onClick={() => onActivate(it.id)} onKeyDown={(e) => onKey(e, i)}>
            {it.icon}{it.label}
          </button>
        )
      })}
    </div>
  )
}

export function Navigation({ router }: { router: PanelRouter }) {
  const route = useRoute(router)
  useCounts()
  const tab = isOverlay(route) ? null : route.tab
  const def = TABS.find((t) => t.id === tab)
  return (
    <nav aria-label="Panel sections" className="shrink-0">
      <Tablist label="Sections" size="tab" active={tab} onActivate={(id) => router.go(routeOf(id as TabId))}
        items={TABS.map((t) => ({ id: t.id, label: t.label, name: t.label, icon: TAB_ICONS[t.id] }))} />
      {def && def.subs.length > 0 && (
        <Tablist label={`${def.label} views`} size="segment" active={'sub' in route ? route.sub : null}
          onActivate={(sub) => router.go(routeOf(def.id, sub))}
          items={def.subs.map((s) => {
            const count = viewFor(routeOf(def.id, s.id))?.count?.() ?? null
            return {
              id: s.id,
              name: count ? `${s.label}, ${count}` : s.label,
              label: <>{s.label}{count ? <span aria-hidden="true" className="rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-800">{count}</span> : null}</>,
            }
          })} />
      )}
    </nav>
  )
}

/** Tab icons on the docked rail; a click expands the panel to that tab (panel-ux R1.6). */
export function RailTabs({ onPick }: { onPick: (tab: TabId) => void }) {
  return (
    <>
      {TABS.map((t) => (
        <button key={t.id} type="button" aria-label={t.label} onClick={() => onPick(t.id)}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded px-1 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
          {TAB_ICONS[t.id]}
        </button>
      ))}
    </>
  )
}
