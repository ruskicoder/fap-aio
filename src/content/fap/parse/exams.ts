// Exam schedule parser (core R7.1, R7.4, R7.5): `table.fap-sheet` on /ExamSchedule, columns by
// position. Observed 2026-10-13 with nine columns (an Exam format column after Subject); the
// eight-column layout recorded on 2026-10-04 is still accepted.
import { LayoutChangedError } from '../registry'
import { fromDmy, parseTimeRange, todayVn } from '../../../shared/dates'
import type { Exam, ExamType } from '../../../features/scheduler/types'

const clean = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const TYPES: ExamType[] = ['FE', 'PE', '2NDFE', '2NDPE']

export function examTypeOf(raw: string): ExamType {
  const t = raw.trim().toUpperCase().replace(/\s+/g, '')
  return (TYPES as string[]).includes(t) ? (t as ExamType) : 'other'
}

const roomOf = (s: string) => (!s || s === '-' || /^tba$/i.test(s) ? null : s)

export function parseExams(doc: Document, now = Date.now()): Exam[] {
  const table = doc.querySelector('table.fap-sheet')
  if (!table) {
    if (doc.querySelector('.fap-empty-state, .fap-empty-card')) return []
    throw new LayoutChangedError('no table.fap-sheet on /ExamSchedule')
  }
  const today = todayVn(now)
  const out: Exam[] = []
  for (const tr of table.querySelectorAll('tbody tr')) {
    const c = [...tr.querySelectorAll('td')].map(clean)
    if (c.length < 8) continue
    const withFormat = c.length >= 9
    const at = (i: number) => c[withFormat || i < 4 ? i : i - 1] ?? ''
    const date = fromDmy(at(0))
    const range = parseTimeRange(at(1))
    const [code = '', ...name] = at(3).split(' - ')
    if (!date || !range || !code) continue
    const typeRaw = at(5)
    const type = examTypeOf(typeRaw)
    out.push({
      id: `${code}|${type}|${date}`,
      date,
      start: range[0],
      end: range[1],
      room: roomOf(at(2)),
      code,
      name: name.join(' - '),
      type,
      typeRaw,
      format: withFormat ? c[4] || null : null,
      publishDate: fromDmy(at(6)),
      attendanceNote: at(7),
      note: at(8),
      past: date < today,
      syncedAt: now,
    })
  }
  return out
}
