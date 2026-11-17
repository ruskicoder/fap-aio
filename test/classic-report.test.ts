// @vitest-environment happy-dom
// APP-7.3: Classic report pages and timetable cards (appearance R6.6, R6.7, R6.8).
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'
import { PatchLog, markAll } from '../src/features/appearance/layout/classic/patch'
import { SR_CLASS, attendanceClass, choose, courseParts, reportPart, sessionCells } from '../src/features/appearance/layout/classic/report'
import { CLASSIC_KEY, clearClassicParts, registerClassicPart, startClassic } from '../src/features/appearance/layout/classic/controller'
import { StylePipeline } from '../src/features/appearance/pipeline'
import { write } from '../src/shared/storage/catalog'

const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')
const page = (n: string) => strip(readFileSync(`test/fixtures/en/${n}`, 'utf8'))
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const body = (html: string) => { document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML }

beforeEach(() => {
  installFakeChrome()
  clearClassicParts()
  document.adoptedStyleSheets = []
})

describe('markAll', () => {
  it('marks every match, including later ones, and restores class text exactly', () => {
    document.body.innerHTML = '<p class=" a  b ">1</p><p>2</p>'
    const before = document.body.innerHTML
    const log = new PatchLog()
    log.apply([markAll('m', () => [...document.querySelectorAll('p')], (el) => ['x', `n${el.textContent}`])])
    expect([...document.querySelectorAll('p')].map((p) => p.className)).toEqual([' a  b  x n1'.replace(/\s+/g, ' ').trim(), 'x n2'])
    document.body.insertAdjacentHTML('beforeend', '<p>3</p>')
    expect(log.refresh()).toEqual(['m'])
    expect(document.querySelectorAll('p')[2]!.className).toBe('x n3')
    expect(log.refresh()).toEqual([])
    document.querySelectorAll('p')[2]!.remove()
    log.revertAll()
    expect(document.body.innerHTML).toBe(before)
  })
})

describe('report pages', () => {
  it('split FAP course labels and set a select as a person would', () => {
    expect(courseParts('LMO Vidvpdnr (LMO352) (Rmky7_LO3383)')).toEqual({ name: 'LMO Vidvpdnr', code: 'LMO352', group: 'Rmky7_LO3383' })
    expect(courseParts('Plain')).toEqual({ name: 'Plain', code: null, group: null })
    document.body.innerHTML = '<select id="s"><option value="a">A</option><option value="b">B</option></select>'
    const sel = document.getElementById('s') as HTMLSelectElement
    const seen: string[] = []
    document.body.addEventListener('change', (e) => seen.push((e.target as HTMLSelectElement).value))
    choose(sel, 'b')
    choose(sel, 'b')
    expect(seen).toEqual(['b'])
  })

  for (const [file, prefix] of [['grade.html', 'grade-report'], ['attendance.html', 'attendance-report']] as const) {
    it(`${prefix}: term tabs and course cards drive FAP's selects, which stay focusable, and Classic off restores the page`, async () => {
      body(page(file))
      const before = document.body.innerHTML
      registerClassicPart(reportPart)
      const c = startClassic(new StylePipeline(document), document)
      await c.ready
      await write('settings', { [CLASSIC_KEY]: true })
      await tick()
      const term = document.getElementById(`${prefix}-term`) as HTMLSelectElement
      const course = document.getElementById(`${prefix}-course`) as HTMLSelectElement
      const host = document.querySelector(`[data-fap-aio-classic="${prefix}-term-cards"]`)!
      const root = host.shadowRoot!
      const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')]
      expect(tabs.map((t) => t.textContent)).toEqual([...term.options].map((o) => o.textContent!.trim()))
      expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1)
      const cards = [...root.querySelectorAll<HTMLButtonElement>('.card')]
      const termCourses = [...course.options].filter((o) => !o.dataset.reportTermId || o.dataset.reportTermId === term.value)
      expect(cards).toHaveLength(termCourses.length)
      expect(term.closest('.row')!.classList.contains(SR_CLASS)).toBe(true)
      expect(term.tabIndex).not.toBe(-1)
      const changes: string[] = []
      document.addEventListener('change', (e) => changes.push((e.target as Element).id))
      if (cards.length > 1) {
        const target = cards.find((b) => b.getAttribute('aria-current') !== 'true')!
        target.click()
        await tick()
        expect(changes).toContain(`${prefix}-course`)
        expect(root.querySelector('.card[aria-current=true]')!.textContent).toBe(target.textContent)
      }
      const other = tabs.find((t) => t.getAttribute('aria-selected') !== 'true')!
      other.click()
      await tick()
      expect(changes).toContain(`${prefix}-term`)
      expect(root.querySelector('[role=tab][aria-selected=true]')!.textContent).toBe(other.textContent)
      // Arrow keys move focus between tabs.
      const first = root.querySelectorAll<HTMLButtonElement>('[role=tab]')[0]!
      first.focus()
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
      expect(root.activeElement).toBe([...root.querySelectorAll('[role=tab]')].at(-1))
      // Back to FAP's own choices, then Classic off: the page is as it was.
      choose(term, [...term.options].find((o) => o.defaultSelected)?.value ?? term.options[0]!.value)
      choose(course, [...course.options].find((o) => o.defaultSelected)?.value ?? course.options[0]!.value)
      await write('settings', { [CLASSIC_KEY]: false })
      await tick()
      expect(document.querySelector('[data-fap-aio-classic]')).toBeNull()
      expect(document.body.innerHTML).toBe(before)
    })
  }
})

describe('timetable cards', () => {
  it('mark each session by attendance and leave FAP\'s text alone', async () => {
    body(page('timetable.html') + page('timetable-week.partial.html'))
    const text = document.body.textContent
    const cells = sessionCells(document)
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.map(attendanceClass)).toContain('fap-aio-att-exempt')
    registerClassicPart(reportPart)
    const c = startClassic(new StylePipeline(document), document)
    await c.ready
    await write('settings', { [CLASSIC_KEY]: true })
    await tick()
    expect(document.querySelectorAll('.fap-aio-classic-cell')).toHaveLength(cells.length)
    expect(document.body.textContent).toBe(text)
    const status = document.querySelector('.weekly-timetable-attendance-status')!
    status.textContent = 'Present'
    expect(attendanceClass(status.closest('.fap-aio-classic-cell')!)).toBe('fap-aio-att-present')
  })
})
