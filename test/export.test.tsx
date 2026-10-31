// @vitest-environment happy-dom
// Export options, selection, events and the Export form (core R9.1 to R9.12, revised 2026-10-31).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { buildIcs, classEvent, examEvent, offsetText, sha1 } from '../src/features/scheduler/ics'
import {
  DEFAULT_PREFS, longDate, parsePrefs, rangeBounds, selectForExport, subjectNames, subjectsInRange, termName, type ExportPrefs,
} from '../src/features/scheduler/export-prefs'
import { ExportView } from '../src/features/scheduler/views/ExportView'
import type { Exam, Session } from '../src/features/scheduler/types'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const session = (p: Partial<Session> = {}): Session => ({
  id: 'x', date: '2026-10-05', slot: 1, start: '07:30', end: '09:00', code: 'PRF192', group: 'SE1', room: 'BE-301',
  lecturer: 'abc', online: false, scheduleType: null, attendance: 'present', syncedAt: 1, ...p,
})
const exam = (p: Partial<Exam> = {}): Exam => ({
  id: 'e', date: '2026-10-20', start: '10:50', end: '12:20', room: 'R1', code: 'PRF192', name: 'Lập trình C',
  type: 'FE', typeRaw: 'FE', format: 'Multiple choice', publishDate: '2026-10-30', attendanceNote: '', note: '', past: false, syncedAt: 1, ...p,
})
const TODAY = '2026-10-07' // a Wednesday in Fall 2026
const NOW = Date.parse('2026-10-07T02:00:00Z')
const prefs = (p: Partial<ExportPrefs> = {}): ExportPrefs => ({ ...DEFAULT_PREFS, ...p })

const SESSIONS = [
  session({ id: 'a' }),
  session({ id: 'b', date: '2026-10-06', code: 'SWE201', online: true, room: null }),
  session({ id: 'c', date: '2026-11-20' }),
  session({ id: 'd', date: '2026-08-10', code: 'MAE101' }),
]
const EXAMS = [
  exam(),
  exam({ id: 'past', date: '2026-10-01', type: 'PE', typeRaw: 'PE' }),
  exam({ id: 'noroom', date: '2026-10-25', type: '2NDFE', typeRaw: '2NDFE', room: null }),
  exam({ id: 'other', date: '2026-10-22', type: 'other', typeRaw: 'PT', room: 'R2', code: 'SWE201', name: '' }),
]

describe('export options', () => {
  it('resolves every date range', () => {
    expect(rangeBounds(prefs({ range: 'week' }), TODAY)).toEqual(['2026-10-05', '2026-10-11'])
    expect(rangeBounds(prefs({ range: 'next2' }), TODAY)).toEqual(['2026-10-07', '2026-10-20'])
    expect(rangeBounds(prefs({ range: 'month' }), TODAY)).toEqual(['2026-10-01', '2026-10-31'])
    expect(rangeBounds(prefs({ range: 'month' }), '2028-02-10')).toEqual(['2028-02-01', '2028-02-29'])
    expect(rangeBounds(prefs({ range: 'month' }), '2026-12-31')).toEqual(['2026-12-01', '2026-12-31'])
    expect(rangeBounds(prefs({ range: 'term' }), TODAY)).toEqual(['2026-09-01', '2026-12-31'])
    expect(rangeBounds(prefs({ range: 'custom', from: '2026-10-20', to: '2026-10-10' }), TODAY)).toEqual(['2026-10-10', '2026-10-20'])
    expect(rangeBounds(prefs({ range: 'custom', from: null, to: null }), TODAY)).toEqual([TODAY, TODAY])
    expect(termName(TODAY)).toBe('Fall 2026')
    expect(termName('2027-03-01')).toBe('Spring 2027')
    expect(longDate('2026-09-01')).toBe('01 Sep 2026')
  })

  it('reads stored options and falls back to the defaults', () => {
    const p = prefs({ title: 'name-code', excludedSubjects: ['PRF192'], remember: true })
    expect(parsePrefs(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(parsePrefs({ title: 'nope' })).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
  })

  it('selects by range, mode and subject, and exams by type, room and date', () => {
    const ids = (r: { classes: Session[]; exams: Exam[] }) => [r.classes.map((s) => s.id), r.exams.map((e) => e.id)]
    expect(ids(selectForExport(SESSIONS, EXAMS, prefs(), TODAY))).toEqual([['a', 'b', 'c'], ['e']])
    expect(ids(selectForExport(SESSIONS, EXAMS, prefs({ range: 'week', classMode: 'offline' }), TODAY))).toEqual([['a'], []])
    expect(ids(selectForExport(SESSIONS, EXAMS, prefs({ classMode: 'online' }), TODAY))[0]).toEqual(['b'])
    expect(ids(selectForExport(SESSIONS, EXAMS, prefs({ excludedSubjects: ['PRF192'] }), TODAY))[0]).toEqual(['b'])
    expect(ids(selectForExport(SESSIONS, EXAMS, prefs({ examNoRoom: true, examPast: true, examTypes: ['FE', 'PE', '2NDFE', 'other'] }), TODAY))[1])
      .toEqual(['past', 'e', 'other', 'noroom'])
    expect(ids(selectForExport(SESSIONS, EXAMS, prefs({ classes: false, exams: false }), TODAY))).toEqual([[], []])
    expect(subjectsInRange(SESSIONS, prefs(), TODAY)).toEqual(['PRF192', 'SWE201'])
    expect(subjectsInRange(SESSIONS, prefs({ classMode: 'offline', excludedSubjects: ['PRF192'] }), TODAY)).toEqual(['PRF192'])
  })
})

describe('export events', () => {
  const names = subjectNames(EXAMS)

  it('formats class titles, with the code alone when no name is known', () => {
    const s = session()
    expect(classEvent(s, prefs(), names).summary).toBe('PRF192 (SE1)')
    expect(classEvent(s, prefs({ title: 'code-name' }), names).summary).toBe('PRF192 · Lập trình C')
    expect(classEvent(s, prefs({ title: 'name-code' }), names).summary).toBe('Lập trình C (PRF192)')
    expect(classEvent(session({ code: 'SWE201' }), prefs({ title: 'name-code' }), names).summary).toBe('SWE201')
    expect(classEvent(session({ group: '' }), prefs(), names).summary).toBe('PRF192')
  })

  it('puts the chosen details in the description and the room in the location', () => {
    const all = prefs({ details: ['room', 'lecturer', 'slot', 'group', 'attendance'] })
    const e = classEvent(session({ scheduleType: 'Lab' }), all, names)
    expect(e.location).toBe('BE-301')
    expect(e.description).toBe('Lecturer: abc\nSlot 1\nGroup: SE1\nAttendance: Present\nLab')
    expect(classEvent(session({ online: true, room: null }), all, names).location).toBe('Online')
    const none = classEvent(session(), prefs({ details: [] }), names)
    expect(none.location).toBeNull()
    expect(none.description).toBe('')
  })

  it('writes alarms at the chosen offsets', () => {
    expect(classEvent(session(), prefs(), names).alarms.flat()).toContain('TRIGGER:-PT15M')
    expect(classEvent(session(), prefs({ classReminder: 60 }), names).alarms.flat()).toContain('TRIGGER:-PT1H')
    expect(classEvent(session(), prefs({ classReminder: null }), names).alarms).toEqual([])
    const ex = examEvent(exam(), prefs({ examReminders: [2880, 30] }), names).alarms.flat()
    expect(ex).toContain('TRIGGER:-P2D')
    expect(ex).toContain('TRIGGER:-PT30M')
    expect(examEvent(exam(), prefs({ examReminders: null }), names).alarms).toEqual([])
    expect([offsetText(15), offsetText(60), offsetText(1440), offsetText(120)]).toEqual(['15 minutes', '1 hour', '1 day', '2 hours'])
  })

  it('starts exam titles with the type and carries format and results', () => {
    const e = examEvent(exam(), prefs(), names)
    expect(e.summary).toBe('FE PRF192')
    expect(e.location).toBe('R1')
    expect(e.description).toBe('Format: Multiple choice\nResults: 2026-10-30')
    expect(examEvent(exam(), prefs({ title: 'code-name' }), names).summary).toBe('FE PRF192 · Lập trình C')
    expect(examEvent(exam(), prefs({ title: 'name-code' }), names).summary).toBe('FE Lập trình C (PRF192)')
    expect(examEvent(EXAMS[3]!, prefs({ title: 'name-code' }), names).summary).toBe('PT SWE201')
    expect(examEvent(exam(), prefs({ details: ['room'] }), names).description).toBe('')
  })

  it('keeps the UID when the title format or details change', async () => {
    const a = await buildIcs([classEvent(session(), prefs(), names)], NOW)
    const b = await buildIcs([classEvent(session(), prefs({ title: 'name-code', details: [] }), names)], NOW)
    expect(a.match(/UID:.*/)![0]).toBe(`UID:${await sha1('PRF192|2026-10-05|07:30')}@fap-aio`)
    expect(b.match(/UID:.*/)![0]).toBe(a.match(/UID:.*/)![0])
    const x = await buildIcs([examEvent(exam(), prefs(), names)], NOW)
    expect(x).toContain(`UID:${await sha1('PRF192|2026-10-20|10:50|FE')}@fap-aio`)
  })
})

describe('export form', () => {
  let c: FakeChrome
  let el: HTMLDivElement
  let root: Root
  const download = vi.fn()
  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 10)) })
  const mount = async () => {
    root = createRoot(el)
    act(() => root.render(<ExportView now={() => NOW} download={download} />))
    await flush()
  }
  const byText = (sel: string, t: RegExp) => [...el.querySelectorAll<HTMLElement>(sel)].find((b) => t.test(b.textContent ?? ''))!
  const dl = () => byText('button', /^Download/)
  const check = (t: RegExp) => byText('label', t).querySelector('input')!

  beforeEach(async () => {
    c = installFakeChrome()
    download.mockReset()
    document.body.innerHTML = ''
    el = document.createElement('div')
    document.body.appendChild(el)
    await c.storage.local.set({
      timetable: { schemaVersion: 1, updatedAt: 0, data: { sessions: SESSIONS, weeks: {}, lastSync: 1 } },
      exams: { schemaVersion: 1, updatedAt: 0, data: { exams: EXAMS, lastSync: 1 } },
    })
  })

  it('draws the agreed groups, the term with its dates, a preview and the pinned download', async () => {
    await mount()
    expect([...el.querySelectorAll('legend')].map((l) => l.textContent)).toEqual(
      ['1What to export', '2Date range', '3Classes', '4Exams', '5Event title', '6Event details', '7Reminders', '8Preview'])
    expect(byText('button', /^Fall 2026$/).getAttribute('aria-pressed')).toBe('true')
    expect(el.textContent).toContain('01 Sep 2026 to 31 Dec 2026')
    expect(el.textContent).toContain('3 classes and 1 exam')
    expect(el.textContent).toContain('PRF192 (SE1)Mon 5 Oct, 07:30–09:00 · BE-301Lecturer: abc · Slot 1')
    expect(dl().textContent).toBe('Download .ics (4 events)')
    expect(dl().parentElement!.className).toContain('sticky bottom-0')
    act(() => root.unmount())
  })

  it('downloads one file, or one file each, and follows the filters', async () => {
    await mount()
    await act(async () => { dl().click(); await new Promise((r) => setTimeout(r, 20)) })
    expect(download.mock.calls.map((a) => a[1])).toEqual(['fap-schedule-2026-10-07.ics'])
    const text = download.mock.calls[0]![2] as string
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(4)
    expect(el.querySelector('[role="status"]')!.textContent).toContain('with 4 events')

    act(() => byText('label', /^One file each$/).querySelector('input')!.click())
    expect(dl().textContent).toBe('Download 2 .ics files (4 events)')
    download.mockReset()
    await act(async () => { dl().click(); await new Promise((r) => setTimeout(r, 20)) })
    expect(download.mock.calls.map((a) => a[1])).toEqual(['fap-classes-2026-10-07.ics', 'fap-exams-2026-10-07.ics'])

    act(() => byText('button', /^PRF192$/).click())
    act(() => byText('button', /^Exams$/).click())
    expect(el.textContent).toContain('1 class')
    expect(dl().textContent).toBe('Download .ics (1 event)')
    act(() => byText('button', /^Classes$/).click())
    expect(dl().disabled).toBe(true)
    expect(el.textContent).toContain('Nothing matches these options.')
    act(() => root.unmount())
  })

  it('remembers the options only while the box is ticked', async () => {
    await mount()
    act(() => byText('button', /^This week$/).click())
    expect(c.storage.local.data['export.prefs']).toBeUndefined()
    act(() => check(/Remember my choices/).click())
    await flush()
    expect((c.storage.local.data['export.prefs'] as { data: ExportPrefs }).data).toMatchObject({ range: 'week', remember: true })
    act(() => root.unmount())

    await mount()
    expect(byText('button', /^This week$/).getAttribute('aria-pressed')).toBe('true')
    expect(check(/Remember my choices/).checked).toBe(true)
    act(() => check(/Remember my choices/).click())
    await flush()
    expect(c.storage.local.data['export.prefs']).toBeUndefined()
    act(() => root.unmount())
  })
})
