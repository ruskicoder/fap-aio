// Appearance module in the main content script: its settings rows. Styles are applied by the
// document_start entry (src/content/appearance.ts), which reads the same settings.
import { addModule } from '../../content/modules'
import { registerLayoutSettings } from './settings'

addModule({ id: 'appearance', registerViews: registerLayoutSettings })
