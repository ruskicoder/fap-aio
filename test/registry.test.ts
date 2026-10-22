import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

const queuedGet = vi.fn()
vi.mock('../src/content/fap/queue', () => ({ queuedGet: (...a: unknown[]) => queuedGet(...a) }))

const { register, read, peek, LayoutChangedError } = await import('../src/content/fap/registry')
const { ATTENDANCE, attendanceOf, normText } = await import('../src/content/fap/parse/constants')

const doc = (html: string) => ({ querySelector: (s: string) => (html.includes(s) ? {} : null) }) as unknown as Document

describe('source registry', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    queuedGet.mockReset()
    register({
      id: 'demo',
      route: (p) => `/Demo?x=${p.x ?? ''}`,
      partial: true,
      cacheTtlMs: 60_000,
      parse: (d) => {
        if (!d.querySelector('.ok')) throw new LayoutChangedError('missing .ok')
        return { n: 1 }
      },
    })
  })

  it('fetches through the queue, parses and caches per params', async () => {
    queuedGet.mockResolvedValue({ ok: true, value: doc('.ok'), fetchedAt: Date.now() })
    expect(await read('demo', { x: '1' })).toMatchObject({ ok: true, value: { n: 1 } })
    expect(queuedGet).toHaveBeenCalledWith('/Demo?x=1', { partial: true, source: 'demo', priority: 'user' })
    expect(await read('demo', { x: '1' })).toMatchObject({ ok: true, cached: true })
    expect(queuedGet).toHaveBeenCalledTimes(1)
    await read('demo', { x: '2' })
    expect(queuedGet).toHaveBeenCalledTimes(2)
    expect(Object.keys((c.storage.local.data['cache:demo'] as { data: { entries: object } }).data.entries)).toHaveLength(2)
  })

  it('force skips the cache', async () => {
    queuedGet.mockResolvedValue({ ok: true, value: doc('.ok'), fetchedAt: Date.now() })
    await read('demo')
    await read('demo', {}, { force: true })
    expect(queuedGet).toHaveBeenCalledTimes(2)
  })

  it('maps a parser failure to layout-changed and keeps the last good copy', async () => {
    const t = Date.now()
    queuedGet.mockResolvedValueOnce({ ok: true, value: doc('.ok'), fetchedAt: t })
    await read('demo')
    queuedGet.mockResolvedValueOnce({ ok: true, value: doc('.changed'), fetchedAt: t + 1 })
    expect(await read('demo', {}, { force: true })).toEqual({ ok: false, error: { kind: 'layout-changed', source: 'demo', detail: 'missing .ok' } })
    expect(await peek('demo')).toEqual({ value: { n: 1 }, fetchedAt: t })
  })

  it('passes access errors through', async () => {
    queuedGet.mockResolvedValue({ ok: false, error: { kind: 'session-expired' } })
    expect(await read('demo', {}, { force: true })).toEqual({ ok: false, error: { kind: 'session-expired' } })
  })
})

describe('attendance constants', () => {
  for (const e of ATTENDANCE) {
    for (const t of e.en) it(`en "${t}" -> ${e.value}`, () => expect(attendanceOf(t)).toBe(e.value))
    for (const t of e.vi) it(`vi "${t}" -> ${e.value}`, () => expect(attendanceOf(`  ${t.toUpperCase()} `)).toBe(e.value))
  }
  it('keeps unknown text raw', () => {
    expect(attendanceOf('Late')).toEqual({ kind: 'unknown', raw: 'Late' })
  })
  it('normalizes NFC, case and spaces', () => {
    expect(normText('Có   MẶT')).toBe('có mặt')
  })
})
