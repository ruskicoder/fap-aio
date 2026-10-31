// Schedule, Exams (core R8.3 to R8.7; ui/schedule.html): Sync exams at the top, Upcoming and Past
// with counts, a row of type chips, and exam cards with type and countdown tags.
import { useState } from 'react'
import { useStore } from '../../../content/panel/use-store'
import { errorText } from '../../../content/panel/errors'
import { parseIso, todayVn } from '../../../shared/dates'
import { syncExams as defaultSync, type ExamOutcome } from '../sync'
import { examTypeText } from '../ics'
import { EXAM_TYPES } from '../export-prefs'
import type { Exam, ExamType } from '../types'
import { fullTitle } from './WeekView'
import { Card, Chip, Empty, Line, Message, SubTabs, Tag, button, dayLabel, primary, type Tint } from './common'

const TYPE_TINT: Record<ExamType, Tint> = { FE: 'green', PE: 'blue', '2NDFE': 'amber', '2NDPE': 'violet', other: 'gray' }

const dayDiff = (date: string, today: string) => Math.round((parseIso(date).getTime() - parseIso(today).getTime()) / 86_400_000)
export function daysLeft(date: string, today: string): string {
  const n = dayDiff(date, today)
  return n < 0 ? 'Done' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`
}
/** Red within three days, green later, grey when past (core R8.5). */
const countdownTint = (date: string, today: string): Tint => { const n = dayDiff(date, today); return n < 0 ? 'gray' : n <= 3 ? 'red' : 'green' }

function ExamCard({ e, today }: { e: Exam; today: string }) {
  return (
    <Card title={fullTitle(e.code, e.name || undefined)} tags={<><Tag tint={TYPE_TINT[e.type]}>{examTypeText(e)}</Tag><Tag tint={countdownTint(e.date, today)}>{daysLeft(e.date, today)}</Tag></>}>
      {e.format && <Line label="Format">{e.format}</Line>}
      <Line label="Room">{e.room ?? 'not assigned yet'}</Line>
      <Line label="Date">{dayLabel(e.date)}</Line>
      <Line label="Time">{e.start}–{e.end}</Line>
      {e.publishDate && <Line label="Results">{/^\d{4}-\d{2}-\d{2}$/.test(e.publishDate) ? dayLabel(e.publishDate) : e.publishDate}</Line>}
      {e.note && <Line label="Note">{e.note}</Line>}
    </Card>
  )
}

export function ExamsView({ sync = defaultSync, now = () => Date.now() }: { sync?: () => Promise<ExamOutcome>; now?: () => number }) {
  const { data, loading } = useStore('exams')
  const [types, setTypes] = useState<ExamType[]>(EXAM_TYPES.map(([t]) => t))
  const [sub, setSub] = useState<'upcoming' | 'past'>('upcoming')
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
  const shown = exams.filter((e) => types.includes(e.type))
  const byTime = (a: Exam, b: Exam) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
  const upcoming = shown.filter((e) => e.date >= today).sort(byTime)
  const past = shown.filter((e) => e.date < today).sort((a, b) => byTime(b, a))
  const list = sub === 'upcoming' ? upcoming : past
  const toggle = (t: ExamType) => setTypes((o) => (o.includes(t) ? o.filter((x) => x !== t) : [...o, t]))

  return (
    <div className="flex flex-col pb-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2">
        <button type="button" className={button} disabled={busy} onClick={() => void run()}>{busy ? 'Syncing exams…' : 'Sync exams'}</button>
      </div>
      {msg && <div className="px-3 pt-2"><Message tone={msg.tone}>{msg.text}</Message></div>}
      <SubTabs label="Exams shown" value={sub} onChange={setSub} items={[['upcoming', `Upcoming (${upcoming.length})`], ['past', `Past (${past.length})`]]} />
      <div role="group" aria-label="Exam types" className="flex flex-wrap gap-1.5 px-3 pb-1.5">
        {EXAM_TYPES.map(([t, l]) => <Chip key={t} on={types.includes(t)} onClick={() => toggle(t)}>{l}</Chip>)}
      </div>
      {list.length
        ? <ul aria-label={sub === 'upcoming' ? 'Upcoming exams' : 'Past exams'}>{list.map((e) => <ExamCard key={e.id} e={e} today={today} />)}</ul>
        : <p className="px-3 py-2 text-gray-600">{sub === 'upcoming' ? 'No upcoming exams.' : 'No past exams.'}</p>}
    </div>
  )
}
