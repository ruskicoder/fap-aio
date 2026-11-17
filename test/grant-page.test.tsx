// @vitest-environment happy-dom
// PLT-8.1: grant window states (decision D-4).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { CLOSE_AFTER_MS, GrantPage } from '../src/pages/grant/GrantPage'
import { EXPIRED_TEXT, GRANT_COPY } from '../src/shared/permissions'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

async function mount(perm: string | null, close = vi.fn()) {
  const el = document.createElement('div')
  document.body.replaceChildren(el)
  await act(async () => { createRoot(el).render(<GrantPage perm={perm} close={close} />) })
  return { el, close }
}
const click = async (el: HTMLElement, name: string) => {
  const b = [...el.querySelectorAll('button')].find((x) => x.textContent === name)!
  await act(async () => { b.click() })
}

describe('grant page', () => {
  let c: FakeChrome
  const results: unknown[] = []
  beforeEach(() => {
    c = installFakeChrome()
    results.length = 0
    c.runtime.onMessage.addListener((m: unknown, _s: unknown, respond: (r: unknown) => void) => { results.push(m); respond({ ok: true, value: null }) })
  })

  it('asks with one sentence and one button, then reports granted and closes after 1.5 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { el, close } = await mount('notifications')
    expect(el.querySelector('h1')!.textContent).toBe(GRANT_COPY.notifications.title)
    expect(el.textContent).toContain(GRANT_COPY.notifications.purpose)
    expect(el.querySelectorAll('main button')).toHaveLength(1)
    await click(el, GRANT_COPY.notifications.button)
    expect(results).toEqual([{ v: 1, type: 'perm.result', perm: 'notifications', granted: true }])
    expect(el.textContent).toContain(GRANT_COPY.notifications.granted)
    expect(close).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(CLOSE_AFTER_MS) })
    expect(close).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('reports refused with a Close button', async () => {
    c.permissions.request = async () => false
    const { el, close } = await mount('flm')
    await click(el, GRANT_COPY.flm.button)
    expect(results).toEqual([{ v: 1, type: 'perm.result', perm: 'flm', granted: false }])
    expect(el.textContent).toContain(GRANT_COPY.flm.refused)
    await click(el, 'Close')
    expect(close).toHaveBeenCalledOnce()
  })

  it('shows the expired text for an unknown permission', async () => {
    const { el } = await mount('tabs')
    expect(el.textContent).toContain(EXPIRED_TEXT)
  })
})
