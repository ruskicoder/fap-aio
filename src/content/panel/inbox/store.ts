// AlertStore (panel-ux R6.1 to R6.5; design "AlertStore and inbox"): producers call `alerts.push()`;
// alerts are deduped by dedupeKey and kept for 200 items or 60 days (catalog pruning). A new alert is sent
// to the service worker, which mirrors it as a browser notification only for kinds the user turned on.
import { useSyncExternalStore } from 'react'
import { call } from '../../../shared/call'
import { pushAlert, type Alert, type NewAlert } from '../../../shared/alerts'
import { update } from '../../../shared/storage/catalog'

export async function push(a: NewAlert): Promise<Alert | null> {
  const added = await pushAlert(a)
  if (added) void call({ type: 'notify', alert: { id: added.id, kind: added.kind, title: added.title, ...(added.detail ? { detail: added.detail } : {}) } })
  return added
}

export async function markRead(id: string): Promise<void> {
  await update('alerts', (old) => ({ items: (old?.items ?? []).map((a) => (a.id === id ? { ...a, read: true } : a)) }))
}

export async function markAllRead(): Promise<void> {
  await update('alerts', (old) => ({ items: (old?.items ?? []).map((a) => (a.read ? a : { ...a, read: true })) }))
}

export const alerts = { push, markRead, markAllRead }

export const unreadCount = (items: Alert[] | undefined | null) => (items ?? []).filter((a) => !a.read).length

// Open state of the popover, shared by the bell (header) and the popover (panel body).
let open = false
const listeners = new Set<() => void>()
export function setInboxOpen(v: boolean): void {
  if (open === v) return
  open = v
  for (const l of listeners) l()
}
export const toggleInbox = () => setInboxOpen(!open)
export function useInboxOpen(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => open)
}
