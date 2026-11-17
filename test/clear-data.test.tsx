// @vitest-environment happy-dom
// CORE-11.1: core and scheduler settings, and "Clear data" (core R5.5, R13.1, R13.2).
import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { IDBFactory } from 'fake-indexeddb'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { ClearDataRow, clearData } from '../src/content/panel/settings/clear-data'
import { clearSettings, settingDef, writeSetting } from '../src/content/panel/settings/registry'
import { SCHEDULER_KEYS, registerKeepAliveSettings, registerReminderSettings } from '../src/features/scheduler/settings'
import { handle } from '../src/background/router'
import { installDataHandlers } from '../src/background/data/handlers'
import { ensureData, openDataDb, readFiles, type DataDeps } from '../src/background/data/db'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const BASE = 'chrome-extension://test/'
const idb = new IDBFactory()
const deps: DataDeps = { idb, getURL: (p) => BASE + p, fetch: (async (url: string) => new Response(readFileSync(resolve(__dirname, '..', url.slice(BASE.length))) as unknown as BodyInit)) as unknown as typeof fetch }

beforeAll(async () => { await ensureData('start', deps) }, 60_000)

describe('Clear data', () => {
  let c: FakeChrome
  const sent: string[] = []
  beforeEach(async () => {
    c = installFakeChrome()
    sent.length = 0
    c.runtime.onMessage.addListener((m: { type: string }, _s: unknown, respond: (r: unknown) => void) => { sent.push(m.type); respond({ ok: true, value: {} }); return false })
    await c.storage.local.set({ settings: { schemaVersion: 1, updatedAt: 0, data: { 'general.density': 'compact' } }, timetable: { schemaVersion: 1, updatedAt: 0, data: {} }, 'cache:grades.transcript': { schemaVersion: 1, updatedAt: 0, data: { entries: {} } }, 'panel.prefs': { schemaVersion: 1, updatedAt: 0, data: {} } })
  })

  it('removes every key except settings and asks the service worker to clear its caches', async () => {
    expect(await clearData()).toEqual({ removed: 3, caches: true })
    expect(Object.keys(c.storage.local.data)).toEqual(['settings'])
    expect(sent).toEqual(['data.clearCaches'])
  })

  it('asks for confirmation first, and Cancel keeps everything', async () => {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(<ClearDataRow />) })
    const button = (t: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === t)!
    await act(async () => { button('Clear data').click() })
    expect(el.querySelector('[role="alertdialog"]')!.textContent).toContain('Settings stay. This cannot be undone.')
    await act(async () => { button('Cancel').click() })
    expect(Object.keys(c.storage.local.data)).toHaveLength(4)
    await act(async () => { button('Clear data').click() })
    await act(async () => { button('Clear data').click() })
    await wait()
    expect(Object.keys(c.storage.local.data)).toEqual(['settings'])
    expect(el.textContent).toContain('Cleared 3 stored items and the data caches. Settings were kept.')
  })
})

describe('data.clearCaches in the service worker', () => {
  it('drops live overrides and channel copies, keeping packaged data', async () => {
    installFakeChrome()
    installDataHandlers(deps)
    const { db } = await openDataDb(idb)
    const files = await readFiles(db)
    const tx = db.transaction(['files', 'overrides'], 'readwrite')
    tx.objectStore('overrides').put({ code: 'ACC101', syllabusId: 1, approvedDate: null, rules: null, full: null, fetchedAt: 1 })
    tx.objectStore('files').put({ ...files[0]!, source: 'channel', dataVersion: 9 })
    await new Promise((r) => { tx.oncomplete = r })
    db.close()
    const r = await handle({ v: 1, type: 'data.clearCaches' }, { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 1 } as chrome.tabs.Tab })
    expect(r).toEqual({ ok: true, value: { overrides: 'cleared', reindexed: true } })
    const { db: after } = await openDataDb(idb)
    expect((await readFiles(after)).every((f) => f.source === 'packaged')).toBe(true)
    const left = await new Promise<number>((ok) => { const q = after.transaction('overrides').objectStore('overrides').count(); q.onsuccess = () => ok(q.result) })
    expect(left).toBe(0)
    after.close()
  }, 60_000)
})

describe('scheduler and session settings', () => {
  beforeEach(() => { installFakeChrome(); clearSettings() })

  it('are declared for the reminder and keep-alive features, off by default, with a validated interval', async () => {
    registerReminderSettings()
    registerKeepAliveSettings()
    expect([settingDef(SCHEDULER_KEYS.remindersEnabled)!.default, settingDef(SCHEDULER_KEYS.classOffset)!.default, settingDef(SCHEDULER_KEYS.keepAliveEnabled)!.default, settingDef(SCHEDULER_KEYS.keepAliveMinutes)!.default]).toEqual([false, 15, false, 7])
    expect(await writeSetting(settingDef(SCHEDULER_KEYS.keepAliveMinutes)!, 0)).toBe('Enter whole minutes from 1 to 60.')
    expect(await writeSetting(settingDef(SCHEDULER_KEYS.keepAliveMinutes)!, 10)).toBeNull()
  })
})
