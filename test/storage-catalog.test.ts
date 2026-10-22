import { beforeEach, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { CATALOG, isCatalogKey, read, subscribe, update, usage, write } from '../src/shared/storage/catalog'
import { storageStatus } from '../src/background/status'

const DAY = 86_400_000
const NOW = Date.parse('2026-10-23T12:00:00+07:00')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

describe('storage catalog', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome() })

  it('every key used in src is in the catalog, and only the catalog touches chrome.storage.local', () => {
    const files = walk('src')
    const bad: string[] = []
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      if (!f.endsWith(join('storage', 'catalog.ts')) && /chrome\.storage\.local/.test(text)) bad.push(`${f}: direct chrome.storage.local`)
      for (const m of text.matchAll(/\b(?:read|write|update|subscribe|readRaw|remove)\(\s*['`]([^'`$]+)['`]/g)) {
        const key = m[1]!
        if (!isCatalogKey(key) && !(key.endsWith(':') && isCatalogKey(`${key}x`))) bad.push(`${f}: ${key}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('every entry declares owner, version, size and retention', () => {
    for (const [k, e] of Object.entries(CATALOG)) {
      expect(e.owner, k).toBeTruthy()
      expect(e.version, k).toBeGreaterThan(0)
      expect(e.size, k).toBeTruthy()
      expect(e.retention, k).toBeTruthy()
    }
  })

  it('writes versioned values and reads them back', async () => {
    await write('legacy', { dismissed: true } as never, NOW)
    expect(c.storage.local.data.legacy).toEqual({ schemaVersion: 1, updatedAt: NOW, data: { dismissed: true } })
    expect(await read('legacy')).toEqual({ dismissed: true })
  })

  it('does not return data written by another schema version', async () => {
    await c.storage.local.set({ 'panel.state': { schemaVersion: 1, updatedAt: 0, data: { x: 1 } } })
    expect(await read('panel.state')).toBeNull()
  })

  it('rejects keys outside the catalog', async () => {
    await expect(write('nope' as never, {} as never)).rejects.toThrow(/not in catalog/)
  })

  it('prunes alerts to 200 items and 60 days', async () => {
    const items = Array.from({ length: 250 }, (_, i) => ({ id: String(i), at: NOW - i * 60_000 }))
    items.push({ id: 'old', at: NOW - 61 * DAY })
    await write('alerts', { items } as never, NOW)
    const got = (await read('alerts')) as unknown as { items: { id: string }[] }
    expect(got.items).toHaveLength(200)
    expect(got.items.map((a) => a.id)).not.toContain('old')
    expect(got.items[0]!.id).toBe('0')
  })

  it('prunes timetable sessions and exams older than 400 days', async () => {
    await write('timetable', { sessions: [{ date: '2026-10-01' }, { date: '2025-09-01' }] } as never, NOW)
    expect(((await read('timetable')) as unknown as { sessions: unknown[] }).sessions).toEqual([{ date: '2026-10-01' }])
    await write('exams', { exams: [{ date: '2026-10-01' }, { date: '2025-09-01' }] } as never, NOW)
    expect(((await read('exams')) as unknown as { exams: unknown[] }).exams).toEqual([{ date: '2026-10-01' }])
  })

  it('prunes cache entries older than 30 days', async () => {
    await write('cache:exam.list', { entries: { a: { value: 1, fetchedAt: NOW - DAY }, b: { value: 2, fetchedAt: NOW - 31 * DAY } } }, NOW)
    expect(Object.keys((await read('cache:exam.list'))!.entries)).toEqual(['a'])
  })

  it('prunes news seen older than 30 days and recents to 10', async () => {
    await write('info.state', { newsSeen: { a: NOW - DAY, b: NOW - 31 * DAY } } as never, NOW)
    expect(((await read('info.state')) as unknown as { newsSeen: object }).newsSeen).toEqual({ a: NOW - DAY })
    await write('panel.prefs', { recents: Array.from({ length: 15 }, (_, i) => `c${i}`) } as never, NOW)
    expect(((await read('panel.prefs')) as unknown as { recents: string[] }).recents).toHaveLength(10)
  })

  it('serializes updates and notifies subscribers', async () => {
    const seen: unknown[] = []
    subscribe('diag.counters', (d) => seen.push(d))
    await Promise.all([1, 2, 3].map(() => update('diag.counters', (o) => ({ n: ((o as { n?: number })?.n ?? 0) + 1 }) as never)))
    expect(await read('diag.counters')).toEqual({ n: 3 })
    expect(seen).toHaveLength(3)
  })

  it('reports usage per key and the IndexedDB estimate', async () => {
    await write('legacy', { dismissed: false } as never)
    const u = await usage()
    expect(u.perKey.legacy).toBeGreaterThan(0)
    const s = await storageStatus()
    expect(s.usage.total).toBe(u.total)
    expect(s.idb).toHaveProperty('usage')
  })
})
