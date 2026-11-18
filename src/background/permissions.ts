// Optional permission flow (platform R1.3 to R1.7; design "Optional permission flow"):
// `perm.request` opens grant.html in a popup when the permission is missing; the page asks Chrome after
// a click and answers with `perm.result`. A closed window or 120 s without an answer counts as refused.
// `permissions.onRemoved` turns the dependent features off and pushes an alert with the reason.
// `notify` mirrors an alert to a browser notification only when its kind is on and the permission held.
import { ok, register } from './router'
import { pushAlert } from '../shared/alerts'
import { setSettings, type SettingsMap } from '../shared/settings'
import { read } from '../shared/storage/catalog'
import { DEPENDENT_SETTINGS, GRANT_COPY, GRANT_PAGE, GRANT_TIMEOUT_MS, PERMS, type PermId } from '../shared/permissions'

interface Pending { windowId: number | null; waiters: ((granted: boolean) => void)[]; timer: ReturnType<typeof setTimeout> }
const pending = new Map<PermId, Pending>()

function settle(perm: PermId, granted: boolean): void {
  const p = pending.get(perm)
  if (!p) return
  pending.delete(perm)
  clearTimeout(p.timer)
  for (const w of p.waiters) w(granted)
}

export function requestPermission(perm: PermId): Promise<boolean> {
  return chrome.permissions.contains(PERMS[perm]).then((has) => {
    if (has) return true
    return new Promise<boolean>((resolve) => {
      const open = pending.get(perm)
      if (open) {
        open.waiters.push(resolve)
        if (open.windowId !== null) void chrome.windows.update(open.windowId, { focused: true }).catch(() => undefined)
        return
      }
      const p: Pending = { windowId: null, waiters: [resolve], timer: setTimeout(() => settle(perm, false), GRANT_TIMEOUT_MS) }
      pending.set(perm, p)
      chrome.windows
        .create({ url: chrome.runtime.getURL(`${GRANT_PAGE}?perm=${perm}`), type: 'popup', width: 420, height: 280, focused: true })
        .then((w) => { if (pending.get(perm) === p) p.windowId = w?.id ?? null })
        .catch(() => settle(perm, false))
    })
  })
}

/** Turns off every setting that needs the permission (R1.7). */
export async function disableDependents(perm: PermId): Promise<void> {
  const current = (await read('settings')) ?? {}
  const patch: SettingsMap = {}
  for (const key of DEPENDENT_SETTINGS[perm]) {
    if (key.endsWith('.')) {
      for (const k of Object.keys(current)) if (k.startsWith(key) && current[k] === true) patch[k] = false
    } else if (current[key] === true) patch[key] = false
  }
  if (Object.keys(patch).length) await setSettings(patch)
}

async function onRemoved(removed: chrome.permissions.Permissions): Promise<void> {
  const lost: PermId[] = []
  if (removed.permissions?.includes('notifications')) lost.push('notifications')
  if (removed.origins?.some((o) => o.startsWith('https://flm.fpt.edu.vn'))) lost.push('flm')
  for (const perm of lost) {
    await disableDependents(perm)
    await pushAlert({ kind: perm === 'notifications' ? 'reminder' : 'sync', title: GRANT_COPY[perm].removed, dedupeKey: `perm-removed:${perm}:${Date.now()}` })
  }
}

export function installPermissions(): void {
  register('perm.request', async (m) => ok({ granted: await requestPermission(m.perm) }))
  register('perm.state', async () => ok({
    notifications: await chrome.permissions.contains(PERMS.notifications).catch(() => false),
    flm: await chrome.permissions.contains(PERMS.flm).catch(() => false),
  }))
  register('perm.result', async (m) => {
    settle(m.perm, m.granted)
    if (!m.granted) await disableDependents(m.perm)
    return ok(null)
  })
  register('notify', async (m) => {
    const settings = (await read('settings')) ?? {}
    const enabled = settings[`alerts.notify.${m.alert.kind}`] === true
    if (!enabled || !(await chrome.permissions.contains(PERMS.notifications))) return ok({ shown: false })
    await chrome.notifications.create(m.alert.id, {
      type: 'basic', iconUrl: chrome.runtime.getURL('img/logo-128.png'), title: m.alert.title, message: m.alert.detail ?? '',
    })
    return ok({ shown: true })
  })
  chrome.windows.onRemoved.addListener((windowId) => {
    for (const [perm, p] of pending) if (p.windowId === windowId) settle(perm, false)
  })
  chrome.permissions.onRemoved.addListener((p) => void onRemoved(p))
}
