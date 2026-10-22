import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MSG_TYPES, MsgSchema, parseMsg, timeoutFor } from '../src/shared/messages'
import { call, onMessage } from '../src/shared/call'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'

describe('message schemas', () => {
  it('has one schema per message type', () => {
    expect(new Set(MSG_TYPES).size).toBe(MSG_TYPES.length)
    expect(MSG_TYPES.length).toBe(MsgSchema.options.length)
    for (const t of ['tab-ready', 'budget.acquire', 'perm.result', 'reads.stop', 'flm.parse', 'data.progress']) expect(MSG_TYPES).toContain(t)
  })

  it('accepts a valid message', () => {
    expect(parseMsg({ v: 1, type: 'budget.acquire', priority: 'user', source: 'timetable.week' })).not.toBeNull()
  })

  it('rejects a wrong protocol version, an unknown type and extra fields', () => {
    expect(parseMsg({ v: 2, type: 'tab-focus' })).toBeNull()
    expect(parseMsg({ v: 1, type: 'run.code', code: 'x' })).toBeNull()
    expect(parseMsg({ v: 1, type: 'tab-focus', extra: 1 })).toBeNull()
    expect(parseMsg('tab-focus')).toBeNull()
  })

  it('has stated longer limits', () => {
    expect(timeoutFor('perm.request')).toBe(120_000)
    expect(timeoutFor('flm.refresh')).toBe(60_000)
    expect(timeoutFor('data.rules')).toBe(10_000)
  })
})

describe('call', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome() })

  it('returns the reply', async () => {
    c.runtime.onMessage.addListener((_m: unknown, _s: unknown, send: (r: unknown) => void) => { send({ ok: true, value: 7 }); return false })
    expect(await call({ type: 'data.status' })).toEqual({ ok: true, value: 7 })
  })

  it('resolves to timeout when no reply arrives', async () => {
    vi.useFakeTimers()
    c.runtime.onMessage.addListener(() => true) // keeps the channel open, never answers
    const p = call({ type: 'data.status' }, 50)
    await vi.advanceTimersByTimeAsync(60)
    expect(await p).toEqual({ ok: false, error: { kind: 'timeout' } })
    vi.useRealTimers()
  })

  it('resolves to timeout when nobody answers', async () => {
    expect(await call({ type: 'tab-focus' })).toEqual({ ok: false, error: { kind: 'timeout' } })
  })

  it('onMessage delivers only valid messages from this extension', async () => {
    const seen: string[] = []
    onMessage('reads.stop', (m) => { seen.push(m.reason) })
    await c.runtime.sendMessage({ v: 1, type: 'reads.stop', reason: 'challenge' }, { id: 'test-extension-id' })
    await c.runtime.sendMessage({ v: 1, type: 'reads.stop', reason: 'challenge' }, { id: 'other' })
    await c.runtime.sendMessage({ v: 1, type: 'reads.stop', reason: 'nope' }, { id: 'test-extension-id' })
    expect(seen).toEqual(['challenge'])
  })
})
