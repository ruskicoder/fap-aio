// Settings, Data and privacy and About (panel-ux R8.1; platform R4.6, R5.7, R7.3; core R5.5, R12.4): what is
// stored and how much, export of everything stored, the data files in use with "Check for data updates" and
// "Use packaged data", optional permission states, "Copy diagnostics"; About shows the version, the rubric and
// rules dates and links. Clear data and legacy cleanup are their own rows (clear-data.tsx, features/legacy).
import { createElement, useEffect, useRef, useState } from 'react'
import { call } from '../../../shared/call'
import { readRaw, storedKeys, type StoreKey } from '../../../shared/storage/catalog'
import { dataClient } from '../../data-client'
import { rubricInfo, rubricText } from '../../../features/grades/rubric'
import { registerSetting } from './registry'

const quiet = 'inline-flex h-control items-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
const small = 'text-xs text-gray-600'

export function bytesText(n: number | null | undefined): string {
  if (n == null) return 'unknown'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

type Status = Awaited<ReturnType<ReturnType<typeof dataClient>['status']>>
function useDataStatus(): [Status | null, () => void] {
  const [s, setS] = useState<Status | null>(null)
  const load = () => { void dataClient().status().then(setS, () => setS({ ok: false, error: { kind: 'error' } })) }
  useEffect(load, [])
  return [s, load]
}

function StorageRow() {
  const [s] = useDataStatus()
  if (!s) return <p className={small}>Reading storage use</p>
  if (!s.ok) return <p className={small}>Storage use could not be read.</p>
  const per = Object.entries(s.value.usage.perKey).sort((a, b) => b[1] - a[1])
  return (
    <div className="w-full text-sm">
      <p className="text-gray-800">{bytesText(s.value.usage.total)} in extension storage, {bytesText(s.value.idb.usage)} in the data database{s.value.idb.quota ? ` (of ${bytesText(s.value.idb.quota)} available)` : ''}.</p>
      <ul className="mt-1 text-xs text-gray-700">
        {per.slice(0, 12).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span className="break-all">{k}</span><span className="shrink-0">{bytesText(v)}</span></li>)}
      </ul>
      {per.length > 12 && <p className={small}>{per.length - 12} smaller stores not listed.</p>}
    </div>
  )
}

/** Every stored record, as stored, for the student's own copy. */
export async function exportAll(now = new Date()): Promise<string> {
  const stores: Record<string, unknown> = {}
  for (const k of (await storedKeys()).sort()) stores[k] = await readRaw(k as StoreKey)
  return JSON.stringify({ formatVersion: 1, exportedAt: now.toISOString(), stores }, null, 2)
}

function ExportRow() {
  const ref = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState<string | null>(null)
  const go = async () => {
    const text = await exportAll()
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `fap-aio-data-${new Date().toISOString().slice(0, 10)}.json`
    a.hidden = true
    ;(ref.current ?? document.body).appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setNote('Downloaded. The file holds your own records, so keep it private.')
  }
  return <div ref={ref} className="flex flex-col items-start gap-1"><button type="button" className={quiet} onClick={() => void go()}>Export all data</button>{note && <p role="status" className={small}>{note}</p>}</div>
}

const SKIP_PREFIX = 'Last update skipped: '
function DataFilesRow() {
  const [s, reload] = useDataStatus()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const run = async (type: 'data.check' | 'data.usePackaged') => {
    setBusy(true)
    setNote(null)
    const r = await call<{ kind?: string; version?: number; reason?: string }>({ type }).catch(() => null)
    setBusy(false)
    if (!r || !r.ok) setNote('It did not work this time; reload the page and try again.')
    else if (type === 'data.usePackaged') setNote(`Using the data packaged with this version (data version ${r.value.version}). Automatic updates are paused until you check for updates.`)
    else if (r.value.kind === 'updated') setNote(`Updated to data version ${r.value.version}.`)
    else if (r.value.kind === 'current') setNote('The data is up to date.')
    else setNote(`No update: ${r.value.reason}.`)
    reload()
  }
  const files = s?.ok ? s.value.data?.files ?? [] : []
  const ch = s?.ok ? s.value.channel : null
  return (
    <div className="w-full text-sm">
      {s?.ok && s.value.data && <p className="text-gray-800">Data version {s.value.data.version ?? 'none'}, {files.some((f) => f.source === 'channel') ? 'from the update channel' : 'packaged with this version'}.</p>}
      {ch?.lastCheck && <p className={small}>Last check {new Date(ch.lastCheck).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })}.</p>}
      {ch?.lastSkip && <p className={small}>{SKIP_PREFIX}{ch.lastSkip.reason}.</p>}
      {ch?.forcePackaged && <p className={small}>Automatic updates are paused: packaged data is in use.</p>}
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" className={quiet} disabled={busy} onClick={() => void run('data.check')}>Check for data updates</button>
        <button type="button" className={quiet} disabled={busy} onClick={() => void run('data.usePackaged')}>Use packaged data</button>
      </div>
      {note && <p role="status" className={`${small} mt-1`}>{note}</p>}
    </div>
  )
}

function PermissionsRow() {
  const [p, setP] = useState<{ notifications: boolean; flm: boolean } | null>(null)
  useEffect(() => { void call<{ notifications: boolean; flm: boolean }>({ type: 'perm.state' }).then((r) => r.ok && setP(r.value), () => undefined) }, [])
  if (!p) return <p className={small}>Reading permissions</p>
  const line = (label: string, on: boolean, why: string) => <li><span className="font-medium text-gray-900">{label}:</span> {on ? 'allowed' : 'not allowed'}. <span className="text-gray-600">{why}</span></li>
  return (
    <ul className="w-full text-sm text-gray-800">
      {line('Notifications', p.notifications, 'Asked when you turn on reminders or alert notifications.')}
      {line('Reading FLM', p.flm, 'Asked when you turn on live syllabus reading.')}
      <li className={small}>To take a permission back, open Chrome's extension details for FAP-AIO.</li>
    </ul>
  )
}

function DiagnosticsRow() {
  const [text, setText] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const go = async () => {
    setNote(null)
    const r = await call<{ text: string }>({ type: 'diagnostics' }).catch(() => null)
    if (!r || !r.ok) { setNote('The report could not be built; try again.'); return }
    try { await navigator.clipboard.writeText(r.value.text); setText(null); setNote('Copied. The report has versions and error counts only, no names, marks or timetable.') } catch { setText(r.value.text); setNote('Copy it from the box below.') }
  }
  return (
    <div className="flex w-full flex-col items-start gap-1">
      <button type="button" className={quiet} onClick={() => void go()}>Copy diagnostics</button>
      {note && <p role="status" className={small}>{note}</p>}
      {text && <textarea readOnly aria-label="Diagnostics report" rows={6} className="w-full rounded border border-gray-300 p-2 font-mono text-xs" value={text} />}
    </div>
  )
}

/** "read 2026-10-11" in the news rules' source line. */
export const newsRulesDate = (source: string) => /read (\d{4}-\d{2}-\d{2})/.exec(source)?.[1] ?? null
const dayText = (iso: string) => new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

function AboutRow() {
  const [rubric, setRubric] = useState<string | null>(null)
  const [news, setNews] = useState<string | null>(null)
  useEffect(() => {
    void rubricInfo().then((i) => setRubric(i ? rubricText(i) : null), () => undefined)
    void dataClient().newsRules().then((r) => { const d = r.ok ? newsRulesDate(r.value.source) : null; setNews(d ? `News rules of ${dayText(d)}` : null) }, () => undefined)
  }, [])
  const link = (href: string, label: string) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-800 underline underline-offset-2 hover:text-orange-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{label}</a>
  return (
    <div className="w-full text-sm text-gray-800">
      <p>FAP-AIO {chrome.runtime.getManifest().version}</p>
      {rubric && <p className={small}>{rubric}</p>}
      {news && <p className={small}>{news}</p>}
      <p className="mt-1 flex flex-wrap gap-x-3">{link('https://github.com/ruskicoder/fap-aio', 'Source code')}{link('https://fap.fpt.edu.vn/', 'FAP')}{link('https://flm.fpt.edu.vn/', 'FLM')}</p>
    </div>
  )
}

export function registerDataAndAbout(): void {
  const row = (key: string, section: 'data' | 'about', label: string, description: string, c: () => JSX.Element) =>
    registerSetting<null>({ key, section, type: 'custom', default: null, transfer: false, label, description, component: () => createElement(c) })
  row('data.storage', 'data', 'What is stored', 'Space used per store in this browser; nothing leaves it except the requests to FAP, FLM and the data channel.', StorageRow)
  row('data.export', 'data', 'Export all data', 'Everything FAP-AIO stored, as one JSON file.', ExportRow)
  row('data.files', 'data', 'Subject and news data', 'The data files in use, their version and source, and the last update check.', DataFilesRow)
  row('data.permissions', 'data', 'Optional permissions', 'What Chrome allows FAP-AIO beyond FAP itself.', PermissionsRow)
  row('data.diagnostics', 'data', 'Copy diagnostics', 'A report for a bug report, without your names, marks or timetable.', DiagnosticsRow)
  row('about.info', 'about', 'FAP-AIO', 'Version, data dates and links.', AboutRow)
}
