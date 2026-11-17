// CourseModeler (grades R4.1 to R4.10, R12.2): a TypeScript port of `courseModel` in
// tools/flm-scraper/marksheet.mjs. Weights and items come from the FAP mark sheet (how the class is
// actually graded); FLM gives the completion criteria and the exam kind. Groups without an FLM match
// fall back to the owner rules (constraints.md): finals at least 4, everything else above 0.
// Pure: the rubric entry is passed in. `loadCourseModel` fetches it through the dataClient, whose
// service worker lookup already tries the code without a trailing lowercase letter.
import type { SubjectRule } from '../../../shared/data/schemas'
import type { Reply } from '../../../shared/messages'
import type { RulesReply } from '../../../shared/data/types'
import { numberOf, summaryOf } from '../parse/marksheet'
import type { MarkSheetRow, MarkSheetSummary } from '../types'

export interface Criterion { value: number; inclusive: boolean }

export interface ModelAssessment {
  index: number
  category: string
  type: 'final' | 'ongoing' | 'other'
  finalKind: string | null
  parts: number
  weight: number
  weightPerPart: number
  completion: Criterion | null
  parentIndex: number | null
}

export interface ModelSubject {
  code: string | null
  scored: boolean
  scoringScale: number
  minAvgMarkToPass: number | null
  attendance: { minPercent: number; source: string; evidence?: string }
  coursera: { required: boolean; bonus?: boolean }
  hasFinal: boolean
  assessments: ModelAssessment[]
  weightSum: number
  bonus: number
  latePenaltyPercent?: number
  flags: string[]
  source: 'fap-marksheet' | 'flm-plan'
}

export interface GroupMapping {
  group: string
  items: string[]
  flmIndex: number | null
  flmCategory: string | null
  /** Match score: name overlap plus 0.5 for equal weight and 0.25 for equal part count. */
  confidence: number
  assessmentIndex: number[]
  resitApplied?: boolean
}

export type Scores = Record<number, (number | null)[]>

export interface CourseModel {
  /** `none`: neither FLM nor items (R4.8); `unscored`: FLM says not scored (R4.7). */
  result: 'model' | 'unscored' | 'none'
  subject: ModelSubject | null
  scores: Scores
  mapping: GroupMapping[]
  summary: MarkSheetSummary
}

/** Below this the mapping is shown with a warning (R4.9). */
export const WEAK_CONFIDENCE = 0.75

const norm = (s: string | null | undefined) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\(resit\)/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Abbreviations used on FAP mark sheets and FLM categories.
const ALIASES: [RegExp, string][] = [
  [/\bfe\b|final exam|final|thi cuoi ky|ket thuc hoc phan/, 'final'],
  [/\bpe\b|practical exam|practical|thuc hanh/, 'practical'],
  [/\bte\b|theory exam|theoretical/, 'theory'],
  [/\bpt\b|progress tests?|kiem tra/, 'progress'],
  [/assignments?|asm/, 'assignment'],
  [/labs?\b|lab /, 'lab'],
  [/workshops?/, 'workshop'],
  [/participation|attendance|chuyen can|tham gia/, 'participation'],
  [/presentation|thuyet trinh/, 'presentation'],
  [/quiz(zes)?/, 'quiz'],
  [/project|du an/, 'project'],
]

function tokens(s: string): Set<string> {
  const n = norm(s)
  const t = new Set(n.split(' ').filter((w) => w && !/^\d+$/.test(w)))
  for (const [re, tag] of ALIASES) if (re.test(n)) t.add('#' + tag)
  return t
}

export function nameScore(a: string, b: string): number {
  const x = tokens(a)
  const y = tokens(b)
  if (!x.size || !y.size) return 0
  let inter = 0
  for (const w of x) if (y.has(w)) inter++
  return inter / Math.max(x.size, y.size)
}

const isResit = (g: string) => /\(\s*resit\s*\)|thi lại|\bresit\b/i.test(g)
const looksFinal = (g: string) => /\b(fe|pe|te)\b|final|thi cuối|kết thúc|practical exam/i.test(g)
const fix = (x: number, d: number) => +x.toFixed(d)

type Item = Extract<MarkSheetRow, { kind: 'item' | 'group-total' }>

const resultOf = (subject: ModelSubject | null): CourseModel['result'] =>
  !subject ? 'none' : subject.scored === false ? 'unscored' : 'model'

/** Builds the course model from an FLM rubric entry (or null) and the mark sheet rows. */
export function courseModel(flm: SubjectRule | null, rows: MarkSheetRow[]): CourseModel {
  const items = rows.filter((r): r is Item => r.kind === 'item' && !!r.name && !/^total$/i.test(r.name))
  const summary = summaryOf(rows)
  // No items yet (course not started, or a result-only sheet): FLM's plan without scores (R4.6).
  if (!items.length) {
    const subject = flm ? ({ ...flm, bonus: summary.bonus ?? 0, source: 'flm-plan' } as unknown as ModelSubject) : null
    return { result: resultOf(subject), subject, scores: {}, mapping: [], summary }
  }
  const groups = new Map<string, Item[]>()
  const resits: Item[] = []
  for (const r of items) {
    if (isResit(r.group)) {
      resits.push(r)
      continue
    }
    if (!groups.has(r.group)) groups.set(r.group, [])
    groups.get(r.group)!.push(r)
  }

  const candidates = flm ? flm.assessments.filter((a) => a.weight) : []
  const used = new Set<number>()
  const mapping: GroupMapping[] = []
  const assessments: ModelAssessment[] = []
  const scores: Scores = {}
  let i = 0
  for (const [group, list] of groups) {
    const weights = list.map((r) => (numberOf(r.weight) ?? 0) / 100)
    const total = weights.reduce((s, w) => s + w, 0)
    // Score each FLM row: name similarity plus weight and part-count agreement (R4.1).
    let best: { a: (typeof candidates)[number]; score: number } | null = null
    for (const a of candidates) {
      if (used.has(a.index)) continue
      const s = nameScore(group, a.category) + (Math.abs(a.weight - total) < 0.005 ? 0.5 : 0) + (a.parts === list.length ? 0.25 : 0)
      if (!best || s > best.score) best = { a, score: s }
    }
    const match = best && best.score >= 0.5 ? best.a : null
    if (match) {
      used.add(match.index)
      // An aggregate and its sub-rows describe the same marks; block the other side.
      for (const a of candidates) if (a.parentIndex === match.index || match.parentIndex === a.index) used.add(a.index)
    }
    const fapFinal = looksFinal(group)
    const type: ModelAssessment['type'] = match ? (match.type === 'final' ? 'final' : 'ongoing') : fapFinal ? 'final' : 'ongoing'
    const finalKind = type !== 'final' ? null : match?.finalKind || (/\bpe\b|practical/i.test(group) ? 'PE' : 'FE')
    // Owner rules when FLM has no criterion (R4.2).
    const completion = match?.completion || (type === 'final' ? { value: 4, inclusive: true } : { value: 0, inclusive: false })
    const confidence = best ? fix(best.score, 2) : 0
    const evenSplit = weights.every((w) => Math.abs(w - weights[0]!) < 0.0005)
    if (evenSplit) {
      assessments.push({ index: i, category: group, type, finalKind, parts: list.length, weight: fix(total, 4), weightPerPart: fix(weights[0] || 0, 4), completion, parentIndex: null })
      scores[i] = list.map((r) => numberOf(r.value))
      mapping.push({ group, items: list.map((r) => r.name), flmIndex: match?.index ?? null, flmCategory: match?.category ?? null, confidence, assessmentIndex: [i] })
      i++
    } else {
      // Uneven item weights (R4.3): a parent row carrying the group criterion, checked on the weighted
      // group average, and one child row per item, above 0 unless FLM has a sub-row of the same name.
      const parent = i++
      assessments.push({ index: parent, category: group, type, finalKind, parts: list.length, weight: fix(total, 4), weightPerPart: fix(total / list.length, 4), completion, parentIndex: null })
      const idx: number[] = []
      list.forEach((r, k) => {
        const sub = candidates.find((a) => a.parentIndex != null && nameScore(r.name, a.category) >= 0.5)
        assessments.push({ index: i, category: `${group}: ${r.name}`, type, finalKind, parts: 1, weight: fix(weights[k]!, 4), weightPerPart: fix(weights[k]!, 4), completion: sub?.completion || { value: 0, inclusive: false }, parentIndex: parent })
        scores[i] = [numberOf(r.value)]
        idx.push(i++)
      })
      mapping.push({ group, items: list.map((r) => r.name), flmIndex: match?.index ?? null, flmCategory: match?.category ?? null, confidence, assessmentIndex: idx })
    }
  }

  // A graded resit replaces the score of its base group's item with the same name (R4.4).
  for (const r of resits) {
    const v = numberOf(r.value)
    if (v == null) continue
    const base = r.group.replace(/\(\s*resit\s*\)/i, '').trim()
    const m = mapping.find((x) => norm(x.group) === norm(base))
    if (!m) continue
    const pos = m.items.findIndex((n) => norm(n) === norm(r.name))
    const k = m.assessmentIndex.length > 1 ? m.assessmentIndex[Math.max(0, pos)]! : m.assessmentIndex[0]!
    const p = m.assessmentIndex.length > 1 ? 0 : Math.max(0, pos)
    scores[k]![p] = v
    m.resitApplied = true
  }

  const weightSum = fix(assessments.filter((a) => a.parentIndex == null).reduce((s, a) => s + a.weight, 0), 4)
  const late = summary.latePenaltyPercent ?? 0
  const subject: ModelSubject = {
    code: flm?.code ?? null,
    // FLM "Is Scored: False" (LAB211 ...): pass by completion, FAP status decides (R4.7).
    scored: flm?.scored ?? true,
    scoringScale: 10,
    minAvgMarkToPass: flm?.minAvgMarkToPass ?? 5,
    attendance: flm?.attendance ?? { minPercent: 80, source: 'default' },
    coursera: flm?.coursera ?? { required: false },
    hasFinal: assessments.some((a) => a.type === 'final'),
    assessments,
    weightSum,
    bonus: summary.bonus ?? 0,
    latePenaltyPercent: late,
    flags: [
      ...(flm?.flags ?? []),
      ...(late ? ['late-penalty-unmodelled'] : []),
      ...(Math.abs(weightSum - 1) > 0.001 ? ['fap-weights-not-100'] : []),
      ...(mapping.some((m) => m.flmIndex == null) ? ['unmatched-groups'] : []),
    ],
    source: 'fap-marksheet',
  }
  return { result: resultOf(subject), subject, scores, mapping, summary }
}

/** Groups matched with a confidence below 0.75 (R4.9). */
export function weakGroups(model: CourseModel): string[] {
  return model.mapping.filter((m) => m.flmIndex != null && m.confidence < WEAK_CONFIDENCE).map((m) => m.group)
}

export type RulesLookup = (codes: string[]) => Promise<Reply<RulesReply>>

/**
 * Looks the rubric entry up (the service worker tries the code without its trailing lowercase letter)
 * and models the course. A failed lookup models the course without FLM, under the owner rules.
 */
export async function loadCourseModel(code: string | null, rows: MarkSheetRow[], rules: RulesLookup): Promise<CourseModel> {
  let flm: SubjectRule | null = null
  if (code) {
    const r = await rules([code])
    if (r.ok) flm = r.value.subjects[code] ?? null
  }
  return courseModel(flm, rows)
}
