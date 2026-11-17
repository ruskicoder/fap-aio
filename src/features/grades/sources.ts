// Grade sources (grades design, "Sources"; core R4.4).
import { register } from '../../content/fap/registry'
import { parseTranscript } from './parse/transcript'
import { parseTermCourses } from './parse/term-courses'
import type { TermCourses, Transcript } from './types'

export const GRADES_TRANSCRIPT = 'grades.transcript'
export const GRADES_TERM_COURSES = 'grades.termCourses'

const SIX_HOURS = 6 * 60 * 60_000

export function registerGradeSources(): void {
  register<Transcript>({
    id: GRADES_TRANSCRIPT,
    route: () => '/Report/Transcript',
    partial: false,
    parse: (doc) => parseTranscript(doc),
    cacheTtlMs: SIX_HOURS,
  })
  register<TermCourses>({
    id: GRADES_TERM_COURSES,
    route: (p) => (p.termId ? `/Report/Grade?termId=${encodeURIComponent(p.termId)}` : '/Report/Grade'),
    partial: false,
    parse: (doc, p) => parseTermCourses(doc, !p.termId),
    cacheTtlMs: SIX_HOURS,
  })
}
