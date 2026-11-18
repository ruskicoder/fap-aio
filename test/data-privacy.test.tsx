// @vitest-environment happy-dom
// PNL-8.3: Settings, Data and privacy and About (panel-ux R8.1; platform R4.6, R5.7, R7.3; core R5.5, R12.4).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { bytesText, exportAll, newsRulesDate, registerDataAndAbout } from '../src/content/panel/settings/data-privacy'
import { clearSettings, settingDef, settingDefs } from '../src/content/panel/settings/registry'
import { write } from '../src/shared/storage/catalog'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

let c: FakeChrome
let sent: string[]
let check: unknown
const status = (over: object = {}) => ({
  usage: { perKey: { timetable: 4096, settings: 300, 'cache:grades.transcript': 20_000 }, total: 24_396 },
  idb: { usage: 12 * 1024 * 1024, quota: 1024 * 1024 * 1024 },
  data: { files: [{ name: 'subject-rules.json', source: 'packaged', dataVersion: 1, bytes: 1, sha256: 'x' }], version: 1 },
  channel: { acceptedVersion: 0, lastCheck: Date.parse('2026-11-18T03:00:00Z'), lastSkip: { reason: 'the manifest signature does not verify', at: 1 }, forcePackaged: false },
  ...over,
})

beforeEach(() => {
  c = installFakeChrome()
  sent = []
  check = { kind: 'current', version: 1 }
  c.runtime.onMessage.addListener((m: { type: string }, _s: unknown, respond: (r: unknown) => void) => {
    sent.push(m.type)
    const value = ({
      'data.status': status(), 'data.check': check, 'data.usePackaged': { version: 1 }, 'perm.state': { notifications: true, flm: false },
      diagnostics: { text: 'FAP-AIO 2.0.0\nerrors: none' },
      'data.rules': { dataVersion: 1, scrapedAt: '2026-10-10T16:03:12.457Z', rules: {}, subjects: {} },
      'data.file': { source: 'Derived from 600 FAP news titles, read 2026-10-11. Convention: x' },
    } as Record<string, unknown>)[m.type]
    respond({ ok: true, value })
    return false
  })
  clearSettings()
  registerDataAndAbout()
  document.body.innerHTML = ''
})

async function row(key: string) {
  const el = document.createElement('div')
  document.body.append(el)
  const def = settingDef(key)!
  await act(async () => { createRoot(el).render(createElement(def.component!, { def, value: null, set: () => {} })) })
  await tick(); await tick()
  const b = (name: string) => [...el.querySelectorAll('button')].find((x) => x.textContent === name)!
  return { el, b }
}

describe('Data and privacy', () => {
  it('lists the rows in the Data and About sections', () => {
    expect(settingDefs().map((d) => [d.section, d.label])).toEqual([
      ['data', 'What is stored'], ['data', 'Export all data'], ['data', 'Subject and news data'], ['data', 'Optional permissions'], ['data', 'Copy diagnostics'], ['about', 'FAP-AIO'],
    ])
    expect([bytesText(300), bytesText(4096), bytesText(12 * 1024 * 1024), bytesText(30 * 1024 ** 3), bytesText(null)]).toEqual(['300 B', '4.0 KB', '12.0 MB', '30.0 GB', 'unknown'])
  })

  it('shows storage use per store and the database total', async () => {
    const { el } = await row('data.storage')
    expect(el.textContent).toContain('23.8 KB in extension storage, 12.0 MB in the data database (of 1.0 GB available).')
    expect([...el.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['cache:grades.transcript19.5 KB', 'timetable4.0 KB', 'settings300 B'])
  })

  it('exports every stored record as one JSON file', async () => {
    await write('settings', { 'general.density': 'compact' })
    const text = await exportAll(new Date('2026-11-18T00:00:00Z'))
    const out = JSON.parse(text)
    expect(out.formatVersion).toBe(1)
    expect(out.exportedAt).toBe('2026-11-18T00:00:00.000Z')
    expect(out.stores.settings.data).toEqual({ 'general.density': 'compact' })
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const { el, b } = await row('data.export')
    await act(async () => { b('Export all data').click() })
    await tick()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(el.textContent).toContain('keep it private')
    spy.mockRestore()
  })

  it('shows the data version, last check and skip, and runs the two data actions', async () => {
    const { el, b } = await row('data.files')
    expect(el.textContent).toContain('Data version 1, packaged with this version.')
    expect(el.textContent).toContain('Last update skipped: the manifest signature does not verify.')
    await act(async () => { b('Check for data updates').click() })
    await tick()
    expect(el.textContent).toContain('The data is up to date.')
    check = { kind: 'skipped', reason: 'the data channel could not be reached' }
    await act(async () => { b('Check for data updates').click() })
    await tick()
    expect(el.textContent).toContain('No update: the data channel could not be reached.')
    await act(async () => { b('Use packaged data').click() })
    await tick()
    expect(el.textContent).toContain('Automatic updates are paused until you check for updates.')
    expect(sent).toEqual(expect.arrayContaining(['data.check', 'data.usePackaged']))
  })

  it('shows the optional permission states', async () => {
    const { el } = await row('data.permissions')
    expect(el.textContent).toContain('Notifications: allowed.')
    expect(el.textContent).toContain('Reading FLM: not allowed.')
  })

  it('copies the redacted diagnostics, or shows them when the clipboard is refused', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { el, b } = await row('data.diagnostics')
    await act(async () => { b('Copy diagnostics').click() })
    await tick()
    expect(writeText).toHaveBeenCalledWith('FAP-AIO 2.0.0\nerrors: none')
    expect(el.textContent).toContain('Copied.')
    writeText.mockRejectedValueOnce(new Error('denied'))
    await act(async () => { b('Copy diagnostics').click() })
    await tick()
    expect(el.querySelector<HTMLTextAreaElement>('textarea[aria-label="Diagnostics report"]')!.value).toBe('FAP-AIO 2.0.0\nerrors: none')
  })
})

describe('About', () => {
  it('shows the version, the rubric and news rules dates, and links', async () => {
    expect(newsRulesDate('Derived from x, read 2026-10-11. y')).toBe('2026-10-11')
    const { el } = await row('about.info')
    expect(el.textContent).toContain('FAP-AIO ')
    expect(el.textContent).toContain('FLM rubric of 10 Oct 2026, data version 1')
    expect(el.textContent).toContain('News rules of 11 Oct 2026')
    expect([...el.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('rel')])).toEqual([
      ['Source code', 'https://github.com/ruskicoder/fap-aio', 'noopener noreferrer'],
      ['FAP', 'https://fap.fpt.edu.vn/', 'noopener noreferrer'],
      ['FLM', 'https://flm.fpt.edu.vn/', 'noopener noreferrer'],
    ])
  })
})
