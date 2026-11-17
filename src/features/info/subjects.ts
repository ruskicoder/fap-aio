// Subjects helpers (info R2.1, R2.4, R2.5): merged search results, the transcript status of a subject,
// and the learning path (prerequisite ancestors to depth 5, direct dependents) with a cycle guard.
import type { SearchHit } from '../../shared/data/types'
import type { TranscriptRow } from '../grades/types'
import type { CurriculumRow } from './types'

export interface SubjectHit { code: string; name: string; nameVi: string | null; term: number | null; inCurriculum: boolean }

/** Curriculum rows that match the query first (in term order), then the rubric hits not already listed. */
export function mergeHits(q: string, hits: SearchHit[], curriculum: CurriculumRow[]): SubjectHit[] {
  const words = q.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/g, 'd').split(/\s+/).filter(Boolean)
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/g, 'd')
  const mine = curriculum
    .filter((r) => words.every((w) => fold(`${r.code} ${r.name}`).includes(w)))
    .sort((a, b) => (a.term ?? 99) - (b.term ?? 99) || a.code.localeCompare(b.code))
    .map((r) => ({ code: r.code, name: r.name, nameVi: null, term: r.term, inCurriculum: true }))
  const seen = new Set(mine.map((m) => m.code.toUpperCase()))
  const rest = hits.filter((h) => !seen.has(h.code.toUpperCase())).map((h) => ({ code: h.code, name: h.name, nameVi: h.nameVi, term: null, inCurriculum: false }))
  return [...mine, ...rest]
}

export type StudyStatus = 'passed' | 'in-progress' | 'not-started' | 'not-passed'

export function studyStatus(code: string, rows: TranscriptRow[]): StudyStatus {
  const mine = rows.filter((r) => r.code.toUpperCase() === code.toUpperCase())
  if (mine.some((r) => r.status === 'passed' || r.status === 'exempt')) return 'passed'
  if (mine.some((r) => r.status === 'in-progress')) return 'in-progress'
  if (mine.some((r) => r.status === 'not-passed')) return 'not-passed'
  return 'not-started'
}

/** Prerequisite levels: level 1 is the direct prerequisites; at most 5 levels; each code appears once. */
export async function ancestors(code: string, prereqsOf: (codes: string[]) => Promise<Record<string, string[]>>, depth = 5): Promise<string[][]> {
  const seen = new Set([code.toUpperCase()])
  const levels: string[][] = []
  let frontier = [code]
  for (let d = 0; d < depth && frontier.length; d++) {
    const map = await prereqsOf(frontier)
    const next = [...new Set(frontier.flatMap((c) => map[c] ?? []))].filter((c) => !seen.has(c.toUpperCase()))
    next.forEach((c) => seen.add(c.toUpperCase()))
    if (next.length) levels.push(next.sort())
    frontier = next
  }
  return levels
}

/** Subjects that list this one as a direct prerequisite. */
export function dependents(code: string, prereqs: Record<string, string[]>): string[] {
  const c = code.toUpperCase()
  return Object.entries(prereqs).filter(([k, list]) => k.toUpperCase() !== c && list.some((p) => p.toUpperCase() === c)).map(([k]) => k).sort()
}
