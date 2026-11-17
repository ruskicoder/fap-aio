// Classic home link directory (appearance R6.5, R6.9; platform R3.1, R3.2): on the FAP home page, FAP's
// own sidebar links regrouped under the old FAP's orange section headings, with labels taken from FAP, and
// an application deadline table filled only when the student presses "Load deadlines" (one request per
// application type, at user priority under the shared budget, cached for 24 hours). FAP's home content
// stays below. The block lives in its own shadow root and inherits FAP's theme variables.
import { LayoutChangedError, peek, read, register } from '../../../../content/fap/registry'
import { insert, type Patch } from './patch'
import type { ClassicPart } from './controller'

/** The old FAP sections and the v2 routes in each; routes FAP's sidebar does not show are dropped (R6.3). */
export const DIRECTORY: readonly { title: string; routes: readonly string[] }[] = [
  { title: 'Registration/Application', routes: ['/Application/Catalog', '/Application', '/CrossClassChange', '/Wishlist/Register', '/Wishlist', '/StartupGroup/Add', '/StartupGroup'] },
  { title: 'Information Access', routes: ['/WeeklyTimetable', '/ExamSchedule', '/News', '/Subject', '/Curriculum', '/MyCertificates', '/Account', '/StudentProfile'] },
  { title: 'Reports', routes: ['/Report/Attendance', '/Report/Grade', '/Report/Transcript', '/Report/OjtConditions', '/Report/ThesisConditions', '/Transaction', '/FyeCheckInLog'] },
  { title: 'Regulations', routes: ['/Document', '/Document/DrivePdf'] },
  { title: 'Feedback', routes: ['/FyeMentorFeedback'] },
  { title: 'Others', routes: ['/ShoppingCart', '/CoursePendingPayment'] },
  // Coursera links have no v2 route yet, so the section is left out until one exists.
  { title: 'Coursera', routes: [] },
]

export interface DirSection { title: string; links: { label: string; href: string }[] }

/** The directory from the page's sidebar: FAP's label for each route, first occurrence wins. */
export function directoryFrom(doc: Document): DirSection[] {
  const labels = new Map<string, string>()
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('.side-nav a[href]')) {
    const href = a.getAttribute('href') ?? ''
    if (!href.startsWith('/') || labels.has(href)) continue
    const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) labels.set(href, text)
  }
  return DIRECTORY
    .map((s) => ({ title: s.title, links: s.routes.filter((r) => labels.has(r)).map((r) => ({ label: labels.get(r)!, href: r })) }))
    .filter((s) => s.links.length > 0)
}

export const CLASSIC_CATALOG = 'classic.catalog'
export const CLASSIC_SCHEMA = 'classic.formSchema'
const DAY = 24 * 3_600_000

export interface AppType { id: string; name: string }
export interface Deadline { deadline: number | null; period: string | null }

/** Application types from `/Application/Catalog`: the description cell and the Create link's id. */
export function parseCatalog(doc: Document): AppType[] {
  const rows = [...doc.querySelectorAll('table.fap-sheet tbody tr')]
  const out = rows.flatMap((tr) => {
    const href = tr.querySelector<HTMLAnchorElement>('a[href*="applicationTypeId="]')?.getAttribute('href') ?? ''
    const id = /applicationTypeId=([^&]+)/.exec(href)?.[1]
    const name = (tr.querySelector('td.text-break')?.textContent ?? '').replace(/\s+/g, ' ').trim()
    return id && name ? [{ id: decodeURIComponent(id), name }] : []
  })
  if (!out.length) throw new LayoutChangedError('/Application/Catalog has no application types')
  return out
}

export function parseSchema(v: unknown): Deadline {
  const o = (v ?? {}) as { deadline?: unknown; registrationPeriodDisplay?: unknown }
  return {
    deadline: typeof o.deadline === 'number' && Number.isFinite(o.deadline) ? o.deadline : null,
    period: typeof o.registrationPeriodDisplay === 'string' && o.registrationPeriodDisplay.trim() ? o.registrationPeriodDisplay.trim() : null,
  }
}

export function registerClassicSources(): void {
  register<AppType[]>({ id: CLASSIC_CATALOG, route: () => '/Application/Catalog', partial: false, parse: (d) => parseCatalog(d), cacheTtlMs: DAY })
  register<Deadline>({ id: CLASSIC_SCHEMA, route: (p) => `/Application/GetFormSchema?applicationTypeId=${encodeURIComponent(p.id ?? '')}`, partial: false, json: (v) => parseSchema(v), cacheTtlMs: DAY })
}

export type DeadlineRows = { type: AppType; d: Deadline }[]

/** The table from fresh caches only, without any request; null when anything is missing or stale. */
export async function cachedDeadlines(now = Date.now()): Promise<DeadlineRows | null> {
  const cat = await peek<AppType[]>(CLASSIC_CATALOG)
  if (!cat || now - cat.fetchedAt > DAY) return null
  const rows: DeadlineRows = []
  for (const type of cat.value) {
    const s = await peek<Deadline>(CLASSIC_SCHEMA, { id: type.id })
    if (!s || now - s.fetchedAt > DAY) return null
    rows.push({ type, d: s.value })
  }
  return rows
}

/** Reads the types, then one schema per type in order; stops at the first failure that ends reading. */
export async function loadDeadlines(progress: (done: number, total: number) => void): Promise<{ rows: DeadlineRows } | { error: 'types' | 'stopped' }> {
  const cat = await read<AppType[]>(CLASSIC_CATALOG, {}, { priority: 'user' })
  if (!cat.ok) return { error: 'types' }
  const rows: DeadlineRows = []
  progress(0, cat.value.length)
  for (const type of cat.value) {
    const s = await read<Deadline>(CLASSIC_SCHEMA, { id: type.id }, { priority: 'user' })
    if (!s.ok) {
      if (['challenge', 'session-expired', 'feedback-required'].includes(s.error.kind)) return { error: 'stopped' }
      rows.push({ type, d: { deadline: null, period: null } })
    } else rows.push({ type, d: s.value })
    progress(rows.length, cat.value.length)
  }
  return { rows }
}

const CSS = `
:host { all: initial; display: block; margin: 0.75rem 0 1rem; font: 14px/1.45 var(--ct-body-font-family, system-ui, sans-serif); color: var(--ct-body-color, #212529); }
.wrap { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 1rem; background: var(--ct-secondary-bg, #fff); border: 1px solid var(--ct-border-color, #dee2e6); border-radius: 8px; padding: 1rem; }
@media (max-width: 900px) { .wrap { grid-template-columns: minmax(0, 1fr); } }
h2 { margin: 0 0 0.5rem; font-size: 16px; font-weight: 600; }
h3 { margin: 0.75rem 0 0.25rem; font-size: 14px; font-weight: 700; color: #c2410c; }
:host-context([data-bs-theme=dark]) h3 { color: #fb923c; }
.sections { columns: 2 14rem; column-gap: 1.5rem; }
section { break-inside: avoid; }
ul { margin: 0; padding: 0; list-style: none; }
li { padding: 1px 0; }
a { color: var(--ct-link-color, #0d6efd); text-decoration: none; }
a:hover { text-decoration: underline; }
a:focus-visible, button:focus-visible { outline: 2px solid #ea580c; outline-offset: 2px; }
button { font: inherit; padding: 4px 12px; border: 1px solid var(--ct-border-color, #ced4da); border-radius: 6px; background: var(--ct-body-bg, #fff); color: inherit; cursor: pointer; min-height: 30px; }
button:disabled { opacity: 0.6; cursor: default; }
table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 0.5rem; }
th, td { text-align: left; padding: 3px 6px; border-top: 1px solid var(--ct-border-color, #dee2e6); vertical-align: top; overflow-wrap: anywhere; }
th { font-weight: 600; }
.muted { color: var(--ct-secondary-color, #6c757d); font-size: 13px; }
.scroll { max-height: 26rem; overflow: auto; }
`

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []) => {
  const e = Object.assign(doc.createElement(tag), props)
  e.append(...kids)
  return e
}

/** Builds the block; exported for tests. */
export function renderDirectory(doc: Document, host: HTMLElement): void {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  root.replaceChildren()
  const style = el(doc, 'style', { textContent: CSS })
  const sections = directoryFrom(doc).map((s) => el(doc, 'section', {}, [
    el(doc, 'h3', { textContent: s.title }),
    el(doc, 'ul', {}, s.links.map((l) => el(doc, 'li', {}, [el(doc, 'a', { href: l.href, textContent: l.label })]))),
  ]))
  const side = el(doc, 'div', { className: 'deadlines' })
  const status = el(doc, 'p', { className: 'muted' })
  status.setAttribute('role', 'status')
  const btn = el(doc, 'button', { type: 'button', textContent: 'Load deadlines' })
  const table = (rows: DeadlineRows) => el(doc, 'div', { className: 'scroll' }, [el(doc, 'table', {}, [
    el(doc, 'thead', {}, [el(doc, 'tr', {}, ['Application', 'Deadline (days)', 'Registration period'].map((h) => el(doc, 'th', { textContent: h })))]),
    el(doc, 'tbody', {}, rows.map((r) => el(doc, 'tr', {}, [r.type.name, r.d.deadline === null ? '-' : String(r.d.deadline), r.d.period ?? '-'].map((t) => el(doc, 'td', { textContent: t }))))),
  ])])
  const show = (rows: DeadlineRows) => { side.replaceChildren(el(doc, 'h2', { textContent: 'Application deadlines' }), table(rows), el(doc, 'p', { className: 'muted', textContent: 'Kept for 24 hours.' })) }
  btn.addEventListener('click', () => {
    btn.disabled = true
    void loadDeadlines((done, total) => { status.textContent = `Reading ${done} of ${total} application types` }).then((r) => {
      if ('rows' in r) show(r.rows)
      else if (r.error === 'types') side.replaceChildren(el(doc, 'p', { className: 'muted', textContent: 'The application types could not be read, so the deadline table is not shown.' }))
      else { btn.disabled = false; status.textContent = 'Reading stopped: open FAP again or sign in, then load the deadlines again.' }
    })
  })
  side.append(el(doc, 'h2', { textContent: 'Application deadlines' }), el(doc, 'p', { className: 'muted', textContent: 'One request per application type, read only when you ask.' }), btn, status)
  void cachedDeadlines().then((rows) => { if (rows) show(rows) })
  root.append(style, el(doc, 'div', { className: 'wrap' }, [el(doc, 'div', {}, [el(doc, 'h2', { textContent: 'FAP links' }), el(doc, 'div', { className: 'sections' }, sections)]), side]))
}

export const isHome = (path: string) => /^\/(Home)?\/?$/i.test(path)

export const homePart: ClassicPart = {
  id: 'home-directory',
  patches: (doc): Patch[] => {
    if (!isHome(doc.location?.pathname ?? '')) return []
    return [insert('home-directory', () => doc.getElementById('home-student-shell')?.parentElement ?? null, (d) => {
      const h = d.createElement('div')
      renderDirectory(d, h)
      return h
    }, () => doc.getElementById('home-student-shell'))]
  },
}
