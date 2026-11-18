// Development-only FLM cookie probe (platform R6.3; gate G-FLM-COOKIE, decision D-1): reports whether a
// service worker fetch to FLM carries the FLM session. Registered only when import.meta.env.DEV is true, so
// production builds drop it. The owner runs it once on their browser; the answer picks the path for PLT-9.2.
import { ok, register } from './router'
import { PERMS } from '../shared/permissions'

export const PROBE_URL = 'https://flm.fpt.edu.vn/gui/role/student/SyllabusManagement?searchOn=Code&keyword=PRF'

export interface ProbeResult { permission: boolean; status: number | null; finalPath: string | null; signedIn: boolean; note: string }

export async function flmProbe(f: typeof fetch = fetch): Promise<ProbeResult> {
  const permission = await chrome.permissions.contains(PERMS.flm).catch(() => false)
  if (!permission) return { permission, status: null, finalPath: null, signedIn: false, note: 'Grant the FLM permission first (Settings, live FLM read).' }
  try {
    const res = await f(PROBE_URL, { credentials: 'include', cache: 'no-store' })
    const body = await res.text()
    const finalPath = new URL(res.url || PROBE_URL).pathname
    const signedIn = res.ok && !/login|signin|account/i.test(finalPath) && /table-striped/.test(body)
    return { permission, status: res.status, finalPath, signedIn, note: signedIn ? 'The service worker fetch is signed in: use the service worker path (D-1).' : 'Not signed in from the service worker: use the background tab fallback (D-1).' }
  } catch (e) {
    return { permission, status: null, finalPath: null, signedIn: false, note: `The request failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * Development builds: the `dev.flmProbe` message, and `await fapAioFlmProbe()` in the service worker
 * console (chrome://extensions, the extension's service worker link) for the owner's gate run.
 */
export function installFlmProbe(): void {
  if (!import.meta.env.DEV) return
  register('dev.flmProbe', async () => ok(await flmProbe()))
  ;(globalThis as { fapAioFlmProbe?: () => Promise<ProbeResult> }).fapAioFlmProbe = () => flmProbe()
}
