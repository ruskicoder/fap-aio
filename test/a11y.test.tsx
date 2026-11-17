// @vitest-environment happy-dom
// PNL-3.2: accessibility checks on the shell and every registered view, in both densities (panel-ux
// R10.2, R10.3, R10.8): axe-core on every screen, plus checks axe does not make here: an accessible name
// on every control, no control styled below 24 px, and sentence case copy. happy-dom has no layout, so
// axe's colour contrast and target size rules cannot measure; contrast is checked in the browser check.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axe from 'axe-core'
import { act } from 'react'
import { installFakeChrome } from './helpers/fake-chrome'
import { setSettings } from '../src/shared/settings'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(async () => ({ ok: false, error: { kind: 'network' } })), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))

const { mountPanel } = await import('../src/content/panel/host')
const { registerSchedulerViews } = await import('../src/features/scheduler/index')
const { clearViews, tabViews, routeOfView } = await import('../src/content/panel/views')
const { setInboxOpen } = await import('../src/content/panel/inbox/store')
const { registerGradeViews } = await import('../src/features/grades/index')
const { registerGradeSources } = await import('../src/features/grades/sources')
const { write } = await import('../src/shared/storage/catalog')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

const CONTROLS = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="button"], summary'
const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** Accessible name, simplified: aria-label, aria-labelledby, label, alt, title, then text. */
export function nameOf(el: Element, root: ParentNode): string {
  const aria = el.getAttribute('aria-label')
  if (aria?.trim()) return aria.trim()
  const by = el.getAttribute('aria-labelledby')
  if (by) return by.split(/\s+/).map((id) => text((root as Document).getElementById?.(id) ?? root.querySelector(`#${id}`))).join(' ').trim()
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
    const wrap = el.closest('label')
    const forId = el.id ? root.querySelector(`label[for="${el.id}"]`) : null
    const t = text(wrap) || text(forId)
    if (t) return t
  }
  return (el.getAttribute('title') ?? '').trim() || text(el)
}

// Words that keep a capital inside a sentence: names, acronyms, terms, months and days.
const KEEP = /^(FAP|FAP-AIO|FLM|Coursera|ICS|Google|Outlook|Apple|Calendar|Chrome|Spring|Summer|Fall|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|I|OK)$/
/** Sentence case: the first letter capital, other words lower case unless a name, acronym or code. */
export function sentenceCaseProblem(s: string): string | null {
  // A label built of parts (`Room · Code`) is checked part by part.
  if (s.includes(' · ')) return s.split(' · ').map(sentenceCaseProblem).find(Boolean) ?? null
  // Leading symbols (`+ Group`) do not count as the first word.
  const words = s.split(/\s+/).filter(Boolean)
  while (words.length && !/[A-Za-zÀ-ỹ]/.test(words[0]!)) words.shift()
  const first = words[0] ?? ''
  if (/^[a-z]/.test(first)) return `"${s}" starts lower case`
  for (const w of words.slice(1)) {
    const core = w.replace(/^[^A-Za-zÀ-ỹ]+|[^A-Za-zÀ-ỹ0-9'.-]+$/g, '')
    if (!/^[A-ZÀ-Ỹ]/.test(core)) continue
    if (KEEP.test(core) || /^[A-Z0-9.\-+]{2,}$/.test(core) || /\d/.test(core) || /^[A-Z]\.?$/.test(core)) continue
    return `"${s}" has a capital on "${core}"`
  }
  return null
}

const SMALL = /(^|\s)(h|w|size|min-h|min-w)-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5)(\s|$)/

const AXE_OFF = ['color-contrast', 'target-size', 'region', 'landmark-one-main', 'page-has-heading-one', 'html-has-lang', 'document-title', 'bypass']

async function axeAudit(host: Element, where: string): Promise<string[]> {
  const r = await axe.run(host, { rules: Object.fromEntries(AXE_OFF.map((id) => [id, { enabled: false }])), resultTypes: ['violations'] })
  return r.violations.flatMap((v) => v.nodes.map((n) => `${where}: axe ${v.id}: ${n.target.join(' ')}`))
}

function audit(root: ShadowRoot, where: string): string[] {
  const problems: string[] = []
  for (const el of root.querySelectorAll(CONTROLS)) {
    if (el.closest('[hidden], [aria-hidden="true"]')) continue
    const name = nameOf(el, root)
    if (!name) problems.push(`${where}: ${el.tagName.toLowerCase()} without a name (${el.outerHTML.slice(0, 80)})`)
    const isTarget = /^(BUTTON|A)$/.test(el.tagName) || /^(tab|button)$/.test(el.getAttribute('role') ?? '')
    const cls = el.getAttribute('class') ?? ''
    if (isTarget && SMALL.test(cls)) problems.push(`${where}: target below 24 px: "${name}" (${cls})`)
    const h = parseFloat((el as HTMLElement).style?.height ?? '')
    if (isTarget && h && h < 24) problems.push(`${where}: target height ${h}px: "${name}"`)
    const copy = el.getAttribute('aria-label') ?? (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'tab' ? text(el) : '')
    const p = copy && /[A-Za-z]/.test(copy) ? sentenceCaseProblem(copy) : null
    if (p) problems.push(`${where}: ${p}`)
  }
  for (const el of root.querySelectorAll('h1, h2, h3, label, legend')) {
    const p = text(el) && /^[A-Za-z]/.test(text(el)) ? sentenceCaseProblem(text(el)) : null
    if (p) problems.push(`${where}: ${p}`)
  }
  return problems
}

describe('accessibility audit', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    document.body.innerHTML = '<div class="wrapper"><div class="content-page"></div></div>'
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  for (const density of ['comfortable', 'compact'] as const) {
    it(`finds no problem on the shell and every view (${density})`, async () => {
      await act(async () => {
        await setSettings({ 'general.density': density })
        await write('alerts', { items: [
          { id: 'a', kind: 'grade', title: 'PRF192 is failing', at: Date.now(), read: false, dedupeKey: 'a' },
          { id: 'b', kind: 'sync', title: 'Sync failed', at: Date.now(), read: true, dedupeKey: 'b' },
        ] })
      })
      registerSchedulerViews()
      registerGradeSources()
      registerGradeViews()
      let m!: Awaited<ReturnType<typeof mountPanel>>
      await act(async () => { m = await mountPanel(document, '') })
      await tick()
      expect(m.host.getAttribute('data-density')).toBe(density)
      const routes = [...tabViews().map(routeOfView), { overlay: 'settings' as const }]
      expect(routes.length).toBeGreaterThanOrEqual(4)
      const problems: string[] = []
      for (const r of routes) {
        await act(async () => { m.router.go(r) })
        await tick(); await tick()
        problems.push(...audit(m.shadow, JSON.stringify(r)))
        problems.push(...(await axeAudit(m.host, JSON.stringify(r))))
      }
      await act(async () => { setInboxOpen(true) })
      expect(m.shadow.querySelector('[role="dialog"]')).toBeTruthy()
      problems.push(...audit(m.shadow, 'inbox'))
      problems.push(...(await axeAudit(m.host, 'inbox')))
      await act(async () => { setInboxOpen(false) })
      expect(problems).toEqual([])
    })
  }

  it('lets axe see inside the shadow root', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    host.attachShadow({ mode: 'open' }).innerHTML = '<button type="button"><svg aria-hidden="true"></svg></button>'
    expect((await axeAudit(host, 'probe')).join()).toMatch(/axe button-name/)
    host.remove()
  })

  it('checks sentence case the way the copy rules say', () => {
    expect(sentenceCaseProblem('Sync this week')).toBeNull()
    expect(sentenceCaseProblem('Open FAP-AIO')).toBeNull()
    expect(sentenceCaseProblem('Sync Fall2026')).toBeNull()
    expect(sentenceCaseProblem('Export to Google Calendar')).toBeNull()
    expect(sentenceCaseProblem('+ Attendance')).toBeNull()
    expect(sentenceCaseProblem('Exam type · Code · Subject name')).toBeNull()
    expect(sentenceCaseProblem('Sync This Week')).toMatch(/capital/)
    expect(sentenceCaseProblem('sync week')).toMatch(/lower case/)
  })
})
