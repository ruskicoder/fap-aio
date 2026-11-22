// GPA scale (grades R13, GRD-7.1): the 10-point scale FAP grades on, or the 4-point scale through letter
// grades. Pure: no DOM, no storage. The 4-point GPA runs GpaEngine on mapped grades, so counting,
// exclusions and semester order stay exactly those of the 10-point GPA (R13.3).
//
// Letter bands: Vietnam's Circular 08/2021/TT-BGDĐT, Regulation on undergraduate education (Quy chế đào
// tạo trình độ đại học), articles on course grading and on term and cumulative results: A 8.5 to 10,
// B 7.0 to 8.4, C 5.5 to 6.9, D 4.0 to 5.4, F below 4.0, converted for GPA as A 4, B 3, C 2, D 1, F 0.
// The official text could not be opened from the build environment on 2026-11-22 (vbpl.vn, moet.gov.vn
// and thuvienphapluat.vn unreachable); this is the common five-band table that secondary legal summaries
// state for the circular (for example luatvietnam.vn, "Cách quy đổi điểm hệ 10 sang hệ 4"). Institutions
// may add finer levels such as A+ or B+; FAP-AIO keeps the five base levels. A check is on the vet list.
import { computeGpa, type GpaInput, type GpaResult } from './gpa'

export type GpaScale = '10' | '4'
export const DEFAULT_SCALE: GpaScale = '10'
export const SCALE_LABELS: Record<GpaScale, string> = { '10': '10-point (Vietnam)', '4': '4-point (global)' }

export type Letter = 'A' | 'B' | 'C' | 'D' | 'F'

/** The only letter-grade table: lowest 10-point grade of each band, highest band first. */
export const LETTER_BANDS: readonly { letter: Letter; min: number; points: number }[] = [
  { letter: 'A', min: 8.5, points: 4 },
  { letter: 'B', min: 7.0, points: 3 },
  { letter: 'C', min: 5.5, points: 2 },
  { letter: 'D', min: 4.0, points: 1 },
  { letter: 'F', min: 0, points: 0 },
]

/** One decimal, half up: the precision FAP shows, so 8.45 is compared as 8.5. */
const round1 = (x: number) => Math.round(x * 10 + 1e-9) / 10

function bandOf(grade: number | null | undefined) {
  if (grade === null || grade === undefined || !Number.isFinite(grade)) return null
  const g = round1(Math.min(10, Math.max(0, grade)))
  return LETTER_BANDS.find((b) => g >= b.min) ?? LETTER_BANDS.at(-1)!
}

/** The letter of a 10-point course grade; null when there is no grade. */
export const letterOf = (grade: number | null | undefined): Letter | null => bandOf(grade)?.letter ?? null

/** The 4-point value of a 10-point course grade; null when there is no grade. */
export const pointsOf = (grade: number | null | undefined): number | null => bandOf(grade)?.points ?? null

/** GPA on the chosen scale: per course conversion first, then the credit weighting of GpaEngine. */
export function computeGpaOn(scale: GpaScale, input: GpaInput): GpaResult {
  if (scale === '10') return computeGpa(input)
  return computeGpa({ ...input, rows: input.rows.map((r) => ({ ...r, grade: pointsOf(r.grade) })) })
}

export const isScale = (v: unknown): v is GpaScale => v === '10' || v === '4'

/** `8.6 (A)`, or the grade alone when it has no letter. */
export function gradeWithLetter(grade: number | null | undefined, digits = 1): string | null {
  if (grade === null || grade === undefined || !Number.isFinite(grade)) return null
  return `${grade.toFixed(digits)} (${letterOf(grade)})`
}
