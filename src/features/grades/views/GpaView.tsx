// Grades, GPA (grades R2.4, R2.5, R8.3, R1.2, R7.3, R7.5, R11): cumulative and per-semester GPA with
// counted credits, the GPA goal and whether it is reachable, the replaced subjects as information only,
// and the CSV and JSON export.
import { useEffect, useRef, useState } from 'react'
import { Empty, Message, button, primary } from '../../scheduler/views/common'
import { ago } from '../../../content/panel/StatusStrip'
import { errorText } from '../../../content/panel/errors'
import { panelRouter } from '../../../content/panel/host'
import { registerRefresh } from '../../../content/panel/keys'
import { read } from '../../../content/fap/registry'
import { computeGpa, formatGpa, isExcluded, type GpaResult } from '../engine/gpa'
import { gpaGoal, maxAverage, type GoalCourse, type GpaGoalResult } from '../engine/goals'
import { buildExport, downloadGrades, statusText } from '../export'
import { GRADES_TRANSCRIPT } from '../sources'
import { useGradeSettings, type GradeSettings } from '../settings'
import { useCourses, type CourseRow } from '../courses'
import type { Transcript } from '../types'

/**
 * The courses that still count toward the goal: in-progress transcript rows that count once passed, with
 * the highest reachable average from the course prediction when it is loaded, else 10.
 */
export function goalCourses(t: Transcript, s: GradeSettings, rows: CourseRow[]): GoalCourse[] {
  return t.rows
    .filter((r) => r.status === 'in-progress' && r.credits > 0 && !isExcluded(r.code, s.nonGpa))
    .map((r) => {
      const p = rows.find((c) => c.ref.code === r.code)?.prediction
      const m = p ? maxAverage(p) : null
      return { id: r.id, credits: r.credits, maxAverage: m ?? 10 }
    })
}

export function goalResult(g: GpaResult, t: Transcript, s: GradeSettings, rows: CourseRow[]): GpaGoalResult | null {
  if (s.gpaGoal === null) return null
  return gpaGoal({ goal: s.gpaGoal, done: { credits: g.credits, points: (g.cumulative ?? 0) * g.credits }, courses: goalCourses(t, s, rows) })
}

function GoalBlock({ g, t, s, rows }: { g: GpaResult; t: Transcript; s: GradeSettings; rows: CourseRow[] }) {
  const r = goalResult(g, t, s, rows)
  if (!r) {
    return (
      <div className="mx-3 my-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
        <p className="text-gray-700">No GPA goal set.</p>
        <button type="button" className={`${button} mt-1.5`} onClick={() => panelRouter?.go({ overlay: 'settings', section: 'grades' })}>Set a GPA goal</button>
      </div>
    )
  }
  const credits = goalCourses(t, s, rows).reduce((n, c) => n + c.credits, 0)
  return (
    <div className={`mx-3 my-2 rounded-lg border px-3 py-2 text-sm ${r.reachable ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`} role="status">
      <p><b className="font-semibold">GPA goal {s.gpaGoal!.toFixed(2)}</b>{r.reachable ? ' is reachable.' : ' is not reachable.'}</p>
      {r.reachable && r.neededAverage !== null && <p className="text-xs">It needs an average of {Math.max(0, r.neededAverage).toFixed(1)} over {credits} in-progress credits.</p>}
      {r.reachable && r.neededAverage === null && <p className="text-xs">No course in progress counts toward GPA now.</p>}
      {!r.reachable && r.highestGpa !== null && <p className="text-xs">The highest reachable GPA is {formatGpa(r.highestGpa)}.</p>}
    </div>
  )
}

export function GpaView() {
  const settings = useGradeSettings()
  const courses = useCourses()
  const [t, setT] = useState<Transcript | null>(null)
  const [at, setAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const foot = useRef<HTMLDivElement>(null)
  const load = async (force: boolean) => {
    setBusy(true)
    setError(null)
    const r = await read<Transcript>(GRADES_TRANSCRIPT, {}, { force, priority: 'user' }).catch((e: unknown) => ({ ok: false as const, error: { kind: 'network' as const, message: String(e) } }))
    setBusy(false)
    if (r.ok) { setT(r.value); setAt(r.fetchedAt) } else setError(errorText(r.error))
  }
  useEffect(() => { void load(false) }, [])
  // Alt+R (panel-ux R7.1).
  useEffect(() => registerRefresh('grades/gpa', () => void load(true)), [])

  const g = t && settings ? computeGpa({ rows: t.rows, nonGpa: settings.nonGpa }) : null
  return (
    <div className="pb-3">
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <p className="min-w-0 flex-1 text-xs text-gray-600">{at ? `Transcript read ${ago(at)}` : 'Transcript not read yet'}</p>
        <button type="button" className={button} disabled={busy} aria-busy={busy} onClick={() => void load(true)}>{busy ? 'Reading' : 'Refresh'}</button>
      </div>
      {error && <div className="px-3"><Message tone="error">{error}</Message></div>}
      {!t && !busy && !error && (
        <Empty title="No transcript read yet">
          <button type="button" className={primary} onClick={() => void load(true)}>Read the transcript</button>
        </Empty>
      )}
      {t && g && settings && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-4 px-3 pt-1">
            <p><span className="text-2xl font-semibold text-gray-900">{formatGpa(g.cumulative) ?? 'No GPA yet'}</span> <span className="text-sm text-gray-600">cumulative GPA</span></p>
            <p className="text-sm text-gray-600">{g.credits} credits counted</p>
          </div>
          <GoalBlock g={g} t={t} s={settings} rows={courses.rows} />
          <table className="mx-3 w-[calc(100%-24px)] border-collapse text-left text-sm">
            <caption className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">GPA per semester</caption>
            <thead><tr className="text-xs text-gray-500"><th className="py-1 font-medium">Semester</th><th className="py-1 font-medium">GPA</th><th className="py-1 font-medium">Credits counted</th></tr></thead>
            <tbody>
              {g.semesters.map((s) => (
                <tr key={s.name} className="border-t border-gray-100"><td className="py-1">{s.name}</td><td className="py-1 font-medium text-gray-900">{formatGpa(s.gpa) ?? '-'}</td><td className="py-1">{s.credits}</td></tr>
              ))}
            </tbody>
          </table>
          {t.replaced.length > 0 && (
            <div className="px-3 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Replaced or extra subjects</p>
              <p className="text-xs text-gray-600">Information only: they do not count toward GPA.</p>
              <ul className="mt-1 text-xs text-gray-700">
                {t.replaced.map((r) => <li key={`${r.semester}|${r.code}`} className="break-words">{r.semester} · {r.code} · {r.name} · {r.credits} credits · {r.grade ?? '-'} · {statusText(r.status)}</li>)}
              </ul>
            </div>
          )}
          <div ref={foot} className="flex flex-wrap gap-2 px-3 pt-3">
            <button type="button" className={button} onClick={() => downloadGrades(foot.current ?? document.body, 'csv', buildExport(t, settings.nonGpa))}>Export CSV</button>
            <button type="button" className={button} onClick={() => downloadGrades(foot.current ?? document.body, 'json', buildExport(t, settings.nonGpa))}>Export JSON</button>
          </div>
        </>
      )}
    </div>
  )
}
