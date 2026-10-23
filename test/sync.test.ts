import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import type { Exam, ExamStore, Session, SyncJob, TimetableStore } from '../src/features/scheduler/types'

const queuedGet = vi.fn()
vi.mock('../src/content/fap/queue', () => ({ queuedGet: (...a: unknown[]) => queuedGet(...a) }))

const { registerSchedulerSources } = await import('../src/features/scheduler/sources')
const { SyncEngine, LEASE_MS, mergeExams, mergeSessions, mondaysBetween, syncExams, termOf, termRange } = await import('../src/features/scheduler/sync')

const file = (f: string) => readFileSync(`test/fixtures/${f}`, 'utf8')
const page = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document
const WEEK = file('en/timetable-week.partial.html') // week of 2026-10-05
const EMPTY = '<div class="fap-empty-state">No sessions</div>'
const ok = (html: string) => ({ ok: true, value: page(html), fetchedAt: Date.now() })

/** Serves the week partial per requested Monday. */
function serve(weeks: Record<string, unknown>) {
  queuedGet.mockImplementation(async (path: string) => {
    const ref = new URL(path, 'https://fap.fpt.edu.vn').searchParams.get('referenceDate')!
    return weeks[ref] ?? ok(EMPTY)
  })
}
const stored = <T>(c: FakeChrome, k: string) => (c.storage.local.data[k] as { data: T } | undefined)?.data

describe('sync engine', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    queuedGet.mockReset()
    registerSchedulerSources()
  })

  it('lists ISO Mondays and fills term presets', () => {
    expect(mondaysBetween('2026-09-30', '2026-10-12')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(termRange('spring', 2026)).toEqual(['2026-01-01', '2026-04-30'])
    expect(termRange('summer', 2026)).toEqual(['2026-05-01', '2026-08-31'])
    expect(termRange('fall', 2026)).toEqual(['2026-09-01', '2026-12-31'])
    expect(termOf('2026-10-23')).toEqual({ term: 'fall', year: 2026 })
  })

  it('syncs one week, then updates instead of duplicating', async () => {
    serve({ '2026-10-05': ok(WEEK) })
    const e = new SyncEngine('a')
    const first = await e.syncWeek('2026-10-07')
    expect(queuedGet.mock.calls[0]![0]).toBe('/WeeklyTimetable/WeekPartial?referenceDate=2026-10-05')
    expect(first.ok && first.report.synced).toBe(1)
    const n = stored<TimetableStore>(c, 'timetable')!.sessions.length
    expect(first.report.added).toBe(n)
    const again = await e.syncWeek('2026-10-05')
    expect(again.report).toMatchObject({ added: 0, updated: 0, synced: 1 })
    expect(stored<TimetableStore>(c, 'timetable')!.sessions).toHaveLength(n)
  })

  it('rejects a wrong week, records an empty week and reports the range', async () => {
    serve({ '2026-09-28': ok(WEEK), '2026-10-05': ok(WEEK) })
    const r = await new SyncEngine('a').syncRange('2026-09-28', '2026-10-12')
    expect(r.ok).toBe(true)
    expect(r.report).toMatchObject({ synced: 2, failed: ['2026-09-28'] })
    expect(r.report.added).toBeGreaterThan(0)
    const t = stored<TimetableStore>(c, 'timetable')!
    expect(t.weeks['2026-10-12']).toMatchObject({ empty: true })
    expect(t.weeks['2026-09-28']).toBeUndefined()
    expect(c.storage.local.data['sync.job']).toBeUndefined()
  })

  it('writes the job before the first request and stores each week at once', async () => {
    let seen: SyncJob | undefined
    queuedGet.mockImplementation(async () => {
      seen ??= stored<SyncJob>(c, 'sync.job')
      return ok(EMPTY)
    })
    await new SyncEngine('a').syncRange('2026-10-05', '2026-10-19')
    expect(seen).toMatchObject({ kind: 'range', mondays: ['2026-10-05', '2026-10-12', '2026-10-19'], next: 0 })
  })

  it('keeps the job on a fatal error and resumes from the next unfinished week', async () => {
    serve({ '2026-10-05': ok(WEEK), '2026-10-12': { ok: false, error: { kind: 'session-expired' } } })
    const reports: unknown[] = []
    const a = new SyncEngine('a')
    a.onReport((r) => reports.push(r))
    const r = await a.syncRange('2026-10-05', '2026-10-19')
    expect(r).toMatchObject({ ok: false, error: { kind: 'session-expired' }, report: { synced: 1 } })
    expect(reports).toHaveLength(1)
    const job = stored<SyncJob>(c, 'sync.job')!
    expect(job.next).toBe(1)
    expect(job.runner).toBeUndefined()

    serve({})
    queuedGet.mockClear()
    const b = await new SyncEngine('b').resume()
    expect(queuedGet.mock.calls.map((x) => x[0])).toEqual([
      '/WeeklyTimetable/WeekPartial?referenceDate=2026-10-12',
      '/WeeklyTimetable/WeekPartial?referenceDate=2026-10-19',
    ])
    expect(b).toMatchObject({ ok: true, report: { synced: 3, failed: [] } })
    expect(c.storage.local.data['sync.job']).toBeUndefined()
  })

  it('leaves a job leased by a live tab alone and takes over a stale lease', async () => {
    const now = Date.now()
    const job: SyncJob = { kind: 'range', mondays: ['2026-10-05'], next: 0, failed: [], added: 0, updated: 0, unreadable: 0, startedAt: now, runner: 'a', beatAt: now }
    await c.storage.local.set({ 'sync.job': { schemaVersion: 1, updatedAt: now, data: job } })
    serve({})
    expect(await new SyncEngine('b').resume(now + 1000)).toBeNull()
    expect(queuedGet).not.toHaveBeenCalled()
    expect(await new SyncEngine('b').resume(now + LEASE_MS + 1)).toMatchObject({ ok: true })
  })

  it('stops quietly when another tab replaced the job', async () => {
    const a = new SyncEngine('a')
    queuedGet.mockImplementationOnce(async () => {
      const now = Date.now() + 5
      const job: SyncJob = { kind: 'range', mondays: ['2026-11-02'], next: 0, failed: [], added: 0, updated: 0, unreadable: 0, startedAt: now, runner: 'b', beatAt: now }
      await c.storage.local.set({ 'sync.job': { schemaVersion: 1, updatedAt: now, data: job } })
      return ok(EMPTY)
    })
    await a.syncRange('2026-10-05', '2026-10-19')
    expect(queuedGet).toHaveBeenCalledTimes(1)
    expect(stored<SyncJob>(c, 'sync.job')!.runner).toBe('b')
  })
})

const session = (p: Partial<Session>): Session => ({
  id: 'PRF192|2026-10-05|07:30', date: '2026-10-05', slot: 1, start: '07:30', end: '09:00', code: 'PRF192', group: 'SE1', room: 'R1',
  lecturer: 'abc', online: false, scheduleType: null, attendance: 'not-yet', syncedAt: 1, ...p,
})

describe('merge rules', () => {
  it('updates room, lecturer, online flag and attendance of a matching session', () => {
    const m = mergeSessions([session({})], [session({ room: 'R2', attendance: 'present', syncedAt: 2 }), session({ id: 'X|2026-10-05|09:10', code: 'X', start: '09:10' })])
    expect(m).toMatchObject({ added: 1, updated: 1 })
    expect(m.sessions).toHaveLength(2)
    expect(m.sessions[0]).toMatchObject({ room: 'R2', attendance: 'present', syncedAt: 2 })
  })

  const exam = (p: Partial<Exam>): Exam => ({
    id: 'PRF192|FE|2026-10-04', date: '2026-10-04', start: '10:50', end: '12:20', room: 'R1', code: 'PRF192', name: 'Programming',
    type: 'FE', typeRaw: 'FE', format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1, ...p,
  })

  it('keeps exams FAP no longer lists and marks them past', () => {
    const old = exam({})
    const next = exam({ id: 'PRF192|PE|2026-11-04', type: 'PE', date: '2026-11-04' })
    const m = mergeExams([old], [next, exam({ id: 'X|FE|2026-10-30', code: 'X', date: '2026-10-30' })], '2026-10-23')
    expect(m).toMatchObject({ added: 2, updated: 0 })
    expect(m.exams.map((e) => [e.id, e.past])).toEqual([['PRF192|FE|2026-10-04', true], ['X|FE|2026-10-30', false], ['PRF192|PE|2026-11-04', false]])
    expect(mergeExams(m.exams, [exam({ room: 'R9' })], '2026-10-23')).toMatchObject({ added: 0, updated: 1 })
  })

  it('syncs the exam page into the store', async () => {
    const c = installFakeChrome()
    registerSchedulerSources()
    queuedGet.mockReset()
    queuedGet.mockResolvedValue({ ok: true, value: parseHTML(file('en/exam-schedule.html')).document, fetchedAt: Date.now() })
    const now = Date.parse('2026-10-10T12:00:00+07:00')
    const r = await syncExams(now)
    expect(r).toMatchObject({ ok: true, updated: 0 })
    const s = stored<ExamStore>(c, 'exams')!
    expect(s.lastSync).toBe(now)
    expect(s.exams.length).toBe(r.ok ? r.total : -1)
    expect(await syncExams(now)).toMatchObject({ ok: true, added: 0, updated: 0 })
    queuedGet.mockResolvedValue({ ok: false, error: { kind: 'challenge' } })
    expect(await syncExams(now)).toEqual({ ok: false, error: { kind: 'challenge' } })
  })
})
