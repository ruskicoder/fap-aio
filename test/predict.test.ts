// GRD-2.3: Predictor (grades R5.1 to R5.8), golden cases from PLT-5.2.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { courseModel, type ModelAssessment, type ModelSubject } from '../src/features/grades/engine/course-model'
import { highestTier, predict, round1, type Prediction } from '../src/features/grades/engine/predict'
import type { SubjectRule } from '../src/shared/data/schemas'
import type { MarkSheetRow } from '../src/features/grades/types'

const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8')).subjects as Record<string, SubjectRule>
const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as {
  cases: { id: string; code: string; opts: object; rows: MarkSheetRow[]; model: { subject: ModelSubject | null; scores: Record<number, (number | null)[]> }; prediction: object | null }[]
}

const assess = (o: Partial<ModelAssessment> & Pick<ModelAssessment, 'index' | 'category' | 'weight'>): ModelAssessment =>
  ({ type: 'ongoing', finalKind: null, parts: 1, weightPerPart: o.weight, completion: null, parentIndex: null, ...o })
const subject = (assessments: ModelAssessment[], o: Partial<ModelSubject> = {}): ModelSubject => ({
  code: 'T101', scored: true, scoringScale: 10, minAvgMarkToPass: 5, attendance: { minPercent: 80, source: 'default' },
  coursera: { required: false, bonus: false }, hasFinal: false, assessments, weightSum: 1, bonus: 0, flags: [], source: 'fap-marksheet', ...o,
})
const full = (p: Prediction) => {
  if (p.status === 'none' || p.status === 'unscored') throw new Error(p.status)
  return p
}

describe('Predictor', () => {
  it('matches every golden case, from the golden model and from the ported modeler', () => {
    for (const c of golden.cases) {
      const fromGolden = c.model.subject ? predict(c.model.subject, c.model.scores, c.opts) : null
      expect(fromGolden, c.id).toMatchObject(c.prediction as object)
      const m = courseModel(rules[c.code]!, c.rows)
      expect(predict(m.subject, m.scores, c.opts), c.id).toMatchObject(c.prediction as object)
    }
    expect(golden.cases.length).toBe(9)
  })

  it('needs the smallest 0.1 score whose displayed total reaches the tier (F-12)', () => {
    const c = golden.cases.find((x) => x.id === 'in-progress-mae101')!
    const p = full(predict(c.model.subject, c.model.scores, c.opts))
    const pass = p.tiers[0]!
    expect('uniformScore' in pass && pass.uniformScore).toBe(4.1)
    for (const t of p.tiers) {
      if (!('required' in t)) continue
      const at = (d: number) => round1(p.current.weightedSoFar + p.current.bonus + t.required.reduce((s, r) => s + r.weight * Math.max(r.min - d, 0), 0))
      expect(at(0), t.tier).toBeGreaterThanOrEqual(t.target)
      if (t.uniformScore > 0 && t.required.every((r) => r.min === t.uniformScore)) expect(at(0.1), t.tier).toBeLessThan(t.target)
    }
  })

  it('compares the displayed average: 4.95 passes and 4.94 fails', () => {
    const s = subject([assess({ index: 0, category: 'All', weight: 1 })])
    const pass = full(predict(s, { 0: [4.95] }))
    expect([pass.status, pass.tiers[0]]).toEqual(['passed', { tier: 'pass', target: 5, reachable: true, final: 4.95, displayed: 5 }])
    const fail = full(predict(s, { 0: [4.94] }))
    expect([fail.status, fail.tiers[0]!.reachable]).toEqual(['failed', false])
    expect([round1(8.45), round1(8.44)]).toEqual([8.5, 8.4])
    expect(highestTier(full(predict(s, { 0: [8.1] })))).toBe('good')
  })

  it('never lets an FE criterion fall below 4 and keeps progress above 0', () => {
    const s = subject([
      assess({ index: 0, category: 'Progress test', weight: 0.5 }),
      assess({ index: 1, category: 'Final exam', weight: 0.5, type: 'final', finalKind: 'FE', completion: { value: 3, inclusive: true } }),
    ])
    expect(full(predict(s, { 0: [9], 1: [3.5] })).issues).toEqual(['Final exam: 3.5 does not meet >= 4'])
    expect(full(predict(s, { 0: [0], 1: [9] })).issues).toEqual(['Progress test: 0 does not meet > 0'])
    // F-11: rules that ask for less than 4 on the FE are raised to 4.
    const low = { tiers: [{ id: 'pass' as const, minAverage: 5 }], finalExamMin: 3, attendanceMinPercent: 80 }
    expect(full(predict(s, { 0: [9], 1: [3.5] }, { rules: low })).issues).toEqual(['Final exam: 3.5 does not meet >= 4'])
    const open = full(predict(s, { 0: [9] }))
    const pass = open.tiers[0]!
    expect(open.status).toBe('in-progress')
    expect('required' in pass && pass.required[0]!.min).toBe(4)
  })

  it('uses the FLM pass mark and reports unreachable tiers', () => {
    const s = subject([assess({ index: 0, category: 'Final exam', weight: 1, type: 'final', finalKind: 'FE' })], { minAvgMarkToPass: 7 })
    const p = full(predict(s, { 0: [6.9] }))
    expect([p.status, p.tiers[0]!.target]).toEqual(['failed', 7])
    const half = subject([assess({ index: 0, category: 'A', weight: 0.5 }), assess({ index: 1, category: 'B', weight: 0.5 })])
    expect(full(predict(half, { 0: [6] })).tiers.find((t) => t.tier === 'excellent')).toMatchObject({ reachable: false })
  })

  it('assumes a MOOC bonus of 1 only when ticked, granted and not yet shown', () => {
    const s = subject([assess({ index: 0, category: 'A', weight: 1 })], { coursera: { required: true, bonus: true } })
    const assumed = full(predict(s, { 0: [6] }, { moocDone: true, courseraDone: true }))
    expect(assumed.current).toMatchObject({ bonus: 1, assumedBonus: true })
    expect(assumed.tiers[0]).toMatchObject({ displayed: 7 })
    expect(full(predict(s, { 0: [6] }, { courseraDone: true })).current.assumedBonus).toBe(false)
    expect(full(predict({ ...s, bonus: 1 }, { 0: [6] }, { moocDone: true })).current).toMatchObject({ bonus: 1, assumedBonus: false })
    expect(full(predict(s, { 0: [6] })).warnings[0]).toMatch(/^Coursera/)
  })

  it('reports none and unscored', () => {
    expect(predict(null).status).toBe('none')
    expect(predict(subject([], { scored: false })).status).toBe('unscored')
  })
})
