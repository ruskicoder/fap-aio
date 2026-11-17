// INF-2.1: attendanceRisk and courseraDue on synthetic records (info R4.2, R4.3, R4.5, R5.2, R5.3).
import { describe, expect, it } from 'vitest'
import { attendanceRisk, courseraDue, predictorAttendance } from '../src/features/info/analyze'
import { predict } from '../src/features/grades/engine/predict'
import type { ModelSubject } from '../src/features/grades/engine/course-model'
import type { Exam } from '../src/features/scheduler/types'

const NOW = Date.parse('2026-11-17T09:00:00+07:00')
const exam = (code: string, date: string, type: Exam['type'] = 'FE'): Exam => ({
  id: `${code}|${type}|${date}`, date, start: '07:30', end: '09:00', room: null, code, name: code, type, typeRaw: type,
  format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1,
})

describe('attendanceRisk', () => {
  it('allows floor(total × 20%) absences by default and sets the level from what is left', () => {
    expect(attendanceRisk({ total: 20, absent: 0 }, null)).toMatchObject({ minPercent: 80, allowed: 4, left: 4, level: 'safe' })
    expect(attendanceRisk({ total: 20, absent: 2 }, null).level).toBe('safe')
    expect(attendanceRisk({ total: 20, absent: 3 }, null)).toMatchObject({ left: 1, level: 'warning' })
    expect(attendanceRisk({ total: 20, absent: 4 }, null)).toMatchObject({ left: 0, level: 'last-chance' })
    expect(attendanceRisk({ total: 20, absent: 5 }, null)).toMatchObject({ left: -1, level: 'failed' })
    expect(attendanceRisk({ total: 22, absent: 0, notYet: 10 }, null)).toMatchObject({ allowed: 4, notYet: 10 })
  })

  it('uses the FLM requirement, 100% where stated', () => {
    expect(attendanceRisk({ total: 30, absent: 0 }, { attendance: { minPercent: 100 } })).toMatchObject({ allowed: 0, level: 'last-chance' })
    expect(attendanceRisk({ total: 30, absent: 1 }, { attendance: { minPercent: 100 } }).level).toBe('failed')
  })

  it('gives the grades predictor the same limit', () => {
    const s: ModelSubject = {
      code: 'T101', scored: true, scoringScale: 10, minAvgMarkToPass: 5, attendance: { minPercent: 80, source: 'syllabus' }, coursera: { required: false },
      hasFinal: false, weightSum: 1, bonus: 0, flags: [], source: 'fap-marksheet',
      assessments: [{ index: 0, category: 'A', type: 'ongoing', finalKind: null, parts: 1, weight: 1, weightPerPart: 1, completion: null, parentIndex: null }],
    }
    for (const absent of [3, 4, 5]) {
      const r = attendanceRisk({ total: 20, absent }, s)
      const p = predict(s, { 0: [8] }, { attendance: predictorAttendance(r) })
      expect(p.status === 'failed', `absent ${absent}`).toBe(r.level === 'failed')
    }
  })
})

describe('courseraDue', () => {
  const rules = { MKT101c: { coursera: { required: true } }, PRF192: { coursera: { required: false } }, ENW493c: { coursera: { required: true } } }
  const courses = [{ courseId: 'c1', code: 'MKT101c' }, { courseId: 'c2', code: 'PRF192' }, { courseId: 'c3', code: 'ENW493c' }, { courseId: 'c4', code: null }]

  it('warns for unticked Coursera courses with a synced FE ahead, soonest first, with days left', () => {
    const exams = [exam('MKT101c', '2026-11-27'), exam('ENW493c', '2026-11-20'), exam('PRF192', '2026-11-19'), exam('ENW493c', '2026-12-20', '2NDFE')]
    expect(courseraDue(courses, exams, rules, {}, NOW)).toEqual([
      { courseId: 'c3', code: 'ENW493c', feDate: '2026-11-20', daysLeft: 3 },
      { courseId: 'c1', code: 'MKT101c', feDate: '2026-11-27', daysLeft: 10 },
    ])
  })

  it('says nothing once ticked, without a synced FE, or after the FE', () => {
    expect(courseraDue(courses, [exam('MKT101c', '2026-11-27')], rules, { c1: true }, NOW)).toEqual([])
    expect(courseraDue(courses, [exam('MKT101c', '2026-11-27')], rules, { MKT101c: true }, NOW)).toEqual([])
    expect(courseraDue(courses, [], rules, {}, NOW)).toEqual([])
    expect(courseraDue(courses, [exam('MKT101c', '2026-11-10')], rules, {}, NOW)).toEqual([])
  })
})
