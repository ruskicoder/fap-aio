// @vitest-environment happy-dom
// INF-7.1: the capstone card from /Account (info R10.1 to R10.3).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'

let page = ''
let fail = false
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string) => (fail || route !== '/Account'
    ? { ok: false, error: { kind: 'network', message: 'x' } }
    : { ok: true, value: new DOMParser().parseFromString(page, 'text/html'), fetchedAt: Date.now() })),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { parseCapstone } = await import('../src/features/info/parse')
const { registerInfoSources, INFO_ACCOUNT } = await import('../src/features/info/sources')
const { sources } = await import('../src/content/fap/registry')
const { CapstoneCard } = await import('../src/features/info/views/CapstoneCard')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')
const CARD = readFileSync('test/fixtures/en/account-capstone.partial.html', 'utf8')
const doc = (html: string) => new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
const values = (html: string, v: [string, string, string]) => {
  let i = 0
  return html.replace(/(<div class="student-profile-field__value">)[^<]*(<\/div>)/g, (_m, a: string, b: string) => `${a}${v[i++]}${b}`)
}

describe('parseCapstone', () => {
  it('reads the English title, the Vietnamese title and the update date by field icons', () => {
    expect(parseCapstone(doc(CARD))).toEqual({
      titleEn: 'Smart campus parking assistant using computer vision',
      titleVi: 'Trợ lý đỗ xe thông minh trong khuôn viên sử dụng thị giác máy tính',
      updatedOn: '2026-11-15',
    })
  })

  it('returns nothing when FAP shows "-" for both titles, and drops a "-" date only', () => {
    expect(parseCapstone(doc(values(CARD, ['-', '-', '-'])))).toBeNull()
    expect(parseCapstone(doc(values(CARD, [' - ', '', '15/11/2026'])))).toBeNull()
    expect(parseCapstone(doc(values(CARD, ['A topic', '-', '-'])))).toEqual({ titleEn: 'A topic', titleVi: null, updatedOn: null })
  })

  it('works with Vietnamese labels, because labels are never matched', () => {
    const vi = CARD.replace('Capstone / thesis', 'Đồ án / khóa luận').replace('Capstone (Vietnamese)', 'Đồ án (tiếng Việt)').replace('Thesis updated on', 'Cập nhật khóa luận').replace('Capstone project', 'Đồ án tốt nghiệp')
    expect(parseCapstone(doc(vi))).toEqual(parseCapstone(doc(CARD)))
  })

  it('reads only the capstone card, not an edit icon in another card', () => {
    const other = '<div class="card"><div class="student-profile-grid"><div class="student-profile-field"><i class="ri-edit-line"></i><div><div class="student-profile-field__label">Profile updated</div><div class="student-profile-field__value">01/01/2020</div></div></div></div></div>'
    expect(parseCapstone(doc(other + CARD))!.updatedOn).toBe('2026-11-15')
    expect(parseCapstone(doc(other))).toBeNull()
  })

  it('reads the card on the anonymized account page, and nothing on a page without it', () => {
    const r = parseCapstone(new DOMParser().parseFromString(strip(readFileSync('test/fixtures/en/account.html', 'utf8')), 'text/html'))!
    expect(r.titleEn).toMatch(/^VyttDeby /)
    expect(r.titleVi).toMatch(/^VyttDeby /)
    expect(r.updatedOn).toBeNull()
    expect(parseCapstone(new DOMParser().parseFromString(strip(readFileSync('test/fixtures/en/timetable.html', 'utf8')), 'text/html'))).toBeNull()
  })
})

describe('source and card', () => {
  beforeEach(() => {
    installFakeChrome()
    registerInfoSources()
    page = `<html><body>${CARD}</body></html>`
    fail = false
    document.body.innerHTML = ''
  })

  async function render() {
    const el = document.createElement('div')
    document.body.append(el)
    await act(async () => { createRoot(el).render(<CapstoneCard />) })
    await tick(); await tick()
    return el
  }

  it('reads /Account with a 6 hour cache', () => {
    const s = sources().find((x) => x.id === INFO_ACCOUNT)!
    expect([s.route({}), s.cacheTtlMs, s.partial]).toEqual(['/Account', 6 * 3_600_000, false])
  })

  it('shows the titles and the last update', async () => {
    const el = await render()
    expect(el.querySelector('h3')!.textContent).toBe('Capstone project')
    expect(el.textContent).toContain('Smart campus parking assistant using computer vision')
    expect(el.querySelector('[lang="vi"]')!.textContent).toBe('Trợ lý đỗ xe thông minh trong khuôn viên sử dụng thị giác máy tính')
    expect(el.textContent).toContain('Updated 15 Nov 2026')
  })

  it('is hidden without a topic or when the page cannot be read', async () => {
    page = `<html><body>${values(CARD, ['-', '-', '-'])}</body></html>`
    expect((await render()).innerHTML).toBe('')
    document.body.innerHTML = ''
    fail = true
    const el = document.createElement('div')
    document.body.append(el)
    await act(async () => { createRoot(el).render(<CapstoneCard />) })
    await tick()
    expect(el.innerHTML).toBe('')
  })
})
