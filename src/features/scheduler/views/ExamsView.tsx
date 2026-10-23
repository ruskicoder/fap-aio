// Schedule, Exams (core R8.3 to R8.6): upcoming and past, days left, type filter, last sync.
import { useState } from 'react'
import { useStore } from '../../../content/panel/use-store'
import { errorText } from '../../../content/panel/errors'
import { parseIso, todayVn } from '../../../shared/dates'
import { syncExams as defaultSync, type ExamOutcome } from '../sync'
import type { Exam, ExamType } from '../types'
import { Empty, LastSync, Message, button, dayLabel, primary, select } from './common'

const TYPES: [ExamType | 'all', string][] = [['all', 'All types'], ['FE', 'FE'], ['PE', 'PE'], ['2NDFE', '2NDFE'], ['2NDPE', '2NDPE'], ['other', 'Other']]

export function daysLeft(date: string, today: string): string {
  const n = Math.round((parseIso(date).getTime() - parseIso(today).getTime()) / 86_400_000)
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`
}

function Row({ e, today }: { e: Exam; today: string }) {
  return (
    <li className="flex gap-3 px-3 py-2">
      <span className="w-24 shrink-0 text-gray-700">
        {dayLabel(e.date)}
        <span className="block text-xs tabular-nums">{e.start}–{e.end}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{e.code}</span> <span className="rounded bg-gray-100 px-1 text-xs">{e.type === 'other' ? e.typeRaw : e.type}</span>
        <span className="block truncate text-xs text-gray-600">{[e.name, e.room ?? 'Room not assigned'].join(' · ')}</span>
      </span>
      {e.date >= today && <span className="shrink-0 text-xs font-medium text-gray-800">{daysLeft(e.date, today)}</span>}
    </li>
  )
}

export function ExamsView({ sync = defaultSync, now = () => Date.now() }: { sync?: () => Promise<ExamOutcome>; now?: () => number }) {
  const { data, loading } = useStore('exams')
  const [type, setType] = useState<ExamType | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const today = todayVn(now())

  const run = async () => {
    setBusy(true)
    setMsg(null)
    const r = await sync()
    setBusy(false)
    setMsg(r.ok ? { tone: 'info', text: `${r.total} exams stored, ${r.added} added, ${r.updated} updated.` } : { tone: 'error', text: errorText(r.error) })
  }

  if (loading) return null
  const exams = data?.exams ?? []
  if (!exams.length) {
    return (
      <Empty title="No exams synced yet">
        <button type="button" className={primary} disabled={busy} onClick={() => void run()}>{busy ? 'Syncing exams…' : 'Sync exams'}</button>
        {msg && <Message tone={msg.tone}>{msg.text}</Message>}
      </Empty>
    )
  }
  const shown = exams.filter((e) => type === 'all' || e.type === type)
  const upcoming = shown.filter((e) => e.date >= today)
  const past = shown.filter((e) => e.date < today).reverse()
  const groups: [string, Exam[]][] = [['Upcoming', upcoming], ['Past', past]]

  return (
    <div className="flex flex-col gap-2 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 px-3">
        <label className="sr-only" htmlFor="aio-exam-type">Exam type</label>
        <select id="aio-exam-type" className={select} value={type} onChange={(e) => setType(e.target.value as ExamType | 'all')}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" className={button} disabled={busy} onClick={() => void run()}>{busy ? 'Syncing…' : 'Sync exams'}</button>
      </div>
      <div className="px-3">
        <LastSync at={data?.lastSync} what="Exams" />
        {msg && <Message tone={msg.tone}>{msg.text}</Message>}
      </div>
      {groups.map(([title, list]) => (
        <section key={title} aria-label={title}>
          <h3 className="border-y border-gray-100 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">{title} ({list.length})</h3>
          {list.length
            ? <ul className="divide-y divide-gray-100">{list.map((e) => <Row key={e.id} e={e} today={today} />)}</ul>
            : <p className="px-3 py-2 text-gray-600">{title === 'Upcoming' ? 'No upcoming exams.' : 'No past exams.'}</p>}
        </section>
      ))}
    </div>
  )
}
