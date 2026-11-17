// @vitest-environment happy-dom
// GRD-5.3: What-if simulator and target planner (grades R9.1 to R9.4, R10.1 to R10.3).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'
import type { SubjectRule } from '../src/shared/data/schemas'
import type { MarkSheetRow, TranscriptRow } from '../src/features/grades/types'

const pages = new Map<string, string>()
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => {
    const html = pages.get(route)
    if (!html) return { ok: false, error: { kind: 'network' } }
    return { ok: true, value: new DOMParser().parseFromString(html, 'text/html'), fetchedAt: Date.now() }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { averageWithMarks, defaultRemaining, partKey, planTarget, remainingParts, simulate } = await import('../src/features/grades/engine/whatif')
const { courseModel } = await import('../src/features/grades/engine/course-model')
const { computeGpa } = await import('../src/features/grades/engine/gpa')
const { registerGradeSources } = await import('../src/features/grades/sources')
const { registerInfoSources } = await import('../src/features/info/sources')
const { resetCourses } = await import('../src/features/grades/courses')
const { WhatIfView } = await import('../src/features/grades/views/WhatIfView')
const { PlannerView } = await import('../src/features/grades/views/PlannerView')
const { read } = await import('../src/shared/storage/catalog')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8')).subjects as Record<string, SubjectRule>
const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as { cases: { id: string; rows: MarkSheetRow[] }[] }
const stripScripts = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')

const row = (semester: string, code: string, credits: number, grade: number | null, status: TranscriptRow['status']): TranscriptRow =>
  ({ id: `${semester}|${code}`, term: null, semester, code, name: code, prerequisites: null, replaced: null, credits, grade, status })
const ROWS = [
  row('Spring2026', 'AAA101', 3, 8, 'passed'),
  row('Spring2026', 'BBB101', 3, 6, 'passed'),
  row('Fall2026', 'CCC201', 3, null, 'in-progress'),
  row('Fall2026', 'DDD201', 2, null, 'in-progress'),
  row('Fall2026', 'VOV114', 1, null, 'in-progress'),
]

describe('simulate', () => {
  it('recompute term and cumulative GPA from expected averages and future courses, without touching the input', () => {
    const before = JSON.stringify(ROWS)
    const s = simulate({ rows: ROWS, nonGpa: ['VOV'], expected: { 'Fall2026|CCC201': { average: 9, failed: false }, 'Fall2026|DDD201': { average: 7.04, failed: false } }, hypothetical: [{ credits: 3, average: 10 }] })
    expect(s.term).toEqual({ name: 'Fall2026', gpa: (9 * 3 + 7 * 2) / 5, credits: 5 })
    expect(s.cumulative.credits).toBe(14)
    expect(s.cumulative.gpa).toBeCloseTo((24 + 18 + 27 + 14 + 30) / 14, 10)
    expect(JSON.stringify(ROWS)).toBe(before)
  })

  it('leave courses without input in progress and do not count failing ones', () => {
    const s = simulate({ rows: ROWS, nonGpa: [], expected: { 'Fall2026|CCC201': { average: 4.9, failed: false }, 'Fall2026|DDD201': { average: 9, failed: true } }, hypothetical: [] })
    expect(s.failing).toEqual(['Fall2026|CCC201', 'Fall2026|DDD201'])
    expect(s.term.gpa).toBeNull()
    expect(s.cumulative).toEqual({ gpa: 7, credits: 6 })
  })
})

describe('component marks', () => {
  const c = golden.cases.find((x) => x.id === 'in-progress-mae101')!
  const model = courseModel(rules.MAE101!, c.rows)

  it('list the remaining components and give the course average once all are filled', () => {
    const parts = remainingParts(model)
    expect(parts.length).toBeGreaterThan(0)
    const all = (v: number) => Object.fromEntries(parts.map((p) => [partKey(p.index, p.part), v]))
    expect(averageWithMarks(model, { ...all(8), [partKey(parts[0]!.index, parts[0]!.part)]: undefined })).toBeNull()
    const high = averageWithMarks(model, all(10))!
    const low = averageWithMarks(model, all(8))!
    expect(high.average).toBeGreaterThan(low.average)
    expect(high.failed).toBe(false)
    const fe = parts.find((p) => /final/i.test(p.kind) || /final|FE/i.test(p.label))
    expect(fe).toBeDefined()
    expect(averageWithMarks(model, { ...all(10), [partKey(fe!.index, fe!.part)]: 3 })!.failed).toBe(true)
  })
})

describe('planTarget and default credits', () => {
  it('give the needed average, or unreachable with the highest reachable GPA', () => {
    const done = { credits: 100, points: 750 }
    expect(planTarget({ target: 8, done, remaining: 50 }).needed).toBeCloseTo(9, 10)
    const u = planTarget({ target: 9, done, remaining: 20 })
    expect(u.reachable).toBe(false)
    expect(u.needed).toBeCloseTo(16.5, 10)
    expect(u.highest).toBeCloseTo(950 / 120, 10)
    expect(planTarget({ target: 7, done, remaining: 0 })).toMatchObject({ needed: null, reachable: true })
  })

  it('default to curriculum credits not passed, minus the non-GPA list', () => {
    const cur = [{ code: 'AAA101', credits: 3 }, { code: 'CCC201', credits: null }, { code: 'EEE301', credits: 4 }, { code: 'VOV114', credits: 1 }, { code: 'ZZZ999', credits: null }]
    expect(defaultRemaining(cur, ROWS, ['VOV'])).toEqual({ credits: 7, unknown: ['ZZZ999'] })
  })
})

async function render(node: JSX.Element) {
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  await act(async () => { createRoot(el).render(node) })
  await wait(10); await wait(10)
  return el
}
const type = async (input: HTMLInputElement, v: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click() }) }
const byText = (root: Element, sel: string, text: string) => [...root.querySelectorAll(sel)].find((e) => e.textContent?.trim() === text)!

describe('What-if and Planner views', () => {
  let transcriptRows: TranscriptRow[] = []
  beforeEach(async () => {
    const c = installFakeChrome()
    resetCourses()
    pages.clear()
    registerGradeSources()
    registerInfoSources()
    pages.set('/Report/Transcript', stripScripts(readFileSync('test/fixtures/en/transcript.html', 'utf8')))
    pages.set('/Report/Grade', '<div class="content-page"><select id="grade-report-term"></select><select id="grade-report-course"></select></div>')
    c.runtime.onMessage.addListener((m: { type: string }, _s: unknown, respond: (r: unknown) => void) => {
      if (m.type !== 'data.rules') return false
      respond({ ok: true, value: { dataVersion: 1, scrapedAt: '', rules: {}, subjects: {} } })
      return false
    })
    const { read: readSource } = await import('../src/content/fap/registry')
    const t = await readSource<{ rows: TranscriptRow[] }>('grades.transcript', {}, {})
    transcriptRows = t.ok ? t.value.rows : []
  })

  it('What-if: an expected average moves the GPAs at once, future courses add up, Clear all resets, nothing is stored', async () => {
    const el = await render(<WhatIfView />)
    const status = () => el.querySelector('[role="status"]')!.textContent!
    const first = status()
    const inputs = [...el.querySelectorAll<HTMLInputElement>('input[id^="whatif-"]')]
    expect(inputs.map((i) => i.labels?.[0]?.textContent)).toEqual(inputs.map(() => 'Expected average'))
    expect(inputs.length).toBe(transcriptRows.filter((r) => r.status === 'in-progress' && r.credits > 0).length)
    await type(inputs[0]!, '9.5')
    expect(status()).not.toBe(first)
    await type(inputs[1]!, '11')
    expect(el.textContent).toContain('Enter 0 to 10.')
    await click(byText(el, 'button', 'Add a future course'))
    const avg = el.querySelector<HTMLInputElement>('li input[min="0"][max="10"][step="0.1"]:not([id])')!
    const beforeFuture = status()
    await type(avg, '10')
    expect(status()).not.toBe(beforeFuture)
    const settingsBefore = await read('settings')
    await click(byText(el, 'button', 'Clear all'))
    expect(status()).toBe(first)
    expect(el.querySelectorAll('input[id^="whatif-"]')[0]).toHaveProperty('value', '')
    expect(byText(el, 'button', 'Clear all').hasAttribute('disabled')).toBe(true)
    expect(await read('settings')).toEqual(settingsBefore)
  })

  it('Planner: defaults the credits from the curriculum, shows the needed average and the unreachable case', async () => {
    pages.set('/Curriculum', '<table class="table"><thead><tr><th>No</th><th>SubjectCode</th><th>Subject Name</th><th>Term</th></tr></thead><tbody><tr><td>1</td><td>NEW101</td><td>New</td><td>9</td></tr></tbody></table>')
    const el = await render(<PlannerView />)
    await wait(20)
    const [target, credits] = [...el.querySelectorAll<HTMLInputElement>('input[type="number"]')]
    const g = computeGpa({ rows: transcriptRows, nonGpa: [] })
    expect(el.textContent).toMatch(/From your curriculum|could not be read/)
    await type(credits!, '10')
    await type(target!, '9.99')
    expect(el.querySelector('[role="status"]')!.textContent).toContain('is not reachable')
    expect(el.querySelector('[role="status"]')!.textContent).toContain('The highest reachable GPA is')
    await type(credits!, '300')
    await type(target!, ((g.cumulative ?? 7) + 0.3).toFixed(2))
    expect(el.querySelector('[role="status"]')!.textContent).toMatch(/You need an average of \d+\.\d\d over 300 credits/)
    await type(target!, '1')
    expect(el.querySelector('[role="status"]')!.textContent).toContain('Passing every remaining course (5.0 or more) is enough')
  })
})
