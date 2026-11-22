// Grades module: sources, settings, panel views (Courses, GPA, What-if and Planner) and inline page enhancements (the
// transcript summary and the prediction under the mark sheet).
import { addModule } from '../../content/modules'
import { registerView } from '../../content/panel/views'
import { registerGradeSources } from './sources'
import { registerGradeSettings } from './settings'
import { mountTranscriptSummary } from './inline/TranscriptSummary'
import { mountGradeInline } from './inline/GradeInline'
import { CoursesView } from './views/CoursesView'
import { GpaView } from './views/GpaView'
import { WhatIfView } from './views/WhatIfView'
import { PlannerView } from './views/PlannerView'
import { registerGradeToday } from './today'
import { RecordView } from './views/RecordView'
import { AttendanceView } from './views/AttendanceView'
import { recordEngine } from './record'

export const TRANSCRIPT_PATH = /^\/Report\/Transcript(\/|$)/i
export const GRADE_PATH = /^\/Report\/Grade(\/|$)/i

export function registerGradeViews(): void {
  registerGradeSettings()
  // Static loaders: the content script is one IIFE bundle without code splitting.
  registerView({ tab: 'grades', sub: 'courses', label: 'Courses', icon: 'chart', component: async () => CoursesView, lastSync: [{ label: 'Courses', key: 'cache:grades.markSheet' }] })
  registerView({ tab: 'grades', sub: 'gpa', label: 'GPA', icon: 'chart', component: async () => GpaView, lastSync: [{ label: 'Transcript', key: 'cache:grades.transcript' }] })
  registerView({ tab: 'grades', sub: 'whatif', label: 'What-if', icon: 'chart', component: async () => WhatIfView, lastSync: [{ label: 'Transcript', key: 'cache:grades.transcript' }] })
  registerView({ tab: 'grades', sub: 'planner', label: 'Planner', icon: 'chart', component: async () => PlannerView, lastSync: [{ label: 'Transcript', key: 'cache:grades.transcript' }] })
  registerView({ tab: 'grades', sub: 'record', label: 'Record', icon: 'chart', component: async () => RecordView, lastSync: [{ label: 'Record', key: 'grades.record' }] })
  registerView({ tab: 'grades', sub: 'attendance', label: 'Attendance', icon: 'chart', component: async () => AttendanceView, lastSync: [{ label: 'Attendance', key: 'cache:grades.attendance' }] })
  registerGradeToday()
}

// A running record job gives up its lease so the next page load resumes at once (R14.4).
addEventListener('pagehide', () => recordEngine.release())

addModule({
  id: 'grades',
  registerSources: registerGradeSources,
  registerViews: registerGradeViews,
  onPage: ({ path, doc }) => {
    if (TRANSCRIPT_PATH.test(path)) mountTranscriptSummary(doc)
    if (GRADE_PATH.test(path)) mountGradeInline(doc)
  },
})
