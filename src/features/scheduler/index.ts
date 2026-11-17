import { addModule, onBoot } from '../../content/modules'
import { notifyCounts, registerView } from '../../content/panel/views'
import { provideSyncAll } from '../../content/panel/actions'
import { errorText } from '../../content/panel/errors'
import { read, subscribe } from '../../shared/storage/catalog'
import { todayVn } from '../../shared/dates'
import { registerSchedulerSources } from './sources'
import { engine, syncExams } from './sync'
import { WeekView } from './views/WeekView'
import { ExamsView } from './views/ExamsView'
import { ExportView } from './views/ExportView'
import type { ExamStore } from './types'
import { registerSchedulerToday } from './today'
import { registerReminderSettings } from './settings'

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
  // Tabs Classes, Exams, Export (panel-ux R2.1, agreed shell).
  registerView({ tab: 'schedule', sub: 'week', label: 'Classes', icon: 'calendar', component: async () => WeekView, lastSync: [{ label: 'Classes', key: 'timetable' }] })
  registerView({ tab: 'schedule', sub: 'exams', label: 'Exams', icon: 'school', component: async () => ExamsView, count: () => upcoming, lastSync: [{ label: 'Exams', key: 'exams' }] })
  registerView({ tab: 'schedule', sub: 'export', label: 'Export', icon: 'download', component: async () => ExportView, lastSync: [{ label: 'Classes', key: 'timetable' }, { label: 'Exams', key: 'exams' }] })
  void read('exams').then(countExams)
  subscribe('exams', countExams)
  registerSchedulerToday()
  registerReminderSettings()
}

// Header Sync: this week's classes and the exams (panel-ux R2.3).
provideSyncAll(async () => {
  const w = await engine.syncWeek(todayVn())
  if (!w.ok) return { ok: false, text: errorText(w.error) }
  const e = await syncExams()
  if (!e.ok) return { ok: false, text: errorText(e.error) }
  return { ok: true }
})

addModule({ id: 'scheduler', registerSources: registerSchedulerSources, registerViews: registerSchedulerViews })
// A range sync interrupted by a reload or navigation continues on the next page (core R6.6).
onBoot('resume', () => void engine.resume())
addEventListener('pagehide', () => engine.release())
