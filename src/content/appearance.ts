// Appearance entry, run at document_start in the top frame (appearance design, "Early application").
import { startAppearance } from '../features/appearance/early'
import { registerClassicPart } from '../features/appearance/layout/classic/controller'
import { homePart, registerClassicSources } from '../features/appearance/layout/classic/home'
import { reportPart } from '../features/appearance/layout/classic/report'

// Classic layout parts shipped so far (APP-7.2, APP-7.3); the switch turns them on and off together.
registerClassicSources()
registerClassicPart(homePart)
registerClassicPart(reportPart)
startAppearance()
