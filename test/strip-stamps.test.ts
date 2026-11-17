// F-13: the status strip reads a store's lastSync, or a registry cache's latest read.
import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome } from './helpers/fake-chrome'
import { syncedAt } from '../src/content/panel/StatusStrip'
import { write } from '../src/shared/storage/catalog'

describe('status strip stamps', () => {
  beforeEach(() => { installFakeChrome() })

  it('use lastSync, or the latest fetchedAt of a cache, or null', async () => {
    expect(await syncedAt('timetable')).toBeNull()
    await write('timetable', { sessions: [], weeks: {}, lastSync: 42 })
    expect(await syncedAt('timetable')).toBe(42)
    const now = Date.now()
    await write('cache:grades.markSheet', { entries: { a: { value: 1, fetchedAt: now - 5000 }, b: { value: 2, fetchedAt: now - 1000 } } })
    expect(await syncedAt('cache:grades.markSheet')).toBe(now - 1000)
    await write('cache:grades.transcript', { entries: {} })
    expect(await syncedAt('cache:grades.transcript')).toBeNull()
  })
})
