// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { TZID, download, escapeText, examsForExport, examsIcs, filterSessions, fold, sessionsIcs, sha1 } from '../src/features/scheduler/ics'
import type { Exam, Session } from '../src/features/scheduler/types'

const session = (p: Partial<Session> = {}): Session => ({
  id: 'PRF192|2026-10-05|07:30', date: '2026-10-05', slot: 1, start: '07:30', end: '09:00', code: 'PRF192', group: 'SE1', room: 'BE-301',
  lecturer: 'abc', online: false, scheduleType: null, attendance: 'not-yet', syncedAt: 1, ...p,
})
const exam = (p: Partial<Exam> = {}): Exam => ({
  id: 'PRF192|FE|2026-10-20', date: '2026-10-20', start: '10:50', end: '12:20', room: 'R1', code: 'PRF192', name: 'Lập trình, cơ bản; C',
  type: 'FE', typeRaw: 'FE', format: null, publishDate: null, attendanceNote: '', note: '', past: false, syncedAt: 1, ...p,
})
const unfold = (ics: string) => ics.replace(/\r\n /g, '')
const NOW = Date.parse('2026-10-07T02:00:00Z')

describe('ics exporter', () => {
  it('escapes text values', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('folds at 75 octets without splitting Vietnamese characters', () => {
    const line = `SUMMARY:${'Đường lối cách mạng của Đảng Cộng sản Việt Nam '.repeat(4)}`
    const folded = fold(line)
    const parts = folded.split('\r\n')
    const enc = new TextEncoder()
    expect(parts.length).toBeGreaterThan(2)
    for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75)
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    expect(parts.every((p) => !p.includes('�'))).toBe(true)
    expect(unfold(folded)).toBe(line)
    expect(fold('short')).toBe('short')
  })

  it('writes classes with TZID, a stable UID, CRLF and optional alarms', async () => {
    const ics = await sessionsIcs([session(), session({ id: 'x', code: 'SWE201', online: true, room: null })], { now: NOW })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true)
    expect(ics).toContain(`BEGIN:VTIMEZONE\r\nTZID:${TZID}\r\n`)
    expect(ics).toContain('TZOFFSETTO:+0700')
    expect(ics).toContain(`DTSTART;TZID=${TZID}:20261005T073000`)
    expect(ics).toContain(`DTEND;TZID=${TZID}:20261005T090000`)
    expect(ics).toContain('DTSTAMP:20261007T020000Z')
    expect(ics).toContain(`UID:${await sha1('PRF192|2026-10-05|07:30')}@fap-aio`)
    expect(ics).toContain('SUMMARY:PRF192 (SE1)')
    expect(ics).toContain('LOCATION:Online')
    expect(ics).not.toContain('VALARM')
    const again = await sessionsIcs([session({ room: 'AL-102', attendance: 'present' })], { now: NOW + 1000 })
    expect(again.match(/UID:.*/)![0]).toBe(ics.match(/UID:.*/)![0])
    const withAlarm = await sessionsIcs([session()], { now: NOW, reminders: { classOffsetMin: 30 } })
    expect(withAlarm).toContain('BEGIN:VALARM\r\nACTION:DISPLAY')
    expect(withAlarm).toContain('TRIGGER:-PT30M')
  })

  it('filters classes by online flag', () => {
    const list = [session(), session({ id: 'o', online: true })]
    expect(filterSessions(list, 'all')).toHaveLength(2)
    expect(filterSessions(list, 'online').map((s) => s.id)).toEqual(['o'])
    expect(filterSessions(list, 'offline').map((s) => s.id)).toEqual(['PRF192|2026-10-05|07:30'])
  })

  it('exports upcoming exams with a room, the type in the title, and two alarms', async () => {
    const list = examsForExport([exam(), exam({ id: 'b', date: '2026-10-01' }), exam({ id: 'c', room: null })], '2026-10-07')
    expect(list).toHaveLength(1)
    const ics = unfold(await examsIcs(list, { now: NOW, reminders: { classOffsetMin: 15 } }))
    expect(ics).toContain('SUMMARY:FE PRF192 Lập trình\\, cơ bản\\; C')
    expect(ics).toContain(`UID:${await sha1('PRF192|2026-10-20|10:50|FE')}@fap-aio`)
    expect(ics).toContain('TRIGGER:-P1D')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics).toContain('LOCATION:R1')
  })
})

describe('blob download', () => {
  it('clicks a download link inside the given container', () => {
    const shadow = document.createElement('div').attachShadow({ mode: 'open' })
    const clicked: HTMLAnchorElement[] = []
    URL.createObjectURL = vi.fn(() => 'blob:x')
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this) })
    download(shadow, 'a.ics', 'BEGIN:VCALENDAR')
    expect(clicked[0]!.download).toBe('a.ics')
    expect(clicked[0]!.getAttribute('href')).toBe('blob:x')
    expect(clicked[0]!.getRootNode()).not.toBe(shadow) // removed after the click
    expect(document.querySelector('a[download]')).toBeNull()
    spy.mockRestore()
  })
})
