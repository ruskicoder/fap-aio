// @vitest-environment happy-dom
// GRD-4.1: TranscriptSummary on /Report/Transcript (grades R3.1 to R3.4, R2.3).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { readFileSync } from 'node:fs'
import axe from 'axe-core'
import { installFakeChrome } from './helpers/fake-chrome'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const opened: unknown[] = []
vi.mock('../src/content/panel/host', () => ({ openPanelAt: (r: unknown) => opened.push(r) }))
const { COUNTED_CLASS, HOST_ID, LAYOUT_TEXT, mountTranscriptSummary, transcriptGpa } = await import('../src/features/grades/inline/TranscriptSummary')
const { clearViews, registerView } = await import('../src/content/panel/views')
const { setSettings } = await import('../src/shared/settings')
const { formatGpa } = await import('../src/features/grades/engine/gpa')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const fixture = readFileSync('test/fixtures/en/transcript.html', 'utf8')
const bodyOf = (html: string) => html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/gi, '')
const mainTable = () => [...document.querySelectorAll('.content-page table.fap-sheet')].find((t) => t.querySelectorAll('thead th').length === 10)!
const cellsText = () => [...mainTable().querySelectorAll('td')].map((td) => td.innerHTML).join('|')

async function mount() {
  let m!: ReturnType<typeof mountTranscriptSummary>
  await act(async () => { m = mountTranscriptSummary(document) })
  await tick(); await tick()
  return { m, shadow: m!.host.shadowRoot! }
}

describe('transcript summary', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    opened.length = 0
    document.adoptedStyleSheets = []
    document.body.innerHTML = bodyOf(fixture)
  })

  it('sits before the transcript card with cumulative and per-semester GPA, and marks counted rows only', async () => {
    const before = cellsText()
    const { m, shadow } = await mount()
    expect(m!.host.nextElementSibling).toBe(mainTable().closest('.card'))
    const gpa = await transcriptGpa(document)
    expect(shadow.textContent).toContain(formatGpa(gpa.cumulative)!)
    expect(shadow.textContent).toContain(`${gpa.credits} credits counted`)
    expect(shadow.querySelectorAll('[aria-label="GPA per semester"] li').length).toBe(gpa.semesters.filter((s) => s.gpa !== null).length)
    expect(mainTable().querySelectorAll(`tr.${COUNTED_CLASS}`)).toHaveLength(gpa.counted.size)
    expect(cellsText()).toBe(before)
    expect(document.adoptedStyleSheets.length).toBe(1)
    expect(document.querySelectorAll('style')).toHaveLength(0)
  })

  it('recomputes when the non-GPA list changes', async () => {
    const { shadow } = await mount()
    const n = mainTable().querySelectorAll(`tr.${COUNTED_CLASS}`).length
    await act(async () => { await setSettings({ 'grades.nonGpa': [] }) })
    await tick(); await tick()
    expect(mainTable().querySelectorAll(`tr.${COUNTED_CLASS}`).length).toBeGreaterThan(n)
    expect(shadow.textContent).toContain('Not counted: nothing.')
  })

  it('links only to views that have shipped, and always to the not-counted setting', async () => {
    let { shadow } = await mount()
    const names = () => [...shadow.querySelectorAll('button')].map((b) => b.textContent)
    expect(names()).toEqual(['Edit the not-counted list'])
    await act(async () => { shadow.querySelector('button')!.click() })
    expect(opened).toEqual([{ overlay: 'settings', section: 'grades' }])
    registerView({ tab: 'grades', sub: 'gpa', label: 'GPA', icon: 'chart', component: async () => () => null })
    ;({ shadow } = await mount())
    expect(names()).toEqual(['Open Grades', 'Edit the not-counted list'])
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
  })

  it('shows a layout-changed notice when the transcript cannot be read', async () => {
    document.body.innerHTML = '<div class="content-page"><div class="card"><table class="fap-sheet"><thead><tr><th>a</th></tr></thead></table></div></div>'
    const { shadow } = await mount()
    expect(shadow.textContent).toBe(LAYOUT_TEXT)
  })

  it('passes axe', async () => {
    const { m } = await mount()
    const r = await axe.run(m!.host, { rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } }, resultTypes: ['violations'] })
    expect(r.violations.map((v) => v.id)).toEqual([])
  })
})
