// Transcript parser (grades R1.1 to R1.5, design "Transcript parser"): on /Report/Transcript the main
// `table.fap-sheet` has 10 columns and the replaced-subjects table has 7. Columns are read by position,
// never by header text, so vi and en pages read the same.
import { LayoutChangedError } from '../../../content/fap/registry'
import { transcriptStatusOf } from '../../../content/fap/parse/constants'
import type { ReplacedRow, Transcript, TranscriptRow } from '../types'

const clean = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const orNull = (s: string) => (s === '' || s === '-' ? null : s)

/** A mark as FAP writes it (`9.3` in en, `5,5` in vi); `-` or no number gives null (R1.5). */
export function markOf(text: string): number | null {
  const t = text.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null
}

const numberOr0 = (text: string) => markOf(text) ?? 0

function statusOf(td: Element | undefined) {
  const badge = td?.querySelector('.badge')
  return transcriptStatusOf(clean(td), badge?.getAttribute('class') ?? '')
}

function columns(table: Element): number {
  const head = table.querySelectorAll('thead th').length
  if (head) return head
  return Math.max(0, ...[...table.querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td').length))
}

export function parseTranscript(doc: Document): Transcript {
  const tables = [...doc.querySelectorAll('.content-page table.fap-sheet')]
  const main = tables.find((t) => columns(t) === 10)
  if (!main) {
    if (doc.querySelector('.content-page .fap-empty-state, .content-page .fap-empty-card')) return { rows: [], replaced: [] }
    throw new LayoutChangedError('no 10-column table.fap-sheet on /Report/Transcript')
  }
  const rows: TranscriptRow[] = []
  for (const tr of main.querySelectorAll('tbody tr')) {
    const td = [...tr.querySelectorAll('td')]
    if (td.length < 10) continue
    const c = td.map(clean)
    const code = c[3]!
    const semester = c[2]!
    if (!code) continue
    rows.push({
      id: `${semester}|${code}`,
      term: c[1] && /^\d+$/.test(c[1]) ? Number(c[1]) : null,
      semester,
      code,
      name: c[6]!,
      prerequisites: orNull(c[4]!),
      replaced: orNull(c[5]!),
      credits: numberOr0(c[7]!),
      grade: markOf(c[8]!),
      status: statusOf(td[9]),
    })
  }
  const replaced: ReplacedRow[] = []
  const extra = tables.find((t) => columns(t) === 7)
  for (const tr of extra?.querySelectorAll('tbody tr') ?? []) {
    const td = [...tr.querySelectorAll('td')]
    if (td.length < 7) continue
    const c = td.map(clean)
    if (!c[2]) continue
    replaced.push({ semester: c[1]!, code: c[2], name: c[3]!, credits: numberOr0(c[4]!), grade: markOf(c[5]!), status: statusOf(td[6]) })
  }
  return { rows, replaced }
}
