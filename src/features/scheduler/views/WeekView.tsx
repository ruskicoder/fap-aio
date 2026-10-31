// Schedule, Classes (core R8.1, R8.2, R8.7; ui/schedule.html): Sync this week and Sync <term> at
// the top, This week and All with counts, day headers, and class cards that never truncate.
import { useState } from 'react'
import { useStore } from '../../../content/panel/use-store'
import { errorText } from '../../../content/panel/errors'
import { addDays, mondayOf, todayVn } from '../../../shared/dates'
import { engine as defaultEngine, termOf, termRange, type SyncEngine, type SyncOutcome } from '../sync'
import { attendanceText } from '../ics'
import { subjectNames, termName } from '../export-prefs'
import type { Session } from '../types'
import { siteRoom } from '../rooms'
import { Card, Empty, Line, Message, SubTabs, Tag, button, dayLabel, primary, type Tint } from './common'

export type ClassesSub = 'week' | 'all'

export function reportText(r: SyncOutcome['report']): string {
  const parts = [`${r.synced} ${r.synced === 1 ? 'week' : 'weeks'} synced`]
  if (r.failed.length) parts.push(`${r.failed.length} failed`)
  parts.push(`${r.added} added`, `${r.updated} updated`)
  if (r.unreadable) parts.push(`${r.unreadable} unreadable`)
  return `${parts.join(', ')}.`
}

const ATT_TINT: Record<string, Tint> = { present: 'green', absent: 'red', 'not-yet': 'amber', exempt: 'gray' }
const attTint = (a: Session['attendance']): Tint => (typeof a === 'string' ? ATT_TINT[a]! : 'gray')

/** `CODE · name`, or the code alone when no name is known (core R8.2). */
export const fullTitle = (code: string, name: string | undefined) => (name ? `${code} · ${name}` : code)

function ClassCard({ s, name }: { s: Session; name: string | undefined }) {
  const att = attendanceText(s.attendance)
  return (
    <Card title={fullTitle(s.code, name)} tags={<><Tag tint="gray">Slot {s.slot}</Tag>{att && <Tag tint={attTint(s.attendance)}>{att}</Tag>}</>}>
      <Line label="Room">{s.online ? 'Online' : siteRoom(s.room) ?? 'not assigned'}</Line>
      <Line label="Time">{s.start}–{s.end}</Line>
      {s.lecturer && <Line label="Lecturer">{s.lecturer}</Line>}
      {s.group && <Line label="Group">{s.group}</Line>}
      {s.scheduleType && <Line label="Type">{s.scheduleType}</Line>}
    </Card>
  )
}

export function WeekView({ engine = defaultEngine, now = () => Date.now() }: { engine?: SyncEngine; now?: () => number }) {
  const { data, loading } = useStore('timetable')
  const exams = useStore('exams')
  const [sub, setSub] = useState<ClassesSub>('week')
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

  const names = subjectNames(exams.data?.exams ?? [])
  const monday = mondayOf(today)
  const week = sessions.filter((s) => s.date >= monday && s.date <= addDays(monday, 6))
  const shown = sub === 'week' ? week : sessions
  const days = new Map<string, Session[]>()
  for (const s of shown) days.set(s.date, [...(days.get(s.date) ?? []), s])

  return (
    <div className="flex flex-col pb-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2">
        <button type="button" className={button} disabled={busy} onClick={() => void syncWeek()}>Sync this week</button>
        <button type="button" className={button} disabled={busy || engine.running} onClick={() => void syncTerm()}>Sync {termName(today)}</button>
      </div>
      {(busy || msg) && (
        <div className="px-3 pt-2">
          {busy && <Message tone="info">Syncing… progress is shown below.</Message>}
          {msg && <Message tone={msg.tone}>{msg.text}</Message>}
        </div>
      )}
      <SubTabs label="Classes shown" value={sub} onChange={setSub} items={[['week', `This week (${week.length})`], ['all', `All (${sessions.length})`]]} />
      {shown.length === 0
        ? <p className="px-3 py-2 text-gray-600">No classes this week.</p>
        : [...days].map(([date, list]) => (
          <section key={date} aria-label={dayLabel(date)}>
            <h3 className={`px-3 pt-1.5 text-xs font-medium ${date === today ? 'text-orange-700' : 'text-gray-600'}`}>
              {dayLabel(date)}{date === today ? ' · today' : ''}
            </h3>
            <ul>{list.map((s) => <ClassCard key={s.id} s={s} name={names.get(s.code)} />)}</ul>
          </section>
        ))}
    </div>
  )
}
