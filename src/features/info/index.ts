// Info module: sources, the Info tab views (Subjects for now), settings and alerts; analyzers live in
// analyze.ts, news.ts and lecturers.ts; background refresh and the other views follow (INF-3, INF-5).
import { addModule } from '../../content/modules'
import { registerView } from '../../content/panel/views'
import { registerInfoSources } from './sources'
import { SubjectsView } from './views/SubjectsView'
import { registerInfoSettings } from './settings'
import { wireInfoAlerts } from './alerts'

export function registerInfoViews(): void {
  registerView({ tab: 'info', sub: 'subjects', label: 'Subjects', icon: 'search', component: async () => SubjectsView })
  registerInfoSettings()
  wireInfoAlerts()
}

addModule({ id: 'info', registerSources: registerInfoSources, registerViews: registerInfoViews })
