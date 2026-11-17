// @vitest-environment happy-dom
// PNL-8.2: settings export, import with a list of changes, and reset (panel-ux R8.4, R8.5).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { SettingsView } from '../src/content/panel/SettingsView'
import { registerGeneralSettings } from '../src/content/panel/settings/general'
import { clearSettings, registerSetting } from '../src/content/panel/settings/registry'
import { applyChanges, exportSettings, planImport, resetSettings } from '../src/content/panel/settings/transfer'
import { read } from '../src/shared/storage/catalog'
import { readPrefs } from '../src/shared/panel-prefs'
import { setSettings } from '../src/shared/settings'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const file = (settings: Record<string, unknown>, v = 1) => JSON.stringify({ formatVersion: v, exportedAt: 'x', settings })

beforeEach(() => {
  installFakeChrome()
  clearSettings()
  registerGeneralSettings()
  registerSetting<number | null>({ key: 'grades.gpaGoal', section: 'grades', label: 'GPA goal', description: 'd', type: 'number', default: null, min: 0, max: 10 })
})

describe('settings transfer', () => {
  it('exports every setting with the format version', async () => {
    await setSettings({ 'general.density': 'compact' })
    const f = await exportSettings(new Date('2026-11-17T00:00:00Z'))
    expect(f).toEqual({ formatVersion: 1, exportedAt: '2026-11-17T00:00:00.000Z', settings: { 'general.pageAware': true, 'general.density': 'compact', 'general.docked': 'narrow', 'grades.gpaGoal': null } })
  })

  it('checks an import key by key and lists only real changes', async () => {
    expect(await planImport('{oops')).toEqual({ error: 'This file is not JSON. Choose a settings file exported by FAP-AIO.' })
    expect(await planImport(file({}, 2))).toMatchObject({ error: expect.stringMatching(/format version 1/) })
    const plan = await planImport(file({ 'general.density': 'compact', 'general.docked': 'narrow', 'general.pageAware': 'yes', 'grades.gpaGoal': 11, 'old.key': 1 }))
    expect(plan).toEqual({
      changes: [{ key: 'general.density', label: 'Density', from: 'comfortable', to: 'compact' }],
      refused: [{ key: 'general.pageAware', reason: 'not on or off' }, { key: 'grades.gpaGoal', reason: 'out of range' }],
      unknown: ['old.key'],
    })
  })

  it('applies changes and resets one section or all', async () => {
    await applyChanges([{ key: 'general.docked', label: 'When docked', from: 'narrow', to: 'cover' }, { key: 'grades.gpaGoal', label: 'GPA goal', from: null, to: 3.2 }])
    expect((await readPrefs()).docked).toBe('cover')
    await resetSettings('grades')
    expect((await read('settings'))!['grades.gpaGoal']).toBeNull()
    expect((await readPrefs()).docked).toBe('cover')
    await resetSettings(null)
    expect((await readPrefs()).docked).toBe('narrow')
  })
})

describe('Settings view actions', () => {
  async function render() {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<SettingsView />) })
    await tick()
    const button = (t: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === t)!
    return { el, button }
  }

  it('previews an import and applies it on confirmation', async () => {
    const { el, button } = await render()
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    const f = new File([file({ 'general.density': 'compact' })], 's.json', { type: 'application/json' })
    Object.defineProperty(input, 'files', { value: [f], configurable: true })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await tick()
    const dialog = el.querySelector('[role="alertdialog"][aria-label="Confirm import"]')!
    expect(dialog.textContent).toContain('Density: Comfortable to Compact')
    await act(async () => { button('Apply').click() })
    await tick()
    expect((await read('settings'))!['general.density']).toBe('compact')
    expect(el.textContent).toContain('Settings imported.')
  })

  it('resets after a confirmation, and exports through a blob link', async () => {
    await setSettings({ 'general.density': 'compact' })
    const { el, button } = await render()
    await act(async () => { button('Reset all').click() })
    expect(el.textContent).toContain('Reset all settings to their defaults?')
    await act(async () => { button('Cancel').click() })
    expect((await read('settings'))!['general.density']).toBe('compact')
    await act(async () => { el.querySelector<HTMLButtonElement>('[aria-label="Reset general settings"]')!.click() })
    expect(el.textContent).toContain('Reset the General settings to their defaults?')
    await act(async () => { button('Reset').click() })
    await tick()
    expect((await read('settings'))!['general.density']).toBe('comfortable')
    const url = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: url, revokeObjectURL: vi.fn() })
    await act(async () => { button('Export settings').click() })
    await tick()
    expect(url).toHaveBeenCalledOnce()
    expect(el.textContent).toContain('Settings exported.')
  })
})
