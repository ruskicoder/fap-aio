// @vitest-environment happy-dom
// GRD-5.1: Grades Courses and GPA views (grades R8.1 to R8.5, R12.1, R2.4, R1.2, R7.3 to R7.6, R11).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import type { SubjectRule } from '../src/shared/data/schemas'

const requests: string[] = []
const pages = new Map<string, string>()
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => {
    requests.push(route)
    const html = pages.get(route)
    if (!html) return { ok: false, error: { kind: 'network' } }
    return { ok: true, value: new DOMParser().parseFromString(html, 'text/html'), fetchedAt: Date.now() }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { registerGradeSources } = await import('../src/features/grades/sources')
const { coursesState, loadCourses, resetCourses } = await import('../src/features/grades/courses')
const { CoursesView } = await import('../src/features/grades/views/CoursesView')
const { GpaView } = await import('../src/features/grades/views/GpaView')
const { setSettings } = await import('../src/shared/settings')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8')).subjects as Record<string, SubjectRule>
const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as { cases: { id: string; html: string }[] }
const sheet = (id: string, code: string) => `<div id="grade-report"><div class="card fap-result-card"><h5 class="fap-result-card__title">X <span class="fap-result-card__code">${code}</span></h5>${golden.cases.find((c) => c.id === id)!.html}</div></div>`
const COURSES: [string, string, string, string][] = [
  ['c1', 'Mathematics for Engineering (MAE101) (SE1)', 'in-progress-mae101', 'MAE101'],
  ['c2', 'Data structures (CSD201) (SE1)', 'fail-fe-below-4-csd201', 'CSD201'],
  ['c3', 'Programming fundamentals (PRF192) (SE1)', 'pass-prf192', 'PRF192'],
]
const termPage = `<div class="content-page"><select id="grade-report-term"><option value="t1" selected>Fall2026</option></select><select id="grade-report-course">${COURSES.map(([id, label]) => `<option value="${id}" data-report-term-id="t1">${label}</option>`).join('')}</select></div>`
// Scripts, stylesheets and images would make happy-dom try to load them.
const stripScripts = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')

async function render(node: JSX.Element) {
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  await act(async () => { createRoot(el).render(node) })
  await wait(10); await wait(10)
  return el
}

let c: FakeChrome
beforeEach(() => {
  c = installFakeChrome()
  resetCourses()
  requests.length = 0
  pages.clear()
  registerGradeSources()
  pages.set('/Report/Grade', termPage)
  for (const [id, , gid, code] of COURSES) pages.set(`/Report/Grade?termId=t1&courseId=${id}`, sheet(gid, code))
  pages.set('/Report/Transcript', stripScripts(readFileSync('test/fixtures/en/transcript.html', 'utf8')))
  c.runtime.onMessage.addListener((m: { type: string; codes?: string[] }, _s: unknown, respond: (r: unknown) => void) => {
    if (m.type !== 'data.rules') return false
    respond({ ok: true, value: { dataVersion: 1, scrapedAt: '2026-10-10T16:03:12.457Z', rules: {}, subjects: Object.fromEntries((m.codes ?? []).map((k) => [k, rules[k] ?? null])) } })
    return false
  })
})

describe('course loading', () => {
  it('reads the term then each sheet one at a time, failed first, and reuses fresh caches', async () => {
    await loadCourses()
    expect(requests).toEqual(['/Report/Grade', ...COURSES.map(([id]) => `/Report/Grade?termId=t1&courseId=${id}`)])
    expect(coursesState().rows.map((r) => [r.ref.code, r.prediction?.status])).toEqual([['CSD201', 'failed'], ['MAE101', 'in-progress'], ['PRF192', 'passed']])
    expect(coursesState().term).toBe('Fall2026')
    requests.length = 0
    await loadCourses()
    expect(requests).toEqual([])
  })

  it('derives GPA goal targets and keeps the higher of tier and derived target', async () => {
    await act(async () => { await setSettings({ 'grades.gpaGoal': 9.5 }) })
    await render(<GpaView />) // reads and caches the transcript
    await loadCourses()
    const mae = coursesState().rows.find((r) => r.ref.code === 'MAE101')!
    expect(mae.target).toMatchObject({ tier: 8 })
    expect(mae.target!.derived).not.toBeNull()
    expect(mae.target!.effective).toBe(Math.max(8, mae.target!.derived!))
  })
})

describe('Courses view', () => {
  it('shows each course with status, average, goal and needs, and a detail with the FLM link', async () => {
    const el = await render(<CoursesView />)
    await wait(20)
    const cards = [...el.querySelectorAll('[data-course]')]
    expect(cards.map((x) => x.getAttribute('data-course'))).toEqual(['c2', 'c1', 'c3'])
    const mae = el.querySelector('[data-course="c1"]')!
    expect(mae.textContent).toContain('MAE101 · Mathematics for Engineering')
    expect(mae.textContent).toContain('In progress')
    expect(mae.textContent).toContain('Average: 7.0')
    expect(mae.textContent).toContain('Goal: Good 8')
    expect(mae.textContent).toMatch(/Needs: .*Final Exam \d\.\d/)
    expect(el.querySelector('[data-course="c2"]')!.textContent).toContain('Failing')
    await act(async () => { mae.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click() })
    expect(mae.querySelector('table caption')!.textContent).toBe('Components of MAE101')
    expect(mae.querySelector<HTMLAnchorElement>('a')!.href).toBe(`https://flm.fpt.edu.vn/gui/role/student/SyllabusDetails?sylID=${rules.MAE101!.sylId}`)
    expect(el.textContent).toContain('FLM rubric of 10 Oct 2026, data version 1')
  })

  it('says when the term has no courses and offers to read them', async () => {
    pages.set('/Report/Grade', '<div class="content-page"><select id="grade-report-term"><option value="t1" selected>Fall2026</option></select><select id="grade-report-course"></select></div>')
    const el = await render(<CoursesView />)
    expect(el.textContent).toContain('No courses this term yet')
    expect([...el.querySelectorAll('button')].map((b) => b.textContent)).toContain('Read courses from FAP')
  })
})

describe('GPA view', () => {
  it('shows cumulative and per-semester GPA, the goal state, replaced subjects and the export', async () => {
    const el = await render(<GpaView />)
    expect(el.textContent).toContain('cumulative GPA')
    expect(el.querySelectorAll('tbody tr').length).toBeGreaterThan(1)
    expect(el.textContent).toContain('No GPA goal set.')
    expect(el.textContent).toContain('Replaced or extra subjects')
    expect(el.textContent).toContain('Information only: they do not count toward GPA.')
    await act(async () => { await setSettings({ 'grades.gpaGoal': 1 }) })
    await wait(10)
    expect(el.textContent).toContain('GPA goal 1.00 is reachable.')
    await act(async () => { await setSettings({ 'grades.gpaGoal': 10 }) })
    await wait(10)
    expect(el.textContent).toMatch(/GPA goal 10\.00 is not reachable\.The highest reachable GPA is \d\.\d\d\./)
    const url = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: url, revokeObjectURL: vi.fn() })
    await act(async () => { [...el.querySelectorAll('button')].find((b) => b.textContent === 'Export CSV')!.click() })
    expect(url).toHaveBeenCalledOnce()
  })
})
