// Content side of the session keep-alive (core R11.2, R11.3): on the service worker's `timer.run`
// keepalive job, one background read of the unread-notification count through the request budget.
// An expired session turns keep-alive off and says so in the alert inbox.
import { onMessage } from '../../shared/call'
import { update } from '../../shared/storage/catalog'
import { pushAlert } from '../../shared/alerts'
import { queuedGetJson } from '../../content/fap/queue'
import { SCHEDULER_KEYS } from './settings'

export const KEEPALIVE_PATH = '/Notification/UnreadCount'

export async function runKeepAlive(now = Date.now()): Promise<'ok' | 'expired' | 'failed'> {
  const r = await queuedGetJson(KEEPALIVE_PATH, { priority: 'background', source: 'keepalive' })
  if (r.ok) return 'ok'
  if (r.error.kind !== 'session-expired') return 'failed'
  await update('settings', (s) => ({ ...(s ?? {}), [SCHEDULER_KEYS.keepAliveEnabled]: false }))
  await pushAlert({
    kind: 'session', title: 'Keep FAP signed in is off: your FAP session ended',
    detail: 'Sign in to FAP again, then turn it back on in Settings, Session.',
    link: { overlay: 'settings', section: 'session' }, dedupeKey: `session|keepalive|${now}`,
  }, now)
  return 'expired'
}

let wired = false
export function wireKeepAlive(): void {
  if (wired) return
  wired = true
  onMessage('timer.run', (m) => { if (m.job === 'keepalive') void runKeepAlive() })
}
