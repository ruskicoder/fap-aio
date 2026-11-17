// @vitest-environment happy-dom
// APP-7.2: Classic home link directory and the application deadline table (appearance R6.5, R6.9;
// platform R3.1, R3.2).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'

const requests: { route: string; priority: string }[] = []
let catalogOk = true
vi.mock('../src/content/fap/queue', () => ({
  queuedGet: vi.fn(async (route: string, o: { priority: string }) => {
    requests.push({ route, priority: o.priority })
    if (!catalogOk) return { ok: false, error: { kind: 'network', message: 'x' } }
    const html = readFileSync('test/fixtures/en/application-catalog.html', 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '')
    return { ok: true, value: new DOMParser().parseFromString(html, 'text/html'), fetchedAt: Date.now() }
  }),
  queuedGetJson: vi.fn(async (route: string, o: { priority: string }) => {
    requests.push({ route, priority: o.priority })
    return { ok: true, value: { deadline: route.endsWith('i') ? 3 : null, registrationPeriodDisplay: route.endsWith('i') ? '01/12 - 15/12' : null }, fetchedAt: Date.now() }
  }),
  queue: { current: { pending: 0, waiting: null, stopped: false }, subscribe: () => () => {} },
}))
const { DIRECTORY, cachedDeadlines, directoryFrom, homePart, isHome, loadDeadlines, parseCatalog, parseSchema, registerClassicSources, renderDirectory } = await import('../src/features/appearance/layout/classic/home')
const { CLASSIC_KEY, clearClassicParts, registerClassicPart, startClassic } = await import('../src/features/appearance/layout/classic/controller')
const { StylePipeline } = await import('../src/features/appearance/pipeline')
const { write } = await import('../src/shared/storage/catalog')

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
// Scripts, stylesheets and images would make happy-dom try to load them.
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '').replace(/<img\b[^>]*>/gi, '')
const fixture = (n: string) => new DOMParser().parseFromString(strip(readFileSync(`test/fixtures/en/${n}`, 'utf8')), 'text/html')

beforeEach(() => {
  installFakeChrome()
  requests.length = 0
  catalogOk = true
  registerClassicSources()
})

describe('link directory', () => {
  it('groups FAP\'s own sidebar links under the old sections, with FAP\'s labels, dropping what FAP does not show', () => {
    const dir = directoryFrom(fixture('home.html'))
    expect(dir.map((s) => s.title)).toEqual(['Registration/Application', 'Information Access', 'Reports', 'Regulations', 'Feedback', 'Others'])
    expect(dir[0]!.links[0]).toEqual({ label: 'Submit application', href: '/Application/Catalog' })
    expect(dir[2]!.links.map((l) => l.label)).toContain('Academic transcript')
    const all = dir.flatMap((s) => s.links.map((l) => l.href))
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(DIRECTORY.flatMap((s) => s.routes).length)
    const d = fixture('home.html')
    d.querySelector('.side-nav a[href="/Wishlist"]')!.remove()
    for (const a of d.querySelectorAll('.side-nav a[href="/Wishlist"]')) a.remove()
    expect(directoryFrom(d).flatMap((s) => s.links.map((l) => l.href))).not.toContain('/Wishlist')
  })

  it('reads the 46 application types and the schema fields', () => {
    const types = parseCatalog(fixture('application-catalog.html'))
    expect(types).toHaveLength(46)
    expect(types[0]!.id).toBe('u4831n75-00ft-m074-9632-l17150111n1i')
    expect(types[0]!.name).toBe('Sus ngac sch sgus')
    expect(() => parseCatalog(fixture('home.html'))).toThrow(/no application types/)
    expect(parseSchema(JSON.parse(readFileSync('test/fixtures/en/application-form-schema.json', 'utf8')))).toEqual({ deadline: 3, period: null })
    expect(parseSchema({ deadline: 'x', registrationPeriodDisplay: ' 1/1 ' })).toEqual({ deadline: null, period: '1/1' })
  })

  it('shows only on the home page', () => {
    expect(isHome('/')).toBe(true)
    expect(isHome('/Home')).toBe(true)
    expect(isHome('/Report/Grade')).toBe(false)
  })
})

describe('deadline table', () => {
  it('reads nothing until asked, then one type at a time at user priority, and is kept for 24 hours', async () => {
    expect(await cachedDeadlines()).toBeNull()
    expect(requests).toEqual([])
    const seen: string[] = []
    const r = await loadDeadlines((d, t) => seen.push(`${d}/${t}`))
    expect('rows' in r && r.rows).toHaveLength(46)
    expect(requests[0]).toEqual({ route: '/Application/Catalog', priority: 'user' })
    expect(requests.slice(1).every((q) => q.route.startsWith('/Application/GetFormSchema?applicationTypeId=') && q.priority === 'user')).toBe(true)
    expect(requests).toHaveLength(47)
    expect(seen[0]).toBe('0/46')
    expect(seen.at(-1)).toBe('46/46')
    requests.length = 0
    const cached = await cachedDeadlines()
    expect(cached).toHaveLength(46)
    expect(requests).toEqual([])
    expect(await cachedDeadlines(Date.now() + 25 * 3_600_000)).toBeNull()
  })

  it('hides the table when the types cannot be read', async () => {
    catalogOk = false
    expect(await loadDeadlines(() => {})).toEqual({ error: 'types' })
  })
})

describe('on the page', () => {
  beforeEach(() => {
    clearClassicParts()
    document.adoptedStyleSheets = []
    document.body.innerHTML = fixture('home.html').body.innerHTML
    history.replaceState(null, '', '/')
  })

  it('renders the block with the Load deadlines button, and fills the table on press', async () => {
    const host = document.createElement('div')
    renderDirectory(document, host)
    const root = host.shadowRoot!
    expect([...root.querySelectorAll('h3')].map((h) => h.textContent)).toContain('Reports')
    expect(root.querySelector('a[href="/Report/Transcript"]')!.textContent).toBe('Academic transcript')
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent === 'Load deadlines')!
    btn.click()
    await tick(50)
    expect(root.querySelectorAll('tbody tr')).toHaveLength(46)
    expect(root.querySelector('tbody td')!.textContent).toBe('Sus ngac sch sgus')
    const again = document.createElement('div')
    requests.length = 0
    renderDirectory(document, again)
    await tick(20)
    expect(again.shadowRoot!.querySelectorAll('tbody tr')).toHaveLength(46)
    expect(requests).toEqual([])
  })

  it('goes above FAP\'s home content when Classic is on and leaves the page as it was when off', async () => {
    registerClassicPart(homePart)
    const before = document.body.innerHTML
    const c = startClassic(new StylePipeline(document), document)
    await c.ready
    await write('settings', { [CLASSIC_KEY]: true })
    await tick()
    const host = document.querySelector('[data-fap-aio-classic="home-directory"]')!
    expect(host.nextElementSibling!.id).toBe('home-student-shell')
    expect(host.shadowRoot!.textContent).toContain('Application deadlines')
    expect(requests).toEqual([])
    await write('settings', { [CLASSIC_KEY]: false })
    await tick()
    expect(document.body.innerHTML).toBe(before)
  })

  it('does nothing on other pages', () => {
    history.replaceState(null, '', '/Report/Grade')
    expect(homePart.patches!(document)).toEqual([])
    history.replaceState(null, '', '/')
  })
})
