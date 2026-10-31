// @vitest-environment happy-dom
// Export options, selection, events and the Export form (core R9.1 to R9.12, revised 2026-10-31).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { buildIcs, buildTitle, classEvent, examEvent, offsetText, sha1 } from '../src/features/scheduler/ics'
import {
  DEFAULT_PREFS, exportPrefsV1toV2, longDate, parsePrefs, rangeBounds, selectForExport, subjectNames, subjectsInRange, termName, type ExportPrefs,
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

  it('reads stored options, falls back to the defaults, and migrates version 1', () => {
    const p = prefs({ classTitle: { pieces: ['name', 'code'], sep: ' | ' }, excludedSubjects: ['PRF192'], remember: true })
    expect(parsePrefs(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(parsePrefs({ title: 'nope' })).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    const v1 = { ...DEFAULT_PREFS, split: true, title: 'code-name', classReminder: 30, examReminders: [1440, 60], range: 'week', remember: true }
    for (const k of ['files', 'classTitle', 'examTitle', 'classReminders', 'categories'] as const) delete (v1 as Record<string, unknown>)[k]
    expect(exportPrefsV1toV2(v1)).toEqual({ ...DEFAULT_PREFS, files: 'separate', classTitle: { pieces: ['code', 'name'], sep: ' · ' }, classReminders: [30], examReminders: [60, 1440], range: 'week', remember: true })
    expect(exportPrefsV1toV2({ ...v1, split: false, classReminder: null, examReminders: null }).classReminders).toEqual([])
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

  it('builds titles from pieces, leaving out empty ones', () => {
    const s = session()
    expect(classEvent(s, prefs(), names).summary).toBe('BE-301 - PRF192')
    expect(classEvent(session({ online: true, room: null }), prefs(), names).summary).toBe('Online - PRF192')
    expect(classEvent(s, prefs({ classTitle: { pieces: ['code', 'name'], sep: ' · ' } }), names).summary).toBe('PRF192 · Lập trình C')
    expect(classEvent(s, prefs({ classTitle: { pieces: ['time', 'room', 'code', 'group', 'slot', 'lecturer'], sep: ' | ' } }), names).summary).toBe('07:30 | BE-301 | PRF192 | SE1 | Slot 1 | abc')
    expect(classEvent(session({ code: 'SWE201' }), prefs({ classTitle: { pieces: ['name'], sep: ' - ' } }), names).summary).toBe('SWE201')
    expect(classEvent(s, prefs({ classTitle: { pieces: [], sep: ' - ' } }), names).summary).toBe('PRF192')
    expect(buildTitle({ pieces: ['a', 'b'], sep: ' - ' }, (k) => (k === 'a' ? '' : 'B'), 'X')).toBe('B')
  })

  it('writes the details in the chosen order, the room as location, and the category', () => {
    const all = prefs({ details: ['group', 'room', 'attendance', 'lecturer', 'slot'] })
    const e = classEvent(session({ scheduleType: 'Lab' }), all, names)
    expect(e.location).toBe('BE-301')
    expect(e.description).toBe('Group: SE1\nAttendance: Present\nLecturer: abc\nSlot 1\nLab')
    expect(e.category).toBe('Class')
    const on = classEvent(session({ online: true, room: null }), all, names)
    expect([on.location, on.category]).toEqual(['Online', 'Online class'])
    const none = classEvent(session(), prefs({ details: [], categories: { offline: '', online: '', exam: '' } }), names)
    expect([none.location, none.description, none.category]).toEqual([null, '', null])
  })

  it('writes one alarm per reminder tier', () => {
    const cl = classEvent(session(), prefs(), names).alarms.map((a) => a.find((l) => l.startsWith('TRIGGER')))
    expect(cl).toEqual(['TRIGGER:-PT15M', 'TRIGGER:-PT2H', 'TRIGGER:-P1D'])
    const ex = examEvent(exam(), prefs(), names).alarms.map((a) => a.find((l) => l.startsWith('TRIGGER')))
    expect(ex).toEqual(['TRIGGER:-PT30M', 'TRIGGER:-PT2H', 'TRIGGER:-P1D'])
    expect(classEvent(session(), prefs({ classReminders: [] }), names).alarms).toEqual([])
    expect(examEvent(exam(), prefs({ examReminders: [10080, 90] }), names).alarms.flat()).toEqual(expect.arrayContaining(['TRIGGER:-P7D', 'TRIGGER:-PT90M']))
    expect([offsetText(15), offsetText(60), offsetText(1440), offsetText(120)]).toEqual(['15 minutes', '1 hour', '1 day', '2 hours'])
  })

  it('titles exams with room, type and code by default, and carries format, results and the category', () => {
    const e = examEvent(exam(), prefs(), names)
    expect(e.summary).toBe('R1 - FE - PRF192')
    expect(examEvent(exam({ room: null }), prefs(), names).summary).toBe('FE - PRF192')
    expect(examEvent(exam(), prefs({ examTitle: { pieces: ['type', 'code', 'name'], sep: ' · ' } }), names).summary).toBe('FE · PRF192 · Lập trình C')
    expect(examEvent(EXAMS[3]!, prefs(), names).summary).toBe('R2 - PT - SWE201')
    expect(e.location).toBe('R1')
    expect(e.description).toBe('Format: Multiple choice\nResults: 2026-10-30')
    expect(examEvent(exam(), prefs({ details: ['results', 'format'] }), names).description).toBe('Results: 2026-10-30\nFormat: Multiple choice')
    expect(e.category).toBe('Exam')
  })

  it('shows rooms with their site in titles and locations', () => {
    const c = classEvent(session({ room: 'NVH 302' }), prefs(), names)
    expect([c.summary, c.location]).toEqual(['NVH.302 - PRF192', 'NVH.302'])
    expect(classEvent(session({ room: 'P.011' }), prefs(), names).summary).toBe('P.011 - PRF192')
    const e = examEvent(exam({ room: '011' }), prefs(), names)
    expect([e.summary, e.location]).toEqual(['P.011 - FE - PRF192', 'P.011'])
  })

  it('keeps the UID when the title or details change, and writes CATEGORIES', async () => {
    const a = await buildIcs([classEvent(session(), prefs(), names)], NOW)
    const b = await buildIcs([classEvent(session(), prefs({ classTitle: { pieces: ['name', 'code'], sep: ' | ' }, details: [] }), names)], NOW)
    expect(a.match(/UID:.*/)![0]).toBe(`UID:${await sha1('PRF192|2026-10-05|07:30')}@fap-aio`)
    expect(b.match(/UID:.*/)![0]).toBe(a.match(/UID:.*/)![0])
    expect(a).toContain('CATEGORIES:Class\r\n')
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
    expect(el.textContent).toContain('2 offline classes, 1 online class and 1 exam')
    expect(el.textContent).toContain('BE-301 - PRF192Mon 5 Oct, 07:30–09:00 · BE-301Lecturer: abc · Slot 1Category: Class')
    expect(el.textContent).toContain('R1 - FE - PRF192Tue 20 Oct, 10:50–12:20 · R1')
    expect(check(/^Room - Code \(/).checked).toBe(true)
    expect(check(/^Room - Exam type - Code \(/).checked).toBe(true)
    expect(el.textContent).toContain('15 minutes before×2 hours before×1 day before×')
    expect(el.textContent).toContain('30 minutes before×2 hours before×1 day before×')
    expect(dl().textContent).toBe('Download 3 .ics files (4 events)')
    expect(dl().parentElement!.className).toContain('sticky bottom-0')
    act(() => root.unmount())
  })

  it('downloads separate files for offline classes, online classes and exams, or one file', async () => {
    await mount()
    await act(async () => { dl().click(); await new Promise((r) => setTimeout(r, 20)) })
    expect(download.mock.calls.map((a) => a[1])).toEqual(['fap-classes-offline-2026-10-07.ics', 'fap-classes-online-2026-10-07.ics', 'fap-exams-2026-10-07.ics'])
    expect(download.mock.calls.map((a) => ((a[2] as string).match(/BEGIN:VEVENT/g) ?? []).length)).toEqual([2, 1, 1])
    expect(download.mock.calls[1]![2]).toContain('CATEGORIES:Online class')
    expect(el.querySelector('[role="status"]')!.textContent).toContain('each file into its own calendar')

    act(() => check(/^One file$/).click())
    expect(dl().textContent).toBe('Download .ics (4 events)')
    download.mockReset()
    await act(async () => { dl().click(); await new Promise((r) => setTimeout(r, 20)) })
    expect(download.mock.calls.map((a) => a[1])).toEqual(['fap-schedule-2026-10-07.ics'])

    act(() => byText('button', /^PRF192$/).click())
    act(() => byText('button', /^Exams$/).click())
    expect(dl().textContent).toBe('Download .ics (1 event)')
    act(() => byText('button', /^Classes$/).click())
    expect((dl() as HTMLButtonElement).disabled).toBe(true)
    expect(el.textContent).toContain('Nothing matches these options.')
    act(() => root.unmount())
  })

  it('edits a custom title, the detail order and the reminder tiers', async () => {
    await mount()
    const btn = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
    act(() => check(/^Custom \(BE-301 - PRF192\)/).click())
    act(() => byText('button', /^\+ Subject name$/).click())
    act(() => btn('Move Room right').click())
    const sep = el.querySelector<HTMLSelectElement>('select[aria-label="Classes separator"]')!
    act(() => { sep.value = ' | '; sep.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(el.textContent).toContain('PRF192 | BE-301 | Lập trình CMon 5 Oct')

    act(() => btn('Move Slot left').click())
    expect(el.textContent).toContain('Slot 1 · Lecturer: abc')

    act(() => btn('Remove Classes reminder 2 hours').click())
    const amount = el.querySelector<HTMLInputElement>('input[aria-label="Classes reminder amount"]')!
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(amount, '45'); amount.dispatchEvent(new Event('input', { bubbles: true })) })
    const unit = el.querySelector<HTMLSelectElement>('select[aria-label="Classes reminder unit"]')!
    act(() => { unit.value = '1'; unit.dispatchEvent(new Event('change', { bubbles: true })) })
    act(() => [...el.querySelectorAll('button')].filter((b) => b.textContent === 'Add')[0]!.click())
    expect(el.textContent).toContain('15 minutes before×45 minutes before×1 day before×')
    act(() => [...el.querySelectorAll('button')].filter((b) => b.textContent === 'Add')[0]!.click())
    expect(el.textContent).toContain('15 minutes before×45 minutes before×')

    await act(async () => { dl().click(); await new Promise((r) => setTimeout(r, 20)) })
    const ics = (download.mock.calls[0]![2] as string).replace(/\r\n /g, '')
    expect(ics).toContain('SUMMARY:PRF192 | BE-301 | Lập trình C')
    expect(ics).toContain('TRIGGER:-PT45M')
    expect(ics).not.toContain('TRIGGER:-PT2H')
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
