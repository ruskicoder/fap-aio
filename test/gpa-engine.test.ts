// GRD-2.1: GpaEngine (grades R2.1, R2.2, R2.4, R2.5, R2.6, R1.2).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { DEFAULT_NON_GPA, computeGpa, formatGpa, isExcluded, semesterOrder } from '../src/features/grades/engine/gpa'
import { parseTranscript } from '../src/features/grades/parse/transcript'
import type { TranscriptRow } from '../src/features/grades/types'

const row = (semester: string, code: string, credits: number, grade: number | null, status: TranscriptRow['status'] = 'passed'): TranscriptRow =>
  ({ id: `${semester}|${code}`, term: 1, semester, code, name: code, prerequisites: null, replaced: null, credits, grade, status })

describe('GpaEngine', () => {
  it('is the credit-weighted mean of counted rows, per semester in order and cumulative', () => {
    const r = computeGpa({ rows: [
      row('Fall2024', 'PRF192', 3, 8),
      row('Spring2024', 'MAE101', 3, 6),
      row('Spring2024', 'CEA201', 2, 9),
      row('Summer2024', 'CSD201', 3, null, 'in-progress'),
    ], nonGpa: [] })
    expect(r.semesters.map((s) => [s.name, s.order, s.gpa, s.credits])).toEqual([
      ['Spring2024', 20241, 7.2, 5],
      ['Summer2024', 20242, null, 0],
      ['Fall2024', 20243, 8, 3],
    ])
    expect(r.cumulative).toBeCloseTo((8 * 3 + 6 * 3 + 9 * 2) / 8, 10)
    expect(r.credits).toBe(8)
    expect(formatGpa(r.cumulative)).toBe('7.50')
    expect([formatGpa(null), formatGpa(7.125), formatGpa(8)]).toEqual([null, '7.13', '8.00'])
  })

  it('excludes non-GPA prefixes case-insensitively, and ignores blank entries', () => {
    expect(isExcluded('prf192', ['PRF192'])).toBe(true)
    expect(isExcluded('PRF192', ['prf192'])).toBe(true)
    expect(isExcluded('GDQP01', DEFAULT_NON_GPA)).toBe(true)
    expect(isExcluded('ĐSA101', DEFAULT_NON_GPA)).toBe(true)
    expect(isExcluded('đsa101', DEFAULT_NON_GPA)).toBe(true)
    expect(isExcluded('PRF192', DEFAULT_NON_GPA)).toBe(false)
    expect(isExcluded('PRF192', ['', '  '])).toBe(false)
    const r = computeGpa({ rows: [row('Fall2024', 'PRF192', 3, 8), row('Fall2024', 'vov114', 3, 2)], nonGpa: DEFAULT_NON_GPA })
    expect([r.cumulative, [...r.counted]]).toEqual([8, ['Fall2024|PRF192']])
  })

  it('does not count Exempt, In progress, unknown, ungraded or zero-credit rows', () => {
    const r = computeGpa({ rows: [
      row('Fall2024', 'A101', 3, 9, 'exempt'),
      row('Fall2024', 'B101', 3, 9, 'in-progress'),
      row('Fall2024', 'C101', 3, 9, { kind: 'unknown', raw: 'Suspended' }),
      row('Fall2024', 'D101', 3, 9, 'not-passed'),
      row('Fall2024', 'E101', 3, null),
      row('Fall2024', 'F101', 0, 9),
    ], nonGpa: [] })
    expect([r.cumulative, r.credits, r.counted.size]).toEqual([null, 0, 0])
  })

  it('orders semesters by year then Spring, Summer, Fall, unknown names last', () => {
    expect(['Fall2023', 'Spring2024', 'Summer2023', 'Other'].sort((a, b) => semesterOrder(a) - semesterOrder(b))).toEqual(['Summer2023', 'Fall2023', 'Spring2024', 'Other'])
  })

  it('works on the transcript fixture and ignores the replaced table', () => {
    const t = parseTranscript(parseHTML(readFileSync('test/fixtures/en/transcript.html', 'utf8')).document)
    const r = computeGpa({ rows: t.rows, nonGpa: DEFAULT_NON_GPA })
    const expected = t.rows.filter((x) => x.status === 'passed' && x.grade !== null && x.credits > 0 && !/^(GDQP|ENT|VOV|TRS|ÐSA|ĐSA|TMI|LAB|OJS|OJT|SYB301)/i.test(x.code))
    expect([...r.counted].sort()).toEqual(expected.map((x) => x.id).sort())
    expect(r.counted.has('Fall2023|TMI628')).toBe(false)
    expect(r.credits).toBe(expected.reduce((n, x) => n + x.credits, 0))
    for (const x of t.replaced) expect([...r.counted].some((id) => id.endsWith(`|${x.code}`))).toBe(false)
    const orders = r.semesters.map((s) => s.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(r.cumulative).toBeGreaterThan(0)
  })
})
