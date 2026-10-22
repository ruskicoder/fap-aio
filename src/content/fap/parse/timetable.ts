// Weekly timetable partial parser (core R2.5, R6.4, R6.5, R6.8, R6.10). Located by class and
// icon, never by the localized title attributes.
import { LayoutChangedError, type Params } from '../registry'
import { attendanceOf } from './constants'
import { fromDmNear, mondayOf, parseTimeRange } from '../../../shared/dates'
import type { Session, WeekResult } from '../../../features/scheduler/types'

const clean = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
/** Text of the element that holds an icon, without the icon. */
const byIcon = (root: Element, icon: string) => {
  const i = root.querySelector(`i.${icon}`)
  return i ? clean(i.parentElement) : null
}

export function parseWeek(doc: Document, params: Params, now = Date.now()): WeekResult {
  const requested = mondayOf(params.referenceDate ?? '')
  const table = doc.querySelector('.weekly-timetable-grid table')
  if (!table) {
    if (doc.querySelector('.fap-empty-state')) return { monday: requested, empty: true, sessions: [], unreadable: 0 }
    throw new LayoutChangedError('no .weekly-timetable-grid table and no .fap-empty-state')
  }
  const heads = [...table.querySelectorAll('thead th')].slice(1)
  const dates = heads.map((th) => fromDmNear(clean(th), requested))
  if (dates.length !== 7 || dates.some((d) => d === null)) throw new LayoutChangedError('week header without seven dd/MM dates')
  const monday = dates[0]!
  if (monday !== requested) return { monday, empty: false, sessions: [], unreadable: 0, rejected: `response is the week of ${monday}, not ${requested}` }

  const sessions: Session[] = []
  let unreadable = 0
  ;[...table.querySelectorAll('tbody tr')].forEach((tr, rowIndex) => {
    const slotText = clean(tr.querySelector('th'))
    const slot = /^\d+$/.test(slotText) ? Number(slotText) : rowIndex + 1
    ;[...tr.querySelectorAll(':scope > td')].forEach((td, col) => {
      for (const title of td.querySelectorAll('.weekly-timetable-cell-title')) {
        const cell = title.closest('.position-relative') ?? td
        const [code = '', ...rest] = clean(title).split(' - ')
        const timeEl = cell.querySelector('i.ri-time-line')?.parentElement?.querySelector('span.fw-bold')
        const range = parseTimeRange(clean(timeEl))
        if (!range || !code) {
          unreadable++
          continue
        }
        const date = dates[col]!
        const statusEl = cell.querySelector('.weekly-timetable-attendance-status')
        const offline = !!cell.querySelector('i.ri-wifi-off-line')
        const online = !offline && (!!cell.querySelector('i.ri-wifi-line') || /^online$/i.test(byIcon(cell, 'ri-wifi-line') ?? ''))
        sessions.push({
          id: `${code}|${date}|${range[0]}`,
          date,
          slot,
          start: range[0],
          end: range[1],
          code,
          group: rest.join(' - '),
          room: byIcon(cell, 'ri-map-pin-line') || null,
          lecturer: byIcon(cell, 'ri-user-line') || null,
          online,
          scheduleType: byIcon(cell, 'ri-bookmark-line') || null,
          attendance: statusEl ? attendanceOf(clean(statusEl)) : { kind: 'unknown', raw: '' },
          syncedAt: now,
        })
      }
    })
  })
  return { monday, empty: false, sessions, unreadable }
}
