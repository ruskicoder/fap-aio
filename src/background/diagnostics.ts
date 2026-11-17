// "Copy diagnostics" (platform R7.2, R7.3; design "Diagnostics"): a plain-text report built from an
// allow-list only: extension and Chrome versions, platform, data version and source, counts per error
// kind and source id from diag.counters, the budget state, granted optional permissions and storage byte
// counts. No record, free text, name, id, mark or URL ever goes in. The counters reset once copied.
import { ok, register } from './router'
import { read, remove, usage } from '../shared/storage/catalog'
import { PERMS, type PermId } from '../shared/permissions'
import { dataFilesStatus } from './data/handlers'
import { MAX_GRANTS, WINDOW_MS, type Ledger } from './budget'
import type { DataDeps } from './data/db'

/** Only identifier-like names pass (message types, source ids, error kinds). */
const SAFE = /^[a-z][a-z0-9._:-]{0,80}$/i

export function chromeMajor(ua: string): string {
  return /Chrome\/(\d+)/.exec(ua)?.[1] ?? 'unknown'
}

export async function buildDiagnostics(deps: DataDeps = {}, now = Date.now()): Promise<string> {
  const manifest = chrome.runtime.getManifest()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const platform = typeof navigator !== 'undefined' ? (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || 'unknown' : 'unknown'
  const lines: string[] = ['FAP-AIO diagnostics', `Extension ${manifest.version}`, `Chrome ${chromeMajor(ua)}`, `Platform ${SAFE.test(platform.replace(/\s+/g, '-')) ? platform : 'unknown'}`]

  const data = await dataFilesStatus(deps).catch(() => null)
  const sources = data ? [...new Set(data.files.map((f) => f.source))].join(', ') : 'unavailable'
  lines.push(`Data version ${data?.version ?? 'unknown'} (${sources || 'none'})`)

  const perms = await Promise.all((Object.keys(PERMS) as PermId[]).map(async (p) => `${p} ${(await chrome.permissions.contains(PERMS[p]).catch(() => false)) ? 'granted' : 'not granted'}`))
  lines.push(`Optional permissions: ${perms.join(', ')}`)

  const ledger = ((await chrome.storage.session.get('budget.ledger').catch(() => ({}))) as { 'budget.ledger'?: Ledger })['budget.ledger']
  const used = ledger ? ledger.grants.filter((g) => now - g.at < WINDOW_MS) : []
  lines.push(`Budget: ${used.length} of ${MAX_GRANTS} grants in the last 5 minutes (${used.filter((g) => g.bg).length} background), challenged ${ledger?.challenged ? 'yes' : 'no'}`)

  const counters = Object.entries((await read('diag.counters')) ?? {}).filter(([k, v]) => SAFE.test(k) && Number.isFinite(v) && v > 0).sort(([a], [b]) => a.localeCompare(b))
  lines.push('Counters:', ...(counters.length ? counters.map(([k, v]) => `  ${k} ${v}`) : ['  none']))

  const bytes = await usage()
  lines.push('Storage bytes:', ...Object.entries(bytes.perKey).filter(([k]) => SAFE.test(k)).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `  ${k} ${v}`), `  total ${bytes.total}`)
  try {
    const est = await navigator.storage?.estimate?.()
    if (est?.usage !== undefined) lines.push(`  IndexedDB and caches ${est.usage}`)
  } catch {
    // no estimate
  }
  return lines.join('\n') + '\n'
}

export function installDiagnostics(deps: DataDeps = {}): void {
  register('diagnostics', async () => {
    const text = await buildDiagnostics(deps)
    // The catalog says the counters reset when diagnostics are copied.
    await remove('diag.counters')
    return ok({ text })
  })
}
