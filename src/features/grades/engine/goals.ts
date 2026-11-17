// GoalEngine (grades R7.1 to R7.6; design "GoalEngine"). Pure.
// - Course goal: the per-course tier if set, else the default tier (Good) (R7.1, R7.2).
// - GPA goal G: with D counted credits and P grade points done, and in-progress GPA-counting courses k
//   with credits c_k and highest reachable average m_k, the needed average is
//   a = (G·(D + Σc) − P) / Σc (R7.3). Targets: a uniform x with Σ c_k·min(x, m_k) = a·Σc, found by
//   bisection; capped courses push the shortfall onto the others by construction (R7.4).
// - Unreachable when Σ c_k·m_k < a·Σc; the highest reachable GPA is (P + Σ c_k·m_k) / (D + Σc) (R7.5).
// - Effective target: the higher of the tier value and the GPA-derived target (R7.6).
import { TIERS, round1, type Prediction, type TierId } from './predict'

export const DEFAULT_TIER: TierId = 'good'
const EPS = 1e-9

export function courseGoal(courseId: string, goals: Record<string, TierId | undefined>, defaultTier: TierId = DEFAULT_TIER): TierId {
  return goals[courseId] ?? defaultTier
}

/**
 * Highest average a course can still reach: 10 on every remaining component, the bonus included,
 * capped at the scale and shown to one decimal. Null when the course has no prediction.
 */
export function maxAverage(p: Prediction, scale = 10): number | null {
  if (p.status === 'none' || p.status === 'unscored') return null
  const c = p.current
  return round1(Math.min(scale, c.weightedSoFar + c.bonus + scale * c.remainingWeight))
}

export interface GoalCourse { id: string; credits: number; maxAverage: number }

export interface GpaGoalInput {
  goal: number
  /** Counted credits and grade points already done (GpaEngine: credits and cumulative × credits). */
  done: { credits: number; points: number }
  courses: GoalCourse[]
  scale?: number
}

export interface GpaGoalResult {
  reachable: boolean
  /** Average needed over the in-progress credits; null without in-progress credits. */
  neededAverage: number | null
  /** Uniform level x; each course's target is min(x, its highest reachable average). */
  level: number | null
  targets: Record<string, number>
  /** The highest cumulative GPA reachable with every course at its highest reachable average. */
  highestGpa: number | null
}

export function gpaGoal({ goal, done, courses, scale = 10 }: GpaGoalInput): GpaGoalResult {
  const live = courses.filter((c) => c.credits > 0)
  const sumC = live.reduce((s, c) => s + c.credits, 0)
  const best = live.reduce((s, c) => s + c.credits * Math.min(c.maxAverage, scale), 0)
  const highestGpa = done.credits + sumC > 0 ? (done.points + best) / (done.credits + sumC) : null
  if (!sumC) {
    const current = done.credits > 0 ? done.points / done.credits : null
    return { reachable: current !== null && current >= goal - EPS, neededAverage: null, level: null, targets: {}, highestGpa }
  }
  const neededAverage = (goal * (done.credits + sumC) - done.points) / sumC
  const need = neededAverage * sumC
  const reached = (x: number) => live.reduce((s, c) => s + c.credits * Math.min(x, c.maxAverage, scale), 0)
  if (best < need - EPS) {
    const targets = Object.fromEntries(live.map((c) => [c.id, Math.min(c.maxAverage, scale)]))
    return { reachable: false, neededAverage, level: scale, targets, highestGpa }
  }
  let lo = 0
  let hi = scale
  if (need <= EPS) hi = 0
  else {
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2
      if (reached(mid) >= need - EPS) hi = mid
      else lo = mid
    }
  }
  const targets = Object.fromEntries(live.map((c) => [c.id, Math.min(hi, c.maxAverage, scale)]))
  return { reachable: true, neededAverage, level: hi, targets, highestGpa }
}

export interface EffectiveTarget { tier: number; derived: number | null; effective: number; from: 'tier' | 'gpa' }

/** Both targets and the higher one as the effective target (R7.6). */
export function effectiveTarget(tier: TierId, derived: number | null): EffectiveTarget {
  const t = TIERS[tier]
  if (derived === null || derived <= t) return { tier: t, derived, effective: t, from: 'tier' }
  return { tier: t, derived, effective: derived, from: 'gpa' }
}
