// Grades module: sources and settings; views and inline enhancements follow in GRD-4 and GRD-5.
import { addModule } from '../../content/modules'
import { registerGradeSources } from './sources'
import { registerGradeSettings } from './settings'

addModule({ id: 'grades', registerSources: registerGradeSources, registerViews: registerGradeSettings })
