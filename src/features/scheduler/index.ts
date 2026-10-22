import { addModule } from '../../content/modules'
import { registerSchedulerSources } from './sources'

addModule({ id: 'scheduler', registerSources: registerSchedulerSources })
