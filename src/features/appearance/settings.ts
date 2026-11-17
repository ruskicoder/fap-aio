// Appearance settings rows (appearance R7.4; panel-ux R8.1): the theme in use with a way into the Theme
// view, then compact density, wide content and sticky table headers, each off by default. The
// document_start entry reads them (layout/tweaks.ts).
import { createElement } from 'react'
import { registerSetting } from '../../content/panel/settings/registry'
import { panelRouter } from '../../content/panel/host'
import { useStore } from '../../content/panel/use-store'
import { button } from '../scheduler/views/common'
import { TWEAK_KEY } from './layout/tweaks'
import { CLASSIC_KEY } from './layout/classic/controller'
import { parseActive } from './state'
import { choiceOf } from './themes/store'
import { PRESETS } from './themes/presets'

function ThemeRow() {
  const choice = choiceOf(parseActive(useStore('appearance.active').data))
  const custom = useStore('appearance.themes').data?.themes ?? []
  const name = (id: string) => [...PRESETS.map((p) => p.theme), ...custom].find((t) => t.id === id)?.name ?? 'Custom'
  const text = choice.mode === 'fap-default' ? 'FAP default' : choice.mode === 'single' ? name(choice.id) : `${name(choice.light)} and ${name(choice.dark)}`
  return createElement('div', { className: 'flex flex-wrap items-center justify-end gap-2' },
    createElement('span', { className: 'text-sm text-gray-700' }, text),
    createElement('button', { type: 'button', className: button, onClick: () => panelRouter?.go({ overlay: 'theme' }) }, 'Choose a theme'))
}

export function registerAppearanceSettings(): void {
  registerSetting<null>({
    key: 'appearance.theme', section: 'appearance', type: 'custom', default: null, transfer: false,
    label: 'Theme', description: 'Colours and style of FAP pages: presets, your own themes, or FAP default.',
    component: () => createElement(ThemeRow),
  })
  registerLayoutSettings()
  // Shown once a Classic part ships (rule 10); it says only what is there today.
  registerSetting<boolean>({
    key: CLASSIC_KEY, section: 'appearance', type: 'toggle', default: false,
    label: 'Classic FAP layout', description: 'On the FAP home page, the links grouped as the old FAP grouped them, with application deadlines on request.',
  })
}

export function registerLayoutSettings(): void {
  registerSetting<boolean>({
    key: TWEAK_KEY.compact, section: 'appearance', type: 'toggle', default: false,
    label: 'Compact FAP pages', description: 'Tighter table rows and cards on FAP, so more rows fit on screen.',
  })
  registerSetting<boolean>({
    key: TWEAK_KEY.wide, section: 'appearance', type: 'toggle', default: false,
    label: 'Wide FAP pages', description: 'FAP content uses the full window width.',
  })
  registerSetting<boolean>({
    key: TWEAK_KEY.sticky, section: 'appearance', type: 'toggle', default: false,
    label: 'Sticky table headers', description: 'Header rows of FAP data tables stay in view while you scroll.',
  })
}
