// GRD-2.4: GoalEngine (grades R7.1 to R7.6).
import { describe, expect, it } from 'vitest'
import { courseGoal, effectiveTarget, gpaGoal, maxAverage, type GoalCourse } from '../src/features/grades/engine/goals'
import { predict } from '../src/features/grades/engine/predict'
import type { ModelSubject } from '../src/features/grades/engine/course-model'

const gpaWith = (done: { credits: number; points: number }, courses: GoalCourse[], targets: Record<string, number>) =>
  (done.points + courses.reduce((s, c) => s + c.credits * targets[c.id]!, 0)) / (done.credits + courses.reduce((s, c) => s + c.credits, 0))

describe('GoalEngine', () => {
  it('uses the per-course tier, else the default (Good)', () => {
    expect(courseGoal('c1', { c1: 'excellent' })).toBe('excellent')
    expect(courseGoal('c2', { c1: 'excellent' })).toBe('good')
    expect(courseGoal('c2', {}, 'fair')).toBe('fair')
  })

  it('gives every course the same target when reachable, and the targets reproduce the goal', () => {
    const done = { credits: 30, points: 30 * 7 }
    const courses = [{ id: 'a', credits: 3, maxAverage: 10 }, { id: 'b', credits: 3, maxAverage: 10 }, { id: 'c', credits: 4, maxAverage: 10 }]
    const r = gpaGoal({ goal: 7.5, done, courses })
    expect(r.reachable).toBe(true)
    expect(r.neededAverage).toBeCloseTo((7.5 * 40 - 210) / 10, 10)
    expect(new Set(Object.values(r.targets).map((t) => t.toFixed(6))).size).toBe(1)
    expect(gpaWith(done, courses, r.targets)).toBeCloseTo(7.5, 6)
  })

  it('caps a course at its highest reachable average and spreads the shortfall by credits', () => {
    const done = { credits: 20, points: 20 * 8 }
    const courses = [{ id: 'capped', credits: 3, maxAverage: 6 }, { id: 'x', credits: 3, maxAverage: 10 }, { id: 'y', credits: 2, maxAverage: 10 }]
    const r = gpaGoal({ goal: 8, done, courses })
    expect(r.targets.capped).toBe(6)
    expect(r.targets.x).toBeCloseTo(r.targets.y!, 9)
    expect(r.targets.x).toBeGreaterThan(8)
    expect(gpaWith(done, courses, r.targets)).toBeCloseTo(8, 6)
  })

  it('says when the goal is unreachable and gives the highest reachable GPA', () => {
    const done = { credits: 30, points: 30 * 6 }
    const courses = [{ id: 'a', credits: 3, maxAverage: 9 }, { id: 'b', credits: 3, maxAverage: 7 }]
    const r = gpaGoal({ goal: 8, done, courses })
    expect(r.reachable).toBe(false)
    expect(r.highestGpa).toBeCloseTo((180 + 27 + 21) / 36, 10)
    expect(r.targets).toEqual({ a: 9, b: 7 })
  })

  it('handles a goal already met and no in-progress courses', () => {
    const met = gpaGoal({ goal: 6, done: { credits: 30, points: 240 }, courses: [{ id: 'a', credits: 3, maxAverage: 10 }] })
    expect([met.reachable, met.targets.a]).toEqual([true, 0])
    expect(gpaGoal({ goal: 7, done: { credits: 30, points: 240 }, courses: [] })).toMatchObject({ reachable: true, neededAverage: null })
    expect(gpaGoal({ goal: 9, done: { credits: 30, points: 240 }, courses: [] }).reachable).toBe(false)
  })

  it('takes the higher of tier and GPA-derived target as effective', () => {
    expect(effectiveTarget('good', 8.6)).toEqual({ tier: 8, derived: 8.6, effective: 8.6, from: 'gpa' })
    expect(effectiveTarget('good', 7.2)).toEqual({ tier: 8, derived: 7.2, effective: 8, from: 'tier' })
    expect(effectiveTarget('pass', null)).toEqual({ tier: 5, derived: null, effective: 5, from: 'tier' })
  })

  it('derives the highest reachable average from a prediction', () => {
    const s: ModelSubject = {
      code: 'T101', scored: true, scoringScale: 10, minAvgMarkToPass: 5, attendance: { minPercent: 80, source: 'default' }, coursera: { required: false },
      hasFinal: true, weightSum: 1, bonus: 0, flags: [], source: 'fap-marksheet',
      assessments: [
        { index: 0, category: 'PT', type: 'ongoing', finalKind: null, parts: 1, weight: 0.4, weightPerPart: 0.4, completion: null, parentIndex: null },
        { index: 1, category: 'FE', type: 'final', finalKind: 'FE', parts: 1, weight: 0.6, weightPerPart: 0.6, completion: null, parentIndex: null },
      ],
    }
    expect(maxAverage(predict(s, { 0: [5] }))).toBe(8)
    expect(maxAverage(predict(s, { 0: [5], 1: [7] }))).toBe(6.2)
    expect(maxAverage(predict(null))).toBeNull()
  })
})
