// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { installFakeChrome } from './helpers/fake-chrome'
import { PanelRouter } from '../src/content/panel/router'
import { Navigation, TABS } from '../src/content/panel/nav'
import { clearViews, notifyCounts, registerView } from '../src/content/panel/views'
import { pageRoute } from '../src/content/panel/page-aware'
import { mountPanel } from '../src/content/panel/host'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('page-aware map', () => {
  it('maps FAP paths to routes and other pages to Today', () => {
    expect(pageRoute('/WeeklyTimetable')).toEqual({ tab: 'schedule', sub: 'week' })
    expect(pageRoute('/ExamSchedule')).toEqual({ tab: 'schedule', sub: 'exams' })
    expect(pageRoute('/Report/Transcript')).toEqual({ tab: 'grades', sub: 'gpa' })
    expect(pageRoute('/Report/Attendance')).toEqual({ tab: 'info', sub: 'status' })
    expect(pageRoute('/News/Detail/5')).toEqual({ tab: 'info', sub: 'news' })
    expect(pageRoute('/Curriculum')).toEqual({ tab: 'info', sub: 'subjects' })
    expect(pageRoute('/Subject/PRF192')).toEqual({ tab: 'info', sub: 'subjects' })
    expect(pageRoute('/')).toEqual({ tab: 'today' })
    expect(pageRoute('/Newsletter')).toEqual({ tab: 'today' })
    expect(pageRoute('/Report/Grade')).toEqual({ tab: 'grades', sub: 'courses' })
  })

  it('takes the open course from the grade page', () => {
    const { document } = parseHTML('<html><body><select id="grade-report-course"><option value="a">A</option><option value="g-1" selected>B</option></select></body></html>')
    expect(pageRoute('/Report/Grade', document)).toEqual({ tab: 'grades', sub: 'courses', params: { courseId: 'g-1' } })
  })
})

describe('tab bar and sub-views', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    document.body.innerHTML = ''
  })

  function render(router: PanelRouter) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => root.render(<Navigation router={router} />))
    const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Sections"] [role="tab"]')]
    const key = (t: HTMLElement, k: string) => act(() => { t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })
    return { el, root, tabs, key }
  }

  it('has four one-word tabs with icons in order', () => {
    const { tabs, root } = render(new PanelRouter())
    expect(tabs().map((t) => t.textContent)).toEqual(['Today', 'Schedule', 'Grades', 'Info'])
    expect(tabs().every((t) => t.querySelector('svg'))).toBe(true)
    expect(TABS.every((t) => /^[A-Z][a-z]+$/.test(t.label))).toBe(true)
    act(() => root.unmount())
  })

  it('moves focus with arrows, Home and End, and activates only on Enter, Space or click', () => {
    const router = new PanelRouter()
    const { tabs, key, root } = render(router)
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1, -1])
    tabs()[0]!.focus()
    key(tabs()[0]!, 'ArrowRight')
    expect(document.activeElement).toBe(tabs()[1])
    expect(router.current()).toEqual({ tab: 'today' })
    key(tabs()[1]!, 'End')
    expect(document.activeElement).toBe(tabs()[3])
    key(tabs()[3]!, 'ArrowRight')
    expect(document.activeElement).toBe(tabs()[0])
    key(tabs()[0]!, 'ArrowLeft')
    key(tabs()[3]!, 'Home')
    expect(document.activeElement).toBe(tabs()[0])
    key(tabs()[1]!, 'Enter')
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'week' })
    key(tabs()[2]!, ' ')
    expect(router.current()).toEqual({ tab: 'grades', sub: 'courses' })
    act(() => tabs()[3]!.click())
    expect(router.current()).toEqual({ tab: 'info', sub: 'subjects' })
    expect(tabs()[3]!.getAttribute('aria-selected')).toBe('true')
    act(() => root.unmount())
  })

  it('shows the segmented sub-views with counts', () => {
    let exams = 3
    registerView({ tab: 'schedule', sub: 'exams', label: 'Exams', icon: 'school', component: async () => () => null, count: () => exams })
    const router = new PanelRouter({ tab: 'schedule', sub: 'week' })
    const { el, root } = render(router)
    const subs = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Schedule views"] [role="tab"]')]
    expect(subs().map((t) => t.getAttribute('aria-label'))).toEqual(['Week', 'Exams, 3', 'Export'])
    exams = 5
    act(() => notifyCounts())
    expect(subs()[1]!.textContent).toBe('Exams5')
    act(() => subs()[1]!.click())
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    act(() => router.go({ tab: 'today' }))
    expect(el.querySelector('[aria-label="Schedule views"]')).toBeNull()
    act(() => root.unmount())
  })
})

describe('page-aware mount', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  it('selects the mapped tab on load, then a manual pick wins', async () => {
    history.replaceState(null, '', '/ExamSchedule')
    let m!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { m = await mountPanel(document, '') })
    expect(m.router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    const info = [...m.shadow.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) => t.textContent === 'Info')!
    act(() => info.click())
    expect(m.router.current()).toEqual({ tab: 'info', sub: 'subjects' })
    act(() => m.root.unmount())
    history.replaceState(null, '', '/')
  })
})
