// @vitest-environment happy-dom
// GRD-4.2: GradeInline under the mark sheet (grades R6.1 to R6.4, R4.9, R4.10), with a partial swap.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { readFileSync } from 'node:fs'
import axe from 'axe-core'
import { installFakeChrome } from './helpers/fake-chrome'
import type { SubjectRule } from '../src/shared/data/schemas'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const { DEBOUNCE_MS, HOST_ID, mountGradeInline } = await import('../src/features/grades/inline/GradeInline')
const { read } = await import('../src/shared/storage/catalog')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8')).subjects as Record<string, SubjectRule>
const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as { cases: { id: string; code: string; html: string }[] }
const lookup = async (codes: string[]) => ({ ok: true as const, value: { dataVersion: 1, scrapedAt: '', rules: {} as never, subjects: Object.fromEntries(codes.map((c) => [c, rules[c] ?? null])) } })

/** FAP's #grade-report partial around a golden mark sheet. */
function partial(id: string, courseId: string): string {
  const c = golden.cases.find((x) => x.id === id)!
  return `<select id="grade-report-course"><option value="${courseId}" selected>x (${c.code}) (G1)</option></select>
    <div class="card fap-result-card"><div class="card-header"><h5 class="fap-result-card__title">Course <span class="fap-result-card__code">${c.code}</span></h5></div>
    <div class="card-body">${c.html}</div></div>`
}

async function mount(id: string, courseId = 'c1') {
  document.body.innerHTML = `<div class="content-page"><div id="grade-report">${partial(id, courseId)}</div></div>`
  let m!: ReturnType<typeof mountGradeInline>
  await act(async () => { m = mountGradeInline(document, lookup) })
  await wait(10)
  const shadow = m!.host.shadowRoot!
  const chip = (t: string) => [...shadow.querySelectorAll<HTMLButtonElement>('[aria-label="Goal for this course"] button')].find((b) => b.textContent === t)!
  return { m: m!, shadow, chip }
}

describe('GradeInline', () => {
  beforeEach(() => { installFakeChrome() })

  it('sits after the mark sheet card with status, average and the scores for the goal, and saves the goal', async () => {
    const { m, shadow, chip } = await mount('in-progress-mae101')
    const cells = document.querySelector('.fap-result-card table')!.innerHTML
    expect(m.host.previousElementSibling?.classList.contains('fap-result-card')).toBe(true)
    expect(shadow.textContent).toContain('In progress')
    expect(shadow.textContent).toContain('Average so far 7.0 (30% graded)')
    expect(chip('Good 8').getAttribute('aria-pressed')).toBe('true')
    expect(shadow.textContent).toContain('To reach Good, score at least:')
    await act(async () => { chip('Pass 5').click() })
    await wait(10)
    expect((await read('grades.settings'))!.courseGoals).toEqual({ c1: 'pass' })
    expect(chip('Pass 5').getAttribute('aria-pressed')).toBe('true')
    expect([...shadow.querySelectorAll('li')].map((li) => li.textContent)).toContain('Final Exam 4.1')
    await act(async () => { chip('Good 8').click() })
    await wait(10)
    expect((await read('grades.settings'))!.courseGoals).toEqual({})
    expect(document.querySelector('.fap-result-card table')!.innerHTML).toBe(cells)
  })

  it('follows a partial swap after the debounce and leaves FAP cells alone', async () => {
    const { m, shadow } = await mount('in-progress-mae101')
    const report = document.getElementById('grade-report')!
    report.innerHTML = partial('fail-fe-below-4-csd201', 'c2')
    const cells = report.querySelector('table')!.innerHTML
    await wait(DEBOUNCE_MS + 50)
    expect(document.getElementById(HOST_ID)).toBe(m.host)
    expect(m.host.previousElementSibling?.classList.contains('fap-result-card')).toBe(true)
    expect(shadow.textContent).toContain('Failing')
    expect(shadow.querySelector('[aria-label="Failed criteria"]')!.textContent).toContain('Final exam: 3.5 does not meet >= 4')
    expect(shadow.textContent).toContain('Course average 7.0')
    expect(report.querySelector('table')!.innerHTML).toBe(cells)
    m.stop()
  })

  it('reports unscored courses, MOOC bonus assumptions and a changed layout', async () => {
    let { shadow } = await mount('unscored-lab211')
    expect(shadow.textContent).toContain("Not scored: FAP's status decides")
    ;({ shadow } = await mount('bonus-pmg201c'))
    expect(shadow.textContent).toContain('Passed')
    document.body.innerHTML = '<div id="grade-report"><div class="card"><p>changed</p></div></div>'
    let m!: ReturnType<typeof mountGradeInline>
    await act(async () => { m = mountGradeInline(document, lookup) })
    await wait(10)
    expect(m!.host.shadowRoot!.textContent).toContain('could not read this mark sheet')
  })

  it('passes axe', async () => {
    const { m } = await mount('in-progress-mae101')
    const r = await axe.run(m.host, { rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } }, resultTypes: ['violations'] })
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
})
