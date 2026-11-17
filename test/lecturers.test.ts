// INF-2.3: lecturer directory (info R3.1 to R3.3, R3.6, R3.7).
import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome } from './helpers/fake-chrome'
import { buildDirectory, isShortcode, readInfoUser, setLecturerNote, sightingsFromSessions, withNotes, type Sighting } from '../src/features/info/lecturers'
import type { Session } from '../src/features/scheduler/types'

const s = (lecturer: string | null, code: string, group: string, date: string): Sighting => ({ lecturer, code, group, date })

describe('lecturer directory', () => {
  it('merges shortcodes case-insensitively with the latest casing, subjects, groups and last date', () => {
    const dir = buildDirectory([
      s('anhnd3', 'PRF192', 'SE1', '2026-09-01'),
      s('AnhND3', 'PRF192', 'SE1', '2026-10-05'),
      s('ANHND3', 'CSD201', 'SE2', '2026-09-20'),
      s(' TuanVM ', 'MAE101', 'SE1', '2026-10-01'),
      s(null, 'X', 'Y', '2026-10-01'),
      s('', 'X', 'Y', '2026-10-01'),
    ])
    expect(dir.map((l) => [l.key, l.display, l.lastSeen, l.subjects])).toEqual([
      ['anhnd3', 'AnhND3', '2026-10-05', [{ code: 'PRF192', group: 'SE1' }, { code: 'CSD201', group: 'SE2' }]],
      ['tuanvm', 'TuanVM', '2026-10-01', [{ code: 'MAE101', group: 'SE1' }]],
    ])
    expect(dir[0]!.emails).toEqual(['AnhND3@fe.edu.vn', 'AnhND3@fpt.edu.vn'])
  })

  it('derives addresses only for values that look like a shortcode', () => {
    expect(['AnhND3', 'anhnd3', 'TuanVM', 'HoaNT'].map(isShortcode)).toEqual([true, true, true, true])
    expect(['Nguyen Van A', 'Anh', 'anh.nd', 'AnhND3x', '123', 'Tba'].map(isShortcode)).toEqual([false, false, false, false, false, false])
    const [bad] = buildDirectory([s('Nguyen Van A', 'PRF192', 'SE1', '2026-10-01')])
    expect([bad!.validShortcode, bad!.emails]).toEqual([false, []])
  })

  it('reads sightings from synced sessions', () => {
    const session = { id: 'x', date: '2026-10-07', slot: 1, start: '07:30', end: '09:00', code: 'PRF192', group: 'SE1', room: null, lecturer: 'AnhND3', online: false, scheduleType: null, attendance: 'present', syncedAt: 1 } as Session
    expect(sightingsFromSessions([session])).toEqual([{ lecturer: 'AnhND3', code: 'PRF192', group: 'SE1', date: '2026-10-07' }])
  })
})

describe('local notes', () => {
  beforeEach(() => { installFakeChrome() })

  it('store a display name and note per lecturer, and clear them when emptied', async () => {
    await setLecturerNote('AnhND3', { displayName: 'Thầy Anh', note: '  Office hours Tue  ' })
    expect((await readInfoUser()).lecturerNotes).toEqual({ anhnd3: { displayName: 'Thầy Anh', note: 'Office hours Tue' } })
    const dir = withNotes(buildDirectory([s('AnhND3', 'PRF192', 'SE1', '2026-10-01')]), (await readInfoUser()).lecturerNotes)
    expect(dir[0]).toMatchObject({ name: 'Thầy Anh', note: 'Office hours Tue' })
    await setLecturerNote('anhnd3', { displayName: ' ', note: '' })
    expect((await readInfoUser()).lecturerNotes).toEqual({})
  })
})
