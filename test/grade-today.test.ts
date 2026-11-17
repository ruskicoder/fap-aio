// GRD-5.2: grade Today provider and inbox alerts (panel-ux R3.1, R6.1).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMParser as LinkedomParser } from 'linkedom'
import { readFileSync } from 'node:fs'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import type { SubjectRule } from '../src/shared/data/schemas'

const requests: string[] = []
const pages = new Map<string, string>()
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => {
    requests.push(route)
    const html = pages.get(route)
    return html ? { ok: true, value: new LinkedomParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html'), fetchedAt: Date.now() } : { ok: false, error: { kind: 'network' } }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { registerGradeSources } = await import('../src/features/grades/sources')
const { cachedRows, loadCourses, resetCourses } = await import('../src/features/grades/courses')
const { registerGradeToday, riskItems } = await import('../src/features/grades/today')
const { clearTodayProviders, todayProviders } = await import('../src/content/panel/today/providers')
const { read } = await import('../src/shared/storage/catalog')

const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8')).subjects as Record<string, SubjectRule>
const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as { cases: { id: string; html: string }[] }
const COURSES: [string, string, string, string][] = [
  ['c1', 'Maths (MAE101) (SE1)', 'in-progress-mae101', 'MAE101'],
  ['c2', 'Data structures (CSD201) (SE1)', 'fail-fe-below-4-csd201', 'CSD201'],
  ['c3', 'Programming (PRF192) (SE1)', 'pass-prf192', 'PRF192'],
]
const tick = () => new Promise((r) => setTimeout(r, 0))

let c: FakeChrome
beforeEach(() => {
  c = installFakeChrome()
  resetCourses()
  clearTodayProviders()
  requests.length = 0
  registerGradeSources()
  pages.set('/Report/Grade', `<div class="content-page"><select id="grade-report-term"><option value="t1" selected>Fall2026</option></select><select id="grade-report-course">${COURSES.map(([id, l]) => `<option value="${id}" data-report-term-id="t1">${l}</option>`).join('')}</select></div>`)
  for (const [id, , gid, code] of COURSES) pages.set(`/Report/Grade?termId=t1&courseId=${id}`, `<div class="card"><h5 class="fap-result-card__title">X <span class="fap-result-card__code">${code}</span></h5>${golden.cases.find((x) => x.id === gid)!.html}</div>`)
  c.runtime.onMessage.addListener((m: { type: string; codes?: string[] }, _s: unknown, respond: (r: unknown) => void) => {
    if (m.type === 'data.rules') respond({ ok: true, value: { dataVersion: 1, scrapedAt: '', rules: {}, subjects: Object.fromEntries((m.codes ?? []).map((k) => [k, rules[k] ?? null])) } })
    else respond({ ok: true, value: { shown: false } })
    return false
  })
  registerGradeToday()
})

describe('grade Today provider', () => {
  it('lists failing courses first, then courses below their goal, with deep links', async () => {
    await loadCourses()
    const items = riskItems(await cachedRows())
    expect(items.map((i) => [i.title, i.tone, i.when])).toEqual([
      ['CSD201 · Data structures', 'danger', 'failing'],
      ['PRF192 · Programming', 'warning', 'below goal'],
    ])
    expect(items[0]!.detail).toBe('Final exam: 3.5 does not meet >= 4')
    expect(items[1]!.detail).toBe('Good (8) is out of reach.')
    expect(items[0]!.link).toEqual({ tab: 'grades', sub: 'courses', params: { courseId: 'c2' } })
  })

  it('reads cached pages only, and is registered fifth as an attention section', async () => {
    await loadCourses()
    resetCourses()
    requests.length = 0
    const p = todayProviders().find((x) => x.id === 'gradeRisk')!
    expect([p.order, p.attention]).toEqual([5, true])
    expect((await p.items({ now: Date.now() })).length).toBe(2)
    expect(requests).toEqual([])
    expect(await p.syncedAt!()).toBeGreaterThan(0)
  })
})

describe('grade alerts', () => {
  it('push one alert per failure and per goal out of reach, once', async () => {
    await loadCourses()
    await tick(); await tick()
    const first = (await read('alerts'))!.items
    expect(first.map((a) => [a.kind, a.title]).sort()).toEqual([['grade', 'CSD201 is failing'], ['grade', 'Good is out of reach in PRF192']])
    expect(first.find((a) => a.title === 'CSD201 is failing')!.link).toEqual({ tab: 'grades', sub: 'courses', params: { courseId: 'c2' } })
    await loadCourses({ force: true })
    await tick(); await tick()
    expect((await read('alerts'))!.items).toHaveLength(2)
  })
})
