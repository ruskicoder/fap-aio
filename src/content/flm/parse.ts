// FLM syllabus detail parsing (platform R6.3, R6.5; design, "Live FLM read"): a TypeScript port of the
// detail reading in tools/flm-scraper/flm-scraper.js and of normaliseSyllabus and compact in
// tools/flm-scraper/build-subject-list.mjs. It runs in a FAP tab on `flm.parse` (the service worker has no
// DOM parser) and returns the full and compact entries, validated by the data schemas. The parity test keeps
// it equal to the reference tools.
import { subjectFull, subjectRule, type SubjectFull, type SubjectRule } from '../../shared/data/schemas'

type Cell = string | boolean
export interface RawTable { headers: string[]; rows: Cell[][] }
export interface RawDetail { detail: Record<string, string>; tables: Record<string, RawTable | null> }

const TABLES = ['gvMaterial', 'gvLO', 'gvSchedule', 'gvCQ', 'gvAssessment'] as const

// Same whitespace rules as the reference tool, including the no-break space.
const text = (el: Element | null | undefined) =>
  el ? (el.textContent ?? '').replace(/\r/g, '').replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim() : ''

export function parseTable(table: HTMLTableElement | null): RawTable | null {
  if (!table) return null
  const rows = [...table.rows]
  const headers = rows.length ? [...rows[0]!.cells].map(text) : []
  const body = rows.slice(1).map((r) =>
    [...r.cells].map((c): Cell => {
      const box = c.querySelector<HTMLInputElement>('input[type=checkbox]')
      if (box) return box.checked
      const v = text(c)
      const a = c.querySelector('a[href]')
      const href = a?.getAttribute('href') ?? ''
      return a && /^https?:/i.test(href) && !v.includes(href) ? `${v} <${href}>` : v
    }),
  )
  return { headers, rows: body }
}

/** `#table-detail` key and value rows and the five tables, or null when the page is not a detail page. */
export function parseDetail(doc: Document): RawDetail | null {
  const det = doc.querySelector<HTMLTableElement>('#table-detail')
  if (!det) return null
  const detail: Record<string, string> = {}
  for (const r of det.rows) if (r.cells.length >= 2) detail[text(r.cells[0]).replace(/:\s*$/, '')] = text(r.cells[1])
  const tables: Record<string, RawTable | null> = {}
  for (const id of TABLES) tables[id] = parseTable(doc.getElementById(id) as HTMLTableElement | null)
  return { detail, tables }
}

// ---- normalisation (port of build-subject-list.mjs) ----------------------------------------------------

const DEFAULT_RULES = { minAvgMarkToPass: 5, attendanceMinPercent: 80 }
const CODE_RE = /\b[A-Z]{2,4}\d{3}[a-z]?\b/g
const clean = (s: unknown) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim())
const num = (s: unknown): number | null => {
  const m = clean(s).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}
const bool = (s: unknown) => (typeof s === 'boolean' ? s : /^true$/i.test(clean(s)))

function splitName(name: unknown, english: unknown) {
  const s = clean(name)
  const i = s.indexOf('_')
  return { en: clean(english) || (i > 0 ? s.slice(0, i) : s), vi: i > 0 ? s.slice(i + 1) : '' }
}

function parseDecision(s: unknown) {
  const t = clean(s)
  const m = t.match(/^(.*?)\s*dated\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  if (!m) return { number: t || null, date: null }
  return { number: m[1]!, date: `${m[4]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}` }
}

function isoDate(s: unknown) {
  const m = clean(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}` : null
}

export function parseCriterion(s: unknown): { value: number; inclusive: boolean } | null {
  const t = clean(s).replace('≥', '>=').replace(/\s/g, '')
  if (!t) return null
  const m = t.match(/^(>=|>|=>)?(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const value = Number(m[2]!.replace(',', '.'))
  if (m[1] === '>') return { value, inclusive: false }
  if (value === 0 && !m[1]) return { value: 0, inclusive: false }
  return { value, inclusive: true }
}

function finalKind(category: string, type: string) {
  const s = `${category} ${type}`
  if (/\b(2nd|second|resit|retake|re-?exam)\b|thi lại/i.test(s)) return 'resit'
  if (/\bPE\b|practical|thực hành/i.test(s)) return 'PE'
  if (/presentation|thuyết trình|defen[cs]e|bảo vệ|project|dự án/i.test(s)) return 'presentation'
  return 'FE'
}

const FINAL_TYPE_RE = /final|cuối kỳ|kết thúc|^(fe|pe|te)$|defen[cs]e|bảo vệ|practical exam/i
function classifyType(type: string, category: string): 'final' | 'ongoing' | 'other' {
  const t = type.replace(/\s+/g, ' ').trim()
  if (!t) return FINAL_TYPE_RE.test(category) ? 'final' : 'ongoing'
  if (FINAL_TYPE_RE.test(t)) return 'final'
  if (/^on\s*-?\s*goi\s*n\s*g$|^ongoing$|mid\s*-?\s*term|quiz|assignment/i.test(t)) return 'ongoing'
  return 'other'
}

const headerIndex = (headers: string[], re: RegExp) => headers.findIndex((h) => re.test(h))

export interface Assessment {
  index: number; category: string; type: 'final' | 'ongoing' | 'other'; typeRaw: string; finalKind: string | null
  parts: number; weight: number | null; weightPerPart: number | null; completion: { value: number; inclusive: boolean } | null
  completionRaw: string; duration: string; clo: string; questionType: string; questions: string; knowledgeAndSkill: string
  gradingGuide: string; note: string; parentIndex: number | null
}

function parseAssessments(table: RawTable | null | undefined): Assessment[] {
  if (!table || !table.rows.length) return []
  const h = table.headers
  const ix = {
    category: headerIndex(h, /^category/i), type: headerIndex(h, /^type/i), part: headerIndex(h, /^part/i),
    weight: headerIndex(h, /^weight/i), criteria: headerIndex(h, /completion/i), duration: headerIndex(h, /^duration/i),
    clo: headerIndex(h, /^(clo|lo)$/i), questionType: headerIndex(h, /question type/i), questions: headerIndex(h, /no question/i),
    knowledge: headerIndex(h, /knowledge/i), grading: headerIndex(h, /grading/i), note: headerIndex(h, /^note/i),
  }
  const at = (r: Cell[], k: keyof typeof ix): Cell => (ix[k] >= 0 ? r[ix[k]]! : '')
  return table.rows.map((r, i) => {
    const category = clean(at(r, 'category'))
    const type = clean(at(r, 'type')).replace(/\s+/g, ' ')
    const kind = classifyType(type, category)
    const isFinal = kind === 'final'
    const weightPct = num(at(r, 'weight'))
    const parts = Math.max(1, num(at(r, 'part')) || 1)
    return {
      index: i, category, type: kind, typeRaw: type, finalKind: isFinal ? finalKind(category, type) : null, parts,
      weight: weightPct == null ? null : +(weightPct / 100).toFixed(4),
      weightPerPart: weightPct == null ? null : +(weightPct / 100 / parts).toFixed(4),
      completion: parseCriterion(at(r, 'criteria')), completionRaw: clean(at(r, 'criteria')),
      duration: clean(at(r, 'duration')), clo: clean(at(r, 'clo')), questionType: clean(at(r, 'questionType')),
      questions: clean(at(r, 'questions')), knowledgeAndSkill: clean(at(r, 'knowledge')), gradingGuide: clean(at(r, 'grading')),
      note: String(at(r, 'note') ?? '').trim(), parentIndex: null,
    }
  })
}

function similarity(a: string, b: string) {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  let i = 0
  while (i < x.length && i < y.length && x[i] === y[i]) i++
  return i
}

function linkSubcomponents(list: Assessment[]): void {
  const total = list.reduce((s, a) => s + (a.weight || 0), 0)
  if (total <= 1.0001) return
  const counted = () => list.filter((a) => a.parentIndex == null).reduce((s, a) => s + (a.weight || 0), 0)
  const parents = list.filter((a) => a.parts > 1 && a.weight).sort((a, b) => b.weight! - a.weight!)
  for (const parent of parents) {
    if (counted() <= 1.0001) break
    if (parent.parentIndex != null) continue
    const pool = list.filter((a) => a !== parent && a.parentIndex == null && a.type === parent.type && a.weight && !list.some((b) => b.parentIndex === a.index) && (parent.type === 'final' || similarity(a.category, parent.category) >= 4))
    if (pool.length > 14) continue
    let best: Assessment[] | null = null
    let bestScore = -1
    for (let mask = 1; mask < 1 << pool.length; mask++) {
      const pick = pool.filter((_, i) => mask & (1 << i))
      const w = pick.reduce((s, a) => s + a.weight!, 0)
      const n = pick.reduce((s, a) => s + a.parts, 0)
      if (n !== parent.parts || Math.abs(w - parent.weight!) >= 0.0005 || counted() - w < 0.9995) continue
      const score = pick.reduce((s, a) => s + similarity(a.category, parent.category), 0) / pick.length
      if (score > bestScore || (score === bestScore && pick.length < best!.length)) {
        best = pick
        bestScore = score
      }
    }
    if (best) best.forEach((k) => (k.parentIndex = parent.index))
  }
}

function parseMaterials(table: RawTable | null | undefined) {
  if (!table) return []
  const h = table.headers
  const g = (r: Cell[], re: RegExp) => { const i = headerIndex(h, re); return i >= 0 ? r[i] : '' }
  return table.rows.map((r) => ({
    description: clean(g(r, /description/i)), author: clean(g(r, /author/i)), publisher: clean(g(r, /publisher/i)),
    published: clean(g(r, /published/i)), edition: clean(g(r, /edition/i)), isbn: clean(g(r, /isbn/i)),
    isMain: bool(g(r, /main/i)), isHardCopy: bool(g(r, /hard/i)), isOnline: bool(g(r, /online/i)), note: clean(g(r, /^note/i)),
  }))
}

const parseClos = (table: RawTable | null | undefined) => (table ? table.rows.map((r) => ({ id: clean(r[1]), details: String(r[2] ?? '').trim() })) : [])

function contactHours(s: unknown) {
  const t = clean(s)
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*h(?:ours?)?\s*(?:contact|of contact|on[- ]?class|in[- ]?class|offline)/i) || t.match(/(\d+(?:[.,]\d+)?)\s*giờ\s*(?:trên lớp|tiếp xúc)/i)
  return m ? Number(m[1]!.replace(',', '.')) : null
}

const COURSERA_RE = /coursera|\bMOOC\b|specialization/i
const MANDATORY_RE = /\bmust\b|required|have to|has to|in order to|to be (accepted|allowed|eligible|graded)|prior to|before the final|condition|điều kiện|bắt buộc|phải|certificat|chứng chỉ/i
const BONUS_RE = /bonus|plus \d|\+\s?\d(\.\d)? ?point|cộng/i

function detectCoursera(code: string, texts: string[], categories: string[] = []) {
  const evidence: string[] = []
  for (const t of texts) {
    if (!t) continue
    const re = new RegExp(COURSERA_RE.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(t))) evidence.push(clean(t.slice(Math.max(0, m.index - 160), m.index + 160)))
  }
  const mentioned = evidence.length > 0
  return {
    mentioned,
    required: evidence.some((e) => MANDATORY_RE.test(e)) || categories.some((c) => COURSERA_RE.test(c)) || (/\dc$/.test(code) && mentioned),
    bonus: evidence.some((e) => BONUS_RE.test(e)),
    suffixC: /\dc$/.test(code),
    evidence: [...new Set(evidence)].slice(0, 3),
  }
}

function attendance(studentTasks: unknown) {
  const t = clean(studentTasks)
  const absent = t.match(/(miss(?:es)?|absen\w*|vắng)[^.%]{0,30}?(\d{1,3})\s*%/i) || t.match(/(\d{1,3})\s*%[^.]{0,20}?(absen\w*|vắng)/i)
  if (absent) {
    const x = Number(/^\d/.test(absent[1]!) ? absent[1] : absent[2])
    return { minPercent: 100 - x, source: 'syllabus', evidence: absent[0] }
  }
  const m = t.match(/(\d{2,3})\s*%[^.]{0,80}?(contact|session|slot|class|attend|giờ học|buổi)/i) || t.match(/(attend|tham dự|có mặt)[^.]{0,40}?(\d{2,3})\s*%/i)
  if (!m) return { minPercent: DEFAULT_RULES.attendanceMinPercent, source: 'default', evidence: '' }
  return { minPercent: Number(/^\d/.test(m[1]!) ? m[1] : m[2]), source: 'syllabus', evidence: m[0] }
}

export interface ListInfo { sylId: number; code: string; subjectName?: string; decision?: string; isActive?: unknown; isApproved?: unknown }

/** Port of normaliseSyllabus: one raw detail to the full entry. */
export function normaliseSyllabus(raw: RawDetail & { sylId: number | string; list: ListInfo }) {
  const d = raw.detail
  const t = raw.tables
  const code = clean(d['Subject Code'] || raw.list.code)
  const assessments = parseAssessments(t.gvAssessment)
  linkSubcomponents(assessments)
  const counted = assessments.filter((a) => a.parentIndex == null)
  const weightSum = +counted.reduce((s, a) => s + (a.weight || 0), 0).toFixed(4)
  const scored = bool(d['Is Scored'])
  const notes = [d['StudentTasks'], d['Note'], ...assessments.map((a) => a.note), ...assessments.map((a) => a.category)]
  const prereqRaw = clean(d['Pre-Requisite'])
  const flags: string[] = []
  if (scored && !assessments.length) flags.push('no-assessment')
  if (scored && assessments.length && Math.abs(weightSum - 1) > 0.001) flags.push('weights-not-100')
  if (assessments.some((a) => a.parentIndex != null)) flags.push('has-subcomponents')
  if (assessments.some((a) => a.completionRaw && !a.completion)) flags.push('unparsed-criterion')
  if (assessments.some((a) => a.completion && a.completion.value > 5 && a.type !== 'final')) flags.push('criterion-suspect')
  if (assessments.some((a) => a.type === 'other')) flags.push('type-unclassified')
  if (assessments.some((a) => /on- ?goin g|Assignm ent|Checkp oint/.test(a.typeRaw + a.category))) flags.push('pdf-artifacts')
  return {
    code,
    sylId: Number(raw.sylId),
    name: splitName(d['Syllabus Name'] || raw.list.subjectName, d['Course Name English']),
    credits: num(d['NoCredit']),
    degreeLevel: clean(d['Degree Level']) || null,
    method: clean(d['Learning-Teaching Method']) || null,
    prerequisites: { raw: /^(none|không|n\/a|-)?$/i.test(prereqRaw) ? '' : prereqRaw, codes: [...new Set(prereqRaw.match(CODE_RE) || [])] },
    scored,
    scoringScale: num(d['Scoring Scale']),
    minAvgMarkToPass: num(d['MinAvgMarkToPass']) ?? (scored ? DEFAULT_RULES.minAvgMarkToPass : null),
    decision: parseDecision(d['DecisionNo MM/dd/yyyy'] || raw.list.decision),
    approvedDate: isoDate(d['ApprovedDate']),
    isActive: bool(d['IsActive'] ?? raw.list.isActive),
    isApproved: bool(d['IsApproved'] ?? raw.list.isApproved),
    timeAllocation: clean(d['Time Allocation']),
    contactHours: contactHours(d['Time Allocation']),
    syllabusSessions: t.gvSchedule ? t.gvSchedule.rows.length : 0,
    attendance: attendance(d['StudentTasks']),
    hasFinal: assessments.some((a) => a.type === 'final'),
    coursera: detectCoursera(code, notes.map((x) => String(x || '')), assessments.map((a) => a.category)),
    assessments,
    weightSum,
    flags,
    materials: parseMaterials(t.gvMaterial),
    clos: parseClos(t.gvLO),
    description: String(d['Description'] || '').trim(),
    studentTasks: String(d['StudentTasks'] || '').trim(),
    tools: String(d['Tools'] || '').trim(),
    note: String(d['Note'] || '').trim(),
  }
}
export type Normalised = ReturnType<typeof normaliseSyllabus>

/** Port of compact's per-subject projection. */
export function compactEntry(s: Normalised) {
  return {
    code: s.code, name: s.name.en, credits: s.credits, scored: s.scored, scoringScale: s.scoringScale, minAvgMarkToPass: s.minAvgMarkToPass,
    prerequisites: s.prerequisites.codes, attendance: s.attendance, coursera: { required: s.coursera.required, bonus: s.coursera.bonus },
    hasFinal: s.hasFinal,
    assessments: s.assessments.map((a) => ({ index: a.index, category: a.category, type: a.type, finalKind: a.finalKind, parts: a.parts, weight: a.weight, weightPerPart: a.weightPerPart, completion: a.completion, parentIndex: a.parentIndex })),
    weightSum: s.weightSum, flags: s.flags, sylId: s.sylId,
  }
}

export type FlmParsed = { full: SubjectFull; rules: SubjectRule } | { error: string }

/** A detail page to validated full and compact entries, or why it could not be read (signed out, layout changed). */
export function parseFlmDetail(html: string, code: string, sylId: number, doc?: Document): FlmParsed {
  const page = doc ?? new DOMParser().parseFromString(html, 'text/html')
  const raw = parseDetail(page)
  if (!raw) return { error: 'no #table-detail (signed out or layout changed)' }
  const full = normaliseSyllabus({ ...raw, sylId, list: { sylId, code } })
  const f = subjectFull.safeParse(full)
  const r = subjectRule.safeParse(compactEntry(full))
  if (!f.success || !r.success) return { error: `the syllabus for ${code} does not have the expected fields` }
  return { full: f.data, rules: r.data }
}
