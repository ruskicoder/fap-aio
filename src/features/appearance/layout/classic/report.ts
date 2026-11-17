// Classic report pages and timetable (appearance R6.6, R6.7): on the grade and attendance reports, the
// terms as a horizontal tab strip and the courses as a vertical card list; a choice sets FAP's own select
// and dispatches `change` (bubbling), so FAP's academic-report.js loads the partial as usual. FAP's selects
// stay in the page, visually hidden but focusable. Timetable sessions show as cards coloured by
// attendance (present green, absent red, others neutral); FAP's text is not changed.
import { attendanceOf } from '../../../../content/fap/parse/constants'
import { insert, markAll, type Patch } from './patch'
import type { ClassicPart } from './controller'

export const SR_CLASS = 'fap-aio-classic-sr'
const REPORTS = [['grade-report-term', 'grade-report-course'], ['attendance-report-term', 'attendance-report-course']] as const

export interface Choice { value: string; label: string; selected: boolean }

const optionsOf = (sel: HTMLSelectElement, term: string | null): Choice[] =>
  [...sel.options]
    .filter((o) => !term || !o.dataset.reportTermId || o.dataset.reportTermId === term)
    .map((o) => ({ value: o.value, label: (o.textContent ?? '').replace(/\s+/g, ' ').trim(), selected: o.selected }))

/** `Name (CODE) (Group)` from FAP's course option, split for the card. */
export function courseParts(label: string): { name: string; code: string | null; group: string | null } {
  const m = /^(.*?)\s*\(([^()]+)\)\s*\(([^()]+)\)\s*$/.exec(label)
  return m ? { name: m[1]!.trim() || label, code: m[2]!.trim(), group: m[3]!.trim() } : { name: label, code: null, group: null }
}

/** Sets a FAP select as a person would, so FAP's own script reacts (R6.6). */
export function choose(sel: HTMLSelectElement, value: string): void {
  if (sel.value === value) return
  sel.value = value
  sel.dispatchEvent(new Event('change', { bubbles: true }))
}

const CSS = `
:host { all: initial; display: block; margin: 0 0 0.75rem; font: 14px/1.4 var(--ct-body-font-family, system-ui, sans-serif); color: var(--ct-body-color, #212529); }
[role=tablist] { display: flex; flex-wrap: wrap; gap: 0.25rem; border-bottom: 1px solid var(--ct-border-color, #dee2e6); margin-bottom: 0.75rem; }
[role=tab] { font: inherit; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--ct-secondary-color, #6c757d); padding: 0.4rem 0.75rem; cursor: pointer; min-height: 32px; }
[role=tab][aria-selected=true] { color: var(--ct-body-color, #212529); border-bottom-color: #ea580c; font-weight: 600; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.375rem; }
.card { width: 100%; text-align: left; font: inherit; color: inherit; background: var(--ct-secondary-bg, #fff); border: 1px solid var(--ct-border-color, #dee2e6); border-left: 4px solid transparent; border-radius: 6px; padding: 0.5rem 0.75rem; cursor: pointer; }
.card[aria-current=true] { border-left-color: #ea580c; background: var(--ct-tertiary-bg, #f8f9fa); }
.code { font-weight: 600; margin-right: 0.5rem; }
.group { color: var(--ct-secondary-color, #6c757d); font-size: 13px; }
button:focus-visible { outline: 2px solid #ea580c; outline-offset: 2px; }
`

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []) {
  const e = Object.assign(doc.createElement(tag), props)
  e.append(...kids)
  return e
}

/** Draws the tabs and cards from FAP's selects; called again whenever FAP changes them. */
export function renderReport(doc: Document, root: ShadowRoot, term: HTMLSelectElement, course: HTMLSelectElement): void {
  const terms = optionsOf(term, null)
  const courses = optionsOf(course, term.value || null)
  const tabs = el(doc, 'div', { role: 'tablist' } as Partial<HTMLDivElement>)
  tabs.setAttribute('aria-label', 'Terms')
  terms.forEach((t, i) => {
    const b = el(doc, 'button', { type: 'button', textContent: t.label })
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', String(t.selected))
    b.tabIndex = t.selected || (i === 0 && !terms.some((x) => x.selected)) ? 0 : -1
    b.addEventListener('click', () => choose(term, t.value))
    b.addEventListener('keydown', (e) => {
      const k = e.key
      const all = [...tabs.querySelectorAll<HTMLButtonElement>('[role=tab]')]
      const at = all.indexOf(b)
      const to = k === 'ArrowRight' ? at + 1 : k === 'ArrowLeft' ? at - 1 : k === 'Home' ? 0 : k === 'End' ? all.length - 1 : null
      if (to === null) return
      e.preventDefault()
      all[(to + all.length) % all.length]!.focus()
    })
    tabs.append(b)
  })
  const list = el(doc, 'ul', {}, courses.map((c) => {
    const p = courseParts(c.label)
    const b = el(doc, 'button', { type: 'button', className: 'card' }, [
      ...(p.code ? [el(doc, 'span', { className: 'code', textContent: p.code })] : []),
      el(doc, 'span', { textContent: p.name }),
      ...(p.group ? [el(doc, 'div', { className: 'group', textContent: p.group })] : []),
    ])
    b.setAttribute('aria-current', String(c.selected))
    b.addEventListener('click', () => choose(course, c.value))
    return el(doc, 'li', {}, [b])
  }))
  list.setAttribute('aria-label', 'Courses')
  root.replaceChildren(el(doc, 'style', { textContent: CSS }), tabs, list)
}

function reportPatches(doc: Document): Patch[] {
  const out: Patch[] = []
  for (const [termId, courseId] of REPORTS) {
    const term = () => doc.getElementById(termId) as HTMLSelectElement | null
    const course = () => doc.getElementById(courseId) as HTMLSelectElement | null
    const row = () => term()?.closest('.row') ?? term()?.parentElement ?? null
    if (!term() || !course()) continue
    out.push(insert(`${termId}-cards`, () => row()?.parentElement ?? null, (d) => {
      const host = d.createElement('div')
      const root = host.attachShadow({ mode: 'open' })
      const redraw = () => {
        if (!host.isConnected && host.parentNode === null && root.childNodes.length) { stop(); return }
        const t = term()
        const c = course()
        if (t && c) renderReport(d, root, t, c)
      }
      // FAP rebuilds the course list when the term changes; watch the page while the host is in it.
      const onChange = (e: Event) => { if ((e.target as Element | null)?.id === termId || (e.target as Element | null)?.id === courseId) queueMicrotask(redraw) }
      const mo = new MutationObserver(() => redraw())
      const stop = () => { d.removeEventListener('change', onChange, true); mo.disconnect() }
      d.addEventListener('change', onChange, true)
      mo.observe(row() ?? d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected'] })
      redraw()
      return host
    }, row))
    out.push(markAll(`${termId}-hide`, () => { const r = row(); return r ? [r] : [] }, () => [SR_CLASS]))
  }
  return out
}

/** Timetable cells and mobile cards with a session, marked by attendance (R6.7). */
export function sessionCells(doc: Document): Element[] {
  const cells = [...doc.querySelectorAll('.weekly-timetable-cell-title')].map((t) => t.closest('td, .weekly-timetable-mobile-card'))
  return [...new Set(cells.filter((c): c is Element => !!c))]
}

export function attendanceClass(cell: Element): string {
  const s = cell.querySelector('.weekly-timetable-attendance-status')
  const a = s ? attendanceOf((s.textContent ?? '').replace(/\s+/g, ' ').trim()) : 'not-yet'
  return `fap-aio-att-${typeof a === 'string' ? a : 'unknown'}`
}

export const reportPart: ClassicPart = {
  id: 'report-pages',
  css: [
    `.${SR_CLASS} { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }`,
    `.fap-aio-classic-cell { border: 1px solid var(--ct-border-color, #dee2e6) !important; border-left: 4px solid var(--ct-border-color, #adb5bd) !important; border-radius: 6px; background: var(--ct-secondary-bg, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06); }`,
    `.fap-aio-classic-cell.fap-aio-att-present { border-left-color: #16a34a !important; }`,
    `.fap-aio-classic-cell.fap-aio-att-absent { border-left-color: #dc2626 !important; }`,
  ].join('\n'),
  patches: (doc) => [
    ...reportPatches(doc),
    markAll('timetable-cards', () => sessionCells(doc), (c) => ['fap-aio-classic-cell', attendanceClass(c)]),
  ],
}
