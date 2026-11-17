// @vitest-environment happy-dom
// GRD-3.1: grade settings and store (grades R2.3, R7.1, R7.2, R7.7, R5.8; panel-ux R8.1).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const { KEYS, readGradeSettings, registerGradeSettings, setCourseGoal, setMoocDone, useGradeSettings } = await import('../src/features/grades/settings')
const { activeSections, clearSettings, settingDef, writeSetting } = await import('../src/content/panel/settings/registry')
const { registerGeneralSettings } = await import('../src/content/panel/settings/general')
const { exportSettings } = await import('../src/content/panel/settings/transfer')
const { SettingsView } = await import('../src/content/panel/SettingsView')
const { DEFAULT_NON_GPA } = await import('../src/features/grades/engine/gpa')
const { read, write } = await import('../src/shared/storage/catalog')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

let c: FakeChrome
beforeEach(() => {
  c = installFakeChrome()
  clearSettings()
  registerGeneralSettings()
  registerGradeSettings()
})

describe('grade settings', () => {
  it('add a Grades section after General with defaults Good, the owner list and no goal', async () => {
    expect(activeSections()).toEqual(['general', 'grades'])
    expect(await readGradeSettings()).toEqual({ defaultTier: 'good', nonGpa: [...DEFAULT_NON_GPA], gpaGoal: null, courseGoals: {}, moocDone: {} })
  })

  it('validate the non-GPA list and the GPA goal', async () => {
    expect(await writeSetting(settingDef(KEYS.nonGpa)!, ['PRF*'])).toMatch(/not a code prefix/)
    expect(await writeSetting(settingDef(KEYS.nonGpa)!, ['prf', 'ĐSA'])).toBeNull()
    expect(await writeSetting(settingDef(KEYS.gpaGoal)!, 11)).toMatch(/0 to 10/)
    expect(await writeSetting(settingDef(KEYS.gpaGoal)!, 3.2)).toBeNull()
    expect(await readGradeSettings()).toMatchObject({ nonGpa: ['prf', 'ĐSA'], gpaGoal: 3.2 })
  })

  it('keep per-course goals and MOOC completion in grades.settings', async () => {
    await setCourseGoal('c1', 'excellent')
    await setMoocDone('c2', true)
    expect(await read('grades.settings')).toEqual({ courseGoals: { c1: 'excellent' }, moocDone: { c2: true } })
    await setCourseGoal('c1', null)
    expect((await read('grades.settings'))!.courseGoals).toEqual({})
  })

  it('recompute at once: the hook follows every change', async () => {
    const seen: (number | null)[] = []
    function Probe() { const s = useGradeSettings(); if (s) seen.push(s.gpaGoal); return null }
    const el = document.createElement('div')
    await act(async () => { createRoot(el).render(<Probe />) })
    await tick()
    await act(async () => { await writeSetting(settingDef(KEYS.gpaGoal)!, 3.5) })
    await tick()
    expect(seen.at(-1)).toBe(3.5)
  })

  it('export the list and goals but not the MOOC rows', async () => {
    const f = await exportSettings()
    expect(Object.keys(f.settings)).toEqual(expect.arrayContaining([KEYS.defaultTier, KEYS.nonGpa, KEYS.gpaGoal]))
    expect(Object.keys(f.settings)).not.toContain(KEYS.mooc)
    expect(Object.keys(f.settings)).not.toContain('general.welcome')
  })
})

describe('Grades section rows', () => {
  async function render() {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<SettingsView />) })
    await tick(); await tick()
    return el
  }

  it('edit the non-GPA list on blur and reset it to the default', async () => {
    const el = await render()
    const row = el.querySelector(`[data-setting="${KEYS.nonGpa}"]`)!
    const box = row.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'GDQP, prf192')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      box.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    await tick()
    expect((await read('settings'))![KEYS.nonGpa]).toEqual(['GDQP', 'prf192'])
    await act(async () => { [...row.querySelectorAll('button')].find((b) => b.textContent === 'Reset to default')!.click() })
    await tick()
    expect((await read('settings'))![KEYS.nonGpa]).toEqual([...DEFAULT_NON_GPA])
    const tiers = [...el.querySelectorAll<HTMLOptionElement>(`[data-setting="${KEYS.defaultTier}"] option`)].map((o) => o.textContent)
    expect(tiers).toEqual(['Pass (5)', 'Fair (7)', 'Good (8)', 'Excellent (9)'])
  })

  it('list current courses with a MOOC bonus and save the ticks', async () => {
    await write('cache:grades.termCourses', { entries: { '[]': { value: { terms: [], selectedTermId: 't', courses: [
      { id: 'c1', termId: 't', label: 'Project management (PMG201c) (G1)', code: 'PMG201c' },
      { id: 'c2', termId: 't', label: 'Programming (PRF192) (G1)', code: 'PRF192' },
    ] }, fetchedAt: Date.now() } } })
    c.runtime.onMessage.addListener((m: { type: string }, _s: unknown, respond: (r: unknown) => void) => {
      if (m.type !== 'data.rules') return false
      respond({ ok: true, value: { dataVersion: 1, scrapedAt: '', rules: {}, subjects: { PMG201c: { coursera: { required: true, bonus: true } }, PRF192: { coursera: { required: false, bonus: false } } } } })
      return false
    })
    const el = await render()
    await tick()
    const row = el.querySelector(`[data-setting="${KEYS.mooc}"]`)!
    const boxes = [...row.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    expect(boxes.map((b) => b.parentElement!.textContent)).toEqual(['Project management (PMG201c) (G1)'])
    await act(async () => { boxes[0]!.click() })
    await tick()
    expect((await read('grades.settings'))!.moocDone).toEqual({ c1: true })
    expect(row.textContent).not.toContain('Default:')
  })
})
