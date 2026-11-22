// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { installFakeChrome } from './helpers/fake-chrome'
import { PanelRouter } from '../src/content/panel/router'
import { Navigation, forgetViews } from '../src/content/panel/nav'
import { clearViews, registerView } from '../src/content/panel/views'
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

describe('tab bar', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    document.body.innerHTML = ''
    for (const [sub, label] of [['week', 'Classes'], ['exams', 'Exams'], ['export', 'Export']] as const) {
      registerView({ tab: 'schedule', sub, label, icon: 'x', component: async () => () => null })
    }
  })

  function render(router: PanelRouter) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => root.render(<Navigation router={router} />))
    const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    const key = (t: HTMLElement, k: string) => act(() => { t.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })
    return { el, root, tabs, key }
  }

  it('shows one tab per shipped view, one word each, and nothing for later milestones', () => {
    const { el, tabs, root } = render(new PanelRouter({ tab: 'schedule', sub: 'week' }))
    expect(tabs().map((t) => t.textContent)).toEqual(['Classes', 'Exams', 'Export'])
    expect(tabs().every((t) => /^[A-Z][a-z]+$/.test(t.textContent ?? ''))).toBe(true)
    expect(el.textContent).not.toMatch(/Today|Grades|Info/)
    act(() => root.unmount())
  })

  it('opens the first tab when the route has no shipped view', () => {
    const router = new PanelRouter({ tab: 'today' })
    const { root } = render(router)
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'week' })
    act(() => root.unmount())
  })

  it('moves focus with arrows, Home and End, and activates only on Enter, Space or click', () => {
    const router = new PanelRouter({ tab: 'schedule', sub: 'week' })
    const { tabs, key, root } = render(router)
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1])
    tabs()[0]!.focus()
    key(tabs()[0]!, 'ArrowRight')
    expect(document.activeElement).toBe(tabs()[1])
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'week' })
    key(tabs()[1]!, 'End')
    expect(document.activeElement).toBe(tabs()[2])
    key(tabs()[2]!, 'ArrowRight')
    expect(document.activeElement).toBe(tabs()[0])
    key(tabs()[0]!, 'Home')
    expect(document.activeElement).toBe(tabs()[0])
    key(tabs()[1]!, 'Enter')
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    key(tabs()[2]!, ' ')
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'export' })
    act(() => tabs()[0]!.click())
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'week' })
    expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true')
    act(() => root.unmount())
  })

  it('hides the tabs while Settings is open', () => {
    const router = new PanelRouter({ tab: 'schedule', sub: 'week' })
    const { tabs, root } = render(router)
    act(() => router.go({ overlay: 'settings' }))
    expect(tabs()).toHaveLength(0)
    act(() => router.back())
    expect(tabs()).toHaveLength(3)
    act(() => root.unmount())
  })
})

describe('sections and sub-views (F-18)', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    forgetViews()
    document.body.innerHTML = ''
    const v = (tab: 'today' | 'schedule' | 'grades' | 'info', sub: string | undefined, label: string) =>
      registerView({ tab, ...(sub ? { sub } : {}), label, icon: 'x', component: async () => () => null } as Parameters<typeof registerView>[0])
    // Registration order differs from the section order on purpose.
    v('grades', 'courses', 'Courses'); v('grades', 'gpa', 'GPA'); v('grades', 'whatif', 'What-if'); v('grades', 'planner', 'Planner')
    v('schedule', 'week', 'Classes'); v('schedule', 'exams', 'Exams'); v('schedule', 'export', 'Export')
    v('info', 'subjects', 'Subjects'); v('today', undefined, 'Today')
  })

  function render(router: PanelRouter) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => root.render(<Navigation router={router} />))
    const list = (label: string) => [...(el.querySelector(`[role="tablist"][aria-label="${label}"]`)?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
    const names = (label: string) => list(label).map((t) => t.textContent)
    return { el, root, list, names }
  }

  it('show Today, Schedule, Grades and Info in order, and the open section\'s views below', () => {
    const router = new PanelRouter({ tab: 'grades', sub: 'gpa' })
    const { names, list, el, root } = render(router)
    expect(names('Sections')).toEqual(['Today', 'Schedule', 'Grades', 'Info'])
    expect(list('Sections')[2]!.getAttribute('aria-selected')).toBe('true')
    expect(names('Grades views')).toEqual(['Courses', 'GPA', 'What-if', 'Planner'])
    expect(list('Grades views')[1]!.getAttribute('aria-selected')).toBe('true')
    expect(el.querySelectorAll('[role="tablist"]')).toHaveLength(2)
    // Never a sideways-scrolling bar (F-18); a sub-view bar that does not fit wraps instead (GRD-7).
    expect(el.innerHTML).not.toMatch(/overflow-x/)
    expect(el.querySelector('[role="tablist"][aria-label="Grades views"]')!.className).toContain('flex-wrap')
    act(() => list('Sections')[1]!.click())
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'week' })
    expect(names('Schedule views')).toEqual(['Classes', 'Exams', 'Export'])
    act(() => list('Sections')[0]!.click())
    expect(router.current()).toEqual({ tab: 'today' })
    expect(el.querySelectorAll('[role="tablist"]')).toHaveLength(1)
    act(() => list('Sections')[3]!.click())
    expect(router.current()).toEqual({ tab: 'info', sub: 'subjects' })
    expect(el.querySelectorAll('[role="tablist"]')).toHaveLength(1)
    act(() => root.unmount())
  })

  it('return a section to its last open view', () => {
    const router = new PanelRouter({ tab: 'grades', sub: 'courses' })
    const { list, root } = render(router)
    act(() => list('Grades views')[3]!.click())
    act(() => list('Sections')[1]!.click())
    act(() => list('Schedule views')[1]!.click())
    act(() => list('Sections')[2]!.click())
    expect(router.current()).toEqual({ tab: 'grades', sub: 'planner' })
    act(() => list('Sections')[1]!.click())
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    act(() => root.unmount())
  })

  it('open the section\'s first view for a stored or page-aware route without a view', () => {
    const router = new PanelRouter({ tab: 'info', sub: 'news' })
    const { root } = render(router)
    expect(router.current()).toEqual({ tab: 'info', sub: 'subjects' })
    act(() => router.go({ tab: 'grades', sub: 'courses', params: { courseId: 'x' } }))
    expect(router.current()).toEqual({ tab: 'grades', sub: 'courses', params: { courseId: 'x' } })
    act(() => root.unmount())
  })

  it('hide both rows while Settings is open', () => {
    const router = new PanelRouter({ tab: 'grades', sub: 'gpa' })
    const { el, root } = render(router)
    act(() => router.go({ overlay: 'settings' }))
    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(0)
    act(() => router.back())
    expect(el.querySelectorAll('[role="tablist"]')).toHaveLength(2)
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
    for (const [sub, label] of [['week', 'Classes'], ['exams', 'Exams'], ['export', 'Export']] as const) {
      registerView({ tab: 'schedule', sub, label, icon: 'x', component: async () => () => null })
    }
  })

  it('selects the mapped tab on load, then a manual pick wins', async () => {
    history.replaceState(null, '', '/ExamSchedule')
    let m!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { m = await mountPanel(document, '') })
    expect(m.router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    const classes = [...m.shadow.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) => t.textContent === 'Classes')!
    act(() => classes.click())
    expect(m.router.current()).toEqual({ tab: 'schedule', sub: 'week' })
    act(() => m.root.unmount())
    history.replaceState(null, '', '/')
  })
})
