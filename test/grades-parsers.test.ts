// GRD-1.1: transcript and term list parsers and sources (grades R1.1 to R1.5, R8.1, R8.2).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { markOf, parseTranscript } from '../src/features/grades/parse/transcript'
import { courseCodeOf, parseTermCourses } from '../src/features/grades/parse/term-courses'
import { registerGradeSources } from '../src/features/grades/sources'
import { transcriptStatusOf } from '../src/content/fap/parse/constants'
import { sources, LayoutChangedError } from '../src/content/fap/registry'

const doc = (f: string) => parseHTML(readFileSync(`test/fixtures/${f}`, 'utf8')).document
const html = (body: string) => parseHTML(`<html><body><div class="content-page">${body}</div></body></html>`).document

describe('transcript parser', () => {
  const en = parseTranscript(doc('en/transcript.html'))
  const vi = parseTranscript(doc('vi/transcript.html'))

  it('reads the 10-column main table by position', () => {
    expect(en.rows).toHaveLength(48)
    expect(en.rows[0]).toMatchObject({ id: 'Fall2023|YLI867', term: 0, semester: 'Fall2023', code: 'YLI867', prerequisites: null, replaced: null, credits: 0, grade: 9.3, status: 'passed' })
    expect(en.rows[1]).toMatchObject({ code: 'TMI628', replaced: 'ALD954', credits: 3, grade: 0.8 })
    expect(en.rows[1]!.name).not.toBe('')
  })

  it('treats a - grade as ungraded and maps Exempt and In progress', () => {
    expect(en.rows[2]).toMatchObject({ code: 'TRS343', grade: null, status: 'exempt' })
    expect(en.rows.filter((r) => r.status === 'in-progress')).toHaveLength(3)
    expect(en.rows.filter((r) => r.status === 'passed')).toHaveLength(44)
  })

  it('reads vi the same as en, with comma decimals', () => {
    expect(vi.rows.map((r) => [r.id, r.credits, r.status, r.grade === null])).toEqual(en.rows.map((r) => [r.id, r.credits, r.status, r.grade === null]))
    expect(vi.rows[0]!.grade).toBe(5.5)
  })

  it('keeps the replaced-subjects table apart (7 columns)', () => {
    expect(en.replaced).toEqual([
      expect.objectContaining({ semester: 'Summer2025', code: 'FRV018c', credits: 3, grade: 9.2, status: 'passed' }),
      expect.objectContaining({ semester: 'Fall2025', code: 'MPU995c', credits: 3, grade: 3.7, status: 'passed' }),
    ])
    expect(en.rows.some((r) => r.code === 'FRV018c')).toBe(false)
    expect(vi.replaced.map((r) => r.code)).toEqual(['FRV018c', 'MPU995c'])
  })

  it('keeps an unknown status raw and fails on a changed layout', () => {
    expect(transcriptStatusOf('Suspended', 'badge bg-secondary')).toEqual({ kind: 'unknown', raw: 'Suspended' })
    expect(transcriptStatusOf('Không đạt', 'badge bg-danger')).toBe('not-passed')
    expect(transcriptStatusOf('Failed', 'badge bg-danger')).toBe('not-passed')
    const row = '<tr>' + ['1', '2', 'Fall2026', 'ABC101', '-', '-', 'Name', '3', '<span>-</span>', '<span class="badge bg-secondary">Suspended</span>'].map((x) => `<td>${x}</td>`).join('') + '</tr>'
    const t = parseTranscript(html(`<table class="fap-sheet"><thead><tr>${'<th>x</th>'.repeat(10)}</tr></thead><tbody>${row}</tbody></table>`))
    expect(t.rows[0]!.status).toEqual({ kind: 'unknown', raw: 'Suspended' })
    expect(() => parseTranscript(html('<table class="fap-sheet"><thead><tr><th>a</th></tr></thead></table>'))).toThrow(LayoutChangedError)
  })

  it('parses marks as FAP writes them', () => {
    expect([markOf('9.3'), markOf('5,5'), markOf('10'), markOf('-'), markOf(''), markOf('N/A')]).toEqual([9.3, 5.5, 10, null, null, null])
  })
})

describe('term and course lists', () => {
  it('reads terms and the current term from the default grade page', () => {
    const r = parseTermCourses(doc('en/grade.html'), true)
    expect(r.terms).toHaveLength(10)
    expect(r.terms[0]).toMatchObject({ name: 'Fall2026', current: true })
    expect(r.terms.filter((t) => t.current)).toHaveLength(1)
    expect(r.selectedTermId).toBe(r.terms[0]!.id)
    expect(r.courses).toHaveLength(4)
    expect(r.courses[0]).toMatchObject({ termId: r.terms[0]!.id, code: 'LMO352', label: 'LMO Vidvpdnr (LMO352) (Rmky7_LO3383)' })
    expect(r.courses.map((c) => c.code)).toEqual(['LMO352', 'RSE663', 'ACT707', 'MRS083'])
  })

  it('marks no term current when a term was requested, and reads vi the same', () => {
    const r = parseTermCourses(doc('en/grade-term-sp26.html'), false)
    expect(r.terms.some((t) => t.current)).toBe(false)
    expect(r.terms.find((t) => t.id === r.selectedTermId)?.name).toBe('Spring2026')
    expect(r.courses.map((c) => c.code)).toContain('YCL185c')
    const vi = parseTermCourses(doc('vi/grade.html'), true)
    expect(vi.courses.map((c) => c.code)).toEqual(['LMO352', 'RSE663', 'ACT707', 'MRS083'])
  })

  it('finds the code in a label whose name has parentheses', () => {
    expect(courseCodeOf('Gidsgyd 6 (Actkbtshug) (VOV824) (D5_NSL418_9L)')).toBe('VOV824')
    expect(courseCodeOf('No code here')).toBeNull()
  })
})

describe('grade sources', () => {
  it('registers the transcript and term list with 6 h lifetimes and the right routes', () => {
    registerGradeSources()
    const t = sources().find((s) => s.id === 'grades.transcript')!
    const tc = sources().find((s) => s.id === 'grades.termCourses')!
    expect([t.cacheTtlMs, tc.cacheTtlMs]).toEqual([6 * 3600_000, 6 * 3600_000])
    expect([t.partial, tc.partial]).toEqual([false, false])
    expect(t.route({})).toBe('/Report/Transcript')
    expect(tc.route({})).toBe('/Report/Grade')
    expect(tc.route({ termId: 'a b' })).toBe('/Report/Grade?termId=a%20b')
  })
})
