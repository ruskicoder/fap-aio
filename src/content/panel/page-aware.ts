// PageAwareMap (panel-ux R4.1 to R4.3): FAP pathname to the panel route, applied once per page
// load when `panel.prefs.pageAware` is on. A tab picked by hand afterwards stays until the next load.
import type { Route } from '../../shared/panel-state'

const MAP: [RegExp, Route][] = [
  [/^\/WeeklyTimetable(\/|$)/i, { tab: 'schedule', sub: 'week' }],
  [/^\/ExamSchedule(\/|$)/i, { tab: 'schedule', sub: 'exams' }],
  [/^\/Report\/Grade(\/|$)/i, { tab: 'grades', sub: 'courses' }],
  [/^\/Report\/Transcript(\/|$)/i, { tab: 'grades', sub: 'gpa' }],
  [/^\/Report\/Attendance(\/|$)/i, { tab: 'info', sub: 'status' }],
  [/^\/News(\/|$)/i, { tab: 'info', sub: 'news' }],
  [/^\/(Curriculum|Subject)(\/|$)/i, { tab: 'info', sub: 'subjects' }],
]

export function pageRoute(path: string, doc?: Document): Route {
  const hit = MAP.find(([re]) => re.test(path))?.[1]
  if (!hit) return { tab: 'today' }
  if ('tab' in hit && hit.tab === 'grades' && hit.sub === 'courses') {
    // The open course on the grade page (panel-ux design, "PageAwareMap").
    const courseId = doc?.querySelector<HTMLSelectElement>('#grade-report-course')?.value
    if (courseId) return { tab: 'grades', sub: 'courses', params: { courseId } }
  }
  return hit
}
