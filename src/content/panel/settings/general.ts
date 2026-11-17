// General section (panel-ux R8.1, R4.3, R10.1, R1.5): page-aware tab, density and the docked layout.
import { createElement } from 'react'
import { registerSetting } from './registry'
import { WelcomeAgain } from '../welcome/Welcome'

export function registerGeneralSettings(): void {
  registerSetting<boolean>({
    key: 'general.pageAware', section: 'general', type: 'toggle', default: true, prefs: 'pageAware',
    label: 'Open the tab for the page',
    description: 'On each FAP page, open the panel tab that matches it.',
  })
  registerSetting<'comfortable' | 'compact'>({
    key: 'general.density', section: 'general', type: 'select', default: 'comfortable',
    options: [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }],
    label: 'Density',
    description: 'Compact fits more rows; comfortable is easier to read.',
  })
  registerSetting<'narrow' | 'cover'>({
    key: 'general.docked', section: 'general', type: 'select', default: 'narrow', prefs: 'docked',
    options: [{ value: 'narrow', label: 'Narrow the page' }, { value: 'cover', label: 'Cover the page' }],
    label: 'When docked',
    description: 'Narrow the FAP page so nothing is hidden, or let the panel cover its right side.',
  })
  registerSetting<null>({
    key: 'general.welcome', section: 'general', type: 'custom', default: null,
    label: 'Welcome tour',
    description: 'Show the first-run welcome again.',
    component: () => createElement(WelcomeAgain),
  })
}
