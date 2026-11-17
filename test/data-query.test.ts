// PLT-6.2: data query handlers and the content-side client (platform R2.4, R6.5, R6.6; grades R12.2; info R2.1).
import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installFakeChrome } from './helpers/fake-chrome'
import { handle, installRouter } from '../src/background/router'
import { ensureData, openDataDb, type DataDeps, type OverrideRecord } from '../src/background/data/db'
import { installDataHandlers } from '../src/background/data/handlers'
import { fallbackCode, overrideWins } from '../src/background/data/query'
import { installStatus } from '../src/background/status'
import { DataClient } from '../src/content/data-client'
import type { RulesReply, SearchHit, SubjectEntry } from '../src/shared/data/types'

const BASE = 'chrome-extension://test/'
const idb = new IDBFactory()
const deps: DataDeps = {
  idb,
  getURL: (p) => BASE + p,
  fetch: (async (url: string) => new Response(readFileSync(resolve(__dirname, '..', url.slice(BASE.length))) as unknown as BodyInit)) as unknown as typeof fetch,
}
const fap = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/Report/Grade', frameId: 0, tab: { id: 3 } as chrome.tabs.Tab }
const ask = async <T>(m: Record<string, unknown>) => (await handle({ v: 1, ...m }, fap)) as { ok: true; value: T } | { ok: false; error: { kind: string } }
const value = async <T>(m: Record<string, unknown>) => {
  const r = await ask<T>(m)
  if (!r.ok) throw new Error(r.error.kind)
  return r.value
}

async function putOverride(o: OverrideRecord | null, code = 'ACC101') {
  const { db } = await openDataDb(idb)
  const tx = db.transaction('overrides', 'readwrite')
  if (o) tx.objectStore('overrides').put(o)
  else tx.objectStore('overrides').delete(code)
  await new Promise((ok) => { tx.oncomplete = ok })
  db.close()
}

beforeAll(async () => {
  await ensureData('start', deps)
}, 60_000)

beforeEach(() => {
  installFakeChrome()
  installDataHandlers(deps)
  installStatus(deps)
})

describe('data handlers', () => {
  it('data.rules returns compact entries, global rules and the scrape date, with the lowercase fallback', async () => {
    const r = await value<RulesReply>({ type: 'data.rules', codes: ['ACC101', 'ACC101t', 'NOPE999'] })
    expect(r.dataVersion).toBe(1)
    expect(r.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(r.rules.tiers.map((t) => t.minAverage)).toEqual([5, 7, 8, 9])
    expect(r.subjects.ACC101?.code).toBe('ACC101')
    expect(r.subjects.ACC101t?.code).toBe('ACC101')
    expect(r.subjects.NOPE999).toBeNull()
    expect([fallbackCode('IOT102t'), fallbackCode('IOT102'), fallbackCode('abc1d')]).toEqual(['IOT102', null, null])
  })

  it('data.subject prefers an exact code with a trailing letter over the fallback', async () => {
    const e = await value<SubjectEntry>({ type: 'data.subject', code: 'ADA201c' })
    expect(e).toMatchObject({ code: 'ADA201c', source: 'packaged' })
    expect(e.full?.name.en).toBeTruthy()
    expect(await value({ type: 'data.subject', code: 'NOPE999' })).toBeNull()
  })

  it('serves a live override only while it is at least as new as the active entry', async () => {
    const active = await value<SubjectEntry>({ type: 'data.subject', code: 'ACC101' })
    const base = { code: 'ACC101', rules: active.rules, full: active.full, fetchedAt: 1 }
    const id = active.syllabusId!
    await putOverride({ ...base, syllabusId: id + 1, approvedDate: null })
    expect(await value<SubjectEntry>({ type: 'data.subject', code: 'ACC101' })).toMatchObject({ source: 'live', fetchedAt: 1 })
    await putOverride({ ...base, syllabusId: id - 1, approvedDate: '2099-01-01' })
    expect((await value<SubjectEntry>({ type: 'data.subject', code: 'ACC101' })).source).toBe('packaged')
    await putOverride(null)
    const sameId = (approvedDate: string) => ({ ...base, syllabusId: id, approvedDate })
    const act = { code: 'X', syllabusId: id, approvedDate: '2026-04-01', rules: null, full: null, source: 'packaged' as const }
    expect(overrideWins(sameId('2026-04-01'), act)).toBe(true)
    expect(overrideWins(sameId('2026-05-01'), act)).toBe(true)
    expect(overrideWins(sameId('2026-03-01'), act)).toBe(false)
  })

  it('data.search matches code and names by token prefix, without diacritics, exact code first', async () => {
    const byCode = await value<SearchHit[]>({ type: 'data.search', q: 'acc101', limit: 5 })
    expect(byCode[0]).toMatchObject({ code: 'ACC101', credits: 3 })
    const vi = await value<SearchHit[]>({ type: 'data.search', q: 'nguyên lý kế toán', limit: 10 })
    expect(vi.map((h) => h.code)).toContain('ACC101')
    const prefix = await value<SearchHit[]>({ type: 'data.search', q: 'princ accoun', limit: 10 })
    expect(prefix.map((h) => h.code)).toContain('ACC101')
    expect(await value<SearchHit[]>({ type: 'data.search', q: '  ', limit: 5 })).toEqual([])
    expect((await value<SearchHit[]>({ type: 'data.search', q: 'a', limit: 500 })).length).toBeLessThanOrEqual(50)
  })

  it('data.file returns the validated news rules, and data.status lists the files and version', async () => {
    const news = await value<{ families: unknown[] }>({ type: 'data.file', name: 'news-rules.json' })
    expect(news.families.length).toBeGreaterThan(0)
    const s = await value<{ data: { files: { name: string; source: string }[]; version: number }; idb: unknown }>({ type: 'data.status' })
    expect(s.data.version).toBe(1)
    expect(s.data.files.map((f) => f.name).sort()).toEqual(['news-rules.json', 'subject-list.json', 'subject-rules.json'])
    expect(s.idb).toBeDefined()
  })
})

describe('dataClient', () => {
  it('caches replies per tab, asks only for missing rule codes, and drops the cache on new data', async () => {
    const c = installFakeChrome()
    installDataHandlers(deps)
    installRouter()
    const sent: string[] = []
    const send = c.runtime.sendMessage.bind(c.runtime)
    c.runtime.sendMessage = (async (m: { type: string; codes?: string[] }) => {
      sent.push(m.type + (m.codes ? `:${m.codes.join(',')}` : ''))
      return send(m)
    }) as typeof c.runtime.sendMessage
    const client = new DataClient()
    const a = await client.rules(['ACC101'])
    expect(a.ok && a.value.subjects.ACC101?.code).toBe('ACC101')
    const b = await client.rules(['ACC101', 'ACC302'])
    expect(b.ok && Object.keys(b.value.subjects)).toEqual(['ACC101', 'ACC302'])
    await client.subject('ACC101')
    await client.subject('ACC101')
    expect(sent).toEqual(['data.rules:ACC101', 'data.rules:ACC302', 'data.subject'])
    // A data update (new version) clears the cache.
    c.runtime.onMessage.emit({ v: 1, type: 'data.progress', state: 'idle', version: 2 }, { id: 'test-extension-id' }, () => undefined)
    await client.subject('ACC101')
    expect(sent.at(-1)).toBe('data.subject')
    expect(sent.filter((x) => x === 'data.subject')).toHaveLength(2)
  }, 30_000)
})
