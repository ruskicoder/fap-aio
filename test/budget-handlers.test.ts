import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { handle } from '../src/background/router'
import { installTabs } from '../src/background/tabs'
import { installBudget, runOnFapTab } from '../src/background/budget-handlers'

const from = (tabId: number) => ({ id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: tabId } as chrome.tabs.Tab })

describe('budget handlers', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome(); installTabs(); installBudget() })

  it('grants, stops every tab on a challenge and resumes on the next tab-ready', async () => {
    await handle({ v: 1, type: 'tab-ready', path: '/' }, from(1))
    await handle({ v: 1, type: 'tab-ready', path: '/' }, from(2))
    const r = (await handle({ v: 1, type: 'budget.acquire', priority: 'user', source: 'x' }, from(1))) as { ok: true; value: { kind: string; grantId: string } }
    expect(r.value.kind).toBe('grant')
    await handle({ v: 1, type: 'budget.release', grantId: r.value.grantId, outcome: 'challenge' }, from(1))
    const stops = c.tabs._sent.filter((s) => (s.msg as { type: string }).type === 'reads.stop').map((s) => s.tabId).sort()
    expect(stops).toEqual([1, 2])
    expect(await handle({ v: 1, type: 'budget.acquire', priority: 'user', source: 'x' }, from(2))).toEqual({ ok: false, error: { kind: 'challenge' } })
    await handle({ v: 1, type: 'tab-ready', path: '/' }, from(2))
    expect(c.tabs._sent.filter((s) => (s.msg as { type: string }).type === 'reads.resume')).toHaveLength(2)
  })

  it('routes timer work to the focused tab and skips without a FAP tab', async () => {
    expect(await runOnFapTab('keepalive')).toBe(false)
    await handle({ v: 1, type: 'tab-ready', path: '/' }, from(4))
    await handle({ v: 1, type: 'tab-ready', path: '/' }, from(5))
    await handle({ v: 1, type: 'tab-focus' }, from(4))
    expect(await runOnFapTab('keepalive')).toBe(true)
    expect(c.tabs._sent.at(-1)).toEqual({ tabId: 4, msg: { v: 1, type: 'timer.run', job: 'keepalive' } })
  })
})
