// Mark sheet reader (grades R4.1, R4.5): a TypeScript port of `rowsFromTable` in
// tools/flm-scraper/marksheet.mjs (validated on 53 live sheets, 2026-10-10), plus the summary rows
// and the `.fap-result-card__*` header of the /Report/Grade partial.
//
// Row shapes: the first item of a group has a `td.sheet-group-cell` with rowspan; further items have
// 4 cells; `tr.sheet-row-total` is a group total. Three `tr.sheet-grand-total` rows close the sheet:
// late penalty (value like `0%`), mark bonus (`-`, `0` or `1`) and course total (`.grade-average`,
// `.grade-status`). A missing mark is `-`.
import { LayoutChangedError } from '../../../content/fap/registry'
import type { MarkSheet, MarkSheetHeader, MarkSheetRow, MarkSheetSummary } from '../types'

const text = (c: Element | null | undefined) => (c ? (c.textContent ?? '').replace(/\s+/g, ' ').trim() : '')

export function rowsFromTable(table: Element): MarkSheetRow[] {
  const rows: MarkSheetRow[] = []
  let group = ''
  for (const tr of table.querySelectorAll('tbody tr')) {
    const c = [...tr.children].filter((x) => /^t[dh]$/i.test(x.tagName))
    if (tr.classList.contains('sheet-grand-total')) {
      const label = c.find((x) => x.classList.contains('text-end'))
      const avg = tr.querySelector('.grade-average')
      const st = tr.querySelector('.grade-status')
      const status = st ? ([...st.classList].find((k) => k.startsWith('grade-status--')) ?? '').replace('grade-status--', '') : null
      rows.push({ kind: 'summary', label: text(label), value: avg ? text(avg) : text(label?.nextElementSibling), status })
      continue
    }
    const kind = tr.classList.contains('sheet-row-total') ? 'group-total' : 'item'
    let o = 0
    if (c[0] && (c[0].classList.contains('sheet-group-cell') || Number(c[0].getAttribute('rowspan')) > 1)) {
      group = text(c[0])
      o = 1
    }
    rows.push({ kind, group, name: text(c[o]), weight: text(c[o + 1]), value: text(c[o + 2]) })
  }
  return rows
}

/** A number as FAP writes it (`8.2`, `8,2`, `0%`); `-` or nothing gives null. */
export function numberOf(s: string | null | undefined): number | null {
  const m = String(s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

/**
 * Summary values. The rows are told apart by shape, not by label text, so vi pages work too: the course
 * total carries a status (or is the last row), the late penalty is the value with `%`, the bonus is the
 * remaining row.
 */
export function summaryOf(rows: MarkSheetRow[]): MarkSheetSummary {
  const sums = rows.filter((r): r is Extract<MarkSheetRow, { kind: 'summary' }> => r.kind === 'summary')
  const total = sums.find((r) => r.status !== null) ?? sums.at(-1)
  const rest = sums.filter((r) => r !== total)
  const penalty = rest.find((r) => r.value.includes('%'))
  const bonus = rest.find((r) => r !== penalty)
  return {
    latePenaltyPercent: numberOf(penalty?.value),
    bonus: numberOf(bonus?.value),
    average: numberOf(total?.value),
    status: total?.status ?? null,
  }
}

export function headerOf(root: ParentNode): MarkSheetHeader | null {
  const title = root.querySelector('.fap-result-card__title')
  if (!title) return null
  const codeEl = title.querySelector('.fap-result-card__code') ?? root.querySelector('.fap-result-card__code')
  const code = text(codeEl)
  const full = text(title)
  const name = code && full.endsWith(code) ? full.slice(0, -code.length).trim() : full
  const meta = [...(root.querySelector('.fap-result-card__meta')?.children ?? [])].map(text).filter(Boolean)
  return { code, title: name, meta }
}

const EMPTY_SUMMARY: MarkSheetSummary = { latePenaltyPercent: null, bonus: null, average: null, status: null }

export function parseMarkSheet(doc: Document): MarkSheet {
  const table = doc.querySelector('table.student-mark-sheet')
  if (!table) {
    if (doc.querySelector('.fap-empty-state, .fap-empty-card')) return { header: headerOf(doc), rows: [], summary: EMPTY_SUMMARY }
    throw new LayoutChangedError('no table.student-mark-sheet in the /Report/Grade partial')
  }
  const rows = rowsFromTable(table)
  return { header: headerOf(doc), rows, summary: summaryOf(rows) }
}
