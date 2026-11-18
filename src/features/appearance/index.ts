// Appearance module in the main content script: its settings rows and the Theme view. Styles are applied
// by the document_start entry (src/content/appearance.ts), which reads the same stores.
import { addModule } from '../../content/modules'
import { registerView } from '../../content/panel/views'
import { registerAppearanceSettings } from './settings'
import { ThemeView } from './views/ThemeView'
import { onMessage } from '../../shared/call'
import { PREVIEW_EVENT } from './preview'

export function registerAppearanceViews(): void {
  registerView({ overlay: 'theme', label: 'Theme', icon: 'settings', component: async () => ThemeView })
  registerAppearanceSettings()
}

// Previews from the theme editor window reach the document_start entry the same way as the panel's (F-21);
// that entry validates the style before it applies anything.
let relaying = false
export function relayEditorPreviews(): void {
  if (relaying) return
  relaying = true
  onMessage('theme.preview', (m) => { document.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: m.preview })) })
}

addModule({ id: 'appearance', registerViews: () => { registerAppearanceViews(); relayEditorPreviews() } })
