// Appearance module in the main content script: its settings rows and the Theme view. Styles are applied
// by the document_start entry (src/content/appearance.ts), which reads the same stores.
import { addModule } from '../../content/modules'
import { registerView } from '../../content/panel/views'
import { registerAppearanceSettings } from './settings'
import { ThemeView } from './views/ThemeView'

export function registerAppearanceViews(): void {
  registerView({ overlay: 'theme', label: 'Theme', icon: 'settings', component: async () => ThemeView })
  registerAppearanceSettings()
}

addModule({ id: 'appearance', registerViews: registerAppearanceViews })
