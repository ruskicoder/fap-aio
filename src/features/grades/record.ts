// Full academic record (grades R14, GRD-7.2; design "Full academic record"): every term and course with
// its mark sheet. A resumable job, like the schedule sync (core R6.6): the plan and progress are stored
// after every step, so a reload resumes at the next unfinished step; each finished step is merged into
// `grades.record` at once, so the Record view shows partial results. Reads go through the registry, which
// uses the paced queue and the shared request budget, one request at a time, GET only. An ordinary update
// reads only terms whose transcript rows changed, terms in progress and sheets not stored yet (R14.6).
import { read as readSource } from '../../content/fap/registry'
import type { FapError } from '../../content/fap/access'
import { errorText } from '../../content/panel/errors'
import { read, remove, subscribe, update, write } from '../../shared/storage/catalog'
import { statusText } from './export'
import { semesterOrder } from './engine/gpa'
import { studentOf } from './parse/transcript'
import { GRADES_ATTENDANCE, GRADES_ATTENDANCE_TERM, GRADES_MARK_SHEET, GRADES_TERM_COURSES, GRADES_TRANSCRIPT } from './sources'
import type { AttendancePage, AttendanceSheet } from './parse/attendance'
import type { CourseRef, MarkSheet, TermCourses, Transcript, TranscriptRow } from './types'

export interface RecordTerm {
  id: string
  name: string
  /** When the term's course list was read; null while only its name is known. */
  readAt: number | null
  courses: CourseRef[]
  /** The term's transcript rows when its courses were read (see `fingerprints`). */
  fingerprint: string | null
}

export interface RecordSheet {
  termId: string
  courseId: string
  sheet: MarkSheet
  fetchedAt: number
  /** The course's transcript row when the sheet was read (see `rowKey`); null when it had none. */
  rowKey: string | null
}

/** A course's attendance (grades R16.6, GRD-7.4). */
export interface RecordAttendance { termId: string; courseId: string; sheet: AttendanceSheet; fetchedAt: number }

export interface RecordStore {
  transcript: Transcript | null
  transcriptAt: number | null
  /** FAP's term ids in FAP's order (newest first). */
  termOrder: string[]
  terms: Record<string, RecordTerm>
  /** By FAP course id. */
  sheets: Record<string, RecordSheet>
  student: { name: string; roll: string } | null
  curriculum: string | null
  /** By FAP course id; attendance and grade pages share term and course ids (GRD-7.4). */
  attendance: Record<string, RecordAttendance>
  /** The terms `/Report/Attendance` lists (fewer than the grade page); null until read. */
  attendanceTerms: string[] | null
  /** FAP's current term, from the grade page without a term. */
  currentTermId: string | null
  /** The last finished step, for the status strip. */
  lastSync: number | null
}

export type RecordStep =
  | { kind: 'transcript'; force: boolean }
  | { kind: 'terms'; force: boolean }
  | { kind: 'term'; termId: string; name: string; force: boolean }
  | { kind: 'sheet'; termId: string; courseId: string; label: string; force: boolean }
  | { kind: 'attTerms'; force: boolean }
  | { kind: 'attendance'; termId: string; courseId: string; label: string; force: boolean }

/** update: what changed; all: everything again; term or course: that one again (R14.6). */
export type RecordMode = 'update' | 'all' | 'term' | 'course'

export interface RecordJob {
  mode: RecordMode
  steps: RecordStep[]
  next: number
  failed: { index: number; error: string }[]
  startedAt: number
  runner?: string
  beatAt: number
  /** Set by Cancel: the job stays stored and resumes only from Resume. */
  paused: boolean
}

declare module '../../shared/storage/catalog' {
  interface StoreMap {
    'grades.record': RecordStore
    'grades.record.job': RecordJob
  }
}

export const EMPTY_RECORD: RecordStore = { transcript: null, transcriptAt: null, termOrder: [], terms: {}, sheets: {}, student: null, curriculum: null, attendance: {}, attendanceTerms: null, currentTermId: null, lastSync: null }

/** Errors that stop the whole job; it stays stored and resumable (R14.7). Others fail only the step. */
export const FATAL: ReadonlySet<FapError['kind']> = new Set(['challenge', 'session-expired', 'feedback-required', 'forbidden'])
export const LEASE_MS = 60_000
const BEAT_MS = 20_000

// ---- planning (pure) ---------------------------------------------------------------------------

export const rowKey = (r: TranscriptRow) => `${r.code}:${r.grade ?? '-'}:${statusText(r.status)}`
const settled = (r: TranscriptRow) => r.status === 'passed' || r.status === 'exempt' || r.status === 'not-passed'
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/** The transcript rows of a term, by its name (`Fall2025`). */
export const rowsOfTerm = (t: Transcript | null, name: string) => (t?.rows ?? []).filter((r) => norm(r.semester) === norm(name))

/** Sorted row keys of a term: the term changed in the transcript when this changes. */
export const fingerprint = (t: Transcript | null, name: string) => rowsOfTerm(t, name).map(rowKey).sort().join('|')

/** The transcript row of a course: same code in the same term, else the latest row with that code. */
export function rowOf(t: Transcript | null, code: string | null, termName: string): TranscriptRow | null {
  if (!t || !code) return null
  const c = code.toUpperCase()
  const same = t.rows.find((r) => r.code.toUpperCase() === c && norm(r.semester) === norm(termName))
  if (same) return same
  return [...t.rows].filter((r) => r.code.toUpperCase() === c).sort((a, b) => semesterOrder(b.semester) - semesterOrder(a.semester))[0] ?? null
}

/** A term is read when it is new, its transcript rows changed, it has a course in progress, it is FAP's current term, or on force. */
export function termNeedsRead(store: RecordStore, termId: string, name: string, currentId: string | null, force: boolean): boolean {
  if (force || termId === currentId) return true
  const old = store.terms[termId]
  if (!old || old.readAt === null) return true
  if (old.fingerprint !== fingerprint(store.transcript, name)) return true
  return rowsOfTerm(store.transcript, name).some((r) => !settled(r))
}

/** The sheets to read for a term's courses: not stored yet, transcript row changed or not settled, or on force. */
export function sheetSteps(store: RecordStore, term: { id: string; name: string }, courses: CourseRef[], force: boolean): RecordStep[] {
  return courses.flatMap((c) => {
    const row = rowOf(store.transcript, c.code, term.name)
    const old = store.sheets[c.id]
    // A changed row skips the registry cache: the grade was just published or corrected.
    const changed = !!old && !!row && old.rowKey !== rowKey(row)
    const read = force || !old || changed || (row ? !settled(row) : false)
    return read ? [{ kind: 'sheet' as const, termId: term.id, courseId: c.id, label: c.code ?? c.label, force: force || changed }] : []
  })
}

/**
 * A course's attendance is read when its term is on the attendance page and it has none stored, its term is
 * FAP's current term, its transcript row is not settled, or on force (R16.6).
 */
export function attendanceSteps(store: RecordStore, term: { id: string; name: string }, courses: CourseRef[], force: boolean): RecordStep[] {
  if (!store.attendanceTerms?.includes(term.id)) return []
  return courses.flatMap((c) => {
    const row = rowOf(store.transcript, c.code, term.name)
    const read = force || !store.attendance[c.id] || term.id === store.currentTermId || (row ? !settled(row) : false)
    return read ? [{ kind: 'attendance' as const, termId: term.id, courseId: c.id, label: c.code ?? c.label, force }] : []
  })
}

export function initialSteps(mode: RecordMode, scope?: { termId: string; name: string } | { termId: string; courseId: string; label: string; attendance?: boolean }): RecordStep[] {
  if (mode === 'term' && scope && 'name' in scope) return [{ kind: 'term', termId: scope.termId, name: scope.name, force: true }]
  if (mode === 'course' && scope && 'courseId' in scope) {
    const one = { termId: scope.termId, courseId: scope.courseId, label: scope.label, force: true }
    return [{ kind: 'sheet', ...one }, ...(scope.attendance ? [{ kind: 'attendance' as const, ...one }] : [])]
  }
  // The transcript is read again on every update: it is one request and tells what changed.
  return [{ kind: 'transcript', force: true }, { kind: 'terms', force: mode === 'all' }, { kind: 'attTerms', force: mode === 'all' }]
}

export function stepText(s: RecordStep): string {
  switch (s.kind) {
    case 'transcript': return 'the transcript'
    case 'terms': return 'the term list'
    case 'term': return `the courses of ${s.name}`
    case 'sheet': return `the mark sheet of ${s.label}`
    case 'attTerms': return 'the attendance term list'
    case 'attendance': return `the attendance of ${s.label}`
  }
}

// ---- steps -------------------------------------------------------------------------------------

type Outcome = { fatal: FapError } | { error: string } | { added: RecordStep[] }

const opts = (force: boolean) => ({ force, priority: 'user' as const })
const merge = (fn: (r: RecordStore) => RecordStore) => update('grades.record', (old) => ({ ...fn({ ...EMPTY_RECORD, ...old }), lastSync: Date.now() }))

/** Stores a term's course list and returns the sheet steps it needs. */
async function storeTerm(id: string, name: string, courses: CourseRef[], at: number, force: boolean): Promise<RecordStep[]> {
  let steps: RecordStep[] = []
  await merge((r) => {
    const own = courses.filter((c) => !c.termId || c.termId === id)
    steps = [...sheetSteps(r, { id, name }, own, force), ...attendanceSteps(r, { id, name }, own, force)]
    return { ...r, terms: { ...r.terms, [id]: { id, name, readAt: at, courses: own, fingerprint: fingerprint(r.transcript, name) } } }
  })
  return steps
}

async function runStep(step: RecordStep, mode: RecordMode, doc: () => Document | null, planned: readonly RecordStep[] = []): Promise<Outcome> {
  const force = mode === 'all' || mode === 'term'
  switch (step.kind) {
    case 'transcript': {
      const r = await readSource<Transcript>(GRADES_TRANSCRIPT, {}, opts(step.force))
      if (!r.ok) return FATAL.has(r.error.kind) ? { fatal: r.error } : { error: errorText(r.error) }
      const page = doc()
      const student = r.value.student ?? (page ? studentOf(page) : null)
      await merge((s) => ({ ...s, transcript: r.value, transcriptAt: r.fetchedAt, curriculum: r.value.curriculum ?? s.curriculum, student: student ?? s.student }))
      return { added: [] }
    }
    case 'terms': {
      const r = await readSource<TermCourses>(GRADES_TERM_COURSES, {}, opts(step.force))
      if (!r.ok) return FATAL.has(r.error.kind) ? { fatal: r.error } : { error: errorText(r.error) }
      const tc = r.value
      let added: RecordStep[] = []
      await merge((s) => {
        const terms = { ...s.terms }
        for (const t of tc.terms) terms[t.id] = terms[t.id] ? { ...terms[t.id]!, name: t.name } : { id: t.id, name: t.name, readAt: null, courses: [], fingerprint: null }
        const next = { ...s, termOrder: tc.terms.map((t) => t.id), terms, currentTermId: tc.selectedTermId }
        added = tc.terms
          .filter((t) => t.id !== tc.selectedTermId && termNeedsRead(next, t.id, t.name, tc.selectedTermId, force))
          .map((t) => ({ kind: 'term' as const, termId: t.id, name: t.name, force }))
        return next
      })
      // The page without a term already lists the current term's courses: no extra request for it.
      const current = tc.terms.find((t) => t.id === tc.selectedTermId)
      const sheets = current ? await storeTerm(current.id, current.name, tc.courses, r.fetchedAt, force) : []
      return { added: [...sheets, ...added] }
    }
    case 'term': {
      const r = await readSource<TermCourses>(GRADES_TERM_COURSES, { termId: step.termId }, opts(step.force))
      if (!r.ok) return FATAL.has(r.error.kind) ? { fatal: r.error } : { error: errorText(r.error) }
      return { added: await storeTerm(step.termId, step.name, r.value.courses, r.fetchedAt, force) }
    }
    case 'sheet': {
      const r = await readSource<MarkSheet>(GRADES_MARK_SHEET, { termId: step.termId, courseId: step.courseId }, opts(step.force))
      if (!r.ok) return FATAL.has(r.error.kind) ? { fatal: r.error } : { error: errorText(r.error) }
      await merge((s) => {
        const term = s.terms[step.termId]
        const ref = term?.courses.find((c) => c.id === step.courseId)
        const row = rowOf(s.transcript, ref?.code ?? r.value.header?.code ?? null, term?.name ?? '')
        return { ...s, sheets: { ...s.sheets, [step.courseId]: { termId: step.termId, courseId: step.courseId, sheet: r.value, fetchedAt: r.fetchedAt, rowKey: row ? rowKey(row) : null } } }
      })
      return { added: [] }
    }
    case 'attTerms': {
      const r = await readSource<AttendancePage>(GRADES_ATTENDANCE_TERM, {}, opts(step.force))
      if (!r.ok) return FATAL.has(r.error.kind) ? { fatal: r.error } : { error: errorText(r.error) }
      let added: RecordStep[] = []
      await merge((s) => {
        const next = { ...s, attendanceTerms: r.value.terms.map((t) => t.id) }
        // Terms this job reads again plan their own attendance; the others are planned here.
        const reread = new Set(planned.flatMap((p) => (p.kind === 'term' ? [p.termId] : [])))
        const already = new Set(planned.flatMap((p) => (p.kind === 'attendance' ? [p.courseId] : [])))
        added = next.attendanceTerms.flatMap((id) => {
          const t = next.terms[id]
          return t?.readAt && !reread.has(id) ? attendanceSteps(next, t, t.courses, force) : []
        }).filter((p) => p.kind === 'attendance' && !already.has(p.courseId))
        return next
      })
      return { added }
    }
    case 'attendance': {
      const r = await readSource<AttendanceSheet>(GRADES_ATTENDANCE, { termId: step.termId, courseId: step.courseId }, opts(step.force))
      if (!r.ok) return FATAL.has(r.error.kind) ? { fatal: r.error } : { error: errorText(r.error) }
      await merge((s) => ({ ...s, attendance: { ...s.attendance, [step.courseId]: { termId: step.termId, courseId: step.courseId, sheet: r.value, fetchedAt: r.fetchedAt } } }))
      return { added: [] }
    }
  }
}

// ---- engine ------------------------------------------------------------------------------------

export type RecordOutcome = { ok: true; job: RecordJob } | { ok: false; error: FapError; job: RecordJob } | { ok: false; busy: true }

/** Writes the running job without losing a Cancel another tab stored meanwhile. */
const save = (job: RecordJob) => update('grades.record.job', (old) => ({ ...job, paused: job.paused || !!old?.paused }))

export class RecordEngine {
  private job: RecordJob | null = null
  private cancelled = false
  private listeners = new Set<() => void>()

  constructor(readonly runner: string = crypto.randomUUID(), private doc: () => Document | null = () => (typeof document === 'undefined' ? null : document)) {}

  get running(): boolean { return this.job !== null }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  private notify(): void { for (const l of this.listeners) l() }

  /** Starts a new job unless one runs here or in another live tab. */
  async start(mode: RecordMode, scope?: Parameters<typeof initialSteps>[1], now = Date.now()): Promise<RecordOutcome> {
    if (this.job) return { ok: false, busy: true }
    const stored = await read('grades.record.job')
    if (stored?.runner && stored.runner !== this.runner && !stored.paused && now - stored.beatAt < LEASE_MS) return { ok: false, busy: true }
    const job: RecordJob = { mode, steps: initialSteps(mode, scope), next: 0, failed: [], startedAt: now, runner: this.runner, beatAt: now, paused: false }
    await write('grades.record.job', job)
    return this.run(job)
  }

  /**
   * Continues the stored job (R14.4). `auto` (the Record view opening) does not resume a cancelled job;
   * a job another live tab holds is never taken over.
   */
  async resume({ auto = false } = {}, now = Date.now()): Promise<RecordOutcome | null> {
    if (this.job) return null
    const job = await read('grades.record.job')
    if (!job || (auto && job.paused)) return null
    if (job.runner && job.runner !== this.runner && !job.paused && now - job.beatAt < LEASE_MS) return null
    const claimed: RecordJob = { ...job, runner: this.runner, beatAt: now, paused: false }
    await write('grades.record.job', claimed)
    return this.run(claimed)
  }

  /** Stops after the current request; the job stays stored for Resume (R14.5). Works for a job another tab runs. */
  async cancel(): Promise<void> {
    if (this.job) this.cancelled = true
    const job = await read('grades.record.job')
    if (job) await write('grades.record.job', { ...job, paused: true })
    this.notify()
  }

  /** Forgets a stored job that is not running anywhere. */
  async discard(): Promise<void> {
    if (!this.job) await remove('grades.record.job')
    this.notify()
  }

  /** Gives up the lease so the next page load resumes at once (wired to pagehide). */
  release(): void {
    if (!this.job) return
    void write('grades.record.job', { ...this.job, runner: undefined, beatAt: 0 })
    this.job = null
  }

  private async stop(job: RecordJob, patch: Partial<RecordJob>): Promise<void> {
    await write('grades.record.job', { ...job, ...patch, runner: undefined, beatAt: 0 })
    if (this.job === job) this.job = null
    this.notify()
  }

  private async run(job: RecordJob): Promise<RecordOutcome> {
    this.job = job
    this.cancelled = false
    this.notify()
    const beat = setInterval(() => {
      if (this.job !== job) return
      job.beatAt = Date.now()
      void save(job)
    }, BEAT_MS)
    try {
      while (job.next < job.steps.length) {
        let r: Outcome
        try {
          r = await runStep(job.steps[job.next]!, job.mode, this.doc, job.steps.slice(job.next + 1))
        } catch (e) {
          r = { error: e instanceof Error ? e.message : String(e) }
        }
        if (this.job !== job) return { ok: true, job } // released mid-step
        const stored = await read('grades.record.job')
        if (stored?.runner !== this.runner || stored.startedAt !== job.startedAt) { this.job = null; this.notify(); return { ok: true, job } } // replaced elsewhere
        if ('fatal' in r) { await this.stop(job, {}); return { ok: false, error: r.fatal, job } }
        if ('error' in r) job.failed.push({ index: job.next, error: r.error })
        else job.steps.push(...r.added)
        job.next++
        if (stored.paused || this.cancelled) { await this.stop(job, { paused: true }); return { ok: true, job } }
        job.beatAt = Date.now()
        if (job.next < job.steps.length) await save(job)
      }
      // Finished: a job with failed steps is kept so its list stays visible; Update record reads what is missing.
      if (job.failed.length) await this.stop(job, { paused: true })
      else { await remove('grades.record.job'); this.job = null; this.notify() }
      return { ok: true, job }
    } finally {
      clearInterval(beat)
    }
  }
}

export const recordEngine = new RecordEngine()

/** The stored record and job, following every change (partial results while a job runs, R14.5). */
export function watchRecord(cb: (store: RecordStore | null, job: RecordJob | null) => void): () => void {
  let store: RecordStore | null = null
  let job: RecordJob | null = null
  let live = true
  void Promise.all([read('grades.record'), read('grades.record.job')]).then(([s, j]) => { if (!live) return; store = s; job = j; cb(store, job) })
  const a = subscribe('grades.record', (s) => { store = s; cb(store, job) })
  const b = subscribe('grades.record.job', (j) => { job = j; cb(store, job) })
  return () => { live = false; a(); b() }
}
