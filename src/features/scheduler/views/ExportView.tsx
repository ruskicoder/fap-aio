// Schedule, Export (core R9.1 to R9.10): layout A of ui/schedule-audit.md round S1 with the round S3
// editors. One scrolling form with groups 1 to 8, "Remember my choices" and the Download button
// pinned at the bottom.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../../../content/panel/use-store'
import { Icon } from '../../../content/panel/icons'
import { read, remove, write } from '../../../shared/storage/catalog'
import { todayVn } from '../../../shared/dates'
import { buildIcs, classEvent, download as defaultDownload, examEvent, offsetText, type IcsEvent } from '../ics'
import {
  CLASS_PIECES, CLASS_PRESETS, DEFAULT_PREFS, DETAILS, EXAM_PIECES, EXAM_PRESETS, EXAM_TYPES, SEPARATORS,
  longDate, parsePrefs, rangeBounds, sameTitle, selectForExport, subjectNames, subjectsInRange, termName,
  type ExportPrefs, type ExportRange, type TitleSpec,
} from '../export-prefs'
import { Chip, Message, dayLabel, select } from './common'

const MODES: [ExportPrefs['classMode'], string][] = [['all', 'All'], ['offline', 'Offline only'], ['online', 'Online only']]
const TIERS = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080]
const UNITS: [number, string][] = [[1, 'min'], [60, 'hours'], [1440, 'days']]
const SEP_LABEL: Record<string, string> = { ' - ': '-', ' · ': '·', ' | ': '|', ' ': 'space' }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const small = `${select} h-7 text-xs`
const mini = 'rounded px-1 text-xs leading-none hover:bg-orange-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-30'

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
const Sub = ({ children }: { children: ReactNode }) => <p className="text-xs font-medium text-gray-700">{children}</p>

/** Ordered pieces with move and remove, and add buttons for the rest (round S3 builder). */
function Pieces<K extends string>({ items, value, onChange, label }: { items: readonly (readonly [K, string])[]; value: K[]; onChange: (v: K[]) => void; label: string }) {
  const name = (k: K) => items.find(([x]) => x === k)![1]
  const move = (i: number, d: number) => { const v = [...value]; [v[i], v[i + d]] = [v[i + d]!, v[i]!]; onChange(v) }
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((k, i) => (
          <span key={k} className="inline-flex min-h-7 items-center gap-0.5 rounded-full border border-orange-500 bg-orange-50 pl-3 pr-1 text-xs text-orange-800">
            {name(k)}
            <button type="button" className={mini} aria-label={`Move ${name(k)} left`} disabled={i === 0} onClick={() => move(i, -1)}>←</button>
            <button type="button" className={mini} aria-label={`Move ${name(k)} right`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>→</button>
            <button type="button" className={mini} aria-label={`Remove ${name(k)}`} onClick={() => onChange(value.filter((x) => x !== k))}>×</button>
          </span>
        ))}
        {!value.length && <span className="text-xs text-gray-600">None</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.filter(([k]) => !value.includes(k)).map(([k, l]) => (
          <button key={k} type="button" onClick={() => onChange([...value, k])} className="inline-flex min-h-7 items-center rounded-full border border-dashed border-gray-300 px-3 text-xs text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">+ {l}</button>
        ))}
      </div>
    </div>
  )
}

/** Title presets plus Custom, which opens the piece builder with a separator (R9.6). */
function TitleEditor<K extends string>({ kind, items, presets, value, onChange, sample }: {
  kind: string; items: readonly (readonly [K, string])[]; presets: TitleSpec<K>[]; value: TitleSpec<K>; onChange: (v: TitleSpec<K>) => void; sample: (t: TitleSpec<K>) => string
}) {
  const preset = presets.findIndex((t) => sameTitle(t, value))
  const [custom, setCustom] = useState(preset < 0)
  const label = (t: TitleSpec<K>) => t.pieces.map((k) => items.find(([x]) => x === k)![1]).join(t.sep)
  return (
    <div className="flex flex-col gap-1">
      <Sub>{kind}</Sub>
      {presets.map((t, i) => (
        <Radio key={label(t)} name={`title-${kind}`} on={!custom && preset === i} onChange={() => { setCustom(false); onChange(t) }}>
          {label(t)} <span className="text-gray-500">({sample(t)})</span>
        </Radio>
      ))}
      <Radio name={`title-${kind}`} on={custom} onChange={() => setCustom(true)}>Custom <span className="text-gray-500">({sample(value)})</span></Radio>
      {custom && (
        <div className="ml-5 flex flex-col gap-1.5">
          <Pieces label={`${kind} title pieces`} items={items} value={value.pieces} onChange={(pieces) => onChange({ ...value, pieces })} />
          <label className="flex items-center gap-1.5 text-xs">Separator
            <select aria-label={`${kind} separator`} className={small} value={value.sep} onChange={(e) => onChange({ ...value, sep: e.target.value as TitleSpec<K>['sep'] })}>
              {SEPARATORS.map((s) => <option key={s} value={s}>{SEP_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

/** Reminder tiers: remove any, add one from the list or typed (R9.8). */
function Tiers({ kind, value, onChange }: { kind: string; value: number[]; onChange: (v: number[]) => void }) {
  const [pick, setPick] = useState('')
  const [n, setN] = useState('')
  const [unit, setUnit] = useState(60)
  const [err, setErr] = useState<string | null>(null)
  const free = TIERS.filter((m) => !value.includes(m))
  const add = () => {
    const m = n ? Math.round(+n * unit) : +(pick || free[0] || 0)
    if (!m || m < 1 || m > 60 * 24 * 60) return setErr('Enter a time from 1 minute to 60 days.')
    if (value.includes(m)) return setErr('That time is already in the list.')
    setErr(null)
    setN('')
    setPick('')
    onChange([...value, m].sort((a, b) => a - b))
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Sub>{kind}</Sub>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((m) => (
          <span key={m} className="inline-flex min-h-7 items-center gap-0.5 rounded-full border border-gray-300 pl-3 pr-1 text-xs">
            {offsetText(m)} before
            <button type="button" className={mini} aria-label={`Remove ${kind} reminder ${offsetText(m)}`} onClick={() => onChange(value.filter((x) => x !== m))}>×</button>
          </span>
        ))}
        {!value.length && <span className="text-xs text-gray-600">No reminders</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        Add
        <select aria-label={`${kind} reminder to add`} className={small} value={pick} onChange={(e) => setPick(e.target.value)}>
          {free.map((m) => <option key={m} value={m}>{offsetText(m)}</option>)}
        </select>
        or
        <input type="number" min={1} aria-label={`${kind} reminder amount`} placeholder="time" className={`${small} w-16`} value={n} onChange={(e) => setN(e.target.value)} />
        <select aria-label={`${kind} reminder unit`} className={small} value={unit} onChange={(e) => setUnit(+e.target.value)}>
          {UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" className="inline-flex h-7 items-center rounded border border-gray-300 px-2 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={add}>Add</button>
      </div>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
    </div>
  )
}

function Preview({ ev }: { ev: IcsEvent }) {
  return (
    <div className="border-l-[3px] border-orange-500 bg-gray-50 px-2 py-1.5 text-xs leading-relaxed">
      <p className="font-medium">{ev.summary}</p>
      <p>{dayLabel(ev.date)}, {ev.start}–{ev.end}{ev.location ? ` · ${ev.location}` : ''}</p>
      {ev.description && <p className="text-gray-600">{ev.description.split('\n').join(' · ')}</p>}
      {ev.category && <p className="text-gray-600">Category: {ev.category}</p>}
    </div>
  )
}

export function ExportView({ now = () => Date.now(), download = defaultDownload }: { now?: () => number; download?: typeof defaultDownload }) {
  const timetable = useStore('timetable')
  const examStore = useStore('exams')
  const [p, setP] = useState<ExportPrefs>(DEFAULT_PREFS)
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const loaded = useRef(false)
  const box = useRef<HTMLDivElement>(null)
  const today = todayVn(now())

  // Restore remembered options once (R9.10); the title editors mount after it so Custom shows right.
  useEffect(() => {
    void read('export.prefs').then((d) => { if (d) setP(parsePrefs(d)); loaded.current = true; setReady(true) })
  }, [])
  useEffect(() => {
    if (loaded.current && p.remember) void write('export.prefs', p)
  }, [p])
  const set = (patch: Partial<ExportPrefs>) => { setP((o) => ({ ...o, ...patch })); setMsg(null) }
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const remember = (on: boolean) => {
    set({ remember: on })
    // Written at once, so a tick made before the stored options load is not lost (R9.10).
    if (on) void write('export.prefs', { ...p, remember: true })
    else void remove('export.prefs')
  }

  const sessions = timetable.data?.sessions ?? []
  const exams = examStore.data?.exams ?? []
  const names = useMemo(() => subjectNames(exams), [exams])
  const subjects = subjectsInRange(sessions, p, today)
  const sel = selectForExport(sessions, exams, p, today)
  const offline = sel.classes.filter((s) => !s.online).map((s) => classEvent(s, p, names))
  const online = sel.classes.filter((s) => s.online).map((s) => classEvent(s, p, names))
  const examEvents = sel.exams.map((e) => examEvent(e, p, names))
  const total = offline.length + online.length + examEvents.length
  const out: [string, IcsEvent[]][] = (p.files === 'separate'
    ? [[`fap-classes-offline-${today}.ics`, offline], [`fap-classes-online-${today}.ics`, online], [`fap-exams-${today}.ics`, examEvents]] as [string, IcsEvent[]][]
    : [[`fap-schedule-${today}.ics`, [...offline, ...online, ...examEvents]]] as [string, IcsEvent[]][]
  ).filter(([, evs]) => evs.length)
  const [from, to] = rangeBounds(p, today)
  const ranges: [ExportRange, string][] = [['week', 'This week'], ['next2', 'Next 2 weeks'], ['month', 'This month'], ['term', termName(today)], ['custom', 'Custom']]
  // Title samples from a class whose subject name is known, so the choices read differently.
  const sampleClass = sessions.find((s) => names.has(s.code) && s.room) ?? sessions[0]
  const sampleExam = exams.find((e) => e.room) ?? exams[0]
  const preview = [offline[0] ?? online[0], examEvents[0]].filter((e): e is IcsEvent => !!e)

  const run = async () => {
    const at = now()
    for (const [name, evs] of out) download(box.current!, name, await buildIcs(evs, at))
    setMsg(`Downloaded ${out.map(([n]) => n).join(', ')} with ${plural(total, 'event')}. Import ${out.length > 1 ? 'each file into its own calendar' : 'it into your calendar app'}.`)
  }

  return (
    <div ref={box} className="flex min-h-full flex-col text-sm">
      <Group n={1} title="What to export">
        <div className="flex flex-wrap gap-1.5">
          <Chip on={p.classes} onClick={() => set({ classes: !p.classes })}>Classes</Chip>
          <Chip on={p.exams} onClick={() => set({ exams: !p.exams })}>Exams</Chip>
        </div>
        <Radio name="files" on={p.files === 'separate'} onChange={() => set({ files: 'separate' })}>Separate files: offline classes, online classes, exams</Radio>
        <Radio name="files" on={p.files === 'one'} onChange={() => set({ files: 'one' })}>One file</Radio>
      </Group>

      <Group n={2} title="Date range">
        <div className="flex flex-wrap gap-1.5">
          {ranges.map(([v, l]) => <Chip key={v} on={p.range === v} onClick={() => set(v === 'custom' && !p.from ? { range: v, from, to } : { range: v })}>{l}</Chip>)}
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
        {ready && (
          <>
            <TitleEditor kind="Classes" items={CLASS_PIECES} presets={CLASS_PRESETS} value={p.classTitle} onChange={(classTitle) => set({ classTitle })}
              sample={(t) => (sampleClass ? classEvent(sampleClass, { ...p, classTitle: t }, names).summary : '')} />
            <TitleEditor kind="Exams" items={EXAM_PIECES} presets={EXAM_PRESETS} value={p.examTitle} onChange={(examTitle) => set({ examTitle })}
              sample={(t) => (sampleExam ? examEvent(sampleExam, { ...p, examTitle: t }, names).summary : '')} />
          </>
        )}
        <p className="text-xs text-gray-600">Subject names come from your synced exams. A piece with no value is left out; an online class shows Online as its room.</p>
      </Group>

      <Group n={6} title="Event details">
        <Pieces label="Event details in order" items={DETAILS} value={p.details} onChange={(details) => set({ details })} />
        <p className="text-xs text-gray-600">Room goes in the event location; the other details are description lines in this order.</p>
        <div className="flex flex-col gap-1 text-xs">
          <Sub>Category</Sub>
          {([['offline', 'Offline classes'], ['online', 'Online classes'], ['exam', 'Exams']] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5">
              <span className="w-24">{l}</span>
              <input type="text" maxLength={40} aria-label={`Category for ${l.toLowerCase()}`} className={`${small} w-36`} value={p.categories[k]} onChange={(e) => set({ categories: { ...p.categories, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
      </Group>

      <Group n={7} title="Reminders">
        <Tiers kind="Classes" value={p.classReminders} onChange={(classReminders) => set({ classReminders })} />
        <Tiers kind="Exams" value={p.examReminders} onChange={(examReminders) => set({ examReminders })} />
      </Group>

      <Group n={8} title="Preview">
        {preview.length ? preview.map((ev) => <Preview key={ev.uid} ev={ev} />) : <p className="text-xs text-gray-600">Nothing matches these options.</p>}
        <p className="text-xs text-gray-600">
          {[p.classes && `${plural(offline.length, 'offline class', 'offline classes')}, ${plural(online.length, 'online class', 'online classes')}`, p.exams && plural(examEvents.length, 'exam')].filter(Boolean).join(' and ') || 'Pick classes or exams.'}
        </p>
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
          {out.length > 1 ? `Download ${out.length} .ics files` : 'Download .ics'} ({plural(total, 'event')})
        </button>
      </div>
    </div>
  )
}
