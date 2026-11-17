// PLT-10.1: "Copy diagnostics" is an allow-list report with no record values (platform R7.2, R7.3).
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { handle } from '../src/background/router'
import { buildDiagnostics, chromeMajor, installDiagnostics } from '../src/background/diagnostics'
import { read, write } from '../src/shared/storage/catalog'

const fap = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 1 } as chrome.tabs.Tab }
// Values that must never appear: names, ids, marks, rooms, lecturers, URLs with queries, free text.
const SECRETS = ['Nguyen Van Secret', 'SE170001', 'secret@fpt.edu.vn', '8.75', 'BE-301', 'lecturersecret', 'courseId=abc-123', 'Lập trình bí mật', 'PRF192']
const deps = { idb: new IDBFactory(), fetch: (async () => new Response('', { status: 404 })) as unknown as typeof fetch, getURL: (p: string) => p }

describe('diagnostics', () => {
  let c: FakeChrome
  beforeEach(async () => {
    c = installFakeChrome()
    installDiagnostics(deps)
    await write('timetable', { sessions: [{ id: 'PRF192|2026-10-07|07:30', date: '2026-10-07', slot: 1, start: '07:30', end: '09:00', code: 'PRF192', group: 'SE1', room: 'BE-301', lecturer: 'lecturersecret', online: false, scheduleType: null, attendance: 'present', syncedAt: 1 }], weeks: {}, lastSync: 5 })
    await write('cache:grades.transcript', { entries: { '[]': { value: { rows: [{ code: 'PRF192', name: 'Lập trình bí mật', grade: 8.75 }], owner: 'Nguyen Van Secret', roll: 'SE170001', email: 'secret@fpt.edu.vn' }, fetchedAt: Date.now() } } })
    await write('alerts', { items: [{ id: 'a', kind: 'grade', title: 'PRF192 failing', detail: 'see https://fap.fpt.edu.vn/Report/Grade?courseId=abc-123', at: Date.now(), read: false, dedupeKey: 'a' }] })
    await write('diag.counters', { 'msg.rejected.schema': 2, 'handler.error.data.rules': 1, 'Nguyen Van Secret': 3 })
    await c.storage.session.set({ 'budget.ledger': { grants: [{ at: Date.now() - 1000, bg: false }, { at: Date.now() - 2000, bg: true }], inflight: null, lastEndAt: 0, lastOutcome: 'ok', challenged: false, userWaitingUntil: 0 } })
    c.permissions._granted.add('notifications')
  })

  it('reports versions, data, permissions, budget, counters and storage sizes only', async () => {
    const text = await buildDiagnostics(deps)
    expect(text).toMatch(/^FAP-AIO diagnostics\nExtension 2\.0\.0\nChrome \S+\nPlatform \S+/)
    expect(text).toContain('Optional permissions: notifications granted, flm not granted')
    expect(text).toContain('Budget: 2 of 30 grants in the last 5 minutes (1 background), challenged no')
    expect(text).toContain('  msg.rejected.schema 2')
    expect(text).toContain('  handler.error.data.rules 1')
    expect(text).toMatch(/ {2}timetable \d+/)
    expect(text).toMatch(/ {2}cache:grades\.transcript \d+/)
    for (const s of SECRETS) expect(text, s).not.toContain(s)
  })

  it('answers the diagnostics message and resets the counters', async () => {
    const r = (await handle({ v: 1, type: 'diagnostics' }, fap)) as { ok: true; value: { text: string } }
    expect(r.ok).toBe(true)
    for (const s of SECRETS) expect(r.value.text).not.toContain(s)
    expect(await read('diag.counters')).toBeNull()
  })

  it('keeps only the Chrome major version', () => {
    expect(chromeMajor('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.59 Safari/537.36')).toBe('142')
    expect(chromeMajor('curl/8')).toBe('unknown')
  })
})
