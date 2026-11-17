// @vitest-environment happy-dom
// INF-4.1: Subjects search, detail and learning path (info R2.1 to R2.6).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import axe from 'axe-core'
import { installFakeChrome } from './helpers/fake-chrome'
import type { CurriculumRow } from '../src/features/info/types'

const CURRICULUM = `<div class="content-page"><table class="fap-sheet"><thead><tr>${'<th>x</th>'.repeat(6)}</tr></thead><tbody>
  <tr><td>1</td><td>PRF192</td><td>Programming Fundamentals</td><td>1</td><td>None</td><td></td></tr>
  <tr><td>2</td><td>CSD201</td><td>Data Structures and Algorithms</td><td>3</td><td>PRF192</td><td></td></tr>
  <tr><td>3</td><td>ACC101</td><td>Nguyên lý kế toán</td><td>2</td><td>None</td><td></td></tr>
</tbody></table></div>`
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => route === '/Curriculum'
    ? { ok: true, value: new DOMParser().parseFromString(`<html><body>${CURRICULUM}</body></html>`, 'text/html'), fetchedAt: Date.now() }
    : { ok: false, error: { kind: 'network' } }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { ancestors, dependents, mergeHits, studyStatus } = await import('../src/features/info/subjects')
const { SubjectsView } = await import('../src/features/info/views/SubjectsView')
const { registerInfoSources } = await import('../src/features/info/sources')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8'))
const list = JSON.parse(readFileSync('data/flm/subject-list.json', 'utf8')).subjects

const row = (code: string, name: string, term: number, prerequisites: string[] = []): CurriculumRow => ({ no: 1, code, name, term, prerequisites, replacements: [], credits: null, detailUrl: null })

describe('subject helpers', () => {
  it('list matching curriculum subjects first, in term order, without diacritics, then other FLM hits', () => {
    const cur = [row('CSD201', 'Data Structures', 3), row('ACC101', 'Nguyên lý kế toán', 2)]
    expect(mergeHits('', [], cur).map((h) => h.code)).toEqual(['ACC101', 'CSD201'])
    expect(mergeHits('ke toan', [{ code: 'ACC101', name: 'Principles of Accounting', nameVi: null, credits: 3 }, { code: 'ACC302', name: 'Managerial Accounting', nameVi: null, credits: 3 }], cur).map((h) => [h.code, h.inCurriculum]))
      .toEqual([['ACC101', true], ['ACC302', false]])
  })

  it('read the transcript status', () => {
    const r = (code: string, status: 'passed' | 'in-progress' | 'not-passed') => ({ id: code, term: 1, semester: 'Fall2026', code, name: code, prerequisites: null, replaced: null, credits: 3, grade: null, status })
    expect([studyStatus('PRF192', [r('PRF192', 'passed')]), studyStatus('CSD201', [r('CSD201', 'in-progress')]), studyStatus('X', [])]).toEqual(['passed', 'in-progress', 'not-started'])
  })

  it('walk prerequisites to depth 5 with a cycle guard, and find direct dependents', async () => {
    const g: Record<string, string[]> = { A: ['B'], B: ['C', 'A'], C: ['D'], D: ['E'], E: ['F'], F: ['G'], G: [] }
    expect(await ancestors('A', async (codes) => Object.fromEntries(codes.map((c) => [c, g[c] ?? []])))).toEqual([['B'], ['C'], ['D'], ['E'], ['F']])
    expect(dependents('C', g)).toEqual(['B'])
  })
})

describe('Subjects view', () => {
  beforeEach(() => {
    const c = installFakeChrome()
    registerInfoSources()
    c.runtime.onMessage.addListener((m: { type: string; codes?: string[]; code?: string; q?: string }, _s: unknown, respond: (r: unknown) => void) => {
      if (m.type === 'data.rules') respond({ ok: true, value: { dataVersion: 1, scrapedAt: '', rules: {}, subjects: Object.fromEntries((m.codes ?? []).map((k) => [k, rules.subjects[k] ?? null])) } })
      else if (m.type === 'data.subject') {
        const r = rules.subjects[m.code!]
        respond({ ok: true, value: r ? { code: m.code, syllabusId: r.sylId, approvedDate: list[m.code!]?.approvedDate ?? null, rules: r, full: list[m.code!] ?? null, source: 'packaged' } : null })
      } else if (m.type === 'data.search') respond({ ok: true, value: m.q?.toUpperCase().startsWith('ACC3') ? [{ code: 'ACC302', name: 'Managerial Accounting', nameVi: null, credits: 3 }] : [] })
      else respond({ ok: true, value: null })
      return false
    })
  })

  async function render() {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<SubjectsView />) })
    await wait(); await wait()
    return el
  }

  it('lists the curriculum, searches the rubric, and opens a detail with links, path and outcomes', async () => {
    const el = await render()
    expect([...el.querySelectorAll('li button')].map((b) => b.textContent)).toEqual([
      'PRF192 · Programming FundamentalsCurriculum term 1', 'ACC101 · Nguyên lý kế toánCurriculum term 2', 'CSD201 · Data Structures and AlgorithmsCurriculum term 3',
    ])
    const box = el.querySelector<HTMLInputElement>('input[type="search"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, 'ACC3')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await wait(200)
    expect([...el.querySelectorAll('li button')].map((b) => b.textContent)).toEqual(['ACC302 · Managerial AccountingFLM subject'])
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, '')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await wait(200)
    await act(async () => { [...el.querySelectorAll<HTMLButtonElement>('li button')].find((b) => b.textContent?.startsWith('CSD201'))!.click() })
    await wait(); await wait()
    expect(el.querySelector('h2')!.textContent).toBe(`CSD201 · ${list.CSD201.name.en}`)
    expect(el.textContent).toContain('Curriculum term: 3')
    expect(el.querySelector<HTMLAnchorElement>('a')!.href).toBe(`https://flm.fpt.edu.vn/gui/role/student/SyllabusDetails?sylID=${rules.subjects.CSD201.sylId}`)
    expect(el.textContent).toContain('Needs first:')
    expect([...el.querySelectorAll('section button')].map((b) => b.textContent)).toContain('PRF192')
    expect(el.textContent).toContain('Learning outcomes')
    const r = await axe.run(el, { rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false }, region: { enabled: false } }, resultTypes: ['violations'] })
    expect(r.violations.map((v) => v.id)).toEqual([])
    await act(async () => { [...el.querySelectorAll('button')].find((b) => b.textContent === 'Back to the list')!.click() })
    expect(el.querySelector('input[type="search"]')).toBeTruthy()
  })
})
