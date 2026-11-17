// @vitest-environment happy-dom
// PNL-9.1: Today view (panel-ux R3.1 to R3.4).
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { PanelRouter } from '../src/content/panel/router'
import { CALM_TEXT, NO_NEXT_CLASS, TodayView } from '../src/content/panel/today/TodayView'
import { TODAY_ORDER, clearTodayProviders, refreshAll, registerTodayProvider, todayProviders, type TodayItem } from '../src/content/panel/today/providers'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const item = (id: string, p: Partial<TodayItem> = {}): TodayItem => ({ id, title: id, tone: 'neutral', link: { tab: 'schedule', sub: 'week' }, ...p })

async function render(router = new PanelRouter({ tab: 'today' })) {
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  await act(async () => { createRoot(el).render(<TodayView router={router} />) })
  await tick()
  return { el, router, headings: () => [...el.querySelectorAll('h3')].map((h) => h.textContent) }
}

describe('Today view', () => {
  beforeEach(() => { installFakeChrome(); clearTodayProviders() })

  it('lists sections in the R3.1 order and hides empty ones', async () => {
    registerTodayProvider({ id: 'examsSoon', order: TODAY_ORDER.examsSoon, label: 'Exams within 14 days', attention: true, items: () => [item('FE PRF192', { when: 'in 3 days', tone: 'warning' })] })
    registerTodayProvider({ id: 'nextClass', order: TODAY_ORDER.nextClass, label: 'Next class', attention: false, items: async () => [item('PRF192', { when: 'in 25 min', detail: 'P.011 · 07:30' })] })
    registerTodayProvider({ id: 'todayClasses', order: TODAY_ORDER.todayClasses, label: 'Later today', attention: false, items: () => [] })
    expect(todayProviders().map((p) => p.id)).toEqual(['nextClass', 'todayClasses', 'examsSoon'])
    const { el, headings } = await render()
    expect(headings()).toEqual(['Next class', 'Exams within 14 days'])
    expect(el.textContent).not.toContain(CALM_TEXT)
    expect(el.textContent).toContain('in 25 min')
  })

  it('says so when nothing needs attention, and shows the next class', async () => {
    registerTodayProvider({ id: 'nextClass', order: 1, label: 'Next class', attention: false, items: () => [item('PRF192')] })
    registerTodayProvider({ id: 'gradeRisk', order: 5, label: 'Courses at risk', attention: true, items: () => [] })
    const { el, headings } = await render()
    expect(el.textContent).toContain(CALM_TEXT)
    expect(headings()).toEqual(['Next class'])
    expect(el.textContent).not.toContain(NO_NEXT_CLASS)
  })

  it('says when no next class is known', async () => {
    const { el } = await render()
    expect(el.textContent).toContain(CALM_TEXT)
    expect(el.textContent).toContain(NO_NEXT_CLASS)
    expect([...el.querySelectorAll('button')].some((b) => b.textContent === 'Refresh')).toBe(false)
  })

  it('deep-links each item', async () => {
    registerTodayProvider({ id: 'examsSoon', order: 3, label: 'Exams', attention: true, items: () => [item('FE', { link: { tab: 'schedule', sub: 'exams' } })] })
    const { el, router } = await render()
    await act(async () => { [...el.querySelectorAll<HTMLButtonElement>('li button')][0]!.click() })
    expect(router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
  })

  it('shows the latest sync time and refreshes every source in turn, stopping on a failure', async () => {
    const calls: string[] = []
    registerTodayProvider({ id: 'a', order: 1, label: 'A', attention: false, items: () => [], syncedAt: async () => Date.now() - 120_000, refresh: async () => { calls.push('a'); return { ok: true } } })
    registerTodayProvider({ id: 'b', order: 2, label: 'B', attention: false, items: () => [], syncedAt: async () => Date.now() - 3600_000, refresh: async () => { calls.push('b'); return { ok: false, text: 'FAP asked to sign in again.' } } })
    registerTodayProvider({ id: 'c', order: 3, label: 'C', attention: false, items: () => [], refresh: async () => { calls.push('c'); return { ok: true } } })
    const { el } = await render()
    expect(el.textContent).toContain('Synced 2 min ago')
    await act(async () => { [...el.querySelectorAll('button')].find((b) => b.textContent === 'Refresh')!.click() })
    await tick()
    expect(calls).toEqual(['a', 'b'])
    expect(el.querySelector('[role="alert"]')!.textContent).toBe('FAP asked to sign in again.')
    expect(await refreshAll([])).toEqual({ ok: true })
  })
})
