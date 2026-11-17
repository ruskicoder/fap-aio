// @vitest-environment happy-dom
// CORE-10.1: legacy page storage cleanup (core R12.1 to R12.4).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { exportLegacy, isLegacyKey, removeLegacy, scanLegacy } from '../src/features/legacy/legacy'
import { LegacyBanner, LegacyReviewRow } from '../src/features/legacy/LegacyBanner'
import { read } from '../src/shared/storage/catalog'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

const LEGACY = { weeklySchedule: '[1]', examSchedule: '[2]', examFilter: 'all', semesterSyncState: '{}', pendingSemesterSync: 'x', selectedSemester: 'Fall2025', expireAt: '1', 'fap-aio:panel': '{}', 'PRF192 - Programming Fundamentals': 'notes' }
const OTHER = { theme: 'dark', 'jidox:sidebar': 'open', 'fap-aio': 'not prefixed', PRF192: 'bare code', 'PRF192-Name': 'no spaces', __CONFIG__: '{}' }

function seed(s: Storage) {
  s.clear()
  for (const [k, v] of Object.entries({ ...LEGACY, ...OTHER })) s.setItem(k, v)
}
const keysOf = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i)!).sort()

describe('legacy keys', () => {
  beforeEach(() => { installFakeChrome(); seed(window.localStorage) })

  it('match the list, the fap-aio: prefix and MoveOut subject keys only', () => {
    for (const k of Object.keys(LEGACY)) expect(isLegacyKey(k), k).toBe(true)
    for (const k of Object.keys(OTHER)) expect(isLegacyKey(k), k).toBe(false)
    expect(scanLegacy()).toEqual(Object.keys(LEGACY).sort())
  })

  it('export the values and remove only listed keys, never others', () => {
    const e = exportLegacy(scanLegacy(), window.localStorage, new Date('2026-11-17T00:00:00Z'), 'https://fap.fpt.edu.vn')
    expect(e).toEqual({ formatVersion: 1, exportedAt: '2026-11-17T00:00:00.000Z', origin: 'https://fap.fpt.edu.vn', items: LEGACY })
    expect(removeLegacy([...scanLegacy(), 'theme', 'jidox:sidebar'])).toBe(Object.keys(LEGACY).length)
    expect(keysOf(window.localStorage)).toEqual(Object.keys(OTHER).sort())
  })
})

describe('cleanup offer', () => {
  beforeEach(() => { installFakeChrome(); seed(window.localStorage) })

  async function render(node: JSX.Element) {
    const el = document.createElement('div')
    document.body.replaceChildren(el)
    await act(async () => { createRoot(el).render(node) })
    await wait()
    const button = (t: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === t)
    return { el, button }
  }

  it('downloads the export before removing the keys, and keeps everything else', async () => {
    const atDownload: string[][] = []
    Object.assign(URL, { createObjectURL: vi.fn(() => { atDownload.push(keysOf(window.localStorage)); return 'blob:x' }), revokeObjectURL: vi.fn() })
    const { el, button } = await render(<LegacyBanner />)
    expect(el.textContent).toContain('An older FAP-AIO left 9 items')
    await act(async () => { button('Export and remove')!.click() })
    expect(atDownload).toEqual([Object.keys({ ...LEGACY, ...OTHER }).sort()])
    expect(keysOf(window.localStorage)).toEqual(Object.keys(OTHER).sort())
    expect(el.textContent).toContain('Removed 9 old items')
  })

  it('does not ask again after Not now until Settings asks to look again', async () => {
    const { el, button } = await render(<LegacyBanner />)
    await act(async () => { button('Not now')!.click() })
    await wait()
    expect(await read('legacy')).toEqual({ dismissed: true })
    expect(el.textContent).toBe('')
    const again = await render(<><LegacyBanner /><LegacyReviewRow /></>)
    expect(again.el.textContent).not.toContain('An older FAP-AIO')
    await act(async () => { again.button('Look for old data')!.click() })
    await wait(); await wait()
    expect(await read('legacy')).toEqual({ dismissed: false })
    expect(again.el.textContent).toContain('Found 9. The offer is shown above the tabs.')
    expect(again.el.textContent).toContain('An older FAP-AIO left 9 items')
  })

  it('shows nothing when FAP storage has no legacy key', async () => {
    window.localStorage.clear()
    window.localStorage.setItem('theme', 'dark')
    const { el } = await render(<LegacyBanner />)
    expect(el.textContent).toBe('')
  })
})
