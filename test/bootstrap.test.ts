import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { isAuthenticatedPage, isLoginPage } from '../src/content/guard'
import { addModule, onBoot, modules, bootHooks } from '../src/content/modules'
import { bootstrap } from '../src/content/bootstrap'

const page = (f: string) => {
  const html = readFileSync(`test/fixtures/${f}`, 'utf8')
  return parseHTML(html.trim() ? html : '<!doctype html><html><head></head><body></body></html>')
}

function fakeWindow(f: string, path = '/') {
  const { window, document } = page(f)
  const w = window as unknown as Window & { top: unknown }
  Object.defineProperty(w, 'top', { value: w, configurable: true })
  Object.defineProperty(w, 'location', { value: { pathname: path }, configurable: true })
  Object.assign(document, { hasFocus: () => false })
  const def = (k: string, value: unknown) => Object.defineProperty(globalThis, k, { value, configurable: true, writable: true })
  def('location', { pathname: path })
  def('window', w)
  def('document', document)
  return w
}

describe('page guard', () => {
  it('accepts authenticated pages and rejects login and 404 pages', () => {
    expect(isAuthenticatedPage(page('en/home.html').document)).toBe(true)
    expect(isAuthenticatedPage(page('vi/timetable.html').document)).toBe(true)
    expect(isLoginPage(page('en/login.html').document)).toBe(true)
    expect(isAuthenticatedPage(page('en/login.html').document)).toBe(false)
    expect(isAuthenticatedPage(page('en/not-found.html').document)).toBe(false)
  })
})

describe('bootstrap', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    modules.length = 0
    bootHooks.mount.length = 0
    bootHooks.resume.length = 0
  })

  it('mounts, registers modules, resumes and announces the tab, in order', async () => {
    const order: string[] = []
    onBoot('mount', () => { order.push('mount') })
    onBoot('resume', () => { order.push('resume') })
    addModule({ id: 'scheduler', registerSources: () => { order.push('sources') }, onPage: (ctx) => { order.push(`page:${ctx.path}`) } })
    const sent = vi.spyOn(c.runtime, 'sendMessage')
    expect(await bootstrap(fakeWindow('en/home.html', '/WeeklyTimetable'))).toBe('ready')
    expect(order).toEqual(['mount', 'sources', 'page:/WeeklyTimetable', 'resume'])
    expect(sent.mock.calls[0]![0]).toEqual({ v: 1, type: 'tab-ready', path: '/WeeklyTimetable' })
  })

  it('skips the login page and a 404 page', async () => {
    const mount = vi.fn()
    onBoot('mount', mount)
    expect(await bootstrap(fakeWindow('en/login.html'))).toBe('not-authenticated')
    expect(await bootstrap(fakeWindow('en/not-found.html'))).toBe('not-authenticated')
    expect(mount).not.toHaveBeenCalled()
  })

  it('does nothing in a sub-frame', async () => {
    const w = fakeWindow('en/home.html')
    Object.defineProperty(w, 'top', { value: {}, configurable: true })
    expect(await bootstrap(w)).toBe('not-top-frame')
  })
})
