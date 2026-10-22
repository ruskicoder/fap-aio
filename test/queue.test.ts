import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { FapQueue, wireQueue, type QueueState } from '../src/content/fap/queue'
import type { FapResult } from '../src/content/fap/access'

type Reply = { ok: boolean; value?: unknown; error?: { kind: string } }

describe('per-tab queue', () => {
  let c: FakeChrome
  let replies: Reply[]
  let released: { grantId: string; outcome: string }[]
  beforeEach(() => {
    c = installFakeChrome()
    replies = []
    released = []
    c.runtime.onMessage.addListener((m: { type: string; grantId: string; outcome: string }, _s: unknown, send: (r: unknown) => void) => {
      if (m.type === 'budget.acquire') send(replies.shift() ?? { ok: true, value: { kind: 'grant', grantId: 'g', remaining: 29 } })
      if (m.type === 'budget.release') { released.push({ grantId: m.grantId, outcome: m.outcome }); send({ ok: true, value: null }) }
      return false
    })
  })
  afterEach(() => vi.useRealTimers())

  const okJob = (v: number) => async (): Promise<FapResult<number>> => ({ ok: true, value: v, fetchedAt: 0 })

  it('acquires before and releases after each request, one at a time', async () => {
    const q = new FapQueue()
    const order: string[] = []
    const job = (n: number) => async (): Promise<FapResult<number>> => { order.push(`start${n}`); await new Promise((r) => setTimeout(r, 5)); order.push(`end${n}`); return { ok: true, value: n, fetchedAt: 0 } }
    const [a, b] = await Promise.all([q.run('user', 's', job(1)), q.run('user', 's', job(2))])
    expect(a.ok && b.ok).toBe(true)
    expect(order).toEqual(['start1', 'end1', 'start2', 'end2'])
    expect(released).toEqual([{ grantId: 'g', outcome: 'ok' }, { grantId: 'g', outcome: 'ok' }])
  })

  it('waits on wait replies and exposes the waiting state', async () => {
    vi.useFakeTimers()
    replies.push({ ok: true, value: { kind: 'wait', retryAfterMs: 1000, remaining: 0, reason: 'window' } })
    const q = new FapQueue()
    const seen: (QueueState['waiting'])[] = []
    q.subscribe((s) => seen.push(s.waiting))
    const p = q.run('user', 's', okJob(1))
    await vi.advanceTimersByTimeAsync(10)
    expect(q.current.waiting).toMatchObject({ remaining: 0, retryAfterMs: 1000 })
    await vi.advanceTimersByTimeAsync(1000)
    expect((await p).ok).toBe(true)
    expect(q.current.waiting).toBeNull()
  })

  it('stops on a challenge result and rejects queued work until resumed', async () => {
    const q = new FapQueue()
    const r1 = await q.run('user', 's', async () => ({ ok: false, error: { kind: 'challenge' } }))
    expect(r1).toEqual({ ok: false, error: { kind: 'challenge' } })
    expect(released.at(-1)!.outcome).toBe('challenge')
    expect(await q.run('user', 's', okJob(2))).toEqual({ ok: false, error: { kind: 'challenge' } })
    q.resume()
    expect((await q.run('user', 's', okJob(3))).ok).toBe(true)
  })

  it('follows reads.stop and reads.resume from the service worker', async () => {
    const q = new FapQueue()
    wireQueue(q)
    await c.runtime.sendMessage({ v: 1, type: 'reads.stop', reason: 'challenge' }, { id: 'test-extension-id' })
    expect(q.current.stopped).toBe(true)
    await c.runtime.sendMessage({ v: 1, type: 'reads.resume' }, { id: 'test-extension-id' })
    expect(q.current.stopped).toBe(false)
  })

  it('reports network errors to the budget as error outcomes', async () => {
    const q = new FapQueue()
    await q.run('background', 's', async () => ({ ok: false, error: { kind: 'network', message: 'x' } }))
    expect(released.at(-1)!.outcome).toBe('error')
  })
})
