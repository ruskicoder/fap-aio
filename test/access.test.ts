import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { installDomParser, res } from './helpers/dom'
import { fapGet, fapGetJson } from '../src/content/fap/access'

const login = readFileSync('test/fixtures/en/login.html', 'utf8')
const week = readFileSync('test/fixtures/en/timetable-week.partial.html', 'utf8')

describe('fapGet', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    installDomParser()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('sends a same-origin GET with the partial header and parses the page', async () => {
    fetchMock.mockResolvedValue(res(week))
    const r = await fapGet('/WeeklyTimetable/WeekPartial?referenceDate=2026-10-05', { partial: true })
    expect(r.ok && r.value.querySelector('.weekly-timetable-grid')).toBeTruthy()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://fap.fpt.edu.vn/WeeklyTimetable/WeekPartial?referenceDate=2026-10-05')
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
  })

  it('omits the partial header for pages and refuses other origins', async () => {
    fetchMock.mockResolvedValue(res('<html><body></body></html>'))
    await fapGet('/ExamSchedule')
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty('X-Requested-With')
    await expect(fapGet('https://evil.example/')).rejects.toThrow()
    await expect(fapGet('//evil.example/')).rejects.toThrow()
  })

  it.each([
    ['login redirect', res('<html></html>', { redirected: true, url: 'https://fap.fpt.edu.vn/Auth/Login?ReturnUrl=%2F' }), { kind: 'session-expired' }],
    ['login form', res(login), { kind: 'session-expired' }],
    ['feedback header', res('', { headers: { 'X-Feedback-Required': '1' } }), { kind: 'feedback-required', url: '/Feedback?required=1' }],
    ['404', res('', { status: 404 }), { kind: 'unavailable', status: 404 }],
    ['challenge', res('', { status: 403, headers: { 'cf-mitigated': 'challenge' } }), { kind: 'challenge' }],
    ['other 403', res('', { status: 403 }), { kind: 'forbidden', status: 403 }],
  ])('maps %s', async (_n, response, error) => {
    fetchMock.mockResolvedValue(response)
    expect(await fapGet('/x')).toEqual({ ok: false, error })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a network failure once after 1.5 s', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(res('<html><body><p>ok</p></body></html>'))
    const p = fapGet('/x')
    await vi.advanceTimersByTimeAsync(1500)
    expect((await p).ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports a second network failure', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const p = fapGet('/x')
    await vi.advanceTimersByTimeAsync(1500)
    expect(await p).toEqual({ ok: false, error: { kind: 'network', message: 'Failed to fetch' } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fapGetJson parses JSON and maps a login page', async () => {
    fetchMock.mockResolvedValueOnce(res('{"count":3}'))
    expect(await fapGetJson('/Notification/UnreadCount')).toMatchObject({ ok: true, value: { count: 3 } })
    fetchMock.mockResolvedValueOnce(res(login))
    expect(await fapGetJson('/Notification/UnreadCount')).toEqual({ ok: false, error: { kind: 'session-expired' } })
  })
})
