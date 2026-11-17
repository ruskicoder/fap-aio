// GRD-1.2: mark sheet reader and source (grades R4.1, R4.5), checked against the reference tool.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { numberOf, parseMarkSheet, rowsFromTable, summaryOf } from '../src/features/grades/parse/marksheet'
import { registerGradeSources } from '../src/features/grades/sources'
import { LayoutChangedError, sources } from '../src/content/fap/registry'
// @ts-expect-error plain .mjs reference tool without types
import { rowsFromTable as refRows, summaryOf as refSummary } from '../tools/flm-scraper/marksheet.mjs'

const partial = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document
const fixture = (f: string) => partial(readFileSync(`test/fixtures/${f}`, 'utf8'))
const sheets = ['en', 'vi'].flatMap((l) => readdirSync(`test/fixtures/${l}`).filter((f) => /^(marksheet-|grade-default)/.test(f)).map((f) => `${l}/${f}`))
const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as { cases: { id: string; html: string }[] }
const table = (d: Document) => d.querySelector('table.student-mark-sheet')!

describe('rowsFromTable port', () => {
  it('gives the same rows as the reference tool on every fixture and golden sheet', () => {
    expect(sheets.length).toBeGreaterThanOrEqual(14)
    for (const f of sheets) expect(rowsFromTable(table(fixture(f))), f).toEqual(refRows(table(fixture(f))))
    for (const c of golden.cases) {
      const d = partial(c.html)
      expect(rowsFromTable(table(d)), c.id).toEqual(refRows(table(d)))
      // The golden sheets carry FAP's real labels, so the label-based reference summary must agree.
      expect(summaryOf(rowsFromTable(table(d))), c.id).toEqual(refSummary(refRows(table(d))))
    }
  })
})

describe('parseMarkSheet', () => {
  it('reads a regular sheet with its header and summary', () => {
    const s = parseMarkSheet(fixture('en/marksheet-swd392.partial.html'))
    expect(s.header).toEqual({ code: 'OUR261', title: 'Gbrlgcfi Cdtrlamkpenf tvs Ldhtyt', meta: ['MY4926', 'Spring2026'] })
    expect(s.rows.filter((r) => r.kind === 'item')).toHaveLength(8)
    expect(s.rows[0]).toMatchObject({ kind: 'item', group: 'Course Project', name: 'Course Project', weight: '25' })
    expect(s.summary).toEqual({ latePenaltyPercent: 0, bonus: null, average: 8.2, status: 'passed' })
  })

  it('keeps resit groups and reads vi summaries by shape, not label', () => {
    for (const [f, average] of [['en/marksheet-csd201-failed.partial.html', 2.4], ['vi/marksheet-csd201-failed.partial.html', 8.5]] as const) {
      const s = parseMarkSheet(fixture(f))
      expect(s.rows).toContainEqual({ kind: 'item', group: 'Final exam (Resit)', name: 'Final exam (Resit)', weight: '30', value: '-' })
      expect(s.summary).toEqual({ latePenaltyPercent: 0, bonus: null, average, status: 'failed' })
    }
  })

  it('reads a summary-only sheet, a bonus and an unscored total', () => {
    const only = parseMarkSheet(fixture('en/marksheet-wed201c-summary-only.partial.html'))
    expect(only.rows.every((r) => r.kind === 'summary')).toBe(true)
    expect(only.summary).toMatchObject({ average: 7.2, status: 'passed' })
    expect(parseMarkSheet(fixture('en/marksheet-pmg201c-bonus.partial.html')).summary.bonus).toBe(1)
    expect(parseMarkSheet(fixture('en/marksheet-lab211-unscored.partial.html')).summary).toMatchObject({ average: null, status: 'passed' })
  })

  it('reports a changed layout and parses numbers as FAP writes them', () => {
    expect(() => parseMarkSheet(partial('<div class="card"></div>'))).toThrow(LayoutChangedError)
    expect([numberOf('8,5'), numberOf('0%'), numberOf('-'), numberOf(undefined)]).toEqual([8.5, 0, null, null])
  })
})

describe('grades.markSheet source', () => {
  it('is a partial with a 30 minute lifetime on the term and course route', () => {
    registerGradeSources()
    const s = sources().find((x) => x.id === 'grades.markSheet')!
    expect([s.partial, s.cacheTtlMs]).toEqual([true, 30 * 60_000])
    expect(s.route({ termId: 't 1', courseId: 'c' })).toBe('/Report/Grade?termId=t%201&courseId=c')
  })
})
