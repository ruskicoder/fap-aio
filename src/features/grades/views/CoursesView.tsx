// Grades, Courses (grades R8.1, R8.2, R8.4, R8.5, R12.1, R7.6): the current term's courses with code,
// name, average, status, effective goal and needed scores; failed first; a detail per course with the
// components, marks, criteria, warnings and the FLM link; the rubric date at the foot.
import { useEffect, useState } from 'react'
import { Empty, Message, Tag, button, type Tint } from '../../scheduler/views/common'
import { ago } from '../../../content/panel/StatusStrip'
import { panelRouter } from '../../../content/panel/host'
import { registerRefresh } from '../../../content/panel/keys'
import { TIERS, type Prediction } from '../engine/predict'
import { weakGroups } from '../engine/course-model'
import { coursesState, flmLink, loadCourses, recompute, useCourses, type CourseRow } from '../courses'
import { useGradeSettings } from '../settings'
import { rubricInfo, rubricText, type RubricInfo } from '../rubric'
import { FLAG_TEXT } from '../inline/GradeInline'
import { letterOf } from '../engine/scale'
import { absenceInfo, readAttendance, useAttendanceEntries, type AttendanceEntry } from '../attendance'
import { AbsenceChip } from './AttendanceView'

/** Courses, then the current term's attendance, one page at a time and cache first (R16.6). */
export async function loadCoursesAndAttendance(force = false): Promise<void> {
  await loadCourses({ force })
  const st = coursesState()
  if (!st.error && st.rows.length) await readAttendance(st.rows.map((r) => r.ref), { force })
}

const TIER_LABELS = { pass: 'Pass', fair: 'Fair', good: 'Good', excellent: 'Excellent' } as const

export function statusTag(p: Prediction | null): { text: string; tint: Tint } {
  switch (p?.status) {
    case 'failed': return { text: 'Failing', tint: 'red' }
    case 'passed': return { text: 'Passed', tint: 'green' }
    case 'in-progress': return { text: 'In progress', tint: 'gray' }
    case 'unscored': return { text: 'Not scored', tint: 'violet' }
    default: return { text: 'No prediction', tint: 'gray' }
  }
}

/** The course average: the final one, or the average of the graded components so far. */
export function averageText(p: Prediction | null): string | null {
  if (!p || p.status === 'none' || p.status === 'unscored') return null
  const c = p.current
  if (c.remainingWeight === 0) {
    const t = p.tiers[0]
    return t && 'displayed' in t ? t.displayed.toFixed(1) : null
  }
  return c.gradedWeight > 0 ? (Math.round(Math.min(10, c.weightedSoFar / c.gradedWeight) * 10) / 10).toFixed(1) : null
}

/** True when every component is graded, so the average is the course grade and has a letter (R13.6). */
export const isFinal = (p: Prediction | null) => !!p && p.status !== 'none' && p.status !== 'unscored' && p.current.remainingWeight === 0

/** What the goal needs, in one line. */
export function needsText(row: CourseRow): string | null {
  const p = row.prediction
  if (!p || p.status === 'none' || p.status === 'unscored') return null
  const t = p.tiers.find((x) => x.tier === row.goal)
  if (!t) return null
  if ('reason' in t) return 'not reachable'
  if ('displayed' in t) return t.reachable ? 'reached' : 'not reached'
  if (!t.reachable) return 'out of reach while a criterion is failed'
  return t.required.map((r) => `${r.label} ${r.min.toFixed(1)}`).join(', ')
}

const criterionText = (c: { value: number; inclusive: boolean } | null) => (c ? `${c.inclusive ? 'at least' : 'above'} ${c.value}` : 'none')

function Detail({ row }: { row: CourseRow }) {
  const m = row.model
  const p = row.prediction
  const s = m?.subject
  const full = p && p.status !== 'none' && p.status !== 'unscored' ? p : null
  return (
    <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-700">
      {row.error && <Message tone="error">{row.error}</Message>}
      {s && s.assessments.length > 0 && (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Components of {row.ref.code ?? row.name}</caption>
          <thead><tr className="text-gray-500"><th className="py-0.5 pr-2 font-medium">Component</th><th className="py-0.5 pr-2 font-medium">Weight</th><th className="py-0.5 pr-2 font-medium">Marks</th><th className="py-0.5 font-medium">Must be</th></tr></thead>
          <tbody>
            {s.assessments.map((a) => (
              <tr key={a.index} className="border-t border-gray-100 align-top">
                <td className={`break-words py-0.5 pr-2 ${a.parentIndex !== null ? 'pl-3' : ''}`}>{a.category}</td>
                <td className="py-0.5 pr-2">{Math.round(a.weight * 1000) / 10}%</td>
                <td className="py-0.5 pr-2">{(m.scores[a.index] ?? []).map((v) => (v === null ? '-' : v)).join(', ') || '-'}</td>
                <td className="py-0.5">{criterionText(a.completion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {full && full.issues.length > 0 && <ul aria-label="Failed criteria" className="mt-1.5 text-red-700">{full.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
      {(full?.warnings.length || (m && weakGroups(m).length) || s?.flags.some((f) => FLAG_TEXT[f])) ? (
        <ul aria-label="Warnings" className="mt-1.5 text-amber-900">
          {full?.warnings.map((w) => <li key={w}>{w}</li>)}
          {m && weakGroups(m).map((g) => <li key={g}>The group "{g}" matched its FLM row weakly; check its criterion.</li>)}
          {s?.flags.filter((f) => FLAG_TEXT[f]).map((f) => <li key={f}>{FLAG_TEXT[f]}</li>)}
        </ul>
      ) : null}
      {row.rule?.sylId ? <p className="mt-1.5"><a className="font-medium text-orange-700 underline-offset-2 hover:underline" href={flmLink(row.rule.sylId)} target="_blank" rel="noopener noreferrer">Open the FLM syllabus</a></p> : <p className="mt-1.5 text-gray-500">No FLM syllabus found for this code.</p>}
    </div>
  )
}

function CourseCard({ row, open, toggle, att }: { row: CourseRow; open: boolean; toggle: () => void; att?: AttendanceEntry }) {
  const st = statusTag(row.prediction)
  const avg = averageText(row.prediction)
  const needs = needsText(row)
  const t = row.target
  return (
    <li className="mx-3 my-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2" data-course={row.ref.id}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug">{row.ref.code ? `${row.ref.code} · ${row.name}` : row.name}<Tag tint={st.tint}>{st.text}</Tag></p>
        <button type="button" aria-expanded={open} aria-label={`Details for ${row.ref.code ?? row.name}`} className="shrink-0 rounded px-1.5 text-xs text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={toggle}>{open ? 'Hide' : 'Details'}</button>
      </div>
      <p className="mt-0.5 flex flex-wrap gap-x-3 break-words text-xs leading-relaxed text-gray-600">
        {avg !== null && <span><b className="font-medium text-gray-900">Average:</b> {avg}{isFinal(row.prediction) ? ` (${letterOf(Number(avg))})` : ''}</span>}
        {t && (
          <span>
            <b className="font-medium text-gray-900">Goal:</b>{' '}
            <span className={t.from === 'tier' ? 'font-semibold text-orange-700' : ''}>{TIER_LABELS[row.goal]} {TIERS[row.goal]}</span>
            {t.derived !== null && <>, GPA goal <span className={t.from === 'gpa' ? 'font-semibold text-orange-700' : ''}>{t.derived.toFixed(1)}</span></>}
          </span>
        )}
        {needs && <span><b className="font-medium text-gray-900">Needs:</b> {needs}</span>}
        {(() => { const info = absenceInfo(att?.sheet?.counts, row.rule?.attendance.minPercent ?? null); return info ? <AbsenceChip info={info} /> : null })()}
        {row.error && !row.sheet && <span className="text-red-700">Not read: {row.error}</span>}
      </p>
      {open && <Detail row={row} />}
    </li>
  )
}

export function CoursesView() {
  const st = useCourses()
  const settings = useGradeSettings()
  const att = useAttendanceEntries()
  const [open, setOpen] = useState<string | null>(() => {
    const r = panelRouter?.current()
    return r && 'tab' in r && r.tab === 'grades' && 'params' in r ? r.params?.courseId ?? null : null
  })
  const [rubric, setRubric] = useState<RubricInfo | null>(null)
  useEffect(() => { void loadCoursesAndAttendance() }, [])
  // Alt+R (panel-ux R7.1).
  useEffect(() => registerRefresh('grades/courses', () => void loadCoursesAndAttendance(true)), [])
  // Settings changed: recompute what is loaded, without new requests (R2.3).
  useEffect(() => { if (settings) void recompute() }, [settings])
  useEffect(() => { void rubricInfo().then(setRubric) }, [])

  return (
    <div className="pb-3">
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <p className="min-w-0 flex-1 text-xs text-gray-600">{[st.term, st.fetchedAt ? `read ${ago(st.fetchedAt)}` : null].filter(Boolean).join(' · ') || 'Current term'}</p>
        <button type="button" className={button} disabled={st.loading} aria-busy={st.loading} onClick={() => void loadCoursesAndAttendance(true)}>{st.loading ? 'Reading' : 'Refresh'}</button>
      </div>
      {st.error && <div className="px-3"><Message tone="error">{st.error}</Message></div>}
      {!st.loading && !st.error && st.rows.length === 0 && (
        <Empty title="No courses this term yet">
          <p className="text-xs text-gray-600">FAP lists the courses of a term on its grade page.</p>
          <button type="button" className={button} onClick={() => void loadCoursesAndAttendance(true)}>Read courses from FAP</button>
        </Empty>
      )}
      <ul aria-label="Courses this term" className="m-0 list-none p-0">
        {st.rows.map((r) => <CourseCard key={r.ref.id} row={r} att={att.get(r.ref.id)} open={open === r.ref.id} toggle={() => setOpen(open === r.ref.id ? null : r.ref.id)} />)}
      </ul>
      {rubric && <p className="px-3 pt-2 text-[11px] text-gray-500">{rubricText(rubric)}</p>}
    </div>
  )
}
