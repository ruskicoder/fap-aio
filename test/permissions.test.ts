// PLT-8.1: optional permission flow, removal handling and the notify mirror (platform R1.3 to R1.7).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { handle } from '../src/background/router'
import { installPermissions } from '../src/background/permissions'
import { read, write } from '../src/shared/storage/catalog'
import { GRANT_COPY } from '../src/shared/permissions'

const fap = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 1 } as chrome.tabs.Tab }
const page = { id: 'test-extension-id', url: 'chrome-extension://test-extension-id/src/pages/grant/grant.html?perm=notifications' }
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('optional permissions', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome(); installPermissions() })
  afterEach(() => { vi.useRealTimers() })

  it('answers at once when the permission is already held', async () => {
    c.permissions._granted.add('notifications')
    expect(await handle({ v: 1, type: 'perm.request', perm: 'notifications', reason: 'r' }, fap)).toEqual({ ok: true, value: { granted: true } })
    expect(c.windows._created).toHaveLength(0)
  })

  it('opens the grant window and resolves with its answer', async () => {
    const asked = handle({ v: 1, type: 'perm.request', perm: 'notifications', reason: 'r' }, fap)
    await tick()
    expect(c.windows._created[0]!.url).toBe('chrome-extension://test-extension-id/src/pages/grant/grant.html?perm=notifications')
    expect(await handle({ v: 1, type: 'perm.result', perm: 'notifications', granted: true }, page)).toEqual({ ok: true, value: null })
    expect(await asked).toEqual({ ok: true, value: { granted: true } })
    // A FAP tab cannot send perm.result.
    expect(await handle({ v: 1, type: 'perm.result', perm: 'notifications', granted: true }, fap)).toBeUndefined()
  })

  it('counts a closed window or 120 s without an answer as refused', async () => {
    const closed = handle({ v: 1, type: 'perm.request', perm: 'flm', reason: 'r' }, fap)
    await tick(); await tick()
    c.windows.onRemoved.emit(c.windows._created[0]!.id)
    expect(await closed).toEqual({ ok: true, value: { granted: false } })
    vi.useFakeTimers()
    const late = handle({ v: 1, type: 'perm.request', perm: 'flm', reason: 'r' }, fap)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(await late).toEqual({ ok: true, value: { granted: false } })
  })

  it('turns dependent settings off and pushes an alert when a permission is removed', async () => {
    await write('settings', { 'schedule.reminders.enabled': true, 'alerts.notify.news': true, 'alerts.notify.grade': false, 'info.flmRefresh.enabled': true })
    c.permissions.onRemoved.emit({ permissions: ['notifications'] })
    await tick(); await tick(); await tick()
    expect(await read('settings')).toEqual({ 'schedule.reminders.enabled': false, 'alerts.notify.news': false, 'alerts.notify.grade': false, 'info.flmRefresh.enabled': true })
    const alerts = (await read('alerts'))!.items
    expect(alerts.map((a) => [a.kind, a.title, a.read])).toEqual([['reminder', GRANT_COPY.notifications.removed, false]])
  })

  it('mirrors an alert only when its kind is on and notifications are held', async () => {
    const alert = { id: 'a1', kind: 'news', title: 'P1 news' }
    expect(await handle({ v: 1, type: 'notify', alert }, fap)).toEqual({ ok: true, value: { shown: false } })
    await write('settings', { 'alerts.notify.news': true })
    expect(await handle({ v: 1, type: 'notify', alert }, fap)).toEqual({ ok: true, value: { shown: false } })
    c.permissions._granted.add('notifications')
    expect(await handle({ v: 1, type: 'notify', alert }, fap)).toEqual({ ok: true, value: { shown: true } })
    expect(c.notifications._shown.map((n) => n.id)).toEqual(['a1'])
  })
})
