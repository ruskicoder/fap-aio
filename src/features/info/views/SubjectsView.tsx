// Info, Subjects (info R2.1 to R2.6; panel-ux R10.7): search by code or name across the FLM rubric and the
// curriculum (virtualized), and a subject detail from the full syllabus with FLM and FAP links, curriculum
// term and transcript status, the learning path and data-quality flags explained.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { dataClient } from '../../../content/data-client'
import { peek, read } from '../../../content/fap/registry'
import { errorText } from '../../../content/panel/errors'
import { VirtualList } from '../../../content/panel/VirtualList'
import { Message, button } from '../../scheduler/views/common'
import type { SearchHit, SubjectEntry } from '../../../shared/data/types'
import { FLAG_TEXT } from '../../grades/inline/GradeInline'
import { flmLink } from '../../grades/courses'
import { GRADES_TRANSCRIPT } from '../../grades/sources'
import type { Transcript } from '../../grades/types'
import { INFO_CURRICULUM } from '../sources'
import { ancestors, dependents, mergeHits, studyStatus, type StudyStatus, type SubjectHit } from '../subjects'
import type { CurriculumRow } from '../types'

const STATUS_TEXT: Record<StudyStatus, string> = { passed: 'Passed', 'in-progress': 'In progress', 'not-started': 'Not started', 'not-passed': 'Not passed' }
const input = 'h-control w-full rounded border border-gray-300 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
const link = 'font-medium text-orange-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
// Two lines of name and one of detail; names are never cut (core R8.6). Lists only virtualize past 100 rows.
const ROW = 64

function useCurriculum(): { rows: CurriculumRow[]; error: string | null } {
  const [rows, setRows] = useState<CurriculumRow[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void read<CurriculumRow[]>(INFO_CURRICULUM, {}, { priority: 'user' })
      .then((r) => { if (r.ok) setRows(r.value); else setError(errorText(r.error)) })
      .catch((e: unknown) => setError(String(e)))
  }, [])
  return { rows, error }
}

/** FLM prerequisite codes from the compact rubric, with the curriculum column added. */
function prereqLookup(curriculum: CurriculumRow[]) {
  return async (codes: string[]): Promise<Record<string, string[]>> => {
    const r = await dataClient().rules(codes)
    return Object.fromEntries(codes.map((c) => {
      const flm = r.ok ? r.value.subjects[c]?.prerequisites ?? [] : []
      const cur = curriculum.find((x) => x.code.toUpperCase() === c.toUpperCase())?.prerequisites ?? []
      return [c, [...new Set([...flm, ...cur])]]
    }))
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-1 text-sm text-gray-800">{children}</div>
    </section>
  )
}

function CodeList({ codes, open }: { codes: string[]; open: (c: string) => void }) {
  if (!codes.length) return <span className="text-gray-500">None</span>
  return <span className="flex flex-wrap gap-1.5">{codes.map((c) => <button key={c} type="button" className={`${link} text-xs`} onClick={() => open(c)}>{c}</button>)}</span>
}

function Detail({ code, curriculum, back, open }: { code: string; curriculum: CurriculumRow[]; back: () => void; open: (c: string) => void }) {
  const [e, setE] = useState<SubjectEntry | null | undefined>(undefined)
  const [status, setStatus] = useState<StudyStatus | null>(null)
  const [path, setPath] = useState<{ up: string[][]; down: string[] } | null>(null)
  const row = curriculum.find((r) => r.code.toUpperCase() === code.toUpperCase()) ?? null
  useEffect(() => {
    let live = true
    setE(undefined)
    void dataClient().subject(code).then((r) => { if (live) setE(r.ok ? r.value : null) })
    void peek<Transcript>(GRADES_TRANSCRIPT).then((t) => { if (live) setStatus(t ? studyStatus(code, t.value.rows) : null) })
    const lookup = prereqLookup(curriculum)
    void (async () => {
      const up = await ancestors(code, lookup)
      const all = await lookup(curriculum.map((r) => r.code))
      if (live) setPath({ up, down: dependents(code, all) })
    })()
    return () => { live = false }
  }, [code, curriculum])

  const f = e?.full
  const r = e?.rules
  return (
    <div className="px-3 pb-3 pt-2">
      <button type="button" className={`${button} mb-2`} onClick={back}>Back to the list</button>
      {e === undefined && <p className="text-sm text-gray-600">Reading the syllabus</p>}
      {e === null && <Message tone="error">No FLM syllabus found for {code}.</Message>}
      {e && (
        <>
          <h2 className="break-words text-base font-semibold text-gray-900">{e.code} · {f?.name.en ?? r?.name ?? code}</h2>
          {f?.name.vi && <p className="break-words text-sm text-gray-700">{f.name.vi}</p>}
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-600">
            <span><b className="font-medium text-gray-900">Credits:</b> {f?.credits ?? r?.credits ?? '-'}</span>
            <span><b className="font-medium text-gray-900">Pass mark:</b> {f?.minAvgMarkToPass ?? r?.minAvgMarkToPass ?? 5}</span>
            <span><b className="font-medium text-gray-900">Attendance:</b> at least {f?.attendance.minPercent ?? r?.attendance.minPercent ?? 80}%</span>
            {row && <span><b className="font-medium text-gray-900">Curriculum term:</b> {row.term ?? '-'}</span>}
            {status && <span><b className="font-medium text-gray-900">You:</b> {STATUS_TEXT[status]}</span>}
            {e.approvedDate && <span><b className="font-medium text-gray-900">Approved:</b> {e.approvedDate}</span>}
          </p>
          <p className="mt-1 flex flex-wrap gap-3 text-xs">
            {e.syllabusId !== null && <a className={link} href={flmLink(e.syllabusId)} target="_blank" rel="noopener noreferrer">Open on FLM</a>}
            {row?.detailUrl && <a className={link} href={row.detailUrl} target="_blank" rel="noopener noreferrer">Open on FAP</a>}
          </p>
          {(f?.coursera.required || r?.coursera.required || f?.coursera.bonus || r?.coursera.bonus) && (
            <Message tone="info">{(f?.coursera.required || r?.coursera.required) ? 'Coursera courses are required and must be finished before the final exam.' : ''} {(f?.coursera.bonus || r?.coursera.bonus) ? 'Finishing the MOOCs on time gives a bonus of 1.' : ''}</Message>
          )}
          <Section title="Assessments">
            <ul className="text-xs">
              {(f?.assessments ?? r?.assessments ?? []).filter((a) => a.parentIndex === null).map((a) => (
                <li key={a.index} className="flex gap-2 border-b border-gray-100 py-0.5"><span className="min-w-0 flex-1 break-words">{a.category}{a.parts > 1 ? ` (${a.parts} parts)` : ''}</span><span>{Math.round(a.weight * 1000) / 10}%</span><span className="w-24 text-right text-gray-600">{a.completion ? `${a.completion.inclusive ? 'at least' : 'above'} ${a.completion.value}` : '-'}</span></li>
              ))}
            </ul>
          </Section>
          <Section title="Learning path">
            {!path ? <span className="text-gray-500">Working it out</span> : (
              <div className="flex flex-col gap-1 text-xs">
                <span><b className="font-medium text-gray-900">Needs first:</b> <CodeList codes={path.up[0] ?? []} open={open} /></span>
                {path.up.slice(1).map((lvl, i) => <span key={i} className="pl-3"><b className="font-medium text-gray-700">Before that:</b> <CodeList codes={lvl} open={open} /></span>)}
                <span><b className="font-medium text-gray-900">Opens:</b> <CodeList codes={path.down} open={open} /></span>
              </div>
            )}
          </Section>
          {f?.timeAllocation && <Section title="Time"><p className="text-xs">{String(f.timeAllocation)}</p></Section>}
          {Array.isArray(f?.clos) && (f!.clos as { id: string; details: string }[]).length > 0 && (
            <Section title="Learning outcomes"><ul className="list-disc pl-4 text-xs">{(f!.clos as { id: string; details: string }[]).map((c) => <li key={c.id} className="break-words"><b className="font-medium">{c.id}</b> {c.details}</li>)}</ul></Section>
          )}
          {Array.isArray(f?.materials) && (f!.materials as { description: string; author?: string; isMain?: boolean }[]).length > 0 && (
            <Section title="Materials"><ul className="list-disc pl-4 text-xs">{(f!.materials as { description: string; author?: string; isMain?: boolean }[]).map((m, i) => <li key={i} className="break-words">{m.description}{m.author ? `, ${m.author}` : ''}{m.isMain ? ' (main)' : ''}</li>)}</ul></Section>
          )}
          {(f?.flags ?? r?.flags ?? []).filter((x) => FLAG_TEXT[x]).length > 0 && (
            <Section title="Data notes"><ul className="list-disc pl-4 text-xs text-amber-900">{(f?.flags ?? r?.flags ?? []).filter((x) => FLAG_TEXT[x]).map((x) => <li key={x}>{FLAG_TEXT[x]}</li>)}</ul></Section>
          )}
        </>
      )}
    </div>
  )
}

export function SubjectsView() {
  const { rows: curriculum, error } = useCurriculum()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      if (!q.trim()) { setHits([]); return }
      void dataClient().search(q.trim(), 50).then((r) => { if (live) setHits(r.ok ? r.value : []) })
    }, 150)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  const list: SubjectHit[] = useMemo(() => mergeHits(q, hits, curriculum), [q, hits, curriculum])
  if (open) return <Detail code={open} curriculum={curriculum} back={() => setOpen(null)} open={setOpen} />
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-2.5">
        <input type="search" aria-label="Search subjects by code or name" placeholder="Search by code or name" className={input} value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="mt-1 text-[11px] text-gray-500">{q.trim() ? `${list.length} subjects` : `Your curriculum, ${curriculum.length} subjects. Search to find any FLM subject.`}</p>
      </div>
      {error && <div className="px-3"><Message tone="error">{error}</Message></div>}
      <VirtualList items={list} rowHeight={ROW} height={420} label="Subjects" itemKey={(h) => h.code}
        render={(h) => (
          <button type="button" onClick={() => setOpen(h.code)} className="flex h-full w-full flex-col justify-center border-b border-gray-100 px-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
            <span className="break-words text-[13px] font-medium leading-snug text-gray-900">{h.code} · {h.name}</span>
            <span className="text-[11px] text-gray-500">{h.inCurriculum ? `Curriculum term ${h.term ?? '-'}` : h.nameVi ?? 'FLM subject'}</span>
          </button>
        )} />
    </div>
  )
}
