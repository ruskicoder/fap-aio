// Schedule, Week (core R8.1, R8.2, R8.5, R8.6): synced sessions grouped by day, range filters,
// sync week and sync term with progress and the final report.
import { useState } from 'react'
import { useStore } from '../../../content/panel/use-store'
import { errorText } from '../../../content/panel/errors'
import { addDays, mondayOf, todayVn } from '../../../shared/dates'
import { engine as defaultEngine, termOf, termRange, type SyncEngine, type SyncOutcome } from '../sync'
import type { Session } from '../types'
import { attendanceText } from '../ics'
import { Empty, LastSync, Message, button, dayLabel, primary, select } from './common'

export type Range = 'today' | 'week' | 'next2' | 'month' | 'all'
export const RANGES: [Range, string][] = [['today', 'Today'], ['week', 'This week'], ['next2', 'Next two weeks'], ['month', 'This month'], ['all', 'All']]

export function inRange(date: string, range: Range, today: string): boolean {
  switch (range) {
    case 'today': return date === today
    case 'week': { const m = mondayOf(today); return date >= m && date <= addDays(m, 6) }
    case 'next2': return date >= today && date <= addDays(today, 13)
    case 'month': return date.slice(0, 7) === today.slice(0, 7)
    case 'all': return true
  }
}


export function reportText(r: SyncOutcome['report']): string {
  const parts = [`${r.synced} ${r.synced === 1 ? 'week' : 'weeks'} synced`]
  if (r.failed.length) parts.push(`${r.failed.length} failed`)
  parts.push(`${r.added} added`, `${r.updated} updated`)
  if (r.unreadable) parts.push(`${r.unreadable} unreadable`)
  return `${parts.join(', ')}.`
}

function Row({ s }: { s: Session }) {
  const att = attendanceText(s.attendance)
  return (
    <li className="flex gap-3 px-3 py-2">
      <span className="w-24 shrink-0 tabular-nums text-gray-700">{s.start}–{s.end}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{s.code}</span> <span className="text-gray-600">{s.group}</span>
        <span className="block truncate text-xs text-gray-600">
          {[s.online ? 'Online' : s.room, s.lecturer, s.scheduleType].filter(Boolean).join(' · ')}
        </span>
      </span>
      {att && <span className="shrink-0 text-xs text-gray-700">{att}</span>}
    </li>
  )
}

export function WeekView({ engine = defaultEngine, now = () => Date.now() }: { engine?: SyncEngine; now?: () => number }) {
  const { data, loading } = useStore('timetable')
  const [range, setRange] = useState<Range>('week')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const today = todayVn(now())

  const run = async (fn: () => Promise<SyncOutcome>) => {
    setBusy(true)
    setMsg(null)
    const r = await fn()
    setBusy(false)
    setMsg(r.ok ? { tone: 'info', text: reportText(r.report) } : { tone: 'error', text: `${errorText(r.error)} ${reportText(r.report)}` })
  }
  const syncWeek = () => run(() => engine.syncWeek(today))
  const syncTerm = () => { const t = termOf(today); return run(() => engine.syncRange(...termRange(t.term, t.year))) }

  if (loading) return null
  const sessions = data?.sessions ?? []
  if (!sessions.length) {
    return (
      <Empty title="No classes synced yet">
        <button type="button" className={primary} disabled={busy} onClick={() => void syncWeek()}>{busy ? 'Syncing this week…' : 'Sync this week'}</button>
        {msg && <Message tone={msg.tone}>{msg.text}</Message>}
      </Empty>
    )
  }

  const shown = sessions.filter((s) => inRange(s.date, range, today))
  const days = new Map<string, Session[]>()
  for (const s of shown) days.set(s.date, [...(days.get(s.date) ?? []), s])

  return (
    <div className="flex flex-col gap-2 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 px-3">
        <label className="sr-only" htmlFor="aio-week-range">Range</label>
        <select id="aio-week-range" className={select} value={range} onChange={(e) => setRange(e.target.value as Range)}>
          {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" className={button} disabled={busy} onClick={() => void syncWeek()}>Sync week</button>
        <button type="button" className={button} disabled={busy || engine.running} onClick={() => void syncTerm()}>Sync term</button>
      </div>
      <div className="px-3">
        <LastSync at={data?.lastSync} what="Classes" />
        {busy && <Message tone="info">Syncing… progress is shown below.</Message>}
        {msg && <Message tone={msg.tone}>{msg.text}</Message>}
      </div>
      {shown.length === 0
        ? <p className="px-3 text-gray-600">No classes in this range.</p>
        : [...days].map(([date, list]) => (
          <section key={date} aria-label={dayLabel(date)}>
            <h3 className={`sticky top-0 border-y border-gray-100 bg-gray-50 px-3 py-1 text-xs font-semibold ${date === today ? 'text-orange-700' : 'text-gray-700'}`}>
              {dayLabel(date)}{date === today ? ' · Today' : ''}
            </h3>
            <ul className="divide-y divide-gray-100">{list.map((s) => <Row key={s.id} s={s} />)}</ul>
          </section>
        ))}
    </div>
  )
}
