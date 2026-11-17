// @vitest-environment happy-dom
// PNL-9.2: first-run welcome (panel-ux R9.1, R9.2).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { installFakeChrome } from './helpers/fake-chrome'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const { mountPanel } = await import('../src/content/panel/host')
const { clearViews, registerView } = await import('../src/content/panel/views')
const { provideSyncAll, resetSyncAll } = await import('../src/content/panel/actions')
const { clearOptionalFeatures, registerOptionalFeature, showWelcome } = await import('../src/content/panel/welcome/Welcome')
const { registerSetting } = await import('../src/content/panel/settings/registry')
const { readPrefs } = await import('../src/shared/panel-prefs')
const { read } = await import('../src/shared/storage/catalog')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

async function mount() {
  let m!: Awaited<ReturnType<typeof mountPanel>>
  await act(async () => { m = await mountPanel(document, '') })
  await tick()
  const dialog = () => m.shadow.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="aio-welcome-title"]')
  const button = (t: string) => [...(dialog()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => b.textContent === t)!
  return { m, dialog, button }
}

describe('first-run welcome', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    clearOptionalFeatures()
    resetSyncAll()
    document.body.innerHTML = '<div class="wrapper"></div>'
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    registerView({ tab: 'schedule', sub: 'week', label: 'Classes', icon: 'calendar', component: async () => () => null })
  })

  it('opens docked, tours the shipped tabs, syncs this week and does not reopen once done', async () => {
    let done!: () => void
    provideSyncAll(() => new Promise((r) => { done = () => r({ ok: true }) }))
    const { m, dialog, button } = await mount()
    expect((await read('panel.state'))?.mode ?? 'docked').toBe('docked')
    expect(m.host.style.getPropertyValue('height')).toBe('100vh')
    expect(dialog()!.textContent).toContain('Step 1 of 2')
    expect([...dialog()!.querySelectorAll('li span:first-child')].map((s) => s.textContent)).toEqual(['Today', 'Schedule'])
    await act(async () => { button('Next').click() })
    expect(dialog()!.textContent).toContain('Step 2 of 2')
    await act(async () => { button('Sync this week').click() })
    expect(button('Syncing this week').disabled).toBe(true)
    await act(async () => { done() })
    await tick()
    expect(dialog()!.textContent).toContain('This week is synced.')
    await act(async () => { button('Done').click() })
    await tick()
    expect(dialog()).toBeNull()
    expect((await readPrefs()).firstRun).toBe('done')
    const again = await mount()
    expect(again.dialog()).toBeNull()
  })

  it('can be skipped on any step and reopened from Settings', async () => {
    const { m, dialog, button } = await mount()
    await act(async () => { button('Skip').click() })
    await tick()
    expect(dialog()).toBeNull()
    expect((await readPrefs()).firstRun).toBe('done')
    await act(async () => { m.router.go({ overlay: 'settings' }) })
    await tick(); await tick()
    const again = [...m.shadow.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Show the welcome')!
    await act(async () => { again.click() })
    expect(dialog()!.textContent).toContain('Welcome to FAP-AIO')
    await act(async () => { showWelcome() })
    await act(async () => { button('Next').click() })
    await act(async () => { button('Skip').click() })
    await tick()
    expect(dialog()).toBeNull()
  })

  it('lists shipped optional features, all off, as a third step', async () => {
    registerSetting<boolean>({ key: 'schedule.reminders.enabled', section: 'schedule', label: 'Reminders', description: 'Browser notifications before classes and exams.', type: 'toggle', default: false })
    registerOptionalFeature('schedule.reminders.enabled')
    registerOptionalFeature('session.keepAlive.enabled') // not shipped: no setting, not listed
    const { dialog, button } = await mount()
    expect(dialog()!.textContent).toContain('Step 1 of 3')
    await act(async () => { button('Next').click() })
    await act(async () => { button('Next').click() })
    const sw = dialog()!.querySelector<HTMLButtonElement>('[role="switch"]')!
    expect([dialog()!.querySelectorAll('[role="switch"]').length, sw.getAttribute('aria-checked')]).toEqual([1, 'false'])
    await act(async () => { sw.click() })
    await tick()
    expect((await read('settings'))!['schedule.reminders.enabled']).toBe(true)
  })
})
