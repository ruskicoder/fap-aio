// @vitest-environment happy-dom
// APP-7.1: reversible Classic patches and the Classic switch (appearance R6.1, R6.8).
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { installFakeChrome } from './helpers/fake-chrome'
import { HIDDEN_CLASS, HOST_ATTR, PatchLog, hide, insert, move, type Patch } from '../src/features/appearance/layout/classic/patch'
import { CLASSIC_CLASS, CLASSIC_KEY, clearClassicParts, registerClassicPart, startClassic } from '../src/features/appearance/layout/classic/controller'
import { StylePipeline } from '../src/features/appearance/pipeline'
import { write } from '../src/shared/storage/catalog'

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
// Scripts and stylesheets are stripped so happy-dom does not try to load them.
const fixture = (n: string) => new DOMParser().parseFromString(readFileSync(`test/fixtures/en/${n}`, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''), 'text/html')
const q = (d: Document, s: string) => () => d.querySelector(s)
const host = (d: Document) => { const h = d.createElement('div'); h.textContent = 'classic'; return h }

function patchesFor(d: Document): Patch[] {
  return [
    hide('sidebar', q(d, '.leftside-menu')),
    hide('topbar', q(d, '.navbar-custom')),
    insert('nav', q(d, '.wrapper'), host),
    move('title', q(d, '.page-title-box'), q(d, '.wrapper')),
    hide('term', q(d, '#grade-report-term')),
    hide('course', q(d, '#grade-report-course')),
    insert('cards', q(d, '#grade-report'), host),
    hide('cells', q(d, '.weekly-timetable-cell')),
    hide('gone', q(d, '.not-on-fap')),
  ]
}

describe('patches', () => {
  for (const name of ['home.html', 'grade.html', 'timetable.html', 'transcript.html']) {
    it(`apply then revert restores ${name} byte for byte`, () => {
      const d = fixture(name)
      const before = d.documentElement.outerHTML
      const log = new PatchLog()
      const r = log.apply(patchesFor(d))
      expect(r.missing).toContain('gone')
      expect(r.applied).toEqual(expect.arrayContaining(['sidebar', 'nav']))
      expect(d.documentElement.outerHTML).not.toBe(before)
      expect(d.querySelector('.leftside-menu')!.classList.contains(HIDDEN_CLASS)).toBe(true)
      expect(d.querySelector(`[${HOST_ATTR}="nav"]`)!.parentElement!.matches('.wrapper')).toBe(true)
      log.revertAll()
      expect(d.documentElement.outerHTML).toBe(before)
      expect(log.size).toBe(0)
    })
  }

  it('keep the original class text, and only drop our class when FAP changed it meanwhile', () => {
    const d = fixture('home.html')
    const side = d.querySelector('.leftside-menu')!
    side.setAttribute('class', '  leftside-menu   menuitem-active ')
    const p = hide('s', () => side)
    p.apply()
    p.revert()
    expect(side.getAttribute('class')).toBe('  leftside-menu   menuitem-active ')
    p.apply()
    side.classList.add('show')
    p.revert()
    expect([...side.classList]).toEqual(['leftside-menu', 'menuitem-active', 'show'])
    const bare = d.createElement('div')
    d.body.append(bare)
    const b = hide('b', () => bare)
    b.apply(); b.revert()
    expect(bare.hasAttribute('class')).toBe(false)
  })

  it('re-apply after FAP swaps a partial, and not loop on unchanged patches', () => {
    const d = fixture('grade.html')
    const log = new PatchLog()
    log.apply([hide('course', q(d, '#grade-report-course')), insert('cards', q(d, '#grade-report'), host)])
    expect(log.refresh()).toEqual([])
    const old = d.querySelector('#grade-report-course')!
    old.replaceWith(Object.assign(d.createElement('select'), { id: 'grade-report-course' }))
    d.querySelector(`[${HOST_ATTR}="cards"]`)!.remove()
    expect(log.refresh()).toEqual(['course', 'cards'])
    expect(d.querySelector('#grade-report-course')!.classList.contains(HIDDEN_CLASS)).toBe(true)
    expect(d.querySelectorAll(`[${HOST_ATTR}="cards"]`)).toHaveLength(1)
  })
})

describe('the Classic switch', () => {
  beforeEach(() => {
    installFakeChrome()
    clearClassicParts()
    document.adoptedStyleSheets = []
    document.documentElement.classList.remove(CLASSIC_CLASS)
    const d = fixture('grade.html')
    document.body.innerHTML = d.body.innerHTML
  })

  it('turns on and off without reload, restoring the page, and re-applies after a partial swap', async () => {
    registerClassicPart({ id: 'test', css: '.x { color: red; }', patches: (d) => [hide('sidebar', q(d, '.leftside-menu')), hide('course', q(d, '#grade-report-course')), hide('gone', q(d, '.not-on-fap'))] })
    const before = document.body.innerHTML
    const p = new StylePipeline(document)
    const c = startClassic(p, document)
    await c.ready
    expect(c.on).toBe(false)
    expect(document.adoptedStyleSheets).toHaveLength(0)
    await write('settings', { [CLASSIC_KEY]: true })
    await tick()
    expect(c.on).toBe(true)
    expect(c.missing).toEqual(['gone'])
    expect(document.documentElement.classList.contains(CLASSIC_CLASS)).toBe(true)
    expect(p.get('classic')).toContain(`.${HIDDEN_CLASS} { display: none !important; }`)
    expect(p.get('classic')).toContain('.x { color: red; }')
    expect(document.querySelector('.leftside-menu')!.classList.contains(HIDDEN_CLASS)).toBe(true)
    document.querySelector('#grade-report-course')!.replaceWith(Object.assign(document.createElement('select'), { id: 'grade-report-course' }))
    await tick(120)
    expect(document.querySelector('#grade-report-course')!.classList.contains(HIDDEN_CLASS)).toBe(true)
    document.querySelector('#grade-report-course')!.outerHTML = before.match(/<select[^>]*id="grade-report-course"[\s\S]*?<\/select>/)![0]
    await write('settings', { [CLASSIC_KEY]: false })
    await tick()
    expect(c.on).toBe(false)
    expect(document.body.innerHTML).toBe(before)
    expect(p.get('classic')).toBeNull()
    expect(document.documentElement.classList.contains(CLASSIC_CLASS)).toBe(false)
  })

  it('is independent of the theme: FAP default keeps Classic on', async () => {
    await write('settings', { [CLASSIC_KEY]: true })
    const p = new StylePipeline(document)
    const c = startClassic(p, document)
    await c.ready
    await write('appearance.active', { active: { mode: 'fap-default' }, safeMode: false })
    await tick()
    expect(c.on).toBe(true)
    expect(p.get('classic')).not.toBeNull()
  })
})
