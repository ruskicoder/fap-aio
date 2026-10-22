import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { parseWeek } from '../src/content/fap/parse/timetable'
import { LayoutChangedError } from '../src/content/fap/registry'

const PAST = '2026-09-08'
const doc = (f: string) => parseHTML(`<html><body>${readFileSync(`test/fixtures/${f}`, 'utf8')}</body></html>`).document

describe('timetable parser', () => {
  const en = parseWeek(doc('en/timetable-week.partial.html'), { referenceDate: '2026-10-06' }, 0)
  const vi = parseWeek(doc('vi/timetable-week.partial.html'), { referenceDate: '2026-10-06' }, 0)

  it('reads the week dates and sessions by class and icon', () => {
    expect(en.monday).toBe('2026-10-05')
    expect(en.rejected).toBeUndefined()
    expect(en.sessions.length).toBeGreaterThan(0)
    const s = en.sessions[0]!
    expect(s.date).toMatch(/^2026-10-(0[5-9]|1[01])$/)
    expect(s.start).toMatch(/^\d{2}:\d{2}$/)
    expect(s.code).toMatch(/^[A-Z]{2,4}\d{3}/)
    expect(s.group).not.toBe('')
    expect(s.room).toBeTruthy()
    expect(s.lecturer).toBeTruthy()
    expect(s.online).toBe(false)
    expect(s.slot).toBeGreaterThan(0)
    expect(en.sessions.some((x) => x.attendance === 'exempt')).toBe(true)
    expect(en.sessions.some((x) => x.scheduleType !== null)).toBe(true)
  })

  it('reads a present status from a past week, the same in both cultures', () => {
    const ref = { referenceDate: PAST }
    const pe = parseWeek(doc('en/timetable-week-past.partial.html'), ref, 0)
    const pv = parseWeek(doc('vi/timetable-week-past.partial.html'), ref, 0)
    expect(pe.sessions.some((x) => x.attendance === 'present')).toBe(true)
    expect(pv.sessions.map((x) => x.attendance)).toEqual(pe.sessions.map((x) => x.attendance))
  })

  it('gives the same records in both cultures', () => {
    const strip = (r: typeof en) => r.sessions.map(({ scheduleType: _s, ...x }) => x)
    expect(strip(vi)).toEqual(strip(en))
    expect(vi.unreadable).toBe(en.unreadable)
  })

  it('rejects a response that is not the requested week', () => {
    const r = parseWeek(doc('en/timetable-week.partial.html'), { referenceDate: '2026-10-14' })
    expect(r.rejected).toMatch(/2026-10-05/)
    expect(r.sessions).toEqual([])
  })

  it('treats the empty state as a week without sessions', () => {
    expect(parseWeek(doc('en/timetable-week-tet.partial.html'), { referenceDate: '2026-02-18' })).toEqual({ monday: '2026-02-16', empty: true, sessions: [], unreadable: 0 })
  })

  it('counts a cell without a readable time as unreadable', () => {
    const d = doc('en/timetable-week.partial.html')
    d.querySelector('.weekly-timetable-cell-title')!.closest('.position-relative')!.querySelector('span.fw-bold')!.textContent = 'TBA'
    const r = parseWeek(d, { referenceDate: '2026-10-06' })
    expect(r.unreadable).toBe(en.unreadable + 1)
    expect(r.sessions).toHaveLength(en.sessions.length - 1)
  })

  it('reports a layout change', () => {
    expect(() => parseWeek(parseHTML('<html><body><div>x</div></body></html>').document, { referenceDate: '2026-10-06' })).toThrow(LayoutChangedError)
  })
})
