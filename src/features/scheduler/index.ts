import { addModule, onBoot } from '../../content/modules'
import { notifyCounts, registerView } from '../../content/panel/views'
import { read, subscribe } from '../../shared/storage/catalog'
import { todayVn } from '../../shared/dates'
import { registerSchedulerSources } from './sources'
import { engine } from './sync'
import { WeekView } from './views/WeekView'
import { ExamsView } from './views/ExamsView'
import type { ExamStore } from './types'

// Upcoming exams for the segmented-control badge (panel-ux R2.2).
let upcoming: number | null = null
const countExams = (d: ExamStore | null) => {
  const today = todayVn()
  const n = d ? d.exams.filter((e) => e.date >= today).length : 0
  upcoming = n || null
  notifyCounts()
}

export function registerSchedulerViews(): void {
  // Static loaders: the content script is one IIFE bundle without code splitting.
  registerView({ tab: 'schedule', sub: 'week', label: 'Week', icon: 'calendar', component: async () => WeekView })
  registerView({ tab: 'schedule', sub: 'exams', label: 'Exams', icon: 'school', component: async () => ExamsView, count: () => upcoming })
  void read('exams').then(countExams)
  subscribe('exams', countExams)
}

addModule({ id: 'scheduler', registerSources: registerSchedulerSources, registerViews: registerSchedulerViews })
// A range sync interrupted by a reload or navigation continues on the next page (core R6.6).
onBoot('resume', () => void engine.resume())
addEventListener('pagehide', () => engine.release())
