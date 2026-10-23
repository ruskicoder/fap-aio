// Schedule, Export (core R9.1, R9.2, R9.6): range and filter choice, export reminders, and the
// download through a blob link inside the shadow root.
import { useRef, useState } from 'react'
import { useStore } from '../../../content/panel/use-store'
import { todayVn } from '../../../shared/dates'
import { download as defaultDownload, examsForExport, examsIcs, filterSessions, sessionsIcs, type SessionFilter } from '../ics'
import { RANGES, inRange, type Range } from './WeekView'
import { Message, button, select } from './common'

const FILTERS: [SessionFilter, string][] = [['all', 'All classes'], ['offline', 'Offline only'], ['online', 'Online only']]
const OFFSETS = [5, 10, 15, 30, 60]

export function ExportView({ now = () => Date.now(), download = defaultDownload }: { now?: () => number; download?: typeof defaultDownload }) {
  const timetable = useStore('timetable')
  const exams = useStore('exams')
  const [range, setRange] = useState<Range>('all')
  const [filter, setFilter] = useState<SessionFilter>('all')
  const [remind, setRemind] = useState(false)
  const [offset, setOffset] = useState(15)
  const [msg, setMsg] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const today = todayVn(now())

  const classes = filterSessions((timetable.data?.sessions ?? []).filter((s) => inRange(s.date, range, today)), filter)
  const upcoming = examsForExport(exams.data?.exams ?? [], today)
  const reminders = remind ? { classOffsetMin: offset } : null

  const exportClasses = async () => {
    download(box.current!, `fap-classes-${today}.ics`, await sessionsIcs(classes, { reminders, now: now() }))
    setMsg(`Exported ${classes.length} ${classes.length === 1 ? 'class' : 'classes'}. Import the file into your calendar app.`)
  }
  const exportExams = async () => {
    download(box.current!, `fap-exams-${today}.ics`, await examsIcs(upcoming, { reminders, now: now() }))
    setMsg(`Exported ${upcoming.length} ${upcoming.length === 1 ? 'exam' : 'exams'}. Import the file into your calendar app.`)
  }

  return (
    <div ref={box} className="flex flex-col gap-4 p-3 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Classes</legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1">Range
            <select className={select} value={range} onChange={(e) => setRange(e.target.value as Range)}>
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">Show
            <select className={select} value={filter} onChange={(e) => setFilter(e.target.value as SessionFilter)}>
              {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className={`${button} self-start`} disabled={!classes.length} onClick={() => void exportClasses()}>
          Export {classes.length} {classes.length === 1 ? 'class' : 'classes'}
        </button>
        {!timetable.loading && !timetable.data?.sessions.length && <p className="text-xs text-gray-600">Sync your classes in Week first.</p>}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Exams</legend>
        <p className="text-xs text-gray-600">Upcoming exams with an assigned room.</p>
        <button type="button" className={`${button} self-start`} disabled={!upcoming.length} onClick={() => void exportExams()}>
          Export {upcoming.length} {upcoming.length === 1 ? 'exam' : 'exams'}
        </button>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Reminders in the file</legend>
        <label className="flex min-h-6 items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          Add calendar alarms
        </label>
        {remind && (
          <label className="flex items-center gap-1">Classes
            <select className={select} value={offset} onChange={(e) => setOffset(+e.target.value)}>
              {OFFSETS.map((m) => <option key={m} value={m}>{m} minutes before</option>)}
            </select>
            <span className="text-xs text-gray-600">Exams: 1 day and 1 hour before</span>
          </label>
        )}
      </fieldset>
      {msg && <Message tone="info">{msg}</Message>}
    </div>
  )
}
