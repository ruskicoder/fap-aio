// Appearance settings rows (appearance R7.4; panel-ux R8.1): compact density, wide content and sticky
// table headers, each off by default. The document_start entry reads them (layout/tweaks.ts).
import { registerSetting } from '../../content/panel/settings/registry'
import { TWEAK_KEY } from './layout/tweaks'

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
