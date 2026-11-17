// Grades, What-if (grades R9.1 to R9.4): an expected average or the remaining component marks for each
// in-progress course, hypothetical future courses, and the term and cumulative GPA recomputed on every
// keystroke. Inputs live in component state only and clear in one action; nothing is saved.
import { useEffect, useMemo, useState } from 'react'
import { Chip, Empty, Message, button, primary } from '../../scheduler/views/common'
import { ago } from '../../../content/panel/StatusStrip'
import { computeGpa, formatGpa } from '../engine/gpa'
import { averageWithMarks, partKey, remainingParts, simulatable, simulate, type Expected, type Hypothetical } from '../engine/whatif'
import { loadCourses, useCourses, type CourseRow } from '../courses'
import { useGradeSettings, type GradeSettings } from '../settings'
import { parseMark, useTranscript } from './use-transcript'
import type { TranscriptRow } from '../types'

const field = 'h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 aria-[invalid=true]:border-red-500'
type Mode = 'average' | 'marks'
interface HypoText { credits: string; average: string }

function Course({ row, course, s, mode, setMode, avg, setAvg, marks, setMark, expected, failing }: {
  row: TranscriptRow; course: CourseRow | undefined; s: GradeSettings; mode: Mode; setMode: (m: Mode) => void
  avg: string; setAvg: (v: string) => void; marks: Record<string, string>; setMark: (k: string, v: string) => void
  expected: Expected | null; failing: boolean
}) {
  const opts = { moocDone: course ? s.moocDone[course.ref.id] === true : false }
  const parts = course?.model ? remainingParts(course.model, opts) : []
  const id = `whatif-${row.id.replace(/[^a-z0-9]/gi, '-')}`
  const bad = avg.trim() !== '' && parseMark(avg) === null
  return (
    <li className="mx-3 my-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="min-w-0 flex-1 break-words font-medium text-gray-900">{row.code} · {row.name}</p>
        <p className="text-xs text-gray-600">{row.credits} credits</p>
      </div>
      {parts.length > 0 && (
        <div className="mt-1.5 flex gap-1.5" role="group" aria-label={`How to enter ${row.code}`}>
          <Chip on={mode === 'average'} onClick={() => setMode('average')}>Average</Chip>
          <Chip on={mode === 'marks'} onClick={() => setMode('marks')}>Component marks</Chip>
        </div>
      )}
      {mode === 'average' || parts.length === 0 ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-xs text-gray-700">Expected average</label>
          <input id={id} type="number" inputMode="decimal" min={0} max={10} step={0.1} className={`${field} w-20`} aria-invalid={bad} value={avg} onChange={(e) => setAvg(e.target.value)} />
          {bad && <span className="text-xs text-red-700">Enter 0 to 10.</span>}
        </div>
      ) : (
        <table className="mt-1.5 w-full border-collapse text-left text-xs">
          <caption className="sr-only">Remaining components of {row.code}</caption>
          <thead><tr className="text-gray-500"><th className="py-0.5 pr-2 font-medium">Component</th><th className="py-0.5 pr-2 font-medium">Weight</th><th className="py-0.5 font-medium">Expected mark</th></tr></thead>
          <tbody>
            {parts.map((p) => {
              const k = partKey(p.index, p.part)
              const v = marks[k] ?? ''
              return (
                <tr key={k} className="border-t border-gray-100">
                  <td className="break-words py-0.5 pr-2">{p.label}</td>
                  <td className="py-0.5 pr-2">{Math.round(p.weight * 1000) / 10}%</td>
                  <td className="py-0.5"><input type="number" inputMode="decimal" min={0} max={10} step={0.1} aria-label={`${row.code} ${p.label} expected mark`} className={`${field} h-7 w-16`} aria-invalid={v.trim() !== '' && parseMark(v) === null} value={v} onChange={(e) => setMark(k, e.target.value)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {mode === 'marks' && parts.length > 0 && (
        <p className="mt-1 text-xs text-gray-700">{expected ? `Course average ${expected.average.toFixed(1)}` : 'Fill every remaining component to see the course average.'}</p>
      )}
      {failing && <p className="mt-1 text-xs text-red-700">{expected?.failed ? 'A criterion fails the course, so it would not count toward GPA.' : 'Below 5.0 the course is not passed, so it would not count toward GPA.'}</p>}
    </li>
  )
}

export function WhatIfView() {
  const settings = useGradeSettings()
  const courses = useCourses()
  const { t, at, busy, error, load } = useTranscript('grades/whatif')
  const [mode, setMode] = useState<Record<string, Mode>>({})
  const [avg, setAvg] = useState<Record<string, string>>({})
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({})
  const [hypo, setHypo] = useState<HypoText[]>([])
  // Cached mark sheets cost no request; they enable entering component marks.
  useEffect(() => { void loadCourses() }, [])

  const rows = t && settings ? simulatable(t.rows, settings.nonGpa) : []
  const courseOf = (r: TranscriptRow) => courses.rows.find((c) => c.ref.code === r.code)
  const expectedOf = (r: TranscriptRow): Expected | null => {
    if ((mode[r.id] ?? 'average') === 'average') {
      const v = parseMark(avg[r.id])
      return v === null ? null : { average: v, failed: false }
    }
    const c = courseOf(r)
    if (!c?.model || !settings) return null
    const m = Object.fromEntries(Object.entries(marks[r.id] ?? {}).map(([k, v]) => [k, parseMark(v) ?? undefined]))
    return averageWithMarks(c.model, m, { moocDone: settings.moocDone[c.ref.id] === true })
  }
  const expected = Object.fromEntries(rows.map((r) => [r.id, expectedOf(r) ?? undefined]))
  const hypothetical: Hypothetical[] = hypo.flatMap((h) => {
    const credits = Number(h.credits)
    const average = parseMark(h.average)
    return Number.isInteger(credits) && credits > 0 && credits <= 30 && average !== null ? [{ credits, average }] : []
  })
  const sim = t && settings ? simulate({ rows: t.rows, nonGpa: settings.nonGpa, expected, hypothetical }) : null
  const now = useMemo(() => (t && settings ? computeGpa({ rows: t.rows, nonGpa: settings.nonGpa }) : null), [t, settings])
  const nowTerm = now?.semesters.find((x) => x.name === sim?.term.name)?.gpa ?? null
  const touched = Object.values(avg).some((v) => v !== '') || Object.values(marks).some((m) => Object.values(m).some((v) => v !== '')) || hypo.length > 0
  const clear = () => { setAvg({}); setMarks({}); setHypo([]); setMode({}) }

  return (
    <div className="pb-3">
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <p className="min-w-0 flex-1 text-xs text-gray-600">Try expected results. Nothing here is saved.{at ? ` Transcript read ${ago(at)}.` : ''}</p>
        <button type="button" className={button} disabled={!touched} onClick={clear}>Clear all</button>
      </div>
      {error && <div className="px-3"><Message tone="error">{error}</Message></div>}
      {!t && !busy && !error && (
        <Empty title="No transcript read yet">
          <button type="button" className={primary} onClick={() => void load(true)}>Read the transcript</button>
        </Empty>
      )}
      {t && sim && settings && (
        <>
          <div className="mx-3 my-2 grid grid-cols-2 gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2" role="status" aria-live="polite">
            <div>
              <p className="text-xs text-gray-700">Term GPA{sim.term.name ? ` · ${sim.term.name}` : ''}</p>
              <p className="text-xl font-semibold text-gray-900">{formatGpa(sim.term.gpa) ?? '-'}</p>
              <p className="text-xs text-gray-600">{sim.term.credits} credits · now {formatGpa(nowTerm) ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-700">Cumulative GPA</p>
              <p className="text-xl font-semibold text-gray-900">{formatGpa(sim.cumulative.gpa) ?? '-'}</p>
              <p className="text-xs text-gray-600">{sim.cumulative.credits} credits · now {formatGpa(now?.cumulative ?? null) ?? '-'}</p>
            </div>
          </div>
          <h3 className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Courses in progress</h3>
          {rows.length === 0 && <p className="px-3 py-1 text-sm text-gray-700">No course in progress counts toward GPA now.</p>}
          <ul>
            {rows.map((r) => (
              <Course key={r.id} row={r} course={courseOf(r)} s={settings}
                mode={mode[r.id] ?? 'average'} setMode={(m) => setMode((x) => ({ ...x, [r.id]: m }))}
                avg={avg[r.id] ?? ''} setAvg={(v) => setAvg((x) => ({ ...x, [r.id]: v }))}
                marks={marks[r.id] ?? {}} setMark={(k, v) => setMarks((x) => ({ ...x, [r.id]: { ...x[r.id], [k]: v } }))}
                expected={expected[r.id] ?? null} failing={sim.failing.includes(r.id)} />
            ))}
          </ul>
          <h3 className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Future courses</h3>
          <ul>
            {hypo.map((h, i) => (
              <li key={i} className="mx-3 my-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-700">Course {i + 1}</span>
                <label className="flex items-center gap-1 text-xs text-gray-700">Credits
                  <input type="number" inputMode="numeric" min={1} max={30} step={1} className={`${field} w-16`} value={h.credits} onChange={(e) => setHypo((x) => x.map((y, j) => (j === i ? { ...y, credits: e.target.value } : y)))} />
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-700">Average
                  <input type="number" inputMode="decimal" min={0} max={10} step={0.1} className={`${field} w-20`} aria-invalid={h.average.trim() !== '' && parseMark(h.average) === null} value={h.average} onChange={(e) => setHypo((x) => x.map((y, j) => (j === i ? { ...y, average: e.target.value } : y)))} />
                </label>
                <button type="button" className={button} aria-label={`Remove course ${i + 1}`} onClick={() => setHypo((x) => x.filter((_, j) => j !== i))}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="px-3 pt-1"><button type="button" className={button} onClick={() => setHypo((x) => [...x, { credits: '3', average: '' }])}>Add a future course</button></div>
        </>
      )}
    </div>
  )
}
