// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { StatusStrip, ago } from '../src/content/panel/StatusStrip'
import { FapQueue } from '../src/content/fap/queue'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('status strip', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome(); document.body.innerHTML = '' })

  async function render(props: Parameters<typeof StatusStrip>[0]) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    await act(async () => root.render(<StatusStrip {...props} />))
    return { el, root }
  }

  it('shows the last sync, the budget wait and the data channel state', async () => {
    const q = new FapQueue()
    const { el, root } = await render({ lastSync: Date.now() - 120_000, q })
    expect(el.textContent).toContain('Synced 2 min ago')
    act(() => (q as unknown as { set(p: object): void }).set({ waiting: { remaining: 3, retryAfterMs: 4000, until: 0 } }))
    expect(el.textContent).toContain('Waiting for FAP budget: 3 left, 4 s')
    await act(async () => { await c.runtime.sendMessage({ v: 1, type: 'data.progress', state: 'syncing', version: null }, { id: 'test-extension-id' }) })
    expect(el.textContent).toContain('Syncing data')
    await act(async () => { await c.runtime.sendMessage({ v: 1, type: 'data.progress', state: 'idle', version: 4 }, { id: 'test-extension-id' }) })
    expect(el.textContent).toContain('Data v4')
    act(() => root.unmount())
  })

  it('shows range sync progress from the sync job', async () => {
    const { el, root } = await render({ q: new FapQueue() })
    expect(el.textContent).toContain('Not synced yet')
    await act(async () => { await c.storage.local.set({ 'sync.job': { schemaVersion: 1, updatedAt: 0, data: { mondays: ['a', 'b', 'c', 'd'], next: 1 } } }) })
    expect(el.textContent).toContain('Syncing 1/4 weeks')
    act(() => root.unmount())
  })

  it('shows the challenge banner with a reload button', async () => {
    const q = new FapQueue()
    q.stop()
    const reload = vi.fn()
    const { el, root } = await render({ q, reload })
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Reload this page to continue')
    act(() => el.querySelector('button')!.click())
    expect(reload).toHaveBeenCalled()
    act(() => root.unmount())
  })

  it('formats relative times', () => {
    expect(ago(0, 30_000)).toBe('just now')
    expect(ago(0, 3 * 3_600_000)).toBe('3 h ago')
  })
})
