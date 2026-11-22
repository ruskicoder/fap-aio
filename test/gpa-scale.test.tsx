// @vitest-environment happy-dom
// GRD-7.1: GPA scale switch (grades R13.1 to R13.6).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'

vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => {
    if (route !== '/Report/Transcript') return { ok: false, error: { kind: 'network' } }
    const html = readFileSync('test/fixtures/en/transcript.html', 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')
    return { ok: true, value: new DOMParser().parseFromString(html, 'text/html'), fetchedAt: Date.now() }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { LETTER_BANDS, computeGpaOn, letterOf, pointsOf, gradeWithLetter } = await import('../src/features/grades/engine/scale')
const { computeGpa, DEFAULT_NON_GPA } = await import('../src/features/grades/engine/gpa')
const { parseTranscript } = await import('../src/features/grades/parse/transcript')
const { registerGradeSources } = await import('../src/features/grades/sources')
const { GpaView } = await import('../src/features/grades/views/GpaView')
const { readGpaScale } = await import('../src/features/grades/scale-setting')
const { registerGradeSettings } = await import('../src/features/grades/settings')
const { settingDef, clearSettings } = await import('../src/content/panel/settings/registry')
const { isFinal } = await import('../src/features/grades/views/CoursesView')
import type { TranscriptRow } from '../src/features/grades/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

const row = (code: string, grade: number | null, credits = 3, semester = 'Fall2025', status: TranscriptRow['status'] = 'passed'): TranscriptRow =>
  ({ id: `${semester}|${code}`, term: 1, semester, code, name: code, prerequisites: null, replaced: null, credits, grade, status })

describe('letter-grade table', () => {
  it('is one five-band table, highest first', () => {
    expect(LETTER_BANDS.map((b) => [b.letter, b.min, b.points])).toEqual([['A', 8.5, 4], ['B', 7, 3], ['C', 5.5, 2], ['D', 4, 1], ['F', 0, 0]])
  })
  it('maps each band and its edges, after rounding to one decimal half up', () => {
    const cases: [number, string, number][] = [
      [10, 'A', 4], [8.5, 'A', 4], [8.45, 'A', 4], [8.44, 'B', 3], [8.4, 'B', 3], [7, 'B', 3], [6.95, 'B', 3],
      [6.9, 'C', 2], [5.5, 'C', 2], [5.4, 'D', 1], [4, 'D', 1], [3.95, 'D', 1], [3.9, 'F', 0], [0, 'F', 0],
    ]
    for (const [g, l, p] of cases) expect([g, letterOf(g), pointsOf(g)]).toEqual([g, l, p])
    expect(letterOf(null)).toBeNull()
    expect(pointsOf(Number.NaN)).toBeNull()
    expect(gradeWithLetter(8.6)).toBe('8.6 (A)')
    expect(gradeWithLetter(null)).toBeNull()
  })
})

describe('computeGpaOn', () => {
  const rows = [
    row('PRF192', 9.0), row('MAE101', 7.5), row('CSD201', 5.0, 2, 'Spring2026'), row('VOV134', 9.9), // VOV is not counted
    row('SWP391', null, 3, 'Spring2026', 'in-progress'), row('TRS601', 8, 0), row('ENW492', 6.0, 3, 'Spring2026', 'exempt'),
  ]
  it('is GpaEngine on the 10-point scale', () => {
    expect(computeGpaOn('10', { rows, nonGpa: DEFAULT_NON_GPA })).toEqual(computeGpa({ rows, nonGpa: DEFAULT_NON_GPA }))
  })
  it('converts per course, then weights by credits, over the same counted rows', () => {
    const g10 = computeGpa({ rows, nonGpa: DEFAULT_NON_GPA })
    const g4 = computeGpaOn('4', { rows, nonGpa: DEFAULT_NON_GPA })
    expect([...g4.counted].sort()).toEqual([...g10.counted].sort())
    expect(g4.credits).toBe(g10.credits)
    // A 4 x 3, B 3 x 3, D 1 x 2 over 8 credits.
    expect(g4.cumulative).toBeCloseTo((4 * 3 + 3 * 3 + 1 * 2) / 8, 10)
    expect(g4.semesters.map((s) => [s.name, s.gpa])).toEqual([['Fall2025', 3.5], ['Spring2026', 1]])
  })
  it('agrees with a hand computation on the fixture transcript', () => {
    const t = parseTranscript(new DOMParser().parseFromString(readFileSync('test/fixtures/en/transcript.html', 'utf8'), 'text/html'))
    const g4 = computeGpaOn('4', { rows: t.rows, nonGpa: DEFAULT_NON_GPA })
    const counted = t.rows.filter((r) => g4.counted.has(r.id))
    const hand = counted.reduce((n, r) => n + pointsOf(r.grade)! * r.credits, 0) / counted.reduce((n, r) => n + r.credits, 0)
    expect(g4.cumulative).toBeCloseTo(hand, 10)
    expect(g4.cumulative!).toBeLessThanOrEqual(4)
  })
})

describe('scale setting and the GPA view', () => {
  beforeEach(() => {
    installFakeChrome()
    clearSettings()
    registerGradeSources()
    registerGradeSettings()
  })

  it('declares grades.gpaScale with the 10-point default in the Grades section', async () => {
    const def = settingDef('grades.gpaScale')!
    expect(def.section).toBe('grades')
    expect(def.default).toBe('10')
    expect(def.options?.map((o) => o.label)).toEqual(['10-point (Vietnam)', '4-point (global)'])
    expect(def.validate?.('5' as never)).toMatch(/Choose/)
    expect(await readGpaScale()).toBe('10')
  })

  it('switches the figures, persists the choice and explains the conversion', async () => {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<GpaView />) })
    await wait(20); await wait(20)
    const chip = (label: string) => [...el.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent === label) as HTMLButtonElement
    expect(chip('10-point (Vietnam)').getAttribute('aria-pressed')).toBe('true')
    const big = () => el.querySelector('.text-2xl')!.textContent
    const ten = big()
    expect(ten).toMatch(/^\d\.\d\d$/)
    await act(async () => { chip('4-point (global)').click() })
    await wait(20)
    expect(await readGpaScale()).toBe('4')
    expect(chip('4-point (global)').getAttribute('aria-pressed')).toBe('true')
    expect(big()).not.toBe(ten)
    expect(Number(big())).toBeLessThanOrEqual(4)
    expect(el.textContent).toContain('cumulative GPA (4-point)')
    expect(el.textContent).toContain('A 8.5 to 10 is 4')
    expect(el.textContent).toContain('GPA (4-point)')
    await act(async () => { chip('10-point (Vietnam)').click() })
    await wait(20)
    expect(big()).toBe(ten)
  })

  it('treats an average as final only when nothing remains', () => {
    expect(isFinal(null)).toBe(false)
    expect(isFinal({ status: 'none', scored: null, note: '' } as never)).toBe(false)
  })
})
