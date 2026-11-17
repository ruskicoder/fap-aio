// Term and course lists of /Report/Grade (grades design, source `grades.termCourses`): the options of
// `#grade-report-term` and `#grade-report-course`. A course label reads `Name (CODE) (Group)`.
import { LayoutChangedError } from '../../../content/fap/registry'
import type { CourseRef, TermCourses } from '../types'

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** The subject code: the second-to-last parenthesised part of the label, when it looks like a code. */
export function courseCodeOf(label: string): string | null {
  const m = /\(([^()]+)\)\s*\([^()]*\)\s*$/.exec(label)
  const code = m?.[1]?.trim() ?? ''
  return /^[A-Z][A-Za-z]{1,5}\d{3}[a-z]?$/.test(code) ? code : null
}

/** `withoutTerm` is true when the page was read without a termId, so the selected term is the current one. */
export function parseTermCourses(doc: Document, withoutTerm: boolean): TermCourses {
  const termSel = doc.querySelector('#grade-report-term')
  const courseSel = doc.querySelector('#grade-report-course')
  if (!termSel) {
    if (doc.querySelector('.content-page .fap-empty-state, .content-page .fap-empty-card')) return { terms: [], selectedTermId: null, courses: [] }
    throw new LayoutChangedError('no #grade-report-term on /Report/Grade')
  }
  let selectedTermId: string | null = null
  const terms = [...termSel.querySelectorAll('option')].flatMap((o) => {
    const id = o.getAttribute('value') ?? ''
    if (!id) return []
    const selected = o.hasAttribute('selected')
    if (selected) selectedTermId = id
    return [{ id, name: clean(o.textContent), current: withoutTerm && selected }]
  })
  const courses: CourseRef[] = [...(courseSel?.querySelectorAll('option') ?? [])].flatMap((o) => {
    const id = o.getAttribute('value') ?? ''
    if (!id) return []
    const label = clean(o.textContent)
    return [{ id, termId: o.getAttribute('data-report-term-id') ?? selectedTermId ?? '', label, code: courseCodeOf(label) }]
  })
  return { terms, selectedTermId, courses }
}
