import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { examTypeOf, parseExams } from '../src/content/fap/parse/exams'
import { registerSchedulerSources } from '../src/features/scheduler/sources'
import { sources } from '../src/content/fap/registry'

const doc = (f: string) => parseHTML(readFileSync(`test/fixtures/${f}`, 'utf8')).document
const NOW = Date.parse('2026-10-10T12:00:00+07:00')

describe('exam parser', () => {
  const en = parseExams(doc('en/exam-schedule.html'), NOW)
  const vi = parseExams(doc('vi/exam-schedule.html'), NOW)

  it('reads every row by column position', () => {
    expect(en.length).toBeGreaterThanOrEqual(2)
    const [a, b] = en
    expect(a).toMatchObject({ date: '2026-10-04', start: '10:50', end: '12:20', type: 'FE', past: true })
    expect(a!.code).toMatch(/^[A-Z]{2,4}\d{3}/)
    expect(a!.name).not.toBe('')
    expect(a!.publishDate).toBe('2026-10-16')
    expect(b).toMatchObject({ type: '2NDFE', room: null, past: false })
    expect(a!.id).toBe(`${a!.code}|FE|2026-10-04`)
  })

  it('gives the same records in both cultures', () => {
    expect(vi.map((e) => e.id)).toEqual(en.map((e) => e.id))
  })

  it('maps exam types and placeholder rooms', () => {
    expect(['FE', 'pe', '2NDFE', '2ndpe', 'Quiz', ''].map(examTypeOf)).toEqual(['FE', 'PE', '2NDFE', '2NDPE', 'other', 'other'])
    const d = parseHTML('<table class="fap-sheet"><tbody><tr><td>01/11/2026</td><td>07h30-09h00</td><td>TBA</td><td>ABC123 - Name</td><td>PE</td><td></td><td></td><td></td></tr></tbody></table>').document
    expect(parseExams(d, NOW)[0]).toMatchObject({ room: null, type: 'PE', format: null, publishDate: null })
  })

  it('registers the timetable and exam sources', () => {
    registerSchedulerSources()
    const ids = sources().map((s) => s.id)
    expect(ids).toContain('timetable.week')
    expect(ids).toContain('exam.list')
    const week = sources().find((s) => s.id === 'timetable.week')!
    expect(week.route({ referenceDate: '2026-10-05' })).toBe('/WeeklyTimetable/WeekPartial?referenceDate=2026-10-05')
    expect(week.partial).toBe(true)
  })
})
