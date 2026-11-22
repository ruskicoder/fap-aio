// The academic record as terms and courses (grades R14.1, R14.2, R14.8): the transcript rows of each term
// matched to FAP's grade-page courses and their stored mark sheets. Pure, and free of the FAP access layer,
// so the Record view, the printable list and the record export share it.
import { semesterOrder } from './engine/gpa'
import { statusText } from './export'
import type { RecordSheet, RecordStore } from './record'
import type { CourseRef, MarkSheet, TranscriptRow } from './types'

export interface RecordComponent { category: string; item: string; weight: string; value: string; total: boolean }

export interface RecordCourse {
  key: string
  termId: string | null
  code: string | null
  name: string
  credits: number | null
  /** The transcript grade, else the mark sheet's course average. */
  grade: number | null
  status: string
  row: TranscriptRow | null
  ref: CourseRef | null
  sheet: RecordSheet | null
}

export interface RecordTermView {
  id: string | null
  name: string
  /** When the term's course list was read; null while only its name (or its transcript rows) is known. */
  readAt: number | null
  courses: RecordCourse[]
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
/** `Name (CODE) (Group)` to `Name`. */
export const labelName = (label: string) => label.replace(/\s*\([^()]*\)\s*\([^()]*\)\s*$/, '').trim() || label

const SHEET_STATUS: Record<string, string> = { passed: 'Passed', failed: 'Not passed', studying: 'Studying' }
export const sheetStatusText = (s: string | null | undefined) => (s ? SHEET_STATUS[s] ?? s : null)

export function components(sheet: MarkSheet | null | undefined): RecordComponent[] {
  return (sheet?.rows ?? []).flatMap((r) => (r.kind === 'summary' ? [] : [{ category: r.group, item: r.kind === 'group-total' ? 'Total' : r.name, weight: r.weight, value: r.value, total: r.kind === 'group-total' }]))
}

export function recordTerms(store: RecordStore): RecordTermView[] {
  const rows = store.transcript?.rows ?? []
  const names = new Map<string, { id: string | null; name: string; fap: number }>()
  store.termOrder.forEach((id, i) => {
    const t = store.terms[id]
    if (t) names.set(norm(t.name), { id, name: t.name, fap: i })
  })
  for (const r of rows) if (!names.has(norm(r.semester))) names.set(norm(r.semester), { id: null, name: r.semester, fap: Number.MAX_SAFE_INTEGER })
  const order = (n: { name: string; fap: number }) => { const o = semesterOrder(n.name); return o === Number.MAX_SAFE_INTEGER ? -1 : o }
  const list = [...names.values()].sort((a, b) => order(b) - order(a) || a.fap - b.fap)
  return list.flatMap(({ id, name }) => {
    const term = id ? store.terms[id] : undefined
    const refs = term?.courses ?? []
    const used = new Set<string>()
    const courses: RecordCourse[] = rows.filter((r) => norm(r.semester) === norm(name)).map((row) => {
      const ref = refs.find((c) => !used.has(c.id) && c.code?.toUpperCase() === row.code.toUpperCase()) ?? null
      if (ref) used.add(ref.id)
      const sheet = ref ? store.sheets[ref.id] ?? null : null
      return { key: row.id, termId: id, code: row.code, name: row.name, credits: row.credits, grade: row.grade ?? sheet?.sheet.summary.average ?? null, status: statusText(row.status), row, ref, sheet }
    })
    for (const ref of refs) {
      if (used.has(ref.id)) continue
      const sheet = store.sheets[ref.id] ?? null
      courses.push({ key: `${id}|${ref.id}`, termId: id, code: ref.code, name: sheet?.sheet.header?.title || labelName(ref.label), credits: null, grade: sheet?.sheet.summary.average ?? null, status: sheetStatusText(sheet?.sheet.summary.status) ?? '-', row: null, ref, sheet })
    }
    if (!courses.length && term?.readAt) return []
    return [{ id, name, readAt: term?.readAt ?? null, courses }]
  })
}

/** Counts for the progress line and the empty state. */
export const sheetCount = (store: RecordStore) => Object.keys(store.sheets).length
