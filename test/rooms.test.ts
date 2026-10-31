// Rooms with their site (core R8.9, R9.14; fix F-8).
import { describe, expect, it } from 'vitest'
import { siteRoom } from '../src/features/scheduler/rooms'

describe('siteRoom', () => {
  it('names the site for every form FAP writes', () => {
    expect(siteRoom('P.011')).toBe('P.011') // timetable, campus
    expect(siteRoom('011')).toBe('P.011') // exam list, campus
    expect(siteRoom('NVH 302')).toBe('NVH.302') // timetable, Nhà Văn hóa Sinh viên
  })

  it('accepts spacing, case and suffix variants', () => {
    expect(siteRoom(' p 307a ')).toBe('P.307A')
    expect(siteRoom('P307')).toBe('P.307')
    expect(siteRoom('nvh.308')).toBe('NVH.308')
    expect(siteRoom('NVH308')).toBe('NVH.308')
  })

  it('leaves other texts and missing rooms alone', () => {
    expect(siteRoom('Online')).toBe('Online')
    expect(siteRoom('BE-301')).toBe('BE-301')
    expect(siteRoom('Lab 1')).toBe('Lab 1')
    expect(siteRoom('12345')).toBe('12345')
    expect(siteRoom(null)).toBeNull()
  })
})
