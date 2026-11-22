// @vitest-environment happy-dom
// GRD-7.2: full academic record (grades R14.1 to R14.8): the resumable job on the fixture record, skips of
// unchanged terms, Cancel and Resume, a resume after a reload, the stop on a fatal error, partial results,
// and the Record view.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'

const fx = (n: string) => readFileSync(`test/fixtures/en/${n}`, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')
const requests: string[] = []
let onRequest: (route: string, n: number) => { ok: false; error: { kind: string } } | void = () => {}
let transcriptHtml = ''
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => {
    requests.push(route)
    const forced = onRequest(route, requests.length)
    if (forced) return forced
    const html = page(route)
    if (!html) return { ok: false, error: { kind: 'network', message: 'x' } }
    return { ok: true, value: new DOMParser().parseFromString(html, 'text/html'), fetchedAt: Date.now() }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))

const TERM_FIXTURES: Record<string, string> = { Fall2024: 'grade-term-fa24.html', Spring2026: 'grade-term-sp26.html', Summer2024: 'grade-term-su24.html', Summer2025: 'grade-term-su25.html' }
const gradeHtml = fx('grade.html')
const TERMS = [...new DOMParser().parseFromString(gradeHtml, 'text/html').querySelectorAll('#grade-report-term option')].map((o) => ({ id: o.getAttribute('value')!, name: o.textContent!.trim() }))
const sheetHtml = fx('grade-default.partial.html')
function page(route: string): string | null {
  const u = new URL(`https://fap.fpt.edu.vn${route}`)
  if (u.pathname === '/Report/Transcript') return transcriptHtml
  if (u.pathname === '/Report/Attendance') return u.searchParams.get('courseId') ? fx('attendance-set490.partial.html') : u.searchParams.get('termId') ? fx('attendance-term-su26.html') : fx('attendance.html')
  if (u.pathname !== '/Report/Grade') return null
  if (u.searchParams.get('courseId')) return sheetHtml
  const termId = u.searchParams.get('termId')
  if (!termId) return gradeHtml
  const t = TERMS.find((x) => x.id === termId)!
  const f = TERM_FIXTURES[t.name]
  return f ? fx(f) : `<div class="content-page"><select id="grade-report-term"><option value="${t.id}" selected>${t.name}</option></select><select id="grade-report-course"></select></div>`
}

const { registerGradeSources } = await import('../src/features/grades/sources')
const { RecordEngine, recordEngine, watchRecord, termNeedsRead, sheetSteps, fingerprint, EMPTY_RECORD } = await import('../src/features/grades/record')
const { recordTerms, components } = await import('../src/features/grades/record-model')
const { RecordView } = await import('../src/features/grades/views/RecordView')
const { read, write } = await import('../src/shared/storage/catalog')
import type { RecordStore } from '../src/features/grades/record'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const termReads = () => requests.filter((r) => /^\/Report\/Grade\?termId=[^&]+$/.test(r))
const sheetReads = () => requests.filter((r) => r.startsWith('/Report/Grade?') && r.includes('courseId='))
const attendanceReads = () => requests.filter((r) => r.startsWith('/Report/Attendance?') && r.includes('courseId='))

beforeEach(() => {
  installFakeChrome()
  registerGradeSources()
  requests.length = 0
  onRequest = () => {}
  transcriptHtml = fx('transcript.html')
})

describe('the record job', () => {
  it('reads the transcript, the term list, each other term, then each course sheet, and keeps partial results', async () => {
    let updates = 0
    const off = watchRecord(() => { updates++ })
    const r = await new RecordEngine('a').start('update')
    off()
    expect(r.ok).toBe(true)
    expect(requests.slice(0, 3)).toEqual(['/Report/Transcript', '/Report/Grade', '/Report/Attendance'])
    // The current term's courses come with the page without a term: 9 other terms are read once each.
    expect(termReads()).toHaveLength(TERMS.length - 1)
    const s = (await read('grades.record'))!
    const refs = Object.values(s.terms).flatMap((t) => t.courses)
    expect(sheetReads()).toHaveLength(refs.length)
    expect(new Set(sheetReads()).size).toBe(sheetReads().length)
    expect(Object.keys(s.sheets)).toHaveLength(refs.length)
    expect(updates).toBeGreaterThan(refs.length) // one store change per finished step
    expect(s.student).toEqual({ name: 'So Sriv Aamk', roll: 'IR821902' })
    expect(s.curriculum).toBe('OUV_BV_GN_21A')
    expect(await read('grades.record.job')).toBeNull()
    // Attendance (R16.6): only the terms the attendance page lists (Fall2026, Summer2026, Spring2026).
    expect(s.attendanceTerms).toHaveLength(3)
    const attCourses = s.attendanceTerms!.flatMap((id) => s.terms[id]?.courses ?? [])
    expect(attendanceReads()).toHaveLength(attCourses.length)
    expect(Object.keys(s.attendance).sort()).toEqual(attCourses.map((c) => c.id).sort())
    expect(s.attendance[attCourses[0]!.id]!.sheet.counts).toEqual({ attended: 4, absent: 0, notYet: 11, exempt: 0, unknown: 0, total: 15 })
  })

  it('lists every term newest first with transcript rows, sheets and FAP-only courses', async () => {
    await new RecordEngine('a').start('update')
    const terms = recordTerms((await read('grades.record'))!)
    expect(terms.map((t) => t.name)).toEqual(['Fall2026', 'Summer2026', 'Spring2026', 'Fall2025', 'Summer2025', 'Spring2025', 'Fall2024', 'Summer2024', 'Spring2024', 'Fall2023'])
    const fa26 = terms[0]!
    expect(fa26.courses.map((c) => c.code)).toEqual(['LMO352', 'ACT707', 'ELM405', 'RSE663', 'MRS083'])
    const elm = fa26.courses.find((c) => c.code === 'ELM405')!
    expect([elm.ref, elm.sheet, elm.status]).toEqual([null, null, 'In progress']) // no mark sheet on FAP
    const lmo = fa26.courses.find((c) => c.code === 'LMO352')!
    expect(lmo.sheet).not.toBeNull()
    expect(components(lmo.sheet!.sheet).length).toBeGreaterThan(0)
    // DLH783 failed in Fall2024 (on FAP's grade page) and passed in Summer2025 (on the transcript).
    expect(terms.find((t) => t.name === 'Fall2024')!.courses.map((c) => c.code)).toContain('DLH783')
    expect(terms.find((t) => t.name === 'Summer2025')!.courses.find((c) => c.code === 'DLH783')!.grade).toBe(8.8)
  })

  it('reads again only what changed on an ordinary update', async () => {
    await new RecordEngine('a').start('update')
    requests.length = 0
    await new RecordEngine('a').start('update')
    // Transcript again; the term list and the in-progress sheets come from fresh caches; no past term again.
    expect(requests).toEqual(['/Report/Transcript'])
    requests.length = 0
    transcriptHtml = transcriptHtml.replace(/(UVT027[\s\S]*?<span class="badge[^"]*">)\s*3\.8\s*</, '$1 4.8 <')
    await new RecordEngine('a').start('update')
    const fa24 = TERMS.find((t) => t.name === 'Fall2024')!
    expect(termReads()).toEqual([]) // the course list comes from its cache
    expect(sheetReads()).toHaveLength(1) // only UVT027, whose transcript row changed, is read again
    expect(sheetReads()[0]).toContain(`termId=${fa24.id}`)
  })

  it('plans with the rules of R14.6', () => {
    const t = { rows: [
      { id: 'Fall2024|AAA101', term: 1, semester: 'Fall2024', code: 'AAA101', name: 'A', prerequisites: null, replaced: null, credits: 3, grade: 8, status: 'passed' as const },
      { id: 'Fall2025|BBB101', term: 2, semester: 'Fall2025', code: 'BBB101', name: 'B', prerequisites: null, replaced: null, credits: 3, grade: null, status: 'in-progress' as const },
    ], replaced: [] }
    const s: RecordStore = { ...EMPTY_RECORD, transcript: t, terms: {
      t1: { id: 't1', name: 'Fall2024', readAt: 1, courses: [{ id: 'c1', termId: 't1', label: 'A (AAA101) (G)', code: 'AAA101' }], fingerprint: fingerprint(t, 'Fall2024') },
      t2: { id: 't2', name: 'Fall2025', readAt: 1, courses: [], fingerprint: fingerprint(t, 'Fall2025') },
    }, sheets: { c1: { termId: 't1', courseId: 'c1', sheet: { header: null, rows: [], summary: { latePenaltyPercent: null, bonus: null, average: 8, status: 'passed' } }, fetchedAt: 1, rowKey: 'AAA101:8:Passed' } } }
    expect(termNeedsRead(s, 't1', 'Fall2024', null, false)).toBe(false)
    expect(termNeedsRead(s, 't1', 'Fall2024', 't1', false)).toBe(true) // FAP's current term
    expect(termNeedsRead(s, 't1', 'Fall2024', null, true)).toBe(true)
    expect(termNeedsRead(s, 't2', 'Fall2025', null, false)).toBe(true) // a course in progress
    expect(termNeedsRead(s, 't9', 'Spring2026', null, false)).toBe(true) // new term
    expect(sheetSteps(s, { id: 't1', name: 'Fall2024' }, s.terms.t1!.courses, false)).toEqual([])
    const changed = { ...s, transcript: { ...t, rows: [{ ...t.rows[0]!, grade: 9 }, t.rows[1]!] } }
    expect(sheetSteps(changed, { id: 't1', name: 'Fall2024' }, s.terms.t1!.courses, false)).toEqual([{ kind: 'sheet', termId: 't1', courseId: 'c1', label: 'AAA101', force: true }])
  })

  it('stops on Cancel, keeps the job, and continues only from Resume', async () => {
    const e = new RecordEngine('a')
    onRequest = (_r, n) => { if (n === 6) void e.cancel() }
    await e.start('update')
    const job = (await read('grades.record.job'))!
    expect(job.paused).toBe(true)
    expect(job.next).toBe(6)
    expect(job.next).toBeLessThan(job.steps.length)
    onRequest = () => {}
    expect(await e.resume({ auto: true })).toBeNull() // opening the view does not resume a cancelled job
    const before = requests.length
    await e.resume()
    expect(await read('grades.record.job')).toBeNull()
    expect(new Set(requests.slice(before)).size).toBe(requests.length - before)
    expect(requests.slice(before).some((r) => requests.slice(0, before).includes(r))).toBe(false) // nothing read twice
  })

  it('resumes after a reload from the next unfinished step, and not while another live tab holds it', async () => {
    const a = new RecordEngine('a')
    onRequest = (_r, n) => { if (n === 4) a.release() } // the page unloads during the 4th request
    await a.start('update')
    onRequest = () => {}
    const stored = (await read('grades.record.job'))!
    expect(stored.runner).toBeUndefined()
    await write('grades.record.job', { ...stored, runner: 'other', beatAt: Date.now() })
    expect(await new RecordEngine('b').resume({ auto: true })).toBeNull() // held by a live tab
    await write('grades.record.job', { ...stored })
    await new RecordEngine('b').resume({ auto: true })
    expect(await read('grades.record.job')).toBeNull()
    // The interrupted step runs again, its page from the fresh registry cache: no page is requested twice.
    expect(new Set(requests).size).toBe(requests.length)
    const rec = (await read('grades.record'))!
    expect(Object.keys(rec.sheets)).toHaveLength(Object.values(rec.terms).flatMap((t) => t.courses).length)
  })

  it('stops on a challenge and keeps the job resumable; other errors fail only their step', async () => {
    onRequest = (_r, n) => (n === 5 ? { ok: false, error: { kind: 'challenge' } } : undefined)
    const r = await new RecordEngine('a').start('update')
    expect(r.ok).toBe(false)
    const job = (await read('grades.record.job'))!
    expect([job.next, job.paused, job.runner]).toEqual([4, false, undefined])
    let sheet = 0
    onRequest = (route) => (route.includes('courseId=') && ++sheet === 2 ? { ok: false, error: { kind: 'network' } } : undefined)
    await new RecordEngine('a').resume()
    const end = (await read('grades.record.job'))!
    expect(end.failed).toHaveLength(1)
    expect(end.next).toBe(end.steps.length)
    expect(end.paused).toBe(true) // kept so the failed list stays visible
  })
})

describe('the Record view', () => {
  it('shows terms newest first, progress while reading, and a course mark sheet on Details', async () => {
    let release: () => void = () => {}
    onRequest = (_r, n) => { if (n === 3) return void new Promise<void>((r) => { release = r }) }
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<RecordView />) })
    await wait(10)
    expect(el.textContent).toContain('No record read yet')
    const run = recordEngine.start('update')
    await wait(30)
    release()
    await act(async () => { await run })
    await wait(30)
    const sections = [...el.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label'))
    expect(sections[0]).toBe('Fall2026')
    expect(sections.at(-1)).toBe('Fall2023')
    expect(el.textContent).toMatch(/GPA \d\.\d\d over \d+ credits/)
    const details = el.querySelector('button[aria-label="Details for LMO352"]') as HTMLButtonElement
    await act(async () => { details.click() })
    expect(el.querySelector('caption')?.textContent).toBe('Mark sheet of LMO352')
    expect(el.textContent).toContain('Read this course again')
    const elm = el.querySelector('button[aria-label="Details for ELM405"]') as HTMLButtonElement
    await act(async () => { elm.click() })
    expect(el.textContent).toContain('No mark sheet on FAP for this course.')
    expect(el.textContent).toMatch(/Record updated/)
  })

  it('shows Resume and Discard for a stopped job', async () => {
    await write('grades.record', { ...EMPTY_RECORD })
    await write('grades.record.job', { mode: 'update', steps: [{ kind: 'transcript', force: true }, { kind: 'terms', force: false }], next: 1, failed: [], startedAt: 1, beatAt: 0, paused: true })
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<RecordView />) })
    await wait(20)
    expect(el.textContent).toContain('Reading stopped at 1 of 2 pages.')
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1')
    const discard = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Discard')!
    await act(async () => { discard.click() })
    await wait(20)
    expect(await read('grades.record.job')).toBeNull()
  })
})
