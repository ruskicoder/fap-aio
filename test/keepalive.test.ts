// CORE-9.1: session keep-alive (core R11.1 to R11.4).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

const queued = vi.fn()
vi.mock('../src/content/fap/queue', () => ({ queuedGetJson: (...a: unknown[]) => queued(...a) }))
const { ALARM, keepAliveTick, syncKeepAlive } = await import('../src/background/keepalive')
const { budget } = await import('../src/background/budget-handlers')
const { runKeepAlive, KEEPALIVE_PATH } = await import('../src/features/scheduler/keepalive')
const { read, write } = await import('../src/shared/storage/catalog')

const NOW = Date.parse('2026-11-17T09:00:00+07:00')
let c: FakeChrome
beforeEach(async () => {
  c = installFakeChrome()
  queued.mockReset()
  await chrome.storage.session.set({ 'tabs.known': { ready: { 7: 1 }, focused: 7 } })
})

describe('keep-alive alarm', () => {
  it('stay off by default and clear the alarm when turned off', async () => {
    expect(await syncKeepAlive()).toBe(false)
    expect(await c.alarms.get(ALARM)).toBeUndefined()
    await write('settings', { 'session.keepAlive.enabled': true, 'session.keepAlive.interval': 3 })
    expect(await syncKeepAlive()).toBe(true)
    expect((await c.alarms.get(ALARM))?.periodInMinutes).toBe(3)
    await write('settings', { 'session.keepAlive.enabled': true })
    await syncKeepAlive()
    expect((await c.alarms.get(ALARM))?.periodInMinutes).toBe(7)
    await write('settings', { 'session.keepAlive.enabled': false })
    expect(await keepAliveTick(NOW)).toBe('off')
    expect(await c.alarms.get(ALARM)).toBeUndefined()
    expect(c.tabs._sent).toEqual([])
  })

  it('send one read to a FAP tab, skip when FAP was reached within the interval or no tab is open', async () => {
    await write('settings', { 'session.keepAlive.enabled': true })
    const g = await budget.acquire('user', 7, NOW - 3 * 60_000)
    if (g.kind === 'grant') await budget.release(g.grantId, 'ok', NOW - 3 * 60_000)
    expect(await keepAliveTick(NOW)).toBe('recent')
    expect(await keepAliveTick(NOW + 5 * 60_000)).toBe('sent')
    expect(c.tabs._sent).toEqual([{ tabId: 7, msg: { v: 1, type: 'timer.run', job: 'keepalive' } }])
    await chrome.storage.session.set({ 'tabs.known': { ready: {}, focused: null } })
    expect(await keepAliveTick(NOW + 20 * 60_000)).toBe('no-tab')
  })
})

describe('keep-alive read in the tab', () => {
  it('read the unread count as a background request', async () => {
    queued.mockResolvedValue({ ok: true, value: { hasUnread: false }, fetchedAt: NOW })
    expect(await runKeepAlive(NOW)).toBe('ok')
    expect(queued).toHaveBeenCalledWith(KEEPALIVE_PATH, { priority: 'background', source: 'keepalive' })
    queued.mockResolvedValue({ ok: false, error: { kind: 'network', message: 'x' } })
    expect(await runKeepAlive(NOW)).toBe('failed')
    expect(await read('alerts')).toBeNull()
  })

  it('turn keep-alive off and tell the user when the session expired', async () => {
    await write('settings', { 'session.keepAlive.enabled': true, 'session.keepAlive.interval': 5 })
    queued.mockResolvedValue({ ok: false, error: { kind: 'session-expired' } })
    expect(await runKeepAlive(NOW)).toBe('expired')
    expect(await read('settings')).toEqual({ 'session.keepAlive.enabled': false, 'session.keepAlive.interval': 5 })
    const [a] = (await read('alerts'))!.items
    expect([a!.kind, a!.title, a!.link]).toEqual(['session', 'Keep FAP signed in is off: your FAP session ended', { overlay: 'settings', section: 'session' }])
  })
})
