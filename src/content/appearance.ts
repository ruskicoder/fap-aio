// Appearance entry, run at document_start in the top frame (appearance design, "Early application").
import { startAppearance } from '../features/appearance/early'
import { registerClassicPart } from '../features/appearance/layout/classic/controller'
import { homePart, registerClassicSources } from '../features/appearance/layout/classic/home'

// Classic layout parts shipped so far (APP-7.2); the switch turns them on and off together.
registerClassicSources()
registerClassicPart(homePart)
startAppearance()
