// Grade exporter (grades R11.1 to R11.3; platform amendment: a blob link, no `downloads`): the transcript
// rows, per-semester and cumulative GPA, the non-GPA list used and the export date, as CSV (UTF-8 with a
// byte-order mark, so Vietnamese names open correctly in spreadsheets) and as JSON.
import { computeGpa, formatGpa, type GpaResult } from './engine/gpa'
import type { Transcript, TranscriptRow } from './types'

export const BOM = '﻿'

export function statusText(s: TranscriptRow['status']): string {
  if (typeof s === 'object') return s.raw
  return { passed: 'Passed', exempt: 'Exempt', 'in-progress': 'In progress', 'not-passed': 'Not passed' }[s]
}

/** RFC 4180 quoting; a leading =, +, - or @ is prefixed with ' so spreadsheets do not run it as a formula. */
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const line = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(',')

export interface GradeExport {
  formatVersion: 1
  exportedAt: string
  nonGpa: string[]
  cumulative: { gpa: string | null; credits: number }
  semesters: { name: string; gpa: string | null; credits: number }[]
  rows: (Omit<TranscriptRow, 'status'> & { status: string; counted: boolean })[]
  /** Replaced or extra subjects: information only, never counted (R1.2). */
  replaced: { semester: string; code: string; name: string; credits: number; grade: number | null; status: string }[]
}

export function buildExport(t: Transcript, nonGpa: readonly string[], now = new Date(), gpa: GpaResult = computeGpa({ rows: t.rows, nonGpa })): GradeExport {
  return {
    formatVersion: 1,
    exportedAt: now.toISOString(),
    nonGpa: [...nonGpa],
    cumulative: { gpa: formatGpa(gpa.cumulative), credits: gpa.credits },
    semesters: gpa.semesters.map((s) => ({ name: s.name, gpa: formatGpa(s.gpa), credits: s.credits })),
    rows: t.rows.map((r) => ({ ...r, status: statusText(r.status), counted: gpa.counted.has(r.id) })),
    replaced: t.replaced.map((r) => ({ ...r, status: statusText(r.status) })),
  }
}

export function toCsv(e: GradeExport): string {
  const out = [
    line(['FAP-AIO grade export']),
    line(['Exported', e.exportedAt]),
    line(['Not counted in GPA', e.nonGpa.join(', ')]),
    line(['Cumulative GPA', e.cumulative.gpa ?? '', 'Counted credits', e.cumulative.credits]),
    '',
    line(['Semester', 'GPA', 'Counted credits']),
    ...e.semesters.map((s) => line([s.name, s.gpa ?? '', s.credits])),
    '',
    line(['Term', 'Semester', 'Subject code', 'Subject name', 'Credits', 'Grade', 'Status', 'Counted in GPA', 'Prerequisites', 'Replaced subject']),
    ...e.rows.map((r) => line([r.term, r.semester, r.code, r.name, r.credits, r.grade, r.status, r.counted ? 'Yes' : 'No', r.prerequisites, r.replaced])),
  ]
  if (e.replaced.length) {
    out.push('', line(['Replaced or extra subjects (not counted)']), line(['Semester', 'Subject code', 'Subject name', 'Credits', 'Grade', 'Status']))
    out.push(...e.replaced.map((r) => line([r.semester, r.code, r.name, r.credits, r.grade, r.status])))
  }
  return BOM + out.join('\r\n') + '\r\n'
}

export const toJson = (e: GradeExport) => JSON.stringify(e, null, 2)

export function exportFileName(format: 'csv' | 'json', now = new Date()): string {
  return `fap-aio-grades-${now.toISOString().slice(0, 10)}.${format}`
}

/** Starts the download from a blob link inside the panel. */
export function downloadGrades(container: Node, format: 'csv' | 'json', e: GradeExport, now = new Date()): void {
  const type = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
  const url = URL.createObjectURL(new Blob([format === 'csv' ? toCsv(e) : toJson(e)], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = exportFileName(format, now)
  a.hidden = true
  container.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
