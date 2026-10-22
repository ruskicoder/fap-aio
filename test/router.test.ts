import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { handle, register, ok } from '../src/background/router'
import { readCounters } from '../src/background/diag'

const fap = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/Report/Grade', frameId: 0, tab: { id: 3 } as chrome.tabs.Tab }

describe('service worker router', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    register('tab-focus', (_m, ctx) => ok(ctx.tabId))
    register('perm.result', (m) => ok(m.granted))
  })

  it('dispatches a valid message from a FAP top frame', async () => {
    expect(await handle({ v: 1, type: 'tab-focus' }, fap)).toEqual({ ok: true, value: 3 })
  })

  it('drops forged senders and counts them', async () => {
    expect(await handle({ v: 1, type: 'tab-focus' }, { ...fap, url: 'https://evil.example/' })).toBeUndefined()
    expect(await handle({ v: 1, type: 'tab-focus' }, { ...fap, frameId: 2 })).toBeUndefined()
    expect(await handle({ v: 1, type: 'tab-focus' }, { ...fap, id: 'other-extension' })).toBeUndefined()
    expect(await handle({ v: 1, type: 'tab-focus' }, { ...fap, url: 'https://fap.fpt.edu.vn.evil.example/' })).toBeUndefined()
    expect((await readCounters())['msg.rejected.sender']).toBe(4)
  })

  it('drops invalid shapes and counts them', async () => {
    expect(await handle({ v: 1, type: 'tab-focus', x: 1 }, fap)).toBeUndefined()
    expect(await handle({ type: 'tab-focus' }, fap)).toBeUndefined()
    expect((await readCounters())['msg.rejected.schema']).toBe(2)
  })

  it('accepts perm.result only from grant.html', async () => {
    const grant = { id: 'test-extension-id', url: c.runtime.getURL('src/pages/grant/grant.html?perm=notifications'), tab: { id: 9 } as chrome.tabs.Tab }
    expect(await handle({ v: 1, type: 'perm.result', perm: 'notifications', granted: true }, grant)).toEqual({ ok: true, value: true })
    expect(await handle({ v: 1, type: 'perm.result', perm: 'notifications', granted: true }, fap)).toBeUndefined()
    expect(await handle({ v: 1, type: 'tab-focus' }, grant)).toBeUndefined()
    const other = { ...grant, url: c.runtime.getURL('src/other.html') }
    expect(await handle({ v: 1, type: 'perm.result', perm: 'notifications', granted: true }, other)).toBeUndefined()
  })

  it('replies with a typed error for an unhandled type or a throwing handler', async () => {
    expect(await handle({ v: 1, type: 'data.status' }, fap)).toEqual({ ok: false, error: { kind: 'unhandled', detail: 'data.status' } })
    register('data.check', () => { throw new Error('boom') })
    expect(await handle({ v: 1, type: 'data.check' }, fap)).toEqual({ ok: false, error: { kind: 'error', detail: 'boom' } })
  })
})
