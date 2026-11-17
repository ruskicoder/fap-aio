// Info module: sources for now; analyzers, background refresh and views follow (INF-2 to INF-6).
import { addModule } from '../../content/modules'
import { registerInfoSources } from './sources'

addModule({ id: 'info', registerSources: registerInfoSources })
