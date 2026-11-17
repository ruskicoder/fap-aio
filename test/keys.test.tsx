// @vitest-environment happy-dom
// PNL-7.1: KeybindEngine, recording, Chrome's toggle and the shortcuts sheet (panel-ux R7.1 to R7.6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

vi.mock('../src/content/fap/queue', () => ({ queuedGet: vi.fn(async () => ({ ok: false, error: { kind: 'network' } })), queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} } }))
const { chordOf, clearActions, conflict, installKeys, registerAction, setRecording } = await import('../src/content/panel/keys')
const { KeybindRow, ToggleRow } = await import('../src/content/panel/shortcuts')
const { mountPanel } = await import('../src/content/panel/host')
const { clearViews, registerView } = await import('../src/content/panel/views')
const { readPrefs, updatePrefs } = await import('../src/shared/panel-prefs')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const key = (init: KeyboardEventInit, target: EventTarget = window) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init })) })
const ev = (k: Partial<KeyboardEvent>) => ({ key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...k }) as KeyboardEvent

describe('chords', () => {
  it('read digits, letters and brackets from the key code, so macOS Alt combinations work', () => {
    expect(chordOf(ev({ key: '1', code: 'Digit1', altKey: true }))).toBe('Alt+1')
    expect(chordOf(ev({ key: '¡', code: 'Digit1', altKey: true }))).toBe('Alt+1')
    expect(chordOf(ev({ key: '‘', code: 'BracketRight', altKey: true }))).toBe('Alt+]')
    expect(chordOf(ev({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+K')
    expect(chordOf(ev({ key: '?', code: 'Slash', shiftKey: true }))).toBe('?')
    expect(chordOf(ev({ key: 'Alt', code: 'AltLeft', altKey: true }))).toBeNull()
  })

  it('refuse other actions, browser chords, the toggle and plain keys, naming the conflict', () => {
    clearActions()
    registerAction({ id: 'a', title: 'Refresh this view', default: { win: 'Alt+R', mac: 'Alt+R' }, run: () => {} })
    registerAction({ id: 'b', title: 'Open alerts', default: { win: 'Alt+N', mac: 'Alt+N' }, run: () => {} })
    expect(conflict('b', 'Alt+R', {}, false)).toBe('It is already used by "Refresh this view".')
    expect(conflict('b', 'Ctrl+T', {}, false)).toBe('The browser or the operating system uses it.')
    // F-16: Chrome's Linux tab keys, its Windows address bar key and macOS desktop switching.
    for (const c of ['Alt+1', 'Alt+8', 'Alt+D', 'Ctrl+1', 'Ctrl+Right']) expect(conflict('b', c, {}, false), c).toBe('The browser or the operating system uses it.')
    expect(conflict('b', 'Alt+Shift+F', {}, false)).toMatch(/opens and closes the panel/)
    expect(conflict('b', 'G', {}, false)).toMatch(/Add Ctrl, Alt or Cmd/)
    expect(conflict('b', 'Alt+G', {}, false)).toBeNull()
    expect(conflict('b', 'Alt+R', { a: 'Alt+X' }, false)).toBeNull()
  })
})

describe('engine', () => {
  let c: FakeChrome
  let ran: string[]
  let remove: () => void
  beforeEach(() => {
    c = installFakeChrome()
    clearActions()
    ran = []
    registerAction({ id: 'refresh', title: 'Refresh this view', default: { win: 'Alt+R', mac: 'Alt+R' }, run: () => ran.push('refresh') })
    registerAction({ id: 'sheet', title: 'Show shortcuts', default: { win: '?', mac: '?' }, run: () => ran.push('sheet') })
    remove = installKeys(window, false)
  })
  // The listener must not outlive the test: a leftover one would run every action twice later.
  afterEach(() => remove())

  it('runs actions, but not while typing in a field or while a row records', async () => {
    await key({ key: 'r', code: 'KeyR', altKey: true })
    await key({ key: '?', code: 'Slash', shiftKey: true })
    expect(ran).toEqual(['refresh', 'sheet'])
    const input = document.createElement('input')
    document.body.appendChild(input)
    await key({ key: '?', code: 'Slash', shiftKey: true }, input)
    const area = document.createElement('div')
    area.contentEditable = 'true'
    document.body.appendChild(area)
    await key({ key: 'r', code: 'KeyR', altKey: true }, area)
    setRecording(true)
    await key({ key: 'r', code: 'KeyR', altKey: true })
    setRecording(false)
    expect(ran).toEqual(['refresh', 'sheet'])
    void c
  })

  it('follows the overrides in panel.prefs', async () => {
    await act(async () => { await updatePrefs((p) => ({ ...p, keybinds: { refresh: 'Alt+G' } })) })
    await wait()
    await key({ key: 'r', code: 'KeyR', altKey: true })
    await key({ key: 'g', code: 'KeyG', altKey: true })
    expect(ran).toEqual(['refresh'])
  })
})

describe('settings rows', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    clearActions()
  })
  const action = { id: 'refresh', title: 'Refresh this view', default: { win: 'Alt+R', mac: 'Alt+R' }, run: () => {} }

  async function render(node: JSX.Element) {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(node) })
    await wait()
    return { el, button: (t: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === t)! }
  }

  it('record a new chord, refuse a browser chord with the reason, clear and reset', async () => {
    registerAction(action)
    registerAction({ id: 'other', title: 'Open alerts', default: { win: 'Alt+N', mac: 'Alt+N' }, run: () => {} })
    const { el, button } = await render(<KeybindRow action={action} mac={false} />)
    expect(el.querySelector('kbd')!.textContent).toBe('Alt+R')
    await act(async () => { button('Record').click() })
    expect(el.textContent).toContain('Press the new keys')
    await key({ key: 'g', code: 'KeyG', altKey: true })
    await wait()
    expect((await readPrefs()).keybinds).toEqual({ refresh: 'Alt+G' })
    expect(el.querySelector('kbd')!.textContent).toBe('Alt+G')
    await act(async () => { button('Record').click() })
    await key({ key: 't', code: 'KeyT', ctrlKey: true })
    expect(el.querySelector('[role="alert"]')!.textContent).toBe('Ctrl+T cannot be used. The browser or the operating system uses it.')
    await act(async () => { button('Record').click() })
    await key({ key: 'n', code: 'KeyN', altKey: true })
    expect(el.querySelector('[role="alert"]')!.textContent).toBe('Alt+N cannot be used. It is already used by "Open alerts".')
    await act(async () => { button('Clear').click() })
    await wait()
    expect((await readPrefs()).keybinds).toEqual({ refresh: '' })
    expect(el.textContent).toContain('None')
    await act(async () => { button('Reset').click() })
    await wait()
    expect((await readPrefs()).keybinds).toEqual({})
  })

  it('show the toggle chord from Chrome and open its shortcuts page', async () => {
    const sent: string[] = []
    c.runtime.onMessage.addListener((m: { type: string }, _s: unknown, respond: (r: unknown) => void) => {
      sent.push(m.type)
      respond(m.type === 'commands.list' ? { ok: true, value: [{ name: 'toggle-panel', shortcut: 'Alt+Shift+F' }] } : { ok: true, value: null })
      return false
    })
    const { el, button } = await render(<ToggleRow />)
    await wait()
    expect(el.querySelector('kbd')!.textContent).toBe('Alt+Shift+F')
    await act(async () => { button('Change in Chrome').click() })
    expect(sent).toEqual(['commands.list', 'shortcuts.open'])
  })
})

describe('panel actions', () => {
  beforeEach(() => {
    installFakeChrome()
    clearViews()
    clearActions()
    document.body.innerHTML = '<div class="wrapper"></div>'
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  it('switch tabs, dock, open the inbox and the sheet from the keyboard', async () => {
    await act(async () => { await updatePrefs((p) => ({ ...p, firstRun: 'done', pageAware: false })) })
    // As in the content script: the panel mounts (registering Today), then the modules add their views.
    let m!: Awaited<ReturnType<typeof mountPanel>>
    await act(async () => { m = await mountPanel(document, '') })
    registerView({ tab: 'schedule', sub: 'week', label: 'Classes', icon: 'calendar', component: async () => () => null })
    registerView({ tab: 'schedule', sub: 'exams', label: 'Exams', icon: 'school', component: async () => () => null })
    await wait()
    // F-16: tabs and dock have no default; Alt+3 and Alt+D stay with the browser.
    await key({ key: '3', code: 'Digit3', altKey: true })
    expect(m.router.current()).toEqual({ tab: 'today' })
    await act(async () => { await updatePrefs((p) => ({ ...p, keybinds: { 'tab.3': 'Ctrl+Alt+3', 'panel.dock': 'Ctrl+Alt+K' } })) })
    await wait()
    await key({ key: '3', code: 'Digit3', ctrlKey: true, altKey: true })
    expect(m.router.current()).toEqual({ tab: 'schedule', sub: 'exams' })
    await key({ key: ']', code: 'BracketRight', altKey: true })
    expect(m.router.current()).toEqual({ tab: 'today' })
    await key({ key: 'd', code: 'KeyD', altKey: true })
    await wait()
    expect(m.shadow.querySelector('[aria-label="Undock panel"]')).toBeNull()
    await key({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true })
    await wait()
    expect(m.shadow.querySelector('[aria-label="Undock panel"]')).toBeTruthy()
    await key({ key: 'n', code: 'KeyN', altKey: true })
    expect(m.shadow.querySelector('[role="dialog"][aria-label="Alerts"]')).toBeTruthy()
    await key({ key: '?', code: 'Slash', shiftKey: true })
    await wait(); await wait()
    expect(m.router.current()).toEqual({ overlay: 'shortcuts' })
    expect(m.shadow.textContent).toContain('Open tab 1')
    expect(m.shadow.textContent).toContain('Actions marked None have no default')
  })
})
