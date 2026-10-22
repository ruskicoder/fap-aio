// Message handlers for the budget (platform R3.4, R3.5, R3.8; core R11.2).
import { Budget } from './budget'
import { fail, ok, register } from './router'
import { broadcast, onTabReady, sendToTab, targetTab } from './tabs'

export const budget = new Budget()

export function installBudget(): void {
  register('budget.acquire', async (m, ctx) => {
    const r = await budget.acquire(m.priority, ctx.tabId)
    return r.kind === 'challenge' ? fail('challenge') : ok(r)
  })
  register('budget.release', async (m) => {
    if (await budget.release(m.grantId, m.outcome)) await broadcast({ type: 'reads.stop', reason: 'challenge' })
    return ok(null)
  })
  // A FAP page that finished loading means the user passed the check.
  onTabReady(async () => {
    if (await budget.clearChallenge()) await broadcast({ type: 'reads.resume' })
  })
}

/** Sends timer work to the focused FAP tab, else the latest ready one; false when none is open. */
export async function runOnFapTab(job: 'bg-refresh' | 'keepalive'): Promise<boolean> {
  const tab = await targetTab()
  if (tab === null) return false
  await sendToTab(tab, { type: 'timer.run', job })
  return true
}
