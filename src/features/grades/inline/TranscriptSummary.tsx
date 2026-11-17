// TranscriptSummary (grades R3.1 to R3.4; design "Views"): on /Report/Transcript a block in its own
// shadow root before the transcript card, with cumulative GPA, counted credits and per-semester GPA.
// Counted rows get the `fap-aio-gpa-counted` class, styled by a page-level constructable sheet; FAP's
// cells are never edited. Links open the panel; a link shows only when its view has shipped. If the
// transcript cannot be read, a layout-changed notice replaces the summary.
import { createElement, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import css from '../../../content/panel/panel.css?inline'
import { viewFor } from '../../../content/panel/views'
import { openPanelAt } from '../../../content/panel/host'
import type { Route } from '../../../shared/panel-state'
import { LayoutChangedError } from '../../../content/fap/registry'
import { computeGpa, formatGpa, type GpaResult } from '../engine/gpa'
import { parseTranscript } from '../parse/transcript'
import { readGradeSettings, useGradeSettings } from '../settings'
import type { Transcript } from '../types'

export const HOST_ID = 'fap-aio-transcript-summary'
export const COUNTED_CLASS = 'fap-aio-gpa-counted'
const ROW_CSS = `table.fap-sheet tr.${COUNTED_CLASS} > td:first-child{box-shadow:inset 3px 0 0 #ea580c}`
// The panel's sheet places its host fixed on top of the page; an inline block flows with the page.
const INLINE_CSS = ':host{position:static;display:block;z-index:auto;margin:0 0 12px}'
export const LAYOUT_TEXT = 'FAP-AIO could not read this transcript, so no GPA summary is shown. FAP may have changed the page; the panel keeps your last good data.'

const ROUTES: { label: string; route: Route }[] = [
  { label: 'Open Grades', route: { tab: 'grades', sub: 'gpa' } },
  { label: 'What-if', route: { tab: 'grades', sub: 'whatif' } },
]
const SETTINGS_ROUTE: Route = { overlay: 'settings', section: 'grades' }

/** The main table's rows that count, by the same id the parser gives (`semester|code`). */
export function markCounted(doc: Document, gpa: GpaResult | null): number {
  const main = [...doc.querySelectorAll('.content-page table.fap-sheet')].find((t) => t.querySelectorAll('thead th').length === 10)
  let n = 0
  for (const tr of main?.querySelectorAll('tbody tr') ?? []) {
    const td = tr.querySelectorAll('td')
    const id = `${(td[2]?.textContent ?? '').trim()}|${(td[3]?.textContent ?? '').trim()}`
    const on = !!gpa?.counted.has(id)
    tr.classList.toggle(COUNTED_CLASS, on)
    if (on) n++
  }
  return n
}

const link = 'inline-flex min-h-hit items-center rounded px-1.5 text-[13px] font-medium text-orange-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

function Summary({ transcript, doc }: { transcript: Transcript | null; doc: Document }) {
  const settings = useGradeSettings()
  const [gpa, setGpa] = useState<GpaResult | null>(null)
  useEffect(() => {
    if (!transcript || !settings) return
    const g = computeGpa({ rows: transcript.rows, nonGpa: settings.nonGpa })
    setGpa(g)
    markCounted(doc, g)
  }, [transcript, settings, doc])

  if (!transcript) {
    return <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{LAYOUT_TEXT}</div>
  }
  if (!gpa || !settings) return null
  const nonGpa = settings.nonGpa
  const shown = ROUTES.filter((r) => viewFor(r.route))
  return (
    <section aria-label="GPA summary by FAP-AIO" className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-800 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">GPA by FAP-AIO</p>
        <p><span className="text-2xl font-semibold text-gray-900">{formatGpa(gpa.cumulative) ?? 'No GPA yet'}</span> <span className="text-sm text-gray-600">cumulative</span></p>
        <p className="text-sm text-gray-600">{gpa.credits} credits counted</p>
      </div>
      {gpa.semesters.some((s) => s.gpa !== null) && (
        <ul aria-label="GPA per semester" className="mt-2 flex flex-wrap gap-1.5">
          {gpa.semesters.filter((s) => s.gpa !== null).map((s) => (
            <li key={s.name} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700">
              {s.name} <b className="font-semibold text-gray-900">{formatGpa(s.gpa)}</b> · {s.credits} cr
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-gray-600">
        Rows with an orange edge count toward GPA. Not counted: {nonGpa.length ? nonGpa.join(', ') : 'nothing'}.
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {shown.map((r) => <button key={r.label} type="button" className={link} onClick={() => openPanelAt(r.route)}>{r.label}</button>)}
        <button type="button" className={link} onClick={() => openPanelAt(SETTINGS_ROUTE)}>Edit the not-counted list</button>
      </div>
    </section>
  )
}

export interface Mounted { host: HTMLElement; root: Root; unmount: () => void }

/** Mounts the summary on a transcript page; returns null on other pages. */
export function mountTranscriptSummary(doc: Document = document): Mounted | null {
  doc.getElementById(HOST_ID)?.remove()
  let transcript: Transcript | null = null
  try {
    transcript = parseTranscript(doc)
  } catch (e) {
    if (!(e instanceof LayoutChangedError)) throw e
  }
  const main = [...doc.querySelectorAll('.content-page table.fap-sheet')].find((t) => t.querySelectorAll('thead th').length === 10)
  const anchor = main?.closest('.card') ?? doc.querySelector('.content-page')?.firstElementChild ?? null
  const parent = anchor?.parentElement ?? doc.querySelector('.content-page')
  if (!parent) return null
  const host = doc.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  const inline = new CSSStyleSheet()
  inline.replaceSync(INLINE_CSS)
  shadow.adoptedStyleSheets = [sheet, inline]
  const mountPoint = doc.createElement('div')
  shadow.appendChild(mountPoint)
  if (anchor && anchor.parentElement === parent) parent.insertBefore(host, anchor)
  else parent.prepend(host)
  // The counted-row marker lives in a document sheet: FAP's CSP allows constructed sheets, not <style>.
  if (!doc.adoptedStyleSheets.some((s) => (s as CSSStyleSheet & { fapAioRows?: true }).fapAioRows)) {
    const rows = new CSSStyleSheet() as CSSStyleSheet & { fapAioRows?: true }
    rows.replaceSync(ROW_CSS)
    rows.fapAioRows = true
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, rows]
  }
  const root = createRoot(mountPoint)
  root.render(createElement(Summary, { transcript, doc }))
  return { host, root, unmount: () => { root.unmount(); host.remove(); markCounted(doc, null) } }
}

/** For tests and callers that only need the numbers. */
export async function transcriptGpa(doc: Document): Promise<GpaResult> {
  return computeGpa({ rows: parseTranscript(doc).rows, nonGpa: (await readGradeSettings()).nonGpa })
}
