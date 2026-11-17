// Alerts inbox (panel-ux R6.2, R6.3): the bell with the unread count in the header, and a popover under
// it with kind filters, "Mark all read" and rows that deep-link. Escape or a click outside closes it.
import { useEffect, useRef, useState } from 'react'
import type { Alert, AlertKind } from '../../../shared/alerts'
import { Icon } from '../icons'
import { useStore } from '../use-store'
import type { PanelRouter } from '../router'
import { markAllRead, markRead, setInboxOpen, toggleInbox, unreadCount, useInboxOpen } from './store'

export const KIND_LABELS: Record<AlertKind, string> = {
  attendance: 'Attendance', news: 'News', coursera: 'Coursera', grade: 'Grades',
  reminder: 'Reminders', sync: 'Sync', session: 'Session', challenge: 'Challenge',
}

const btn = 'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

export function useUnread(): number {
  return unreadCount(useStore('alerts').data?.items)
}

export function Badge({ n, className = '' }: { n: number; className?: string }) {
  if (!n) return null
  return <span aria-hidden="true" className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-orange-600 px-1 text-[11px] font-semibold leading-[18px] text-white ${className}`}>{n > 99 ? '99+' : n}</span>
}

export function Bell() {
  const n = useUnread()
  const open = useInboxOpen()
  const label = n ? `Alerts, ${n} unread` : 'Alerts'
  return (
    <button type="button" aria-label={label} title="Alerts" aria-haspopup="dialog" aria-expanded={open} data-inbox-toggle=""
      className={`${btn} ${open ? 'bg-orange-100 text-orange-900' : ''}`} onClick={toggleInbox}>
      <Icon name="bell" />
      <Badge n={n} className="absolute -right-0.5 -top-0.5" />
    </button>
  )
}

/** "2 min ago", "3 h ago", then the date. */
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const chip = (on: boolean) => `inline-flex min-h-7 items-center rounded-full border px-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`

export function InboxPopover({ router }: { router: PanelRouter }) {
  const open = useInboxOpen()
  const items = useStore('alerts').data?.items ?? []
  const [kind, setKind] = useState<AlertKind | 'all'>('all')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setInboxOpen(false) } }
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath()
      if (box.current && !path.includes(box.current) && !path.some((n) => n instanceof Element && n.hasAttribute('data-inbox-toggle'))) setInboxOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    box.current?.querySelector<HTMLElement>('h2')?.focus()
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true) }
  }, [open])

  if (!open) return null
  const kinds = [...new Set(items.map((a) => a.kind))]
  const shown = kind === 'all' ? items : items.filter((a) => a.kind === kind)
  const unread = unreadCount(items)
  const openAlert = (a: Alert) => {
    void markRead(a.id)
    if (a.link) {
      router.go(a.link, { source: 'deeplink' })
      setInboxOpen(false)
    }
  }
  return (
    <div ref={box} role="dialog" aria-label="Alerts" className="absolute right-2 top-[46px] z-20 flex max-h-[min(420px,calc(100%-60px))] w-[min(340px,calc(100%-16px))] flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
        <h2 tabIndex={-1} className="flex-1 text-sm font-semibold text-gray-900 focus:outline-none">Alerts</h2>
        <button type="button" className="rounded px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" disabled={!unread} onClick={() => void markAllRead()}>Mark all read</button>
        <button type="button" aria-label="Close alerts" className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => setInboxOpen(false)}><Icon name="x" size={16} /></button>
      </div>
      {kinds.length > 1 && (
        <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-1.5 border-b border-gray-100 px-3 py-2">
          <button type="button" aria-pressed={kind === 'all'} className={chip(kind === 'all')} onClick={() => setKind('all')}>All</button>
          {kinds.map((k) => <button key={k} type="button" aria-pressed={kind === k} className={chip(kind === k)} onClick={() => setKind(k)}>{KIND_LABELS[k]}</button>)}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-3 py-4 text-sm text-gray-600">No alerts yet. Sync failures, grade warnings and reminders show up here.</p>
      ) : (
        <ul aria-label="Alert list" className="min-h-0 flex-1 overflow-y-auto">
          {shown.map((a) => (
            <li key={a.id} className="border-b border-gray-100 last:border-b-0">
              <button type="button" onClick={() => openAlert(a)} aria-label={`${a.read ? '' : 'Unread: '}${a.title}`}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.read ? 'bg-transparent' : 'bg-orange-600'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block break-words text-[13px] leading-snug ${a.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{a.title}</span>
                  {a.detail && <span className="mt-0.5 block break-words text-xs text-gray-600">{a.detail}</span>}
                  <span className="mt-0.5 block text-[11px] text-gray-500">{KIND_LABELS[a.kind]} · {ago(a.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
