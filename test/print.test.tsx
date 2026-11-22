// @vitest-environment happy-dom
// GRD-7.3: printable grade list and record export (grades R15.1 to R15.5, R13.6).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

const fx = (n: string) => readFileSync(`test/fixtures/en/${n}`, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => {
    const u = new URL(`https://fap.fpt.edu.vn${route}`)
    const html = u.pathname === '/Report/Transcript' ? fx('transcript.html')
      : u.searchParams.get('courseId') ? fx('grade-default.partial.html')
        : !u.searchParams.get('termId') ? fx('grade.html')
          : `<div class="content-page"><select id="grade-report-term"><option value="${u.searchParams.get('termId')}" selected>X</option></select><select id="grade-report-course"></select></div>`
    return { ok: true, value: new DOMParser().parseFromString(html, 'text/html'), fetchedAt: Date.now() }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { registerGradeSources } = await import('../src/features/grades/sources')
const { RecordEngine } = await import('../src/features/grades/record')
const { buildRecordExport, recordCsv, recordJson, gradeList, NOT_OFFICIAL } = await import('../src/features/grades/record-export')
const { PrintPage } = await import('../src/pages/print/PrintPage')
const { RecordView } = await import('../src/features/grades/views/RecordView')
const { installPrintWindow, PRINT_PAGE } = await import('../src/background/print-window')
const { handle } = await import('../src/background/router')
const { DEFAULT_NON_GPA } = await import('../src/features/grades/engine/gpa')
const { read } = await import('../src/shared/storage/catalog')
const { setSettings } = await import('../src/shared/settings')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
let c: FakeChrome
async function render(node: JSX.Element) {
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  await act(async () => { createRoot(el).render(node) })
  await wait(20); await wait(20)
  return el
}

beforeEach(async () => {
  c = installFakeChrome()
  registerGradeSources()
})
const readRecord = async () => { await new RecordEngine('p').start('update'); return (await read('grades.record'))! }

describe('the print window', () => {
  it('is opened by the service worker as a popup extension page, one at a time', async () => {
    installPrintWindow()
    const sender = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/Report/Grade', frameId: 0, tab: { id: 4 } as chrome.tabs.Tab }
    expect(await handle({ v: 1, type: 'print.open', components: true, attendance: false }, sender)).toEqual({ ok: true, value: { opened: true } })
    const w = c.windows._created as { url: string; type?: string }[]
    expect(w[0]!.url).toBe(`chrome-extension://test-extension-id/${PRINT_PAGE}?components=1&attendance=0`)
    expect(w[0]!.type).toBe('popup')
    // Only FAP pages may ask; a message from another site is dropped.
    expect(await handle({ v: 1, type: 'print.open', components: true, attendance: false }, { ...sender, url: 'https://example.com/' })).toBeUndefined()
  })

  it('declares no web-accessible resource and no downloads permission', async () => {
    const { default: manifest } = await import('../src/manifest')
    const m = manifest as unknown as Record<string, unknown>
    expect(m.web_accessible_resources).toBeUndefined()
    expect(JSON.stringify(m.permissions)).not.toContain('downloads')
    expect(readFileSync('vite.config.ts', 'utf8')).toContain("print: resolve(__dirname, 'src/pages/print/print.html')")
  })
})

describe('the grade list', () => {
  it('lists terms oldest first with term and cumulative GPAs on both scales', async () => {
    const list = gradeList(await readRecord(), DEFAULT_NON_GPA)
    expect(list.terms[0]!.name).toBe('Fall2023')
    expect(list.terms.at(-1)!.name).toBe('Fall2026')
    expect(list.terms.at(-1)!.cumulative.ten).toBeCloseTo(list.cumulative.ten!, 10)
    expect(list.terms.at(-1)!.cumulative.four).toBeCloseTo(list.cumulative.four!, 10)
    const yli = list.terms[0]!.courses.find((x) => x.code === 'YLI867')!
    expect([yli.grade, yli.letter, yli.points, yli.counted]).toEqual([9.3, 'A', 4, false]) // 0 credits: not counted
  })

  it('renders identity, curriculum, terms, GPAs, the date and the not-official note; components and scale are switchable', async () => {
    await readRecord()
    await act(async () => { await setSettings({ 'grades.gpaScale': '4' }) })
    const print = vi.fn()
    Object.defineProperty(window, 'print', { value: print, configurable: true })
    const el = await render(<PrintPage components={false} attendance={false} now={new Date('2026-11-22T03:00:00Z')} />)
    const doc = el.querySelector('main[aria-label="Academic grade list"]')!
    expect(doc.textContent).toContain('So Sriv Aamk')
    expect(doc.textContent).toContain('IR821902')
    expect(doc.textContent).toContain('OUV_BV_GN_21A')
    expect(doc.textContent).toContain('22 November 2026')
    expect(doc.textContent).toContain(`${NOT_OFFICIAL}.`)
    expect(doc.textContent).toContain('4-point (global)')
    expect([...doc.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label'))[0]).toBe('Fall2023')
    expect(doc.textContent).toMatch(/Term GPA: \d\.\d\d \(\d+ credits\)/)
    expect(doc.textContent).toMatch(/Cumulative GPA: [0-4]\.\d\d/)
    expect(doc.querySelectorAll('tr.component')).toHaveLength(0)
    const box = el.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => { box.click() })
    expect(el.querySelectorAll('tr.component').length).toBeGreaterThan(0)
    const sel = el.querySelector('select') as HTMLSelectElement
    await act(async () => { sel.value = '10'; sel.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(el.textContent).toContain('10-point (Vietnam)')
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Print or save as PDF')!
    await act(async () => { btn.click() })
    expect(print).toHaveBeenCalledOnce()
  })

  it('says what to do when no record is stored', async () => {
    const el = await render(<PrintPage components attendance={false} />)
    expect(el.textContent).toContain('No record read yet.')
    expect(([...el.querySelectorAll('button')].find((b) => b.textContent === 'Print or save as PDF') as HTMLButtonElement).disabled).toBe(true)
  })

  it('has an A4 print stylesheet that hides the controls', () => {
    const css = readFileSync('src/pages/print/print.css', 'utf8')
    expect(css).toMatch(/@page \{ size: A4;/)
    expect(css).toMatch(/@media print \{[\s\S]*\.no-print \{ display: none !important; \}/)
  })
})

describe('the record export', () => {
  it('writes CSV with a BOM, the header block, letters and components, and the same content as JSON', async () => {
    const e = buildRecordExport(await readRecord(), DEFAULT_NON_GPA, new Date('2026-11-22T00:00:00Z'))
    const csv = recordCsv(e)
    expect(csv.startsWith('﻿FAP-AIO academic record\r\n')).toBe(true)
    expect(csv).toContain(`${NOT_OFFICIAL}\r\n`)
    expect(csv).toContain('Student,So Sriv Aamk,Roll number,IR821902')
    expect(csv).toContain('Fall2023,YLI867,Nrigrthmgig tvs Patpfkb Blbvivvd Dmvasoy,0,9.3,A,4,Passed,No,,')
    expect(csv).toMatch(/\r\nFall2026,LMO352,[^\r\n]+\r\n/)
    const j = JSON.parse(recordJson(e))
    expect(j.formatVersion).toBe(1)
    expect(j.terms).toHaveLength(e.terms.length)
    expect(j.note).toBe(NOT_OFFICIAL)
  })

  it('is offered in Record with the print button, which asks the service worker', async () => {
    await readRecord()
    const sent: unknown[] = []
    c.runtime.onMessage.addListener((m: unknown, _s: unknown, respond: (r: unknown) => void) => { sent.push(m); respond({ ok: true, value: { opened: true } }); return false })
    const created: string[] = []
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:x', configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { created.push(this.download) })
    const el = await render(<RecordView />)
    const b = (t: string) => [...el.querySelectorAll('button')].find((x) => x.textContent === t)!
    await act(async () => { b('Print or save as PDF').click() })
    await wait(10)
    expect(sent).toContainEqual({ v: 1, type: 'print.open', components: true, attendance: false })
    await act(async () => { b('Export CSV').click() })
    await act(async () => { b('Export JSON').click() })
    expect(created).toEqual([expect.stringMatching(/^fap-aio-record-\d{4}-\d\d-\d\d\.csv$/), expect.stringMatching(/^fap-aio-record-\d{4}-\d\d-\d\d\.json$/)])
    click.mockRestore()
  })
})
