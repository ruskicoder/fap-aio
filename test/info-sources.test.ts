// INF-1.1: notification and curriculum sources (info R5.4, R2.3 to R2.5).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { installFakeChrome } from './helpers/fake-chrome'

const json = vi.fn()
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async () => ({ ok: false, error: { kind: 'network' } })),
  queuedGetJson: (...a: unknown[]) => json(...a),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { parseBell, parseCurriculum, parseUnread } = await import('../src/features/info/parse')
const { registerInfoSources } = await import('../src/features/info/sources')
const { read, sources, LayoutChangedError } = await import('../src/content/fap/registry')

const doc = (f: string) => parseHTML(readFileSync(`test/fixtures/${f}`, 'utf8')).document
const partial = (f: string) => parseHTML(`<html><body>${readFileSync(`test/fixtures/${f}`, 'utf8')}</body></html>`).document

describe('notification sources', () => {
  it('read the unread flag from JSON and refuse other shapes', () => {
    expect(parseUnread(JSON.parse(readFileSync('test/fixtures/en/unread-count.json', 'utf8')))).toEqual({ hasUnread: true })
    expect(() => parseUnread({ count: 3 })).toThrow(LayoutChangedError)
  })

  it('read the bell list from data-notification attributes', () => {
    const list = parseBell(partial('en/bell-list.partial.html'))
    expect(list).toHaveLength(5) // the other five data-notification-id elements are mark-read buttons
    expect(list[0]).toEqual({ id: '25b8395b-6c0d-5kiv-s9m3-1171h2746893', linkUrl: '', sourceCode: 'UYPKGRR_EIITD', isRead: false, title: 'Lbgiv huv sriv akmv', time: '06/10/2026 23:14' })
    expect(new Set(list.map((n) => n.id)).size).toBe(5)
    const read = parseBell(parseHTML('<html><body><div data-notification-list><div data-notification-item data-notification-id="x" data-notification-is-read="true"></div></div></body></html>').document)
    expect(read[0]!.isRead).toBe(true)
    expect(parseBell(parseHTML('<html><body><div data-notification-list></div></body></html>').document)).toEqual([])
  })
})

describe('curriculum', () => {
  it('reads term, code, name, prerequisites and replacements by position, vi like en', () => {
    const en = parseCurriculum(doc('en/curriculum.html'))
    expect(en).toHaveLength(48)
    expect(en[5]).toEqual({ no: 6, code: 'VOV824', name: 'Hroavka 24/02', term: 0, prerequisites: [], replacements: [], credits: null, detailUrl: null })
    const vi = parseCurriculum(doc('vi/curriculum.html'))
    expect(vi.map((r) => [r.code, r.term])).toEqual(en.map((r) => [r.code, r.term]))
  })

  it('takes prerequisite codes and a subject detail link when present', () => {
    const d = parseHTML(`<html><body><div class="content-page"><table class="fap-sheet"><thead><tr>${'<th>x</th>'.repeat(6)}</tr></thead><tbody>
      <tr><td>1</td><td>CSD201</td><td><a href="/Subject/Detail/abc">Data structures</a></td><td>3</td><td>PRF192 and MAD101</td><td>CSD201, CSD203</td></tr>
    </tbody></table></div></body></html>`).document
    expect(parseCurriculum(d)[0]).toMatchObject({ code: 'CSD201', term: 3, prerequisites: ['PRF192', 'MAD101'], replacements: ['CSD203'], detailUrl: '/Subject/Detail/abc' })
    expect(() => parseCurriculum(parseHTML('<html><body><div class="content-page"></div></body></html>').document)).toThrow(LayoutChangedError)
  })
})

describe('registration', () => {
  beforeEach(() => { installFakeChrome() })

  it('registers the three sources with their lifetimes, and reads JSON through the queue', async () => {
    registerInfoSources()
    const by = Object.fromEntries(sources().filter((s) => s.id.startsWith('info.')).map((s) => [s.id, s]))
    expect([by['info.unread']!.cacheTtlMs, by['info.bell']!.cacheTtlMs, by['info.curriculum']!.cacheTtlMs]).toEqual([120_000, 600_000, 86_400_000])
    expect([by['info.bell']!.partial, by['info.bell']!.route({})]).toEqual([true, '/Notification/BellList?pageIndex=1&pageSize=10'])
    json.mockResolvedValueOnce({ ok: true, value: { hasUnread: false }, fetchedAt: 1 })
    expect(await read('info.unread')).toMatchObject({ ok: true, value: { hasUnread: false } })
    expect(json).toHaveBeenCalledWith('/Notification/UnreadCount', expect.objectContaining({ source: 'info.unread' }))
    json.mockResolvedValueOnce({ ok: true, value: { nope: 1 }, fetchedAt: 2 })
    expect(await read('info.unread', {}, { force: true })).toMatchObject({ ok: false, error: { kind: 'layout-changed', source: 'info.unread' } })
  })
})
