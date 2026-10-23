import { addModule, onBoot } from '../../content/modules'
import { registerSchedulerSources } from './sources'
import { engine } from './sync'

addModule({ id: 'scheduler', registerSources: registerSchedulerSources })
// A range sync interrupted by a reload or navigation continues on the next page (core R6.6).
onBoot('resume', () => void engine.resume())
addEventListener('pagehide', () => engine.release())
