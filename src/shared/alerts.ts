// The `alerts` store (panel-ux design, AlertStore): producers push, the inbox (PNL-6) reads.
// Retention (200 items, 60 days) is applied by the catalog on write; a dedupeKey is pushed once.
import { update } from './storage/catalog'
import type { Route } from './panel-state'

export type AlertKind = 'attendance' | 'news' | 'coursera' | 'grade' | 'reminder' | 'sync' | 'session' | 'challenge'

export interface Alert {
  id: string
  kind: AlertKind
  title: string
  detail?: string
  at: number
  link?: Route
  read: boolean
  dedupeKey: string
}

declare module './storage/catalog' {
  interface StoreMap { alerts: { items: Alert[] } }
}

export type NewAlert = Omit<Alert, 'id' | 'at' | 'read'> & { at?: number }

/** Adds an alert unless one with the same dedupeKey is stored; returns the stored alert or null. */
export async function pushAlert(a: NewAlert, now = Date.now()): Promise<Alert | null> {
  let added: Alert | null = null
  await update('alerts', (old) => {
    const items = old?.items ?? []
    if (items.some((x) => x.dedupeKey === a.dedupeKey)) return { items }
    added = { ...a, id: `${a.kind}:${now.toString(36)}:${Math.random().toString(36).slice(2, 8)}`, at: a.at ?? now, read: false }
    return { items: [added, ...items] }
  })
  return added
}
