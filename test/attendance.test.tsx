// @vitest-environment happy-dom
// GRD-7.4: attendance in Grades (grades R16.1 to R16.7): the parser on the fixtures and on synthetic sheets
// with absences, an unknown status and the summary fallback; the absence figures and risk; the Attendance
// view, its term switch and CSV; the chip on the Courses cards; the print section.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

const raw = (n: string) => readFileSync(`test/fixtures/${n}`, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')
const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const requests: string[] = []
const pages = new Map<string, string>()
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => {
    requests.push(route)
    const html = pages.get(route)
    if (!html) return { ok: false, error: { kind: 'network', message: 'x' } }
    return { ok: true, value: new DOMParser().parseFromString(html, 'text/html'), fetchedAt: Date.now() }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { parseAttendance, parseAttendanceSheet, summaryCounts } = await import('../src/features/grades/parse/attendance')
const { absenceInfo, attendanceCsv, leftText, loadAttendance, resetAttendance, attendanceEntry } = await import('../src/features/grades/attendance')
const { AttendanceView } = await import('../src/features/grades/views/AttendanceView')
const { CoursesView } = await import('../src/features/grades/views/CoursesView')
const { registerGradeSources } = await import('../src/features/grades/sources')
const { resetCourses } = await import('../src/features/grades/courses')
const { LayoutChangedError } = await import('../src/content/fap/registry')
const { GradeListDoc } = await import('../src/pages/print/PrintPage')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
async function render(node: JSX.Element) {
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  await act(async () => { createRoot(el).render(node) })
  await wait(20); await wait(20)
  return el
}

const set490 = raw('en/attendance-set490.partial.html')
/** set490 with the first three sessions absent and the fourth in a status FAP-AIO does not know. */
const withAbsences = (() => {
  let n = 0
  return set490.replace(/attendance-status--present/g, () => (++n <= 3 ? 'attendance-status--absent' : 'attendance-status--late'))
})()

describe('parseAttendance', () => {
  it('reads terms, courses and the selected course on the en page (all sessions exempt)', () => {
    const p = parseAttendance(doc(raw('en/attendance.html')))
    expect(p.terms.map((t) => t.name)).toEqual(['Fall2026', 'Summer2026', 'Spring2026'])
    expect(p.selectedTermId).toBe(p.terms[0]!.id)
    expect(p.courses.map((c) => c.code)).toEqual(['RSE663', 'ACT707', 'LMO352', 'MRS083'])
    expect(p.selectedCourseId).toBe(p.courses[0]!.id)
    expect(p.sheet!.counts).toEqual({ attended: 0, absent: 0, notYet: 0, exempt: 10, unknown: 0, total: 10 })
    expect(p.sheet!.sessions[0]).toMatchObject({ index: 1, date: 'Wednesday 07/10/2026', slot: '15:00 - 17:15', status: 'exempt' })
  })

  it('counts present and not-yet sessions in en and vi alike', () => {
    for (const f of ['en/attendance-set490.partial.html', 'vi/attendance-set490.partial.html']) {
      const s = parseAttendanceSheet(doc(raw(f)))
      expect([f, s.counts]).toEqual([f, { attended: 4, absent: 0, notYet: 11, exempt: 0, unknown: 0, total: 15 }])
      expect(s.fromSummary).toBe(false)
    }
  })

  it('counts absences and keeps an unknown status raw', () => {
    const s = parseAttendanceSheet(doc(withAbsences))
    expect(s.counts).toEqual({ attended: 0, absent: 3, notYet: 11, exempt: 0, unknown: 1, total: 15 })
    expect(s.sessions.find((x) => typeof x.status === 'object')!.status).toEqual({ raw: expect.any(String) })
  })

  it('falls back to the summary line when the table cannot be read', () => {
    const noTable = set490.replace(/<table[\s\S]*<\/table>/, '').replace(/Absent 0% \(0\/15/, 'Absent 13% (2/15')
    const s = parseAttendanceSheet(doc(noTable))
    expect(s.fromSummary).toBe(true)
    expect(s.counts).toEqual({ attended: 2, absent: 2, notYet: 11, exempt: 0, unknown: 0, total: 15 })
    expect(summaryCounts('Vắng 10% (2/20 buổi), còn 5 buổi chưa điểm danh.')).toEqual({ attended: 13, absent: 2, notYet: 5, exempt: 0, unknown: 0, total: 20 })
    expect(() => parseAttendanceSheet(doc('<div class="content-page"></div>'))).toThrow(LayoutChangedError)
    expect(parseAttendanceSheet(doc('<div class="fap-empty-state">No sessions</div>')).counts.total).toBe(0)
  })
})

describe('absence figures', () => {
  const k = (absent: number, total = 20) => ({ attended: total - absent, absent, notYet: 0, exempt: 0, unknown: 0, total })
  it('follows the 20% limit and the INF-2.1 levels', () => {
    expect(absenceInfo(k(2), null)).toMatchObject({ percent: 10, limit: 20, risk: { allowed: 4, left: 2, level: 'safe' } })
    expect(absenceInfo(k(3), null)!.risk.level).toBe('warning')
    expect(absenceInfo(k(4), 80)!.risk.level).toBe('last-chance')
    expect(absenceInfo(k(5), 80)!.risk.level).toBe('failed')
    expect(leftText(absenceInfo(k(5), 80)!.risk)).toBe('1 absence over the limit')
    expect(absenceInfo(k(1), 100)).toMatchObject({ limit: 0, risk: { level: 'failed' } }) // FOM210-style 100% syllabi
    expect(absenceInfo(k(0, 0), null)).toBeNull()
  })
})

describe('the Attendance view', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    resetAttendance()
    resetCourses()
    registerGradeSources()
    requests.length = 0
    pages.clear()
    c.runtime.onMessage.addListener((m: { type: string; codes?: string[] }, _s: unknown, respond: (r: unknown) => void) => {
      if (m.type !== 'data.rules') return false
      respond({ ok: true, value: { dataVersion: 1, scrapedAt: '2026-10-10T16:03:12.457Z', rules: {}, subjects: Object.fromEntries((m.codes ?? []).map((x) => [x, null])) } })
      return false
    })
    const page = parseAttendance(doc(raw('en/attendance.html')))
    pages.set('/Report/Attendance', raw('en/attendance.html'))
    for (const t of page.terms) pages.set(`/Report/Attendance?termId=${t.id}`, raw('en/attendance-term-su26.html'))
    const su26 = parseAttendance(doc(raw('en/attendance-term-su26.html')))
    for (const x of [...page.courses, ...su26.courses]) pages.set(`/Report/Attendance?termId=${x.termId}&courseId=${x.id}`, x.code === 'LMO352' ? withAbsences : set490)
  })

  it('lists the current term, reads courses one at a time, switches terms and exports CSV', async () => {
    const el = await render(<AttendanceView />)
    await wait(30)
    expect(requests[0]).toBe('/Report/Attendance')
    expect(requests.slice(1).every((r) => r.includes('&courseId='))).toBe(true)
    expect(el.querySelectorAll('[data-attendance]')).toHaveLength(4)
    const lmo = el.querySelector(`[data-attendance] .text-\\[13px\\]`)
    expect(lmo).not.toBeNull()
    expect(el.textContent).toContain('Absent 20% of 20% allowed')
    expect(el.textContent).toContain('No absence left')
    expect(el.textContent).toContain('Last chance')
    expect(el.textContent).toContain('1 session has a status FAP-AIO does not know')
    const sel = el.querySelector('select') as HTMLSelectElement
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Fall2026', 'Summer2026', 'Spring2026'])
    requests.length = 0
    await act(async () => { sel.value = sel.options[1]!.value; sel.dispatchEvent(new Event('change', { bubbles: true })) })
    await wait(30)
    expect(requests[0]).toBe(`/Report/Attendance?termId=${sel.options[1]!.value}`)
    expect(el.querySelectorAll('[data-attendance]')).toHaveLength(5)
    expect(sel.value).toBe(sel.options[1]!.value)
    let csv = ''
    Object.defineProperty(URL, 'createObjectURL', { value: (b: Blob) => { void b.text().then((t) => { csv = t }); return 'blob:x' }, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await act(async () => { ([...el.querySelectorAll('button')].find((b) => b.textContent === 'Export CSV') as HTMLButtonElement).click() })
    await wait(10)
    click.mockRestore()
    expect(csv.startsWith('﻿FAP-AIO attendance export\r\nTerm,Summer2026\r\n')).toBe(true)
    expect(csv).toContain('Subject code,Subject name,Attended,Absent,Not yet,Exempt,Unknown status,Total,Absent %,Allowed absent %,Absences left,Level')
    expect(csv.trim().split('\r\n')).toHaveLength(6 + 5)
  })

  it('shows the absence chip on the Courses cards', async () => {
    const att = parseAttendance(doc(raw('en/attendance.html')))
    const t = att.terms[0]!
    pages.set('/Report/Grade', `<div class="content-page"><select id="grade-report-term"><option value="${t.id}" selected>${t.name}</option></select><select id="grade-report-course">${att.courses.map((x) => `<option value="${x.id}" data-report-term-id="${t.id}">${x.label}</option>`).join('')}</select></div>`)
    for (const x of att.courses) pages.set(`/Report/Grade?termId=${t.id}&courseId=${x.id}`, raw('en/grade-default.partial.html'))
    const el = await render(<CoursesView />)
    await wait(50)
    const lmo = att.courses.find((x) => x.code === 'LMO352')!
    expect(attendanceEntry(lmo.id)?.sheet?.counts.absent).toBe(3)
    const card = el.querySelector(`[data-course="${lmo.id}"]`)!
    expect(card.textContent).toContain('Absent 20%')
    expect(requests.filter((r) => r.startsWith('/Report/Attendance?'))).toHaveLength(4) // one per course, after the mark sheets
  })

  it('a term read twice within the cache lifetime costs no request', async () => {
    await loadAttendance()
    requests.length = 0
    await loadAttendance()
    expect(requests).toEqual([])
  })

  it('writes Not read for a course without attendance in the CSV', () => {
    const ref = { id: 'x', termId: 't', label: 'Name (ABC101) (G1)', code: 'ABC101' }
    expect(attendanceCsv('Fall2026', [{ ref, sheet: null, minPercent: null }])).toContain('ABC101,Name,,,,,,,,,,Not read')
  })
})

describe('the print section', () => {
  it('lists the courses with attendance per term', async () => {
    const counts = { attended: 10, absent: 2, notYet: 3, exempt: 0, unknown: 0, total: 15 }
    const list = { student: null, curriculum: null, nonGpa: [], cumulative: { ten: null, four: null, credits: 0 }, terms: [{ name: 'Fall2026', gpa: { ten: null, four: null, credits: 0 }, cumulative: { ten: null, four: null, credits: 0 }, courses: [
      { code: 'ABC101', name: 'Name', credits: 3, grade: null, letter: null, points: null, status: 'In progress', counted: false, average: null, sheetStatus: null, components: [], attendance: counts, absentPercent: (2 / 15) * 100 },
    ] }] }
    const el = await render(<GradeListDoc list={list} scale="10" components={false} attendance now={new Date('2026-11-22')} />)
    const sec = el.querySelector('section[aria-label="Attendance"]')!
    expect(sec.textContent).toContain('ABC101')
    expect(sec.textContent).toContain('13.3%')
    const none = await render(<GradeListDoc list={list} scale="10" components={false} now={new Date('2026-11-22')} />)
    expect(none.querySelector('section[aria-label="Attendance"]')).toBeNull()
  })
})
