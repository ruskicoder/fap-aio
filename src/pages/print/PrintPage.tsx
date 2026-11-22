// Printable academic grade list (grades R15.1 to R15.4, R13.6; GRD-7.3): the stored record laid out as an A4
// document. The page reads the stored record through the storage catalog (extension pages may) and sends no message. Its
// controls are hidden in print; Chrome's print dialog saves the page as PDF.
import { useEffect, useState } from 'react'
import { read } from '../../shared/storage/catalog'
import { getSetting } from '../../shared/settings'
import { DEFAULT_NON_GPA } from '../../features/grades/engine/gpa'
import { SCALE_LABELS, type GpaScale } from '../../features/grades/engine/scale'
import { readGpaScale } from '../../features/grades/scale-setting'
import { NOT_OFFICIAL, gpaText, gradeList, onScale, type GradeList, type Gpas } from '../../features/grades/record-export'
import type { RecordStore } from '../../features/grades/record'

const dateText = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

function GpaLine({ label, g, scale }: { label: string; g: Gpas; scale: GpaScale }) {
  const v = gpaText(onScale(g, scale))
  return <span>{label}: <b>{v ?? '-'}</b>{v ? ` (${g.credits} credits)` : ''}</span>
}

export function GradeListDoc({ list, scale, components, attendance = false, now }: { list: GradeList; scale: GpaScale; components: boolean; attendance?: boolean; now: Date }) {
  return (
    <main className="sheet" aria-label="Academic grade list">
      <header className="mb-4">
        <h1 className="m-0 text-xl font-semibold">Academic grade list</h1>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 text-[13px]">
          <dt className="text-stone-600">Student</dt><dd className="m-0">{list.student?.name ?? 'Not read from FAP'}</dd>
          <dt className="text-stone-600">Roll number</dt><dd className="m-0">{list.student?.roll ?? 'Not read from FAP'}</dd>
          <dt className="text-stone-600">Curriculum</dt><dd className="m-0">{list.curriculum ?? 'Not read from FAP'}</dd>
          <dt className="text-stone-600">GPA scale</dt><dd className="m-0">{SCALE_LABELS[scale]}</dd>
          <dt className="text-stone-600">Generated</dt><dd className="m-0">{dateText(now)}</dd>
        </dl>
        <p className="mt-2 rounded border border-stone-300 px-2 py-1 text-[12px] text-stone-700">{NOT_OFFICIAL}.</p>
      </header>
      {list.terms.map((t) => (
        <section key={t.name} className="term mb-4" aria-label={t.name}>
          <h2 className="mb-1 mt-0 text-[15px] font-semibold">{t.name}</h2>
          <table>
            <thead>
              <tr><th>Code</th><th>Subject</th><th className="num">Credits</th><th className="num">Grade</th><th>Letter</th><th>Status</th></tr>
            </thead>
            <tbody>
              {t.courses.flatMap((c, i) => [
                <tr key={`c${i}`} className="course">
                  <td className="whitespace-nowrap">{c.code ?? '-'}</td>
                  <td>{c.name}{c.counted ? '' : <span className="text-stone-500"> (not in GPA)</span>}</td>
                  <td className="num">{c.credits ?? '-'}</td>
                  <td className="num">{c.grade === null ? '-' : c.grade.toFixed(1)}</td>
                  <td>{c.letter ?? '-'}</td>
                  <td>{c.status}</td>
                </tr>,
                ...(components ? c.components.map((x, j) => (
                  <tr key={`c${i}x${j}`} className="component">
                    <td />
                    <td>{x.category}{x.total ? ' total' : `: ${x.item}`}</td>
                    <td className="num">{x.weight || '-'}</td>
                    <td className="num">{x.value || '-'}</td>
                    <td colSpan={2} />
                  </tr>
                )) : []),
              ])}
            </tbody>
          </table>
          <p className="mt-1 flex flex-wrap gap-x-6 text-[12px]">
            <GpaLine label="Term GPA" g={t.gpa} scale={scale} />
            <GpaLine label="Cumulative GPA" g={t.cumulative} scale={scale} />
          </p>
        </section>
      ))}
      {attendance && <AttendanceSection list={list} />}
      <footer className="mt-4 border-t border-stone-300 pt-2 text-[12px]">
        <p className="m-0"><GpaLine label="Cumulative GPA" g={list.cumulative} scale={scale} /></p>
        <p className="m-0 text-stone-600">GPA counts passed courses with a grade and more than 0 credits, except subject codes starting with {list.nonGpa.join(', ') || 'nothing'}.{scale === '4' ? ' On the 4-point scale each grade becomes a letter first: A 8.5 to 10 is 4, B 7.0 to 8.4 is 3, C 5.5 to 6.9 is 2, D 4.0 to 5.4 is 1, F below 4.0 is 0.' : ''}</p>
        <p className="m-0 text-stone-600">Letters: A 8.5 to 10, B 7.0 to 8.4, C 5.5 to 6.9, D 4.0 to 5.4, F below 4.0.</p>
      </footer>
    </main>
  )
}

/** The optional attendance section (grades R16.7): per term, the courses whose attendance was read. */
function AttendanceSection({ list }: { list: GradeList }) {
  const terms = list.terms.map((t) => ({ name: t.name, courses: t.courses.filter((c) => c.attendance) })).filter((t) => t.courses.length > 0)
  return (
    <section className="term mb-4" aria-label="Attendance">
      <h2 className="mb-1 mt-0 text-[15px] font-semibold">Attendance</h2>
      {terms.length === 0 && <p className="m-0 text-[12px] text-stone-600">No attendance read yet. Update the record in FAP-AIO to read it.</p>}
      {terms.length > 0 && (
        <table>
          <thead><tr><th>Term</th><th>Code</th><th>Subject</th><th className="num">Attended</th><th className="num">Absent</th><th className="num">Not yet</th><th className="num">Exempt</th><th className="num">Absent %</th></tr></thead>
          <tbody>
            {terms.flatMap((t) => t.courses.map((c, i) => (
              <tr key={`${t.name}${i}`} className="course">
                <td className="whitespace-nowrap">{i === 0 ? t.name : ''}</td>
                <td className="whitespace-nowrap">{c.code ?? '-'}</td>
                <td>{c.name}</td>
                <td className="num">{c.attendance!.attended}</td>
                <td className="num">{c.attendance!.absent}</td>
                <td className="num">{c.attendance!.notYet}</td>
                <td className="num">{c.attendance!.exempt}</td>
                <td className="num">{c.absentPercent === null ? '-' : `${Math.round(c.absentPercent * 10) / 10}%`}</td>
              </tr>
            )))}
          </tbody>
        </table>
      )}
      <p className="mt-1 text-[12px] text-stone-600">A course is failed above 20% absence (80% attendance), or the limit its syllabus states.</p>
    </section>
  )
}

export function PrintPage(props: { components: boolean; attendance: boolean; now?: Date }) {
  const [store, setStore] = useState<RecordStore | null | undefined>(undefined)
  const [nonGpa, setNonGpa] = useState<string[]>([...DEFAULT_NON_GPA])
  const [scale, setScale] = useState<GpaScale>('10')
  const [withComponents, setWithComponents] = useState(props.components)
  const [withAttendance, setWithAttendance] = useState(props.attendance)
  useEffect(() => {
    void Promise.all([read('grades.record'), getSetting<unknown>('grades.nonGpa', DEFAULT_NON_GPA), readGpaScale()]).then(([s, n, sc]) => {
      setStore(s)
      if (Array.isArray(n)) setNonGpa(n as string[])
      setScale(sc)
    })
  }, [])
  useEffect(() => { document.title = 'Academic grade list - FAP-AIO' }, [])
  const list = store ? gradeList(store, nonGpa) : null
  return (
    <>
      <div className="no-print mx-auto flex max-w-[210mm] flex-wrap items-center gap-x-4 gap-y-2 px-1 py-3 text-[13px] print:hidden" role="toolbar" aria-label="Print options">
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4 accent-orange-600" checked={withComponents} onChange={(e) => setWithComponents(e.target.checked)} />Include components</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4 accent-orange-600" checked={withAttendance} onChange={(e) => setWithAttendance(e.target.checked)} />Include attendance</label>
        <label className="inline-flex items-center gap-1.5">GPA scale
          <select className="h-8 rounded border border-stone-300 bg-white px-2" value={scale} onChange={(e) => setScale(e.target.value === '4' ? '4' : '10')}>
            <option value="10">{SCALE_LABELS['10']}</option>
            <option value="4">{SCALE_LABELS['4']}</option>
          </select>
        </label>
        <button type="button" className="ml-auto inline-flex h-8 items-center rounded bg-orange-600 px-3 font-medium text-white hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1" disabled={!list || list.terms.length === 0} onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      {store === null && (
        <main className="sheet"><p>No record read yet. On a FAP page, open FAP-AIO, Grades, Record, and read your record first.</p></main>
      )}
      {list && list.terms.length === 0 && <main className="sheet"><p>The record has no courses yet. Update the record in FAP-AIO first.</p></main>}
      {list && list.terms.length > 0 && <GradeListDoc list={list} scale={scale} components={withComponents} attendance={withAttendance} now={props.now ?? new Date()} />}
    </>
  )
}
