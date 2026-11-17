// GRD-2.2: CourseModeler, checked against the reference courseModel (grades R4.1 to R4.10, R12.2).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { courseModel, loadCourseModel, nameScore, weakGroups } from '../src/features/grades/engine/course-model'
import { rowsFromTable } from '../src/features/grades/parse/marksheet'
import type { SubjectRule } from '../src/shared/data/schemas'
import type { MarkSheetRow } from '../src/features/grades/types'
// @ts-expect-error plain .mjs reference tool without types
import { courseModel as refModel, rowsFromTable as refRows } from '../tools/flm-scraper/marksheet.mjs'

const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8')).subjects as Record<string, SubjectRule>
const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as { cases: { id: string; code: string; rows: MarkSheetRow[]; html: string; model: unknown }[] }
const table = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document.querySelector('table.student-mark-sheet')!

describe('courseModel port', () => {
  it('reproduces every golden model from its rows and from its HTML', () => {
    for (const c of golden.cases) {
      expect(courseModel(rules[c.code]!, c.rows), c.id).toMatchObject(c.model as object)
      expect(courseModel(rules[c.code]!, rowsFromTable(table(c.html))), c.id).toMatchObject(c.model as object)
    }
  })

  it('matches the reference on every mark sheet fixture, with and without FLM', () => {
    const files = ['en', 'vi'].flatMap((l) => readdirSync(`test/fixtures/${l}`).filter((f) => f.startsWith('marksheet-')).map((f) => `${l}/${f}`))
    for (const f of files) {
      const raw = f.split('-')[1]! // e.g. pmg201c: the real code the fixture was captured from
      const code = raw.slice(0, 6).toUpperCase() + raw.slice(6)
      const t = table(readFileSync(`test/fixtures/${f}`, 'utf8'))
      for (const flm of [rules[code] ?? null, null]) {
        // Summaries are compared elsewhere: the fixtures' anonymized labels defeat the reference's label match.
        // The bonus comes from the summary, so it is compared with the summary-derived value.
        const { summary, result: _r, ...mine } = courseModel(flm, rowsFromTable(t))
        const { summary: _rs, ...ref } = refModel(flm, refRows(t))
        if (ref.subject) ref.subject.bonus = summary.bonus ?? 0
        expect(mine, `${f} ${flm ? code : 'no FLM'}`).toEqual(ref)
      }
    }
  })

  it('reports unscored, none and the FLM plan when there are no items', () => {
    const summaryOnly = golden.cases.find((c) => c.id === 'summary-only-mae101')!
    expect(courseModel(rules.MAE101!, summaryOnly.rows)).toMatchObject({ result: 'model', subject: { source: 'flm-plan' }, scores: {} })
    expect(courseModel(null, summaryOnly.rows)).toMatchObject({ result: 'none', subject: null })
    const lab = golden.cases.find((c) => c.id === 'unscored-lab211')!
    expect(courseModel(rules.LAB211!, lab.rows).result).toBe('unscored')
  })

  it('applies a graded resit, keeps unmatched groups under the owner rules, and flags weak matches', () => {
    const resit = courseModel(rules.CSD201!, golden.cases.find((c) => c.id === 'resit-csd201')!.rows)
    expect(resit.mapping.some((m) => m.resitApplied)).toBe(true)
    const rows: MarkSheetRow[] = [
      { kind: 'item', group: 'Mystery block', name: 'Mystery block', weight: '40', value: '7' },
      { kind: 'item', group: 'Final exam', name: 'Final exam', weight: '60', value: '-' },
    ]
    const m = courseModel(null, rows)
    expect(m.subject!.assessments.map((a) => [a.type, a.completion])).toEqual([
      ['ongoing', { value: 0, inclusive: false }],
      ['final', { value: 4, inclusive: true }],
    ])
    expect(m.subject!.flags).toContain('unmatched-groups')
    expect(weakGroups({ ...m, mapping: [{ group: 'G', items: [], flmIndex: 1, flmCategory: 'x', confidence: 0.6, assessmentIndex: [0] }] })).toEqual(['G'])
    expect(nameScore('Final exam', 'Final Exam')).toBe(1)
    expect(nameScore('Assignment', 'Final Exam')).toBe(0)
  })

  it('loads the rubric through the lookup and models without FLM when it fails', async () => {
    const asked: string[][] = []
    const rows = golden.cases.find((c) => c.id === 'pass-prf192')!.rows
    const ok = await loadCourseModel('PRF192', rows, async (codes) => {
      asked.push(codes)
      return { ok: true, value: { dataVersion: 1, scrapedAt: '', rules: {} as never, subjects: { PRF192: rules.PRF192! } } }
    })
    expect(asked).toEqual([['PRF192']])
    expect(ok.subject!.code).toBe('PRF192')
    const down = await loadCourseModel('PRF192', rows, async () => ({ ok: false, error: { kind: 'timeout' } }))
    expect(down.subject!.code).toBeNull()
  })
})
