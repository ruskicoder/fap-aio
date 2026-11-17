// PLT-6.1: packaged data files, their schemas and the IndexedDB store (platform R4.2, R5.1, R7.4).
import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DATA_SCHEMAS, dataManifest, newsRulesFile, subjectRulesFile } from '../src/shared/data/schemas'
import { normalizeText, tokenize } from '../src/shared/data/tokens'
import {
  buildIndex, ensureData, openDataDb, readFiles, sha256Hex, type DataDeps, type SearchRecord, type SubjectRecord,
} from '../src/background/data/db'
// @ts-expect-error plain .mjs tool without types
import { buildPackagedManifest, readCommittedManifest } from '../tools/data/packaged-manifest.mjs'

const root = resolve(__dirname, '..')
const readData = (p: string) => readFileSync(resolve(root, 'data', p))
const json = (p: string) => JSON.parse(readData(p).toString('utf8'))
const BASE = 'chrome-extension://test/'

/** Serves dist-like data/ paths from the repository data folder; `patch` replaces a file's bytes. */
function deps(patch: Record<string, Uint8Array> = {}, idb = new IDBFactory()): DataDeps & { idb: IDBFactory; reads: string[] } {
  const reads: string[] = []
  return {
    idb,
    reads,
    getURL: (p: string) => BASE + p,
    fetch: (async (url: string) => {
      const path = url.slice(BASE.length).replace(/^data\//, '')
      reads.push(path)
      const body = patch[path] ?? readData(path)
      return new Response(body as unknown as BodyInit)
    }) as unknown as typeof fetch,
  }
}

async function getAll<T>(idb: IDBFactory, store: string): Promise<T[]> {
  const { db } = await openDataDb(idb)
  const r = db.transaction(store).objectStore(store).getAll()
  const out = await new Promise<T[]>((ok, ko) => { r.onsuccess = () => ok(r.result as T[]); r.onerror = () => ko(r.error) })
  db.close()
  return out
}

describe('packaged data files', () => {
  it('validate against their schemas', () => {
    const m = readCommittedManifest()
    for (const f of m.files) {
      const res = DATA_SCHEMAS[f.schema as keyof typeof DATA_SCHEMAS].safeParse(json(f.path))
      expect(res.success, `${f.name}: ${res.success ? '' : res.error.issues[0]?.path.join('.')}`).toBe(true)
    }
  })

  it('data/manifest.json is current, valid and lists the three files', () => {
    const committed = readCommittedManifest()
    expect(dataManifest.parse(committed)).toBeTruthy()
    expect(committed).toEqual(buildPackagedManifest({ dataVersion: committed.dataVersion }))
    expect(committed.files.map((f: { name: string }) => f.name).sort())
      .toEqual(['news-rules.json', 'subject-list.json', 'subject-rules.json'])
  })

  it('schemas reject untrusted input that does not fit', () => {
    const rules = json('flm/subject-rules.json')
    expect(subjectRulesFile.safeParse({ ...rules, schemaVersion: 2 }).success).toBe(false)
    const [code, entry] = Object.entries(rules.subjects)[0] as [string, Record<string, unknown>]
    expect(subjectRulesFile.safeParse({ ...rules, subjects: { [code]: { ...entry, code: 'OTHER1' } } }).success).toBe(false)
    expect(subjectRulesFile.safeParse({ ...rules, subjects: { [code]: { ...entry, credits: '3' } } }).success).toBe(false)
    const news = json('news/news-rules.json')
    expect(newsRulesFile.safeParse({ ...news, deadline: ['(unclosed'] }).success).toBe(false)
  })
})

describe('search tokens', () => {
  it('normalize with NFD, no diacritics, đ to d, lowercase', () => {
    expect(normalizeText('Đại số Tuyến tính')).toBe('dai so tuyen tinh')
    expect(tokenize('Nguyên lý kế toán, ACC101')).toEqual(['nguyen', 'ly', 'ke', 'toan', 'acc101'])
  })

  it('index codes and both names', () => {
    const { search, subjects } = buildIndex(null, {
      subjects: { MAD101: { code: 'MAD101', sylId: 7, approvedDate: '2025-01-02', name: { en: 'Discrete mathematics', vi: 'Toán rời rạc' } } },
    } as never, 'packaged')
    expect(subjects[0]).toMatchObject({ code: 'MAD101', syllabusId: 7, approvedDate: '2025-01-02', rules: null, source: 'packaged' })
    expect(search.map((s) => s.token).sort()).toEqual(['discrete', 'mad101', 'mathematics', 'rac', 'roi', 'toan'])
  })
})

describe('IndexedDB store', () => {
  it('indexes the packaged files in one pass when the database is missing', async () => {
    const d = deps()
    expect(await ensureData('start', d)).toBe(true)
    const { db } = await openDataDb(d.idb)
    const files = await readFiles(db)
    db.close()
    const m = readCommittedManifest()
    expect(files.map((f) => [f.name, f.source, f.dataVersion, f.sha256]).sort())
      .toEqual(m.files.map((f: { name: string; sha256: string }) => [f.name, 'packaged', m.dataVersion, f.sha256]).sort())
    for (const f of files) expect(await sha256Hex(new TextEncoder().encode(f.body))).toBe(f.sha256)
    const subjects = await getAll<SubjectRecord>(d.idb, 'subjects')
    expect(subjects.length).toBe(Object.keys(json('flm/subject-list.json').subjects).length)
    const acc = subjects.find((s) => s.code === 'ACC101')
    expect(acc?.rules?.code).toBe('ACC101')
    expect(acc?.full?.name.vi).toBe('Nguyên lý kế toán')
    const search = await getAll<SearchRecord>(d.idb, 'search')
    expect(search.find((s) => s.token === 'toan')?.codes).toContain('ACC101')
    expect(search.find((s) => s.token === 'acc101')?.codes).toEqual(['ACC101'])
  }, 60_000)

  it('does nothing on a start when the data is present, and re-indexes after the database is lost', async () => {
    const idb = new IDBFactory()
    await ensureData('start', deps({}, idb))
    const again = deps({}, idb)
    expect(await ensureData('start', again)).toBe(false)
    expect(again.reads).toEqual([])
    const lost = deps({}, new IDBFactory())
    expect(await ensureData('start', lost)).toBe(true)
  }, 60_000)

  it('keeps an active channel copy with an equal or higher dataVersion on update', async () => {
    const idb = new IDBFactory()
    await ensureData('start', deps({}, idb))
    const { db } = await openDataDb(idb)
    const files = await readFiles(db)
    const tx = db.transaction('files', 'readwrite')
    for (const f of files) tx.objectStore('files').put({ ...f, source: 'channel', dataVersion: 5 })
    await new Promise((ok) => { tx.oncomplete = ok })
    db.close()
    expect(await ensureData('update', deps({}, idb))).toBe(false)
  }, 60_000)

  it('rejects a file whose hash differs from the manifest and writes nothing', async () => {
    const news = readData('news/news-rules.json')
    const tampered = new Uint8Array(news)
    tampered[10] = tampered[10] === 0x20 ? 0x09 : 0x20
    const d = deps({ 'news/news-rules.json': tampered })
    await expect(ensureData('start', d)).rejects.toThrow(/SHA-256 mismatch/)
    expect(await getAll(d.idb, 'files')).toEqual([])
    expect(await getAll(d.idb, 'subjects')).toEqual([])
  }, 60_000)

  it('rejects an unsupported schema major version', async () => {
    const m = readCommittedManifest()
    const bad = { ...m, files: m.files.map((f: { schema: string }) => ({ ...f, schema: f.schema.replace('@1', '@2') })) }
    const d = deps({ 'manifest.json': new TextEncoder().encode(JSON.stringify(bad)) })
    await expect(ensureData('start', d)).rejects.toThrow(/unsupported schema/)
  })
})
