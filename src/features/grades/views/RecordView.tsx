// Grades, Record (grades R14, GRD-7.2): every term, newest first, and every course in it; each course
// expands to its mark sheet components, average and status. The view follows the stored record, so it
// shows what a running job has read so far (R14.5), with progress, Cancel and Resume.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Empty, Message, Tag, button, primary, type Tint } from '../../scheduler/views/common'
import { ago } from '../../../content/panel/StatusStrip'
import { registerRefresh } from '../../../content/panel/keys'
import { LEASE_MS, recordEngine, stepText, watchRecord, type RecordJob, type RecordStore } from '../record'
import { components, recordTerms, sheetStatusText, type RecordCourse, type RecordTermView } from '../record-model'
import { computeGpaOn, letterOf } from '../engine/scale'
import { formatGpa } from '../engine/gpa'
import { useGradeSettings } from '../settings'
import { useGpaScale } from '../scale-setting'
import { buildRecordExport, downloadText, recordCsv, recordFileName, recordJson } from '../record-export'
import { call } from '../../../shared/call'
import { dataClient } from '../../../content/data-client'
import { absenceInfo } from '../attendance'
import { AbsenceChip } from './AttendanceView'

export function useRecord(): { store: RecordStore | null; job: RecordJob | null; loaded: boolean } {
  const [s, setS] = useState<{ store: RecordStore | null; job: RecordJob | null; loaded: boolean }>({ store: null, job: null, loaded: false })
  useEffect(() => watchRecord((store, job) => setS({ store, job, loaded: true })), [])
  // Re-render when this tab's engine starts or stops.
  const [, tick] = useState(0)
  useEffect(() => recordEngine.subscribe(() => tick((n) => n + 1)), [])
  return s
}

/** The FLM attendance requirement of the courses with stored attendance, by code (80% when unknown). */
function useAttendanceRules(store: RecordStore | null): Record<string, number | null> {
  const codes = store ? [...new Set(Object.values(store.attendance ?? {}).flatMap((a) => {
    const code = store.terms[a.termId]?.courses.find((c) => c.id === a.courseId)?.code
    return code ? [code] : []
  }))].sort() : []
  const key = codes.join(',')
  const [rules, setRules] = useState<Record<string, number | null>>({})
  useEffect(() => {
    if (!codes.length) return
    let live = true
    void dataClient().rules(codes).then((r) => {
      if (live && r.ok) setRules(Object.fromEntries(Object.entries(r.value.subjects).map(([k, v]) => [k, v?.attendance.minPercent ?? null])))
    }).catch(() => undefined)
    return () => { live = false }
  }, [key])
  return rules
}

/** A job that runs here, or in another tab whose heartbeat is fresh. */
export const jobRunning = (job: RecordJob | null, now = Date.now()) => recordEngine.running || (!!job && !job.paused && !!job.runner && now - job.beatAt < LEASE_MS)

function statusTint(status: string): Tint {
  if (/^(passed|exempt)$/i.test(status)) return 'green'
  if (/not passed|failed/i.test(status)) return 'red'
  if (/progress|studying/i.test(status)) return 'blue'
  return 'gray'
}

export function gradeText(g: number | null): string | null {
  return g === null ? null : `${g.toFixed(1)} (${letterOf(g)})`
}

function Progress({ job, running }: { job: RecordJob; running: boolean }) {
  const total = job.steps.length
  const done = Math.min(job.next, total)
  const step = job.steps[job.next]
  return (
    <div className="mx-3 my-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
      <div role="progressbar" aria-label="Reading the record" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-1.5 w-full overflow-hidden rounded bg-gray-100">
        <div className="h-full bg-orange-500" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
      </div>
      <p className="mt-1.5 break-words" role="status">
        {running ? `Reading ${done + 1} of ${total}${step ? `: ${stepText(step)}` : ''}.` : `Reading stopped at ${done} of ${total} pages.`}
        {running && ' FAP pages are read one at a time within the request budget, so a first read takes several minutes.'}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {running
          ? <button type="button" className={button} onClick={() => void recordEngine.cancel()}>Cancel</button>
          : <>
              <button type="button" className={primary} onClick={() => void recordEngine.resume()}>Resume</button>
              <button type="button" className={button} onClick={() => void recordEngine.discard()}>Discard</button>
            </>}
      </div>
    </div>
  )
}

function Failed({ job, busy }: { job: RecordJob; busy: boolean }) {
  if (!job.failed.length || job.next < job.steps.length) return null
  return (
    <div className="mx-3 my-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
      <p className="font-medium">{job.failed.length === 1 ? 'One page could not be read:' : `${job.failed.length} pages could not be read:`}</p>
      <ul className="mt-1 list-disc pl-4">
        {job.failed.map((f) => <li key={f.index} className="break-words">{job.steps[f.index] ? stepText(job.steps[f.index]!) : 'a page'}: {f.error}</li>)}
      </ul>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => void recordEngine.start('update')}>Try again</button>
        <button type="button" className={button} disabled={busy} onClick={() => void recordEngine.discard()}>Dismiss</button>
      </div>
    </div>
  )
}

function CourseDetail({ c, busy, withAttendance }: { c: RecordCourse; busy: boolean; withAttendance: boolean }) {
  const rows = components(c.sheet?.sheet)
  const sum = c.sheet?.sheet.summary
  return (
    <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-700">
      {rows.length > 0 ? (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Mark sheet of {c.code ?? c.name}</caption>
          <thead><tr className="text-gray-500"><th className="py-0.5 pr-2 font-medium">Category</th><th className="py-0.5 pr-2 font-medium">Item</th><th className="py-0.5 pr-2 font-medium">Weight</th><th className="py-0.5 font-medium">Value</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-gray-100 align-top ${r.total ? 'font-medium text-gray-900' : ''}`}>
                <td className="break-words py-0.5 pr-2">{r.category}</td>
                <td className="break-words py-0.5 pr-2">{r.item}</td>
                <td className="py-0.5 pr-2">{r.weight || '-'}</td>
                <td className="py-0.5">{r.value || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p>{c.sheet ? 'FAP lists no components for this course.' : c.ref ? 'The mark sheet is not read yet.' : 'No mark sheet on FAP for this course.'}</p>}
      {sum && (
        <p className="mt-1.5 flex flex-wrap gap-x-3">
          <span><b className="font-medium text-gray-900">Average:</b> {sum.average === null ? '-' : gradeText(sum.average)}</span>
          <span><b className="font-medium text-gray-900">Status:</b> {sheetStatusText(sum.status) ?? '-'}</span>
          {sum.bonus ? <span><b className="font-medium text-gray-900">Bonus:</b> {sum.bonus}</span> : null}
          {sum.latePenaltyPercent ? <span><b className="font-medium text-gray-900">Late penalty:</b> {sum.latePenaltyPercent}%</span> : null}
        </p>
      )}
      {c.sheet && <p className="mt-1 text-gray-500">Mark sheet read {ago(c.sheet.fetchedAt)}.</p>}
      {c.ref && c.termId && (
        <button type="button" className={`${button} mt-1.5`} disabled={busy} onClick={() => void recordEngine.start('course', { termId: c.termId!, courseId: c.ref!.id, label: c.code ?? c.name, attendance: withAttendance })}>Read this course again</button>
      )}
    </div>
  )
}

export function RecordCourseCard({ c, open, toggle, busy, extra, withAttendance = false }: { c: RecordCourse; open: boolean; toggle: () => void; busy: boolean; extra?: ReactNode; withAttendance?: boolean }) {
  const g = gradeText(c.grade)
  return (
    <li className="mx-3 my-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2" data-record-course={c.key}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug">{c.code ? `${c.code} · ${c.name}` : c.name}<Tag tint={statusTint(c.status)}>{c.status}</Tag></p>
        <button type="button" aria-expanded={open} aria-label={`Details for ${c.code ?? c.name}`} className="shrink-0 rounded px-1.5 text-xs text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={toggle}>{open ? 'Hide' : 'Details'}</button>
      </div>
      <p className="mt-0.5 flex flex-wrap gap-x-3 break-words text-xs leading-relaxed text-gray-600">
        {c.credits !== null && <span><b className="font-medium text-gray-900">Credits:</b> {c.credits}</span>}
        <span><b className="font-medium text-gray-900">Grade:</b> {g ?? '-'}</span>
        {extra}
      </p>
      {open && <CourseDetail c={c} busy={busy} withAttendance={withAttendance} />}
    </li>
  )
}

function TermSection({ t, gpa, scale, busy, open, setOpen, extra, withAttendance }: {
  t: RecordTermView; gpa: { gpa: number | null; credits: number } | undefined; scale: string; busy: boolean
  open: string | null; setOpen: (k: string | null) => void; extra?: (c: RecordCourse) => ReactNode; withAttendance: boolean
}) {
  return (
    <section aria-label={t.name} className="pt-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3">
        <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
        <p className="min-w-0 flex-1 text-xs text-gray-600">
          {gpa && gpa.gpa !== null ? `GPA ${formatGpa(gpa.gpa)}${scale === '4' ? ' (4-point)' : ''} over ${gpa.credits} credits` : 'No GPA for this term'}
          {t.id && t.readAt === null ? ' · courses not read yet' : ''}
        </p>
        {t.id && <button type="button" className={button} disabled={busy} aria-label={`Read ${t.name} again`} onClick={() => void recordEngine.start('term', { termId: t.id!, name: t.name })}>Read again</button>}
      </div>
      <ul aria-label={`Courses of ${t.name}`} className="m-0 list-none p-0">
        {t.courses.map((c) => <RecordCourseCard key={c.key} c={c} busy={busy} open={open === c.key} toggle={() => setOpen(open === c.key ? null : c.key)} extra={extra?.(c)} withAttendance={withAttendance} />)}
      </ul>
      {t.courses.length === 0 && <p className="px-3 py-1 text-xs text-gray-600">Not read yet.</p>}
    </section>
  )
}

export function RecordView() {
  const { store, job, loaded } = useRecord()
  const settings = useGradeSettings()
  const scale = useGpaScale() ?? '10'
  const [open, setOpen] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const foot = useRef<HTMLDivElement>(null)
  // An interrupted job (reload, closed tab) continues when the view opens; a cancelled one waits for Resume.
  useEffect(() => { void recordEngine.resume({ auto: true }) }, [])
  // Alt+R (panel-ux R7.1).
  useEffect(() => registerRefresh('grades/record', () => void recordEngine.start('update')), [])

  const running = jobRunning(job)
  const busy = running
  const terms = store ? recordTerms(store) : []
  const rules = useAttendanceRules(store)
  // The same absence percentage as the Attendance view, with the syllabus requirement when known (R16.6).
  const chip = (c: RecordCourse) => {
    const a = c.ref ? store?.attendance?.[c.ref.id] : undefined
    const info = a ? absenceInfo(a.sheet.counts, c.code ? rules[c.code] ?? null : null) : null
    return info ? <AbsenceChip info={info} /> : null
  }
  const g = store?.transcript && settings ? computeGpaOn(scale, { rows: store.transcript.rows, nonGpa: settings.nonGpa }) : null
  const byName = new Map(g?.semesters.map((s) => [s.name.replace(/\s+/g, '').toLowerCase(), s]) ?? [])
  const unfinished = job && job.next < job.steps.length

  return (
    <div className="pb-3">
      <div className="flex flex-wrap items-center gap-2 px-3 pb-1 pt-2.5">
        <p className="min-w-0 flex-1 text-xs text-gray-600">{store?.lastSync ? `Record updated ${ago(store.lastSync)}` : 'Record not read yet'}</p>
        <button type="button" className={button} disabled={busy} onClick={() => void recordEngine.start('update')}>Update record</button>
        <button type="button" className={button} disabled={busy} onClick={() => void recordEngine.start('all')}>Read everything again</button>
      </div>
      {job && (running || unfinished) && <Progress job={job} running={running} />}
      {job && !running && <Failed job={job} busy={busy} />}
      {loaded && !store && !job && (
        <Empty title="No record read yet">
          <p className="text-xs text-gray-600">FAP-AIO reads your transcript, then each term's courses and mark sheets, one page at a time. A first read takes several minutes; later updates read only what changed.</p>
          <button type="button" className={primary} onClick={() => void recordEngine.start('update')}>Read my record</button>
        </Empty>
      )}
      {store && !store.transcript && !running && <div className="px-3"><Message tone="info">The transcript is not read yet. Update the record to list your courses.</Message></div>}
      {terms.map((t) => (
        <TermSection key={t.id ?? t.name} t={t} gpa={byName.get(t.name.replace(/\s+/g, '').toLowerCase())} scale={scale} busy={busy} open={open} setOpen={setOpen} extra={chip} withAttendance={!!t.id && !!store?.attendanceTerms?.includes(t.id)} />
      ))}
      {store?.transcript && settings && (
        <div ref={foot} className="px-3 pt-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => {
              setPrintError(null)
              void call({ type: 'print.open', components: true, attendance: Object.keys(store.attendance ?? {}).length > 0 }).then((r) => { if (!r.ok) setPrintError('The print window could not be opened. Reload the page and try again.') })
            }}>Print or save as PDF</button>
            <button type="button" className={button} onClick={() => downloadText(foot.current ?? document.body, recordFileName('csv'), recordCsv(buildRecordExport(store, settings.nonGpa)), 'text/csv;charset=utf-8')}>Export CSV</button>
            <button type="button" className={button} onClick={() => downloadText(foot.current ?? document.body, recordFileName('json'), recordJson(buildRecordExport(store, settings.nonGpa)), 'application/json')}>Export JSON</button>
          </div>
          {printError && <div className="pt-2"><Message tone="error">{printError}</Message></div>}
        </div>
      )}
    </div>
  )
}
