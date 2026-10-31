// Schedule, Export (core R9.1 to R9.10): layout A of ui/schedule-audit.md round S1. One scrolling
// form with groups 1 to 8, "Remember my choices" and the Download button pinned at the bottom.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../../../content/panel/use-store'
import { Icon } from '../../../content/panel/icons'
import { read, remove, write } from '../../../shared/storage/catalog'
import { todayVn } from '../../../shared/dates'
import { buildIcs, classEvent, download as defaultDownload, examEvent, type IcsEvent } from '../ics'
import {
  DEFAULT_PREFS, DETAILS, EXAM_TYPES, longDate, parsePrefs, rangeBounds, selectForExport, subjectNames, subjectsInRange, termName,
  type ExportPrefs, type ExportRange,
} from '../export-prefs'
import { Message, dayLabel, select } from './common'

const CLASS_OFFSETS = [5, 10, 15, 30, 60]
const EXAM_FIRST: [number, string][] = [[10080, '1 week'], [4320, '3 days'], [2880, '2 days'], [1440, '1 day'], [720, '12 hours']]
const EXAM_SECOND: [number, string][] = [[180, '3 hours'], [120, '2 hours'], [60, '1 hour'], [30, '30 min'], [15, '15 min']]
const MODES: [ExportPrefs['classMode'], string][] = [['all', 'All'], ['offline', 'Offline only'], ['online', 'Online only']]

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
    >{children}</button>
  )
}

function Group({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-b border-gray-200 px-3 py-2.5">
      <legend className="float-left mb-1.5 flex w-full items-center gap-1.5 text-sm font-medium">
        <span aria-hidden="true" className="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600">{n}</span>{title}
      </legend>
      {children}
    </fieldset>
  )
}

const Radio = ({ name, on, onChange, children }: { name: string; on: boolean; onChange: () => void; children: ReactNode }) => (
  <label className="flex min-h-6 items-center gap-1.5 text-xs"><input type="radio" name={name} className="h-4 w-4" checked={on} onChange={onChange} />{children}</label>
)
const Check = ({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) => (
  <label className="flex min-h-6 flex-wrap items-center gap-1.5 text-xs"><input type="checkbox" className="h-4 w-4" checked={on} onChange={(e) => onChange(e.target.checked)} />{children}</label>
)
const small = `${select} h-7 text-xs`

function Preview({ ev }: { ev: IcsEvent }) {
  return (
    <div className="border-l-[3px] border-orange-500 bg-gray-50 px-2 py-1.5 text-xs leading-relaxed">
      <p className="font-medium">{ev.summary}</p>
      <p>{dayLabel(ev.date)}, {ev.start}–{ev.end}{ev.location ? ` · ${ev.location}` : ''}</p>
      {ev.description && <p className="text-gray-600">{ev.description.split('\n').join(' · ')}</p>}
    </div>
  )
}

export function ExportView({ now = () => Date.now(), download = defaultDownload }: { now?: () => number; download?: typeof defaultDownload }) {
  const timetable = useStore('timetable')
  const examStore = useStore('exams')
  const [p, setP] = useState<ExportPrefs>(DEFAULT_PREFS)
  const [msg, setMsg] = useState<string | null>(null)
  const loaded = useRef(false)
  const box = useRef<HTMLDivElement>(null)
  const today = todayVn(now())

  // Restore remembered options once (R9.10).
  useEffect(() => {
    void read('export.prefs').then((d) => { if (d) setP(parsePrefs(d)); loaded.current = true })
  }, [])
  useEffect(() => {
    if (loaded.current && p.remember) void write('export.prefs', p)
  }, [p])
  const set = (patch: Partial<ExportPrefs>) => { setP((o) => ({ ...o, ...patch })); setMsg(null) }
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const remember = (on: boolean) => {
    set({ remember: on })
    if (!on) void remove('export.prefs')
  }

  const sessions = timetable.data?.sessions ?? []
  const exams = examStore.data?.exams ?? []
  const names = useMemo(() => subjectNames(exams), [exams])
  const subjects = subjectsInRange(sessions, p, today)
  const sel = selectForExport(sessions, exams, p, today)
  const classEvents = sel.classes.map((s) => classEvent(s, p, names))
  const examEvents = sel.exams.map((e) => examEvent(e, p, names))
  const total = classEvents.length + examEvents.length
  const files = p.split ? [classEvents.length, examEvents.length].filter(Boolean).length : total ? 1 : 0
  const [from, to] = rangeBounds(p, today)
  const sample = sessions[0] ?? null
  const ranges: [ExportRange, string][] = [['week', 'This week'], ['next2', 'Next 2 weeks'], ['month', 'This month'], ['term', termName(today)], ['custom', 'Custom']]
  const titleSample = (f: ExportPrefs['title']) => (sample ? classEvent(sample, { ...p, title: f }, names).summary : { 'code-group': 'CODE (group)', 'code-name': 'CODE · name', 'name-code': 'name (CODE)' }[f])

  const run = async () => {
    const at = now()
    const out: [string, IcsEvent[]][] = p.split || !classEvents.length || !examEvents.length
      ? [[`fap-classes-${today}.ics`, classEvents], [`fap-exams-${today}.ics`, examEvents]]
      : [[`fap-schedule-${today}.ics`, [...classEvents, ...examEvents]]]
    const written = out.filter(([, evs]) => evs.length)
    for (const [name, evs] of written) download(box.current!, name, await buildIcs(evs, at))
    setMsg(`Downloaded ${written.map(([n]) => n).join(' and ')} with ${plural(total, 'event')}. Import ${written.length > 1 ? 'them' : 'it'} into your calendar app.`)
  }

  return (
    <div ref={box} className="flex min-h-full flex-col text-sm">
      <Group n={1} title="What to export">
        <div className="flex flex-wrap gap-1.5">
          <Chip on={p.classes} onClick={() => set({ classes: !p.classes })}>Classes</Chip>
          <Chip on={p.exams} onClick={() => set({ exams: !p.exams })}>Exams</Chip>
        </div>
        <div className="flex flex-wrap gap-3">
          <Radio name="split" on={!p.split} onChange={() => set({ split: false })}>One file</Radio>
          <Radio name="split" on={p.split} onChange={() => set({ split: true })}>One file each</Radio>
        </div>
      </Group>

      <Group n={2} title="Date range">
        <div className="flex flex-wrap gap-1.5">
          {ranges.map(([v, l]) => <Chip key={v} on={p.range === v} onClick={() => set(v === 'custom' && !p.from ? { range: v, from: from, to: to } : { range: v })}>{l}</Chip>)}
        </div>
        {p.range === 'custom' ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <label className="flex items-center gap-1">From <input type="date" aria-label="From" className={small} value={p.from ?? ''} onChange={(e) => set({ from: e.target.value || null })} /></label>
            <label className="flex items-center gap-1">to <input type="date" aria-label="To" className={small} value={p.to ?? ''} onChange={(e) => set({ to: e.target.value || null })} /></label>
          </div>
        ) : <p className="text-xs text-gray-600">{longDate(from)} to {longDate(to)}</p>}
      </Group>

      <Group n={3} title="Classes">
        <div className="flex flex-wrap gap-1.5">
          {MODES.map(([v, l]) => <Chip key={v} on={p.classMode === v} onClick={() => set({ classMode: v })}>{l}</Chip>)}
        </div>
        <p className="text-xs">Subjects:</p>
        {subjects.length ? (
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((c) => <Chip key={c} on={!p.excludedSubjects.includes(c)} onClick={() => set({ excludedSubjects: toggle(p.excludedSubjects, c) })}>{c}</Chip>)}
          </div>
        ) : <p className="text-xs text-gray-600">{sessions.length ? 'No classes in this range.' : 'Sync your classes in the Classes tab first.'}</p>}
      </Group>

      <Group n={4} title="Exams">
        <div className="flex flex-wrap gap-1.5">
          {EXAM_TYPES.map(([v, l]) => <Chip key={v} on={p.examTypes.includes(v)} onClick={() => set({ examTypes: toggle(p.examTypes, v) })}>{l}</Chip>)}
        </div>
        <Check on={p.examNoRoom} onChange={(v) => set({ examNoRoom: v })}>Include exams without a room</Check>
        <Check on={p.examPast} onChange={(v) => set({ examPast: v })}>Include past exams</Check>
        {!examStore.loading && !exams.length && <p className="text-xs text-gray-600">Sync your exams in the Exams tab first.</p>}
      </Group>

      <Group n={5} title="Event title">
        {(['code-group', 'code-name', 'name-code'] as const).map((f) => <Radio key={f} name="title" on={p.title === f} onChange={() => set({ title: f })}>{titleSample(f)}</Radio>)}
        <p className="text-xs text-gray-600">Subject names come from your synced exams; a subject without one shows its code.</p>
      </Group>

      <Group n={6} title="Event details">
        <div className="flex flex-wrap gap-1.5">
          {DETAILS.map(([v, l]) => <Chip key={v} on={p.details.includes(v)} onClick={() => set({ details: toggle(p.details, v) })}>{l}</Chip>)}
        </div>
      </Group>

      <Group n={7} title="Reminders">
        <Check on={p.classReminder !== null} onChange={(v) => set({ classReminder: v ? 15 : null })}>
          Classes
          <select aria-label="Class reminder" className={small} disabled={p.classReminder === null} value={p.classReminder ?? 15} onChange={(e) => set({ classReminder: +e.target.value })}>
            {CLASS_OFFSETS.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          before
        </Check>
        <Check on={p.examReminders !== null} onChange={(v) => set({ examReminders: v ? [1440, 60] : null })}>
          Exams
          <select aria-label="First exam reminder" className={small} disabled={!p.examReminders} value={p.examReminders?.[0] ?? 1440} onChange={(e) => set({ examReminders: [+e.target.value, p.examReminders![1]] })}>
            {EXAM_FIRST.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          </select>
          and
          <select aria-label="Second exam reminder" className={small} disabled={!p.examReminders} value={p.examReminders?.[1] ?? 60} onChange={(e) => set({ examReminders: [p.examReminders![0], +e.target.value] })}>
            {EXAM_SECOND.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          </select>
          before
        </Check>
      </Group>

      <Group n={8} title="Preview">
        {classEvents[0] || examEvents[0] ? <Preview ev={(classEvents[0] ?? examEvents[0])!} /> : <p className="text-xs text-gray-600">Nothing matches these options.</p>}
        <p className="text-xs text-gray-600">{[p.classes && plural(classEvents.length, 'class', 'classes'), p.exams && plural(examEvents.length, 'exam')].filter(Boolean).join(' and ') || 'Pick classes or exams.'}</p>
      </Group>

      <div className="px-3 py-2.5">
        <Check on={p.remember} onChange={remember}>Remember my choices</Check>
        {msg && <div className="mt-2"><Message tone="info">{msg}</Message></div>}
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-gray-200 bg-white px-3 py-2.5">
        <button
          type="button" disabled={!total} onClick={() => void run()}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
        >
          <Icon name="download" size={18} />
          {files > 1 ? `Download ${files} .ics files` : 'Download .ics'} ({plural(total, 'event')})
        </button>
      </div>
    </div>
  )
}
