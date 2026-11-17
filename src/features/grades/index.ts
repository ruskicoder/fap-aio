// Grades module: sources only for now; views and inline enhancements follow in GRD-4 and GRD-5.
import { addModule } from '../../content/modules'
import { registerGradeSources } from './sources'

addModule({ id: 'grades', registerSources: registerGradeSources })
