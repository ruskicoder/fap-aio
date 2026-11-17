// Content-side client for the data service (platform R2.4): typed calls with an in-memory cache per tab.
// Only successful replies are cached; the cache is dropped when the service worker reports new data.
import { call, onMessage } from '../shared/call'
import type { Reply } from '../shared/messages'
import type { NewsRulesFile } from '../shared/data/schemas'
import type { RulesReply, SearchHit, SubjectEntry } from '../shared/data/types'
import type { DataStatus } from '../background/status'

export class DataClient {
  private readonly cache = new Map<string, Reply<unknown>>()
  private dataVersion: number | null = null

  constructor(listen = true) {
    if (listen) {
      onMessage('data.progress', (m) => {
        if (m.state === 'idle' && m.version !== null && m.version !== this.dataVersion) this.clear()
        if (m.version !== null) this.dataVersion = m.version
      })
    }
  }

  clear(): void {
    this.cache.clear()
  }

  private async cached<T>(key: string, load: () => Promise<Reply<T>>): Promise<Reply<T>> {
    const hit = this.cache.get(key)
    if (hit) return hit as Reply<T>
    const r = await load()
    if (r.ok) this.cache.set(key, r)
    return r
  }

  /** Compact rubric entries; codes already cached are not asked again. */
  async rules(codes: string[]): Promise<Reply<RulesReply>> {
    const want = [...new Set(codes)]
    const base = this.cache.get('rules') as Reply<RulesReply> | undefined
    const missing = base?.ok ? want.filter((c) => !(c in base.value.subjects)) : want
    if (base?.ok && !missing.length) return pick(base.value, want)
    const r = await call<RulesReply>({ type: 'data.rules', codes: missing })
    if (!r.ok) return r
    const merged: RulesReply = { ...r.value, subjects: { ...(base?.ok ? base.value.subjects : {}), ...r.value.subjects } }
    this.cache.set('rules', { ok: true, value: merged })
    return pick(merged, want)
  }

  subject(code: string): Promise<Reply<SubjectEntry | null>> {
    return this.cached(`subject:${code}`, () => call<SubjectEntry | null>({ type: 'data.subject', code }))
  }

  search(q: string, limit = 20): Promise<Reply<SearchHit[]>> {
    return this.cached(`search:${limit}:${q}`, () => call<SearchHit[]>({ type: 'data.search', q, limit }))
  }

  newsRules(): Promise<Reply<NewsRulesFile>> {
    return this.cached('file:news-rules.json', () => call<NewsRulesFile>({ type: 'data.file', name: 'news-rules.json' }))
  }

  /** Never cached: usage and versions change. */
  status(): Promise<Reply<DataStatus>> {
    return call<DataStatus>({ type: 'data.status' })
  }
}

function pick(r: RulesReply, codes: string[]): Reply<RulesReply> {
  return { ok: true, value: { ...r, subjects: Object.fromEntries(codes.map((c) => [c, r.subjects[c] ?? null])) } }
}

let shared: DataClient | null = null
/** The tab's client, created on first use. */
export function dataClient(): DataClient {
  return (shared ??= new DataClient())
}
