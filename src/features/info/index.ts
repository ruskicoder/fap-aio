// Info module: sources and the Info tab views (Subjects for now); analyzers live in analyze.ts, news.ts and
// lecturers.ts; background refresh, the other views and alerts follow (INF-3, INF-5, INF-6).
import { addModule } from '../../content/modules'
import { registerView } from '../../content/panel/views'
import { registerInfoSources } from './sources'
import { SubjectsView } from './views/SubjectsView'

export function registerInfoViews(): void {
  registerView({ tab: 'info', sub: 'subjects', label: 'Subjects', icon: 'search', component: async () => SubjectsView })
}

addModule({ id: 'info', registerSources: registerInfoSources, registerViews: registerInfoViews })
