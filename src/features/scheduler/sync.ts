// Timetable and exam sync (core R6.1 to R6.10, R7.1 to R7.5; design "Scheduler"). A range is a
// list of ISO Mondays written as the `sync.job` before the first request; each finished week is
// stored at once, so a reload resumes from the next unfinished week. Errors are typed values.
import { read as readSource } from '../../content/fap/registry'
import type { FapError } from '../../content/fap/access'
import { read, remove, update, write } from '../../shared/storage/catalog'
import { addDays, mondayOf, todayVn } from '../../shared/dates'
import { EXAM_LIST, TIMETABLE_WEEK } from './sources'
import type { Exam, Session, SyncJob, WeekResult } from './types'

export interface SyncReport { synced: number; failed: string[]; added: number; updated: number; unreadable: number }
export type SyncOutcome = { ok: true; report: SyncReport } | { ok: false; error: FapError; report: SyncReport }
export type ExamOutcome = { ok: true; added: number; updated: number; total: number } | { ok: false; error: FapError }

/** Errors that stop the whole job; it stays stored and resumable. Others fail only the week. */
const FATAL: ReadonlySet<FapError['kind']> = new Set(['challenge', 'session-expired', 'feedback-required', 'forbidden'])
export const LEASE_MS = 60_000
const BEAT_MS = 20_000

export type Term = 'spring' | 'summer' | 'fall'
/** Term presets (R6.3): Spring January to April, Summer May to August, Fall September to December. */
export function termRange(term: Term, year: number): [string, string] {
  const [a, b] = { spring: ['01-01', '04-30'], summer: ['05-01', '08-31'], fall: ['09-01', '12-31'] }[term]
  return [`${year}-${a}`, `${year}-${b}`]
}
export function termOf(iso: string): { term: Term; year: number } {
  const m = +iso.slice(5, 7)
  return { term: m <= 4 ? 'spring' : m <= 8 ? 'summer' : 'fall', year: +iso.slice(0, 4) }
}

/** Mondays of every ISO week from `start` to `end`, both included. */
export function mondaysBetween(start: string, end: string): string[] {
  const out: string[] = []
  for (let m = mondayOf(start), last = mondayOf(end); m <= last; m = addDays(m, 7)) out.push(m)
  return out
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const byTime = <T extends { date: string; start: string }>(a: T, b: T) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)

/** Merge on `code|date|start` (R6.9): a match gets its mutable fields updated, not a duplicate. */
export function mergeSessions(stored: Session[], incoming: Session[]): { sessions: Session[]; added: number; updated: number } {
  const map = new Map(stored.map((s) => [s.id, s]))
  let added = 0
  let updated = 0
  for (const s of incoming) {
    const old = map.get(s.id)
    if (!old) {
      map.set(s.id, s)
      added++
      continue
    }
    const next = { ...old, room: s.room, lecturer: s.lecturer, online: s.online, attendance: s.attendance, syncedAt: s.syncedAt }
    if (!sameJson({ ...old, syncedAt: 0 }, { ...next, syncedAt: 0 })) updated++
    map.set(s.id, next)
  }
  return { sessions: [...map.values()].sort(byTime), added, updated }
}

/** Merge on `code|type|date` (R7.3); exams no longer listed stay, `past` from the Vietnam date (R7.2). */
export function mergeExams(stored: Exam[], incoming: Exam[], today: string): { exams: Exam[]; added: number; updated: number } {
  const map = new Map(stored.map((e) => [e.id, e]))
  let added = 0
  let updated = 0
  const strip = (e: Exam) => ({ ...e, syncedAt: 0, past: false })
  for (const e of incoming) {
    const old = map.get(e.id)
    if (!old) added++
    else if (!sameJson(strip(old), strip(e))) updated++
    map.set(e.id, e)
  }
  const exams = [...map.values()].map((e) => ({ ...e, past: e.date < today })).sort(byTime)
  return { exams, added, updated }
}

type Step = { fatal: FapError } | { failed: true } | { added: number; updated: number; unreadable: number }

async function storeWeek(w: WeekResult, now: number): Promise<{ added: number; updated: number }> {
  let counts = { added: 0, updated: 0 }
  await update('timetable', (old) => {
    const m = mergeSessions(old?.sessions ?? [], w.sessions)
    counts = { added: m.added, updated: m.updated }
    return { sessions: m.sessions, weeks: { ...(old?.weeks ?? {}), [w.monday]: { syncedAt: now, empty: w.empty } }, lastSync: now }
  })
  return counts
}

async function step(monday: string): Promise<Step> {
  const r = await readSource<WeekResult>(TIMETABLE_WEEK, { referenceDate: monday }, { force: true })
  if (!r.ok) return FATAL.has(r.error.kind) ? { fatal: r.error } : { failed: true }
  if (r.value.rejected) return { failed: true } // R6.4
  const c = await storeWeek(r.value, r.fetchedAt)
  return { ...c, unreadable: r.value.unreadable }
}

const reportOf = (j: SyncJob): SyncReport => ({ synced: j.next - j.failed.length, failed: j.failed, added: j.added, updated: j.updated, unreadable: j.unreadable })

export class SyncEngine {
  private job: SyncJob | null = null
  private listeners = new Set<(r: SyncOutcome) => void>()

  constructor(readonly runner: string = crypto.randomUUID()) {}

  /** Called with the outcome of every range sync, including one resumed after a reload. */
  onReport(cb: (r: SyncOutcome) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  get running(): boolean { return this.job !== null }

  /** One week (R6.1). */
  async syncWeek(date: string): Promise<SyncOutcome> {
    const monday = mondayOf(date)
    const s = await step(monday)
    const report: SyncReport = { synced: 0, failed: [], added: 0, updated: 0, unreadable: 0 }
    if ('fatal' in s) return { ok: false, error: s.fatal, report }
    if ('failed' in s) report.failed.push(monday)
    else Object.assign(report, { synced: 1, added: s.added, updated: s.updated, unreadable: s.unreadable })
    return { ok: true, report }
  }

  /** Every ISO week from `start` to `end` (R6.2). Replaces any stored job. */
  async syncRange(start: string, end: string, now = Date.now()): Promise<SyncOutcome> {
    const job: SyncJob = { kind: 'range', mondays: mondaysBetween(start, end), next: 0, failed: [], added: 0, updated: 0, unreadable: 0, startedAt: now, runner: this.runner, beatAt: now }
    await write('sync.job', job)
    return this.run(job)
  }

  /** Continues a stored job unless another live tab holds its lease (R6.6). */
  async resume(now = Date.now()): Promise<SyncOutcome | null> {
    if (this.job) return null
    const job = await read('sync.job')
    if (!job) return null
    if (job.runner && job.runner !== this.runner && now - (job.beatAt ?? 0) < LEASE_MS) return null
    const claimed = { ...job, runner: this.runner, beatAt: now }
    await write('sync.job', claimed)
    return this.run(claimed)
  }

  /** Gives up the lease so the next page load resumes at once (wired to pagehide). */
  release(): void {
    if (!this.job) return
    void write('sync.job', { ...this.job, runner: undefined, beatAt: 0 })
    this.job = null
  }

  private async run(job: SyncJob): Promise<SyncOutcome> {
    this.job = job
    const beat = setInterval(() => {
      if (this.job !== job) return
      job.beatAt = Date.now()
      void write('sync.job', job)
    }, BEAT_MS)
    try {
      while (job.next < job.mondays.length) {
        const s = await step(job.mondays[job.next]!)
        if (this.job !== job) return { ok: true, report: reportOf(job) } // released mid-week
        const stored = await read('sync.job')
        if (stored?.runner !== this.runner || stored.startedAt !== job.startedAt) return this.finish(job, null, false) // replaced elsewhere
        if ('fatal' in s) return this.finish(job, s.fatal, false)
        if ('failed' in s) job.failed.push(job.mondays[job.next]!)
        else {
          job.added += s.added
          job.updated += s.updated
          job.unreadable += s.unreadable
        }
        job.next++
        job.beatAt = Date.now()
        await write('sync.job', job)
      }
      await remove('sync.job')
      return this.finish(job, null, true)
    } finally {
      clearInterval(beat)
    }
  }

  private async finish(job: SyncJob, error: FapError | null, done: boolean): Promise<SyncOutcome> {
    if (this.job === job) this.job = null
    if (error) await write('sync.job', { ...job, runner: undefined, beatAt: 0 })
    const out: SyncOutcome = error ? { ok: false, error, report: reportOf(job) } : { ok: true, report: reportOf(job) }
    if (done || error) for (const l of this.listeners) l(out)
    return out
  }
}

export const engine = new SyncEngine()

/** `/ExamSchedule` into the `exams` store (R7.1 to R7.3). */
export async function syncExams(now = Date.now()): Promise<ExamOutcome> {
  const r = await readSource<Exam[]>(EXAM_LIST, {}, { force: true })
  if (!r.ok) return r
  let counts = { added: 0, updated: 0, total: 0 }
  await update('exams', (old) => {
    const m = mergeExams(old?.exams ?? [], r.value, todayVn(now))
    counts = { added: m.added, updated: m.updated, total: m.exams.length }
    return { exams: m.exams, lastSync: now }
  })
  return { ok: true, ...counts }
}
