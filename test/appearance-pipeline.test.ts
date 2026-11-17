// @vitest-environment happy-dom
// APP-1.1: style pipeline, early application, mode guard and panel theme (appearance R1.1 to R1.7, R4.5, R4.6).
import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { StylePipeline, userCss, varsCss } from '../src/features/appearance/pipeline'
import { ModeGuard } from '../src/features/appearance/mode'
import { SAFE_CLASS, startAppearance } from '../src/features/appearance/early'
import { installPanelTheme, panelThemeCss } from '../src/features/appearance/panel-theme'
import { FAP_DEFAULT, parseActive, type ActiveStyle, type AppearanceActive } from '../src/features/appearance/state'
import { write } from '../src/shared/storage/catalog'

const tick = () => new Promise((r) => setTimeout(r, 0))

function style(over: Partial<ActiveStyle> = {}): ActiveStyle {
  return {
    id: 't', mode: 'dark', vars: { '--ct-body-bg': '#000000' }, effects: '.card{border-radius:16px}',
    css: '.btn{color:red}', background: null, roles: { accent: '#3b82f6', surface: '#000000', text: '#ffffff' }, ...over,
  }
}
const single = (s: ActiveStyle, safeMode = false): AppearanceActive => ({ active: { mode: 'single', style: s }, safeMode })
const texts = (d: Document) => d.adoptedStyleSheets.map((s) => [...s.cssRules].map((r) => r.cssText).join(''))

function fakeMedia(dark: boolean) {
  const listeners: (() => void)[] = []
  const m = { matches: dark, addEventListener: (_: string, l: () => void) => listeners.push(l), removeEventListener() {} }
  return { win: Object.assign(Object.create(window), { matchMedia: () => m, addEventListener: window.addEventListener.bind(window) }) as Window, set(d: boolean) { m.matches = d; listeners.forEach((l) => l()) } }
}

describe('StylePipeline', () => {
  beforeEach(() => { document.adoptedStyleSheets = [] })

  it('adopts layers after foreign sheets in a stable order and drops empty layers', () => {
    const foreign = new CSSStyleSheet()
    foreign.replaceSync('p{margin:0}')
    document.adoptedStyleSheets = [foreign]
    const p = new StylePipeline(document)
    p.set('user', 'b{color:red}')
    p.set('base', 'i{color:blue}')
    p.set('vars', 'html{--ct-x:1px}')
    p.apply()
    expect(document.adoptedStyleSheets[0]).toBe(foreign)
    expect(texts(document).slice(1).map((t) => t.slice(0, 1))).toEqual(['i', 'h', 'b'])
    p.set('vars', null)
    p.apply()
    expect(document.adoptedStyleSheets).toHaveLength(3)
    // A sheet adopted later by someone else (the dock narrowing) is kept.
    const dock = new CSSStyleSheet()
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, dock]
    p.set('effects', 'u{color:green}')
    p.apply()
    expect(document.adoptedStyleSheets).toContain(dock)
    expect(document.adoptedStyleSheets.at(-1)!.cssRules[0]!.cssText).toContain('b')
  })

  it('scopes variables to html[data-bs-theme=mode] and adds the background before custom CSS', () => {
    expect(varsCss(style())).toBe('html[data-bs-theme=dark]{--ct-body-bg:#000000;}')
    const s = style({ background: { dataUrl: 'data:image/png;base64,AAAA', fit: 'tile', dim: 0.3 } })
    const css = userCss(s, false)
    expect(css.indexOf('background-image')).toBeLessThan(css.indexOf('.btn'))
    expect(css).toContain('background-repeat:repeat')
    expect(userCss(s, true)).not.toContain('.btn')
  })

  it('rejects stored values that could break out of a rule', () => {
    expect(parseActive(single(style({ vars: { '--ct-body-bg': 'red}body{display:none' } })))).toEqual(FAP_DEFAULT)
    expect(parseActive(single(style({ background: { dataUrl: 'https://x/y.png', fit: 'cover', dim: 0 } })))).toEqual(FAP_DEFAULT)
    expect(parseActive({ nonsense: true })).toEqual(FAP_DEFAULT)
  })
})

describe('ModeGuard', () => {
  it('forces the mode, re-asserts it after FAP changes it, and restores what FAP chose', async () => {
    const root = document.createElement('html')
    root.setAttribute('data-bs-theme', 'light')
    const g = new ModeGuard(root)
    g.force('dark')
    expect(root.getAttribute('data-bs-theme')).toBe('dark')
    root.setAttribute('data-bs-theme', 'light') // Jidox config script
    await tick()
    expect(root.getAttribute('data-bs-theme')).toBe('dark')
    expect(g.saved).toBe('light')
    g.restore()
    expect(root.getAttribute('data-bs-theme')).toBe('light')
  })

  it('removes the attribute on restore when FAP never set one', () => {
    const root = document.createElement('html')
    const g = new ModeGuard(root)
    g.force('dark')
    g.restore()
    expect(root.hasAttribute('data-bs-theme')).toBe(false)
  })
})

describe('early application', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    document.adoptedStyleSheets = []
    document.documentElement.removeAttribute('data-bs-theme')
    document.documentElement.classList.remove(SAFE_CLASS)
  })

  it('applies the stored theme and switches without reload, then FAP default clears it', async () => {
    await write('appearance.active', single(style()))
    const a = startAppearance(document, fakeMedia(false).win)
    await a.ready
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
    expect(a.pipeline.get('vars')).toContain('--ct-body-bg')
    expect(a.pipeline.get('user')).toContain('.btn')
    await write('appearance.active', single(style({ mode: 'light', css: '' })))
    await tick()
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
    expect(a.pipeline.get('user')).toBeNull()
    await write('appearance.active', FAP_DEFAULT)
    await tick()
    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(document.documentElement.hasAttribute('data-bs-theme')).toBe(false)
    expect(Object.keys(c.storage.local.data)).toEqual(['appearance.active'])
  })

  it('follows the colour scheme in auto mode', async () => {
    const m = fakeMedia(false)
    await write('appearance.active', { active: { mode: 'auto', light: style({ id: 'l', mode: 'light' }), dark: style({ id: 'd' }) }, safeMode: false })
    const a = startAppearance(document, m.win)
    await a.ready
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
    m.set(true)
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
  })

  it('drops custom CSS in safe mode and when Shift is held during load', async () => {
    await write('appearance.active', single(style(), true))
    let a = startAppearance(document, fakeMedia(false).win)
    await a.ready
    expect(a.pipeline.get('user')).toBeNull()
    await write('appearance.active', single(style()))
    a = startAppearance(document, fakeMedia(false).win)
    await a.ready
    expect(a.pipeline.get('user')).toContain('.btn')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(a.pipeline.get('user')).toBeNull()
    expect(document.documentElement.classList.contains(SAFE_CLASS)).toBe(true)
  })
})

describe('panel theme', () => {
  beforeEach(() => { installFakeChrome() })

  it('is empty under FAP default and carries mode, accent and roles under a theme', async () => {
    expect(panelThemeCss(null)).toBe('')
    expect(panelThemeCss(style())).toBe(':host{color-scheme:dark;--aio-accent:#3b82f6;--aio-surface:#000000;--aio-text:#ffffff;}')
    const host = document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    installPanelTheme(shadow, fakeMedia(false).win)
    await tick()
    expect(shadow.adoptedStyleSheets).toHaveLength(1)
    expect(shadow.adoptedStyleSheets[0]!.cssRules).toHaveLength(0)
    await write('appearance.active', single(style()))
    await tick()
    expect(shadow.adoptedStyleSheets[0]!.cssRules[0]!.cssText).toContain('--aio-accent')
  })
})
