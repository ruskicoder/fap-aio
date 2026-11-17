// GpaEngine (grades R2.1, R2.2, R2.4, R2.5, R2.6, R1.2; constraints "GPA calculation"). Pure: no DOM,
// no storage. Only main transcript rows are taken, so the replaced-subjects table never counts.
import type { TranscriptRow } from '../types'

/** Owner default, 2026-10-10 (constraints.md); user-editable in grade settings (GRD-3). */
export const DEFAULT_NON_GPA: readonly string[] = ['GDQP', 'ENT', 'VOV', 'TRS', 'ÐSA', 'ĐSA', 'TMI', 'LAB', 'OJS', 'OJT', 'SYB301']

export interface GpaInput {
  rows: TranscriptRow[]
  nonGpa: readonly string[]
}

export interface SemesterGpa {
  name: string
  order: number
  gpa: number | null
  credits: number
  /** Ids of the counted rows of this semester. */
  rows: string[]
}

export interface GpaResult {
  cumulative: number | null
  credits: number
  semesters: SemesterGpa[]
  counted: Set<string>
}

const key = (s: string) => s.normalize('NFC').trim().toUpperCase()

/** True when the code starts with an entry of the list, compared case-insensitively; blank entries are ignored. */
export function isExcluded(code: string, list: readonly string[]): boolean {
  const c = key(code)
  return list.some((e) => key(e) !== '' && c.startsWith(key(e)))
}

const SEASON: Record<string, number> = { spring: 1, summer: 2, fall: 3 }

/** `year * 10 + {Spring 1, Summer 2, Fall 3}`; an unrecognised name sorts last. */
export function semesterOrder(name: string): number {
  const m = /^(spring|summer|fall)\s*(\d{4})$/i.exec(name.trim())
  return m ? Number(m[2]) * 10 + SEASON[m[1]!.toLowerCase()]! : Number.MAX_SAFE_INTEGER
}

/** Passed, numeric grade, credits above 0 and not excluded (R2.1, R2.2, R2.6). */
export function isCounted(row: TranscriptRow, nonGpa: readonly string[]): boolean {
  return row.status === 'passed' && row.grade !== null && Number.isFinite(row.grade) && row.credits > 0 && !isExcluded(row.code, nonGpa)
}

function mean(rows: TranscriptRow[]): { gpa: number | null; credits: number } {
  const credits = rows.reduce((n, r) => n + r.credits, 0)
  if (!credits) return { gpa: null, credits: 0 }
  return { gpa: rows.reduce((n, r) => n + r.grade! * r.credits, 0) / credits, credits }
}

export function computeGpa({ rows, nonGpa }: GpaInput): GpaResult {
  const counted = rows.filter((r) => isCounted(r, nonGpa))
  const bySemester = new Map<string, TranscriptRow[]>()
  for (const r of rows) if (!bySemester.has(r.semester)) bySemester.set(r.semester, [])
  for (const r of counted) bySemester.get(r.semester)!.push(r)
  const semesters = [...bySemester].map(([name, list]) => ({ name, order: semesterOrder(name), ...mean(list), rows: list.map((r) => r.id) }))
  semesters.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const total = mean(counted)
  return { cumulative: total.gpa, credits: total.credits, semesters, counted: new Set(counted.map((r) => r.id)) }
}

/** Two decimals for display (R2.5); null stays null so the view decides what to show. */
export function formatGpa(gpa: number | null): string | null {
  return gpa === null ? null : (Math.round(gpa * 100 + Number.EPSILON) / 100).toFixed(2)
}
