// Grades module: sources, settings and inline page enhancements (the transcript summary); panel views
// follow in GRD-5.
import { addModule } from '../../content/modules'
import { registerGradeSources } from './sources'
import { registerGradeSettings } from './settings'
import { mountTranscriptSummary } from './inline/TranscriptSummary'

export const TRANSCRIPT_PATH = /^\/Report\/Transcript(\/|$)/i

addModule({
  id: 'grades',
  registerSources: registerGradeSources,
  registerViews: registerGradeSettings,
  onPage: ({ path, doc }) => {
    if (TRANSCRIPT_PATH.test(path)) mountTranscriptSummary(doc)
  },
})
