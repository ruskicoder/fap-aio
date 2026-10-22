import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { handle } from '../src/background/router'
import { installTabs, knownTabs, targetTab } from '../src/background/tabs'

const from = (tabId: number) => ({ id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: tabId } as chrome.tabs.Tab })

describe('tab tracking', () => {
  let c: FakeChrome
  beforeEach(() => { c = installFakeChrome(); installTabs() })

  it('tracks ready tabs, focus and removal', async () => {
    await handle({ v: 1, type: 'tab-ready', path: '/' }, from(1))
    await new Promise((r) => setTimeout(r, 2))
    await handle({ v: 1, type: 'tab-ready', path: '/' }, from(2))
    expect((await knownTabs()).sort()).toEqual([1, 2])
    expect(await targetTab()).toBe(2)
    await handle({ v: 1, type: 'tab-focus' }, from(1))
    expect(await targetTab()).toBe(1)
    c.tabs.onRemoved.emit(1)
    expect(await targetTab()).toBe(2)
    c.tabs.onRemoved.emit(2)
    expect(await targetTab()).toBeNull()
  })

  it('toolbar action toggles the panel on a FAP tab and opens FAP elsewhere', async () => {
    c.action.onClicked.emit({ id: 4, url: 'https://fap.fpt.edu.vn/Report/Grade' })
    c.action.onClicked.emit({ id: 5, url: 'https://example.com/' })
    await new Promise((r) => setTimeout(r, 5))
    expect(c.tabs._sent).toEqual([{ tabId: 4, msg: { v: 1, type: 'panel.toggle' } }])
    expect([...c.tabs._tabs.values()].map((t) => t.url)).toContain('https://fap.fpt.edu.vn/')
  })

  it('lists commands', async () => {
    const r = await handle({ v: 1, type: 'commands.list' }, from(1))
    expect(r).toMatchObject({ ok: true, value: [{ name: 'toggle-panel' }] })
  })
})
