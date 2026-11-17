// @vitest-environment happy-dom
// PNL-8.1: SettingsRegistry and the Settings view (panel-ux R8.1, R8.2, R8.3, R4.3).
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { SettingsView } from '../src/content/panel/SettingsView'
import { registerGeneralSettings } from '../src/content/panel/settings/general'
import { activeSections, clearSettings, readSetting, registerSetting, searchSettings, settingDef, writeSetting } from '../src/content/panel/settings/registry'
import { read, write } from '../src/shared/storage/catalog'
import { readPrefs } from '../src/shared/panel-prefs'
import { defaultPanelState } from '../src/shared/panel-state'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

async function render() {
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  await act(async () => { createRoot(el).render(<SettingsView />) })
  await tick()
  return el
}

describe('SettingsRegistry', () => {
  beforeEach(() => { installFakeChrome(); clearSettings(); registerGeneralSettings() })

  it('keeps sections in the R8.1 order and shows only sections with settings', () => {
    expect(activeSections()).toEqual(['general'])
    registerSetting({ key: 'info.x', section: 'info', label: 'X', description: 'd', type: 'toggle', default: false })
    registerSetting({ key: 'grades.y', section: 'grades', label: 'Y', description: 'd', type: 'toggle', default: false })
    expect(activeSections()).toEqual(['general', 'grades', 'info'])
  })

  it('searches label, description and key', () => {
    expect(searchSettings('density').map((d) => d.key)).toEqual(['general.density'])
    expect(searchSettings('hidden').map((d) => d.key)).toEqual(['general.docked'])
    expect(searchSettings('general.page').map((d) => d.key)).toEqual(['general.pageAware'])
    expect(searchSettings('nothing like this')).toEqual([])
  })

  it('stores values in settings, binds shell preferences to panel.prefs and refuses invalid values', async () => {
    await writeSetting(settingDef('general.density')!, 'compact')
    expect((await read('settings'))!['general.density']).toBe('compact')
    await writeSetting(settingDef('general.pageAware')!, false)
    expect((await readPrefs()).pageAware).toBe(false)
    expect(await readSetting(settingDef('general.pageAware')!)).toBe(false)
    const def = { key: 'grades.goal', section: 'grades' as const, label: 'GPA goal', description: 'd', type: 'number' as const, default: null as number | null, validate: (v: number | null) => (v !== null && (v < 0 || v > 10) ? 'Enter a GPA from 0 to 10.' : null) }
    registerSetting(def)
    expect(await writeSetting(def, 11)).toBe('Enter a GPA from 0 to 10.')
    expect((await read('settings'))!['grades.goal']).toBeUndefined()
  })
})

describe('Settings view', () => {
  beforeEach(() => { installFakeChrome(); clearSettings(); registerGeneralSettings() })

  it('shows each row with its description, default and a modified marker, and saves at once', async () => {
    const el = await render()
    const row = el.querySelector('[data-setting="general.density"]')!
    expect(row.textContent).toContain('Compact fits more rows')
    expect(row.textContent).toContain('Default: Comfortable')
    expect(row.querySelector('[aria-label="Changed from the default"]')).toBeNull()
    const compact = [...row.querySelectorAll<HTMLInputElement>('input[type="radio"]')][1]!
    await act(async () => { compact.click() })
    await tick()
    expect((await read('settings'))!['general.density']).toBe('compact')
    expect(row.querySelector('[aria-label="Changed from the default"]')).toBeTruthy()
    const sw = el.querySelector<HTMLButtonElement>('[data-setting="general.pageAware"] [role="switch"]')!
    expect(sw.getAttribute('aria-checked')).toBe('true')
    await act(async () => { sw.click() })
    await tick()
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect((await readPrefs()).pageAware).toBe(false)
  })

  it('filters by the search field and says when nothing matches', async () => {
    const el = await render()
    const box = el.querySelector<HTMLInputElement>('input[type="search"]')!
    const type = async (v: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, v)
        box.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await type('dock')
    expect([...el.querySelectorAll('[data-setting]')].map((r) => r.getAttribute('data-setting'))).toEqual(['general.docked'])
    await type('zzz')
    expect(el.textContent).toContain('No settings match "zzz".')
  })

  it('offers a section select while floating and a sticky index while docked, once two sections exist', async () => {
    expect((await render()).querySelector('[aria-label="Go to section"]')).toBeNull()
    registerSetting({ key: 'info.x', section: 'info', label: 'Background refresh', description: 'd', type: 'toggle', default: false })
    expect((await render()).querySelector('select[aria-label="Go to section"]')).toBeTruthy()
    await write('panel.state', { ...defaultPanelState({ width: 1200, height: 800 }), mode: 'docked' })
    const docked = await render()
    expect([...docked.querySelectorAll('nav[aria-label="Settings sections"] button')].map((b) => b.textContent)).toEqual(['General', 'Info and alerts'])
  })
})
