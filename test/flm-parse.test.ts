// @vitest-environment happy-dom
// PLT-9.1: the FLM detail parser port, overrides and the development probe (platform R6.3, R6.5, R6.6).
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInThisContext } from 'node:vm'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { compactEntry, normaliseSyllabus, parseDetail, parseFlmDetail } from '../src/content/flm/parse'
import { openDataDb, writeIndex, type SubjectRecord } from '../src/background/data/db'
import { removeOverride, storeOverride, installOverrides } from '../src/background/data/overrides'
import { lookupSubject } from '../src/background/data/query'
import { flmProbe, installFlmProbe } from '../src/background/flm-probe'
import { handle } from '../src/background/router'
// @ts-expect-error plain .mjs reference tool without types
import { compact as refCompact, normaliseSyllabus as refNormalise } from '../tools/flm-scraper/build-subject-list.mjs'

const FIXTURE = readFileSync('test/fixtures/flm/syllabus-detail.html', 'utf8')
const docOf = (html: string) => new DOMParser().parseFromString(html, 'text/html')

/** The reference scraper, run as on FLM: its own list and detail requests answered from the fixture. */
async function referenceRaw(html: string, code: string, sylId: number) {
  const g = globalThis as unknown as { fetch: typeof fetch; flmScrape?: (o: object) => Promise<{ syllabi: { sylId: string; list: object; detail: object; tables: object; error?: string }[] }> }
  const realFetch = g.fetch
  const list = `<table class="table-striped"><tr><th>ID</th><th>Code</th><th>Subject</th><th>Syllabus</th><th>Active</th><th>Approved</th><th>Decision</th></tr><tr><td>${sylId}</td><td>${code}</td><td>Sample Systems</td><td>Sample Systems</td><td>True</td><td>True</td><td>123/QĐ-ĐHFPT dated 11/22/2024</td></tr></table>`
  g.fetch = (async (url: string) => new Response(url.includes('SyllabusDetails') ? html : list)) as unknown as typeof fetch
  ;(window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL('https://flm.fpt.edu.vn/gui/role/student/SyllabusManagement')
  try {
    runInThisContext(readFileSync('tools/flm-scraper/flm-scraper.js', 'utf8'), { filename: 'flm-scraper.js' })
    const out = await g.flmScrape!({ delayMs: 0, concurrency: 1, only: [code] })
    return out.syllabi[0]!
  } finally {
    g.fetch = realFetch
    ;(window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL('https://fap.fpt.edu.vn/')
  }
}

let c: FakeChrome
beforeEach(() => { c = installFakeChrome() })

describe('parser port', () => {
  it('reads the detail table and the five grids like the reference scraper', async () => {
    const ref = await referenceRaw(FIXTURE, 'ZZZ101', 99001)
    const port = parseDetail(docOf(FIXTURE))!
    expect(ref.error).toBeUndefined()
    expect(port.detail).toEqual(ref.detail)
    expect(port.tables).toEqual(ref.tables)
    expect(port.detail['Pre-Requisite']).toBe('ZZZ100 or equivalent')
    expect(port.tables.gvMaterial!.rows[0]!.slice(6, 10)).toEqual([true, false, true, 'Online copy <https://example.edu/handbook>'])
  })

  it('normalises to the same full and compact entries as build-subject-list.mjs', async () => {
    const ref = await referenceRaw(FIXTURE, 'ZZZ101', 99001)
    const refFull = refNormalise(ref)
    const portFull = normaliseSyllabus({ ...parseDetail(docOf(FIXTURE))!, sylId: 99001, list: { sylId: 99001, code: 'ZZZ101' } })
    expect(portFull).toEqual(refFull)
    expect(compactEntry(portFull)).toEqual(refCompact({ subjects: { ZZZ101: refFull } }).subjects.ZZZ101)
    // The fixture exercises sub-components, Coursera wording and attendance.
    expect(portFull.flags).toContain('has-subcomponents')
    expect(portFull.assessments.filter((a) => a.parentIndex === 2).map((a) => a.category)).toEqual(['Practical Exam part 1', 'Practical Exam part 2'])
    expect([portFull.weightSum, portFull.coursera.required, portFull.coursera.bonus, portFull.attendance.minPercent]).toEqual([1, true, true, 80])
    expect([portFull.approvedDate, portFull.decision]).toEqual(['2024-12-01', { number: '123/QĐ-ĐHFPT', date: '2024-11-22' }])
  })

  const saved = existsSync('ignore/flm') ? readdirSync('ignore/flm').filter((f) => /^syllabus-\d+\.html$/.test(f)) : []
  it.skipIf(saved.length === 0)('matches the reference on saved FLM pages in ignore/flm/', async () => {
    for (const f of saved) {
      const html = readFileSync(join('ignore/flm', f), 'utf8')
      const sylId = Number(/\d+/.exec(f)![0])
      const code = parseDetail(docOf(html))!.detail['Subject Code']!
      const ref = refNormalise(await referenceRaw(html, code, sylId))
      expect(normaliseSyllabus({ ...parseDetail(docOf(html))!, sylId, list: { sylId, code } })).toEqual(ref)
    }
  })

  it('returns schema-checked entries, or why a page could not be read', () => {
    const r = parseFlmDetail(FIXTURE, 'ZZZ101', 99001)
    if ('error' in r) throw new Error(r.error)
    expect([r.full.code, r.full.sylId, r.rules.credits, r.rules.hasFinal]).toEqual(['ZZZ101', 99001, 3, true])
    expect(parseFlmDetail('<html><body><form action="/Account/Login"></form></body></html>', 'ZZZ101', 1)).toEqual({ error: 'no #table-detail (signed out or layout changed)' })
    expect(parseFlmDetail(FIXTURE.replace('<td>3</td></tr>', '<td>three</td></tr>'), 'ZZZ101', 99001)).toEqual({ error: 'the syllabus for ZZZ101 does not have the expected fields' })
  })
})

describe('overrides', () => {
  const parsed = () => { const r = parseFlmDetail(FIXTURE, 'ZZZ101', 99001); if ('error' in r) throw new Error(r.error); return r }
  const active = (syllabusId: number, approvedDate: string): SubjectRecord => ({ code: 'ZZZ101', syllabusId, approvedDate, rules: null, full: null, source: 'packaged' })

  it('win while newer, are dropped when indexing brings a newer syllabus, and can be removed', async () => {
    const idb = new IDBFactory()
    const { db } = await openDataDb(idb)
    await writeIndex(db, { files: [], subjects: [active(98000, '2024-01-01')], search: [] })
    await storeOverride(db, parsed(), 5)
    expect(await lookupSubject(db, 'ZZZ101')).toMatchObject({ source: 'live', syllabusId: 99001, fetchedAt: 5 })
    // Re-indexing with an older syllabus keeps the override; a newer one drops it.
    await writeIndex(db, { files: [], subjects: [active(98000, '2024-01-01')], search: [] })
    expect((await lookupSubject(db, 'ZZZ101'))!.source).toBe('live')
    await writeIndex(db, { files: [], subjects: [active(99500, '2025-01-01')], search: [] })
    expect((await lookupSubject(db, 'ZZZ101'))!.source).toBe('packaged')
    await storeOverride(db, parsed(), 6)
    expect(await removeOverride(db, 'ZZZ101')).toBe(true)
    expect(await removeOverride(db, 'ZZZ101')).toBe(false)
    db.close()
  })

  it('answer flm.remove from the panel', async () => {
    const idb = new IDBFactory()
    installOverrides(idb)
    const { db } = await openDataDb(idb)
    await storeOverride(db, parsed())
    db.close()
    const sender = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 1 } as chrome.tabs.Tab }
    expect(await handle({ v: 1, type: 'flm.remove', code: 'ZZZ101' }, sender)).toEqual({ ok: true, value: { removed: true } })
  })
})

describe('development FLM probe', () => {
  it('needs the FLM permission, then tells signed in from signed out', async () => {
    expect(await flmProbe()).toMatchObject({ permission: false, signedIn: false })
    c.permissions._granted.add('https://flm.fpt.edu.vn/*')
    const res = (url: string, body: string) => Object.assign(new Response(body), { url }) as Response
    const signedIn = await flmProbe((async () => res('https://flm.fpt.edu.vn/gui/role/student/SyllabusManagement?x', '<table class="table table-striped">'))  as unknown as typeof fetch)
    expect(signedIn).toMatchObject({ permission: true, status: 200, finalPath: '/gui/role/student/SyllabusManagement', signedIn: true })
    const out = await flmProbe((async () => res('https://flm.fpt.edu.vn/Account/Login', '<form>')) as unknown as typeof fetch)
    expect(out).toMatchObject({ signedIn: false, finalPath: '/Account/Login' })
    expect(out.note).toContain('background tab fallback')
  })

  it('is registered in development builds only', async () => {
    installFlmProbe()
    const sender = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 1 } as chrome.tabs.Tab }
    expect((await handle({ v: 1, type: 'dev.flmProbe' }, sender))?.ok).toBe(import.meta.env.DEV)
  })
})
