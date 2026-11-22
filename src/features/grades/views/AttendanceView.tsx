// Grades, Attendance (grades R16.1 to R16.3, R16.7; GRD-7.4): each course of the chosen term with sessions
// attended, absent, not yet and exempt, the absence percentage against the limit and the risk colour of
// INF-2.1; past terms selectable; the term's attendance as CSV.
import { useEffect, useRef } from 'react'
import { Empty, Message, button, select } from '../../scheduler/views/common'
import { ago } from '../../../content/panel/StatusStrip'
import { registerRefresh } from '../../../content/panel/keys'
import { labelName } from '../record-model'
import { downloadText } from '../record-export'
import {
  RISK_STYLE, RISK_TEXT, absenceInfo, attendanceCsv, leftText, loadAttendance, pct, useAttendance, useAttendanceEntries,
  type AbsenceInfo, type AttendanceEntry,
} from '../attendance'
import type { CourseRef } from '../types'

/** The coloured "Absent X %" chip shown on attendance, Courses and Record cards (R16.6). */
export function AbsenceChip({ info }: { info: AbsenceInfo }) {
  return (
    <span className={`inline-block rounded px-1.5 text-[11px] font-medium leading-4 ${RISK_STYLE[info.risk.level]}`} title={`${RISK_TEXT[info.risk.level]}: ${leftText(info.risk)}`}>
      Absent {pct(info.percent)}%
    </span>
  )
}

function Card({ course: c, entry, minPercent }: { course: CourseRef; entry: AttendanceEntry | undefined; minPercent: number | null }) {
  const sheet = entry?.sheet ?? null
  const k = sheet?.counts
  const info = absenceInfo(k, minPercent)
  const unknown = sheet?.sessions.filter((s) => typeof s.status === 'object').map((s) => (s.status as { raw: string }).raw) ?? []
  return (
    <li className="mx-3 my-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2" data-attendance={c.id}>
      <p className="break-words text-[13px] font-medium leading-snug">
        {c.code ? `${c.code} · ${labelName(c.label)}` : c.label}
        {info && <span className={`ml-1 inline-block rounded px-1.5 align-[1px] text-[11px] font-medium leading-4 ${RISK_STYLE[info.risk.level]}`}>{RISK_TEXT[info.risk.level]}</span>}
      </p>
      {k ? (
        <>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs leading-relaxed text-gray-600">
            <span><b className="font-medium text-gray-900">Attended:</b> {k.attended}</span>
            <span><b className="font-medium text-gray-900">Absent:</b> {k.absent}</span>
            <span><b className="font-medium text-gray-900">Not yet:</b> {k.notYet}</span>
            <span><b className="font-medium text-gray-900">Exempt:</b> {k.exempt}</span>
          </p>
          {info
            ? <p className="text-xs leading-relaxed text-gray-700"><AbsenceChip info={info} /> of {pct(info.limit)}% allowed · {leftText(info.risk)} ({k.total} sessions)</p>
            : <p className="text-xs text-gray-600">FAP lists no session for this course yet.</p>}
          {sheet?.fromSummary && <p className="text-xs text-gray-500">Counts from FAP's summary line; the session table could not be read.</p>}
          {unknown.length > 0 && <p className="break-words text-xs text-amber-900">{unknown.length} {unknown.length === 1 ? 'session has' : 'sessions have'} a status FAP-AIO does not know: {[...new Set(unknown)].join(', ')}.</p>}
        </>
      ) : <p className="mt-0.5 text-xs text-gray-600">{entry?.error ? '' : 'Not read yet.'}</p>}
      {entry?.error && <p className="mt-0.5 text-xs text-red-700">Not read: {entry.error}</p>}
    </li>
  )
}

export function AttendanceView() {
  const st = useAttendance()
  const entries = useAttendanceEntries()
  const foot = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!st.termId && !st.loading) void loadAttendance() }, [])
  // Alt+R (panel-ux R7.1).
  useEffect(() => registerRefresh('grades/attendance', () => void loadAttendance({ termId: st.termId, force: true })), [st.termId])
  const term = st.terms.find((t) => t.id === st.termId)
  const minOf = (c: CourseRef) => (c.code ? st.rules[c.code]?.attendance.minPercent ?? null : null)
  return (
    <div className="pb-3">
      <div className="flex flex-wrap items-center gap-2 px-3 pb-1 pt-2.5">
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">Term
          <select className={select} value={st.termId ?? ''} disabled={st.loading || st.terms.length === 0} onChange={(e) => void loadAttendance({ termId: e.target.value })}>
            {st.terms.length === 0 && <option value="">Current term</option>}
            {st.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <p className="min-w-0 flex-1 text-xs text-gray-600">{st.fetchedAt ? `read ${ago(st.fetchedAt)}` : ''}</p>
        <button type="button" className={button} disabled={st.loading} aria-busy={st.loading} onClick={() => void loadAttendance({ termId: st.termId, force: true })}>{st.loading ? 'Reading' : 'Refresh'}</button>
      </div>
      {st.error && <div className="px-3"><Message tone="error">{st.error}</Message></div>}
      {!st.loading && !st.error && st.courses.length === 0 && (
        <Empty title="No attendance read yet">
          <p className="text-xs text-gray-600">FAP lists each course's sessions on its attendance report.</p>
          <button type="button" className={button} onClick={() => void loadAttendance({ termId: st.termId, force: true })}>Read attendance from FAP</button>
        </Empty>
      )}
      <ul aria-label={`Attendance${term ? ` in ${term.name}` : ''}`} className="m-0 list-none p-0">
        {st.courses.map((c) => <Card key={c.id} course={c} entry={entries.get(c.id)} minPercent={minOf(c)} />)}
      </ul>
      {st.courses.length > 0 && (
        <div ref={foot} className="px-3 pt-2">
          <p className="text-[11px] text-gray-500">A course is failed above 20% absence (80% attendance), or the limit its syllabus states.</p>
          <button type="button" className={`${button} mt-2`} onClick={() => downloadText(foot.current ?? document.body, `fap-aio-attendance-${(term?.name ?? 'term').replace(/[^\w-]/g, '')}-${new Date().toISOString().slice(0, 10)}.csv`,
            attendanceCsv(term?.name ?? '', st.courses.map((c) => ({ ref: c, sheet: entries.get(c.id)?.sheet ?? null, minPercent: minOf(c) }))), 'text/csv;charset=utf-8')}>Export CSV</button>
        </div>
      )}
    </div>
  )
}
