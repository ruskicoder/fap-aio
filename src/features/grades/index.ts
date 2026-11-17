// Grades module: sources, settings, panel views (Courses and GPA) and inline page enhancements (the
// transcript summary and the prediction under the mark sheet).
import { addModule } from '../../content/modules'
import { registerView } from '../../content/panel/views'
import { registerGradeSources } from './sources'
import { registerGradeSettings } from './settings'
import { mountTranscriptSummary } from './inline/TranscriptSummary'
import { mountGradeInline } from './inline/GradeInline'
import { CoursesView } from './views/CoursesView'
import { GpaView } from './views/GpaView'
import { registerGradeToday } from './today'

export const TRANSCRIPT_PATH = /^\/Report\/Transcript(\/|$)/i
export const GRADE_PATH = /^\/Report\/Grade(\/|$)/i

export function registerGradeViews(): void {
  registerGradeSettings()
  // Static loaders: the content script is one IIFE bundle without code splitting.
  registerView({ tab: 'grades', sub: 'courses', label: 'Courses', icon: 'chart', component: async () => CoursesView, lastSync: [{ label: 'Courses', key: 'cache:grades.markSheet' }] })
  registerView({ tab: 'grades', sub: 'gpa', label: 'GPA', icon: 'chart', component: async () => GpaView, lastSync: [{ label: 'Transcript', key: 'cache:grades.transcript' }] })
  registerGradeToday()
}

addModule({
  id: 'grades',
  registerSources: registerGradeSources,
  registerViews: registerGradeViews,
  onPage: ({ path, doc }) => {
    if (TRANSCRIPT_PATH.test(path)) mountTranscriptSummary(doc)
    if (GRADE_PATH.test(path)) mountGradeInline(doc)
  },
})
