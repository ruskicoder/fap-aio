// Read-only FAP access layer (core R3.1 to R3.7). GET only: there is no method parameter.
// The isolated world's native fetch is used, so FAP's fetch wrapper never sees the request.
import { isLoginPage } from '../guard'

export type FapError =
  | { kind: 'session-expired' }
  | { kind: 'feedback-required'; url: '/Feedback?required=1' }
  | { kind: 'unavailable'; status: 404 }
  | { kind: 'challenge' }
  | { kind: 'forbidden'; status: 403 }
  | { kind: 'network'; message: string }
  | { kind: 'layout-changed'; source: string; detail: string }

export type FapResult<T> = { ok: true; value: T; fetchedAt: number } | { ok: false; error: FapError }

export interface GetOpts {
  partial?: boolean
  signal?: AbortSignal
}

export const FAP_ORIGIN = 'https://fap.fpt.edu.vn'
export const TIMEOUT_MS = 12_000
export const RETRY_DELAY_MS = 1_500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function toUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error(`FAP path must be site-relative: ${path}`)
  return FAP_ORIGIN + path
}

type Raw = { ok: true; res: Response; body: string } | { ok: false; error: FapError }

async function getOnce(url: string, accept: string, opts: GetOpts): Promise<Raw> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  try {
    const headers: Record<string, string> = { Accept: accept }
    if (opts.partial) headers['X-Requested-With'] = 'XMLHttpRequest'
    const res = await fetch(url, { method: 'GET', credentials: 'same-origin', redirect: 'follow', headers, signal: ctrl.signal })
    if (res.headers.get('X-Feedback-Required') === '1') return { ok: false, error: { kind: 'feedback-required', url: '/Feedback?required=1' } }
    if (res.status === 403) {
      return { ok: false, error: res.headers.get('cf-mitigated') === 'challenge' ? { kind: 'challenge' } : { kind: 'forbidden', status: 403 } }
    }
    if (res.status === 404) return { ok: false, error: { kind: 'unavailable', status: 404 } }
    if (res.redirected && new URL(res.url).pathname.toLowerCase().startsWith('/auth/login')) return { ok: false, error: { kind: 'session-expired' } }
    if (!res.ok) return { ok: false, error: { kind: 'network', message: `HTTP ${res.status}` } }
    return { ok: true, res, body: await res.text() }
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: e instanceof Error ? e.message : String(e) } }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

/** One retry after a network failure (R3.7); every other error is final. */
async function get(path: string, accept: string, opts: GetOpts): Promise<Raw> {
  const url = toUrl(path)
  const first = await getOnce(url, accept, opts)
  if (first.ok || first.error.kind !== 'network' || opts.signal?.aborted) return first
  await sleep(RETRY_DELAY_MS)
  return getOnce(url, accept, opts)
}

export function parseHtml(body: string): Document {
  return new DOMParser().parseFromString(body, 'text/html')
}

export async function fapGet(path: string, opts: GetOpts = {}): Promise<FapResult<Document>> {
  const r = await get(path, 'text/html', opts)
  if (!r.ok) return r
  const doc = parseHtml(r.body)
  if (isLoginPage(doc)) return { ok: false, error: { kind: 'session-expired' } }
  return { ok: true, value: doc, fetchedAt: Date.now() }
}

export async function fapGetJson<T = unknown>(path: string, opts: GetOpts = {}): Promise<FapResult<T>> {
  const r = await get(path, 'application/json', opts)
  if (!r.ok) return r
  try {
    return { ok: true, value: JSON.parse(r.body) as T, fetchedAt: Date.now() }
  } catch {
    if (isLoginPage(parseHtml(r.body))) return { ok: false, error: { kind: 'session-expired' } }
    return { ok: false, error: { kind: 'network', message: 'invalid JSON' } }
  }
}
