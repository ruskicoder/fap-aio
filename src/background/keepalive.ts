// Session keep-alive (core R11.1 to R11.4): an alarm at the configured interval asks a FAP tab to make
// one lightweight background read. A tick is skipped when FAP was reached within the interval anyway,
// and nothing is scheduled while the setting is off or no FAP tab is open.
import { read } from '../shared/storage/catalog'
import { budget, runOnFapTab } from './budget-handlers'

export const ALARM = 'keepalive'
export const DEFAULT_MINUTES = 7
const ENABLED = 'session.keepAlive.enabled'
const MINUTES = 'session.keepAlive.interval'

export async function keepAliveConfig(): Promise<{ on: boolean; minutes: number }> {
  const s = (await read('settings')) ?? {}
  const n = Number(s[MINUTES])
  const minutes = Number.isInteger(n) && n >= 1 && n <= 60 ? n : DEFAULT_MINUTES
  return { on: s[ENABLED] === true, minutes }
}

/** Creates the alarm at the configured period, or clears it when keep-alive is off (R11.4). */
export async function syncKeepAlive(): Promise<boolean> {
  const { on, minutes } = await keepAliveConfig()
  if (!on) { await chrome.alarms.clear(ALARM); return false }
  const cur = await chrome.alarms.get(ALARM)
  if (cur?.periodInMinutes !== minutes) await chrome.alarms.create(ALARM, { periodInMinutes: minutes, delayInMinutes: minutes })
  return true
}

export type TickResult = 'off' | 'recent' | 'no-tab' | 'sent'

/** One alarm tick: send the read to a FAP tab unless FAP was reached within the period (R11.2). */
export async function keepAliveTick(now = Date.now()): Promise<TickResult> {
  const { on, minutes } = await keepAliveConfig()
  if (!on) { await chrome.alarms.clear(ALARM); return 'off' }
  const last = (await budget.ledger()).lastEndAt
  if (now - last < minutes * 60_000) return 'recent'
  return (await runOnFapTab('keepalive')) ? 'sent' : 'no-tab'
}

export function installKeepAlive(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'settings' in changes) void syncKeepAlive()
  })
  chrome.runtime.onStartup?.addListener(() => void syncKeepAlive())
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) void keepAliveTick() })
  void syncKeepAlive()
}
