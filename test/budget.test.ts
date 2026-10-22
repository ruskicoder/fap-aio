import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { Budget, GAP_AFTER_ERROR_MS, GAP_MS, LEASE_MS, WINDOW_MS } from '../src/background/budget'

let n = 0
const ids = () => `g${++n}`
const T0 = 1_000_000_000

describe('request budget', () => {
  let c: FakeChrome
  let b: Budget
  beforeEach(() => {
    c = installFakeChrome()
    b = new Budget(c.storage.session as unknown as chrome.storage.StorageArea, ids)
  })

  async function grantAt(now: number, priority: 'user' | 'background' = 'user') {
    const r = await b.acquire(priority, 1, now)
    if (r.kind !== 'grant') throw new Error(`expected grant at ${now}, got ${JSON.stringify(r)}`)
    await b.release(r.grantId, 'ok', now + 10)
    return r
  }

  it('grants one at a time', async () => {
    const first = await b.acquire('user', 1, T0)
    expect(first.kind).toBe('grant')
    expect(await b.acquire('user', 2, T0 + 5)).toMatchObject({ kind: 'wait', reason: 'inflight', retryAfterMs: GAP_MS })
  })

  it('treats a lease older than 15 s as lost', async () => {
    await b.acquire('user', 1, T0)
    expect((await b.acquire('user', 1, T0 + LEASE_MS)).kind).toBe('grant')
  })

  it('waits 400 ms after a request and 1.5 s after an error', async () => {
    const g = await b.acquire('user', 1, T0)
    if (g.kind !== 'grant') throw new Error()
    await b.release(g.grantId, 'ok', T0 + 100)
    expect(await b.acquire('user', 1, T0 + 300)).toMatchObject({ kind: 'wait', reason: 'gap', retryAfterMs: 200 })
    const g2 = await b.acquire('user', 1, T0 + 500)
    if (g2.kind !== 'grant') throw new Error()
    await b.release(g2.grantId, 'error', T0 + 600)
    expect(await b.acquire('user', 1, T0 + 600 + GAP_MS)).toMatchObject({ kind: 'wait', reason: 'gap' })
    expect((await b.acquire('user', 1, T0 + 600 + GAP_AFTER_ERROR_MS)).kind).toBe('grant')
  })

  it('allows 30 grants per rolling 5 minutes', async () => {
    let t = T0
    for (let i = 0; i < 30; i++) { await grantAt(t); t += 1000 }
    const w = await b.acquire('user', 1, t)
    expect(w).toMatchObject({ kind: 'wait', reason: 'window', remaining: 0 })
    if (w.kind !== 'wait') throw new Error()
    expect(w.retryAfterMs).toBe(T0 + WINDOW_MS - t)
    expect((await b.acquire('user', 1, T0 + WINDOW_MS)).kind).toBe('grant')
  })

  it('caps background reads at 12 per window', async () => {
    let t = T0
    for (let i = 0; i < 12; i++) { await grantAt(t, 'background'); t += 1000 }
    expect(await b.acquire('background', 1, t)).toMatchObject({ kind: 'wait', reason: 'background', remaining: 0 })
    expect((await b.acquire('user', 1, t)).kind).toBe('grant')
  })

  it('lets a waiting user read go before background reads', async () => {
    const g = await b.acquire('background', 1, T0)
    if (g.kind !== 'grant') throw new Error()
    expect((await b.acquire('user', 2, T0 + 10)).kind).toBe('wait')
    await b.release(g.grantId, 'ok', T0 + 20)
    expect(await b.acquire('background', 1, T0 + 1000)).toMatchObject({ kind: 'wait', reason: 'background' })
    expect((await b.acquire('user', 2, T0 + 1000)).kind).toBe('grant')
  })

  it('refuses everything under a challenge until cleared', async () => {
    const g = await b.acquire('user', 1, T0)
    if (g.kind !== 'grant') throw new Error()
    expect(await b.release(g.grantId, 'challenge', T0 + 10)).toBe(true)
    expect(await b.acquire('user', 1, T0 + 60_000)).toEqual({ kind: 'challenge' })
    expect(await b.clearChallenge()).toBe(true)
    expect((await b.acquire('user', 1, T0 + 60_000)).kind).toBe('grant')
  })

  it('survives a service worker restart', async () => {
    let t = T0
    for (let i = 0; i < 30; i++) { await grantAt(t); t += 1000 }
    const restarted = new Budget(c.storage.session as unknown as chrome.storage.StorageArea, ids)
    expect(await restarted.acquire('user', 1, t)).toMatchObject({ kind: 'wait', reason: 'window' })
  })
})
