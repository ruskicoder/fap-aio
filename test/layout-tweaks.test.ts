// @vitest-environment happy-dom
// APP-6.1: compact, wide and sticky layout tweaks (appearance R7.1 to R7.5).
import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome } from './helpers/fake-chrome'
import { StylePipeline } from '../src/features/appearance/pipeline'
import { TWEAK_CLASS, TWEAK_KEY, flagsOf, measureTop, startTweaks, tweaksCss } from '../src/features/appearance/layout/tweaks'
import { registerLayoutSettings } from '../src/features/appearance/settings'
import { clearSettings, settingDefs } from '../src/content/panel/settings/registry'
import { write } from '../src/shared/storage/catalog'

const tick = () => new Promise((r) => setTimeout(r, 0))
const html = () => document.documentElement

beforeEach(() => {
  installFakeChrome()
  document.adoptedStyleSheets = []
  for (const c of Object.values(TWEAK_CLASS)) html().classList.remove(c)
  document.body.innerHTML = ''
})

describe('tweak CSS', () => {
  it('scopes every rule to its html class and carries the sticky offset', () => {
    const css = tweaksCss(70.4)
    const rules = css.split('\n')
    for (const r of rules) expect(r).toMatch(/^html\.fap-aio-(compact|wide|sticky)\b/)
    expect(css).toContain('html.fap-aio-compact .table > :not(caption) > * > * { padding: 0.25rem 0.5rem; }')
    expect(css).toContain('line-height: 1.3')
    expect(css).toContain('html.fap-aio-compact .card-body { padding: 0.75rem; }')
    expect(css).toMatch(/html\.fap-aio-wide \.wrapper[^{]*\{ max-width: none !important; \}/)
    expect(css).toContain('html.fap-aio-sticky { --fap-aio-sticky-top: 70px; }')
    expect(css).toContain('html.fap-aio-sticky table.fap-sheet > thead > tr > th, html.fap-aio-sticky table.student-mark-sheet > thead > tr > th { position: sticky; top: var(--fap-aio-sticky-top, 0px)')
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    expect(sheet.cssRules.length).toBe(rules.length)
  })

  it('read each option from settings, off by default', () => {
    expect(flagsOf(null)).toEqual({ compact: false, wide: false, sticky: false })
    expect(flagsOf({ [TWEAK_KEY.wide]: true, [TWEAK_KEY.sticky]: 'yes' })).toEqual({ compact: false, wide: true, sticky: false })
  })

  it('measure the top bar only when it stays on screen', () => {
    expect(measureTop(document)).toBe(0)
    document.body.innerHTML = '<div class="navbar-custom" style="position: fixed; height: 70px"></div>'
    const bar = document.querySelector<HTMLElement>('.navbar-custom')!
    bar.getBoundingClientRect = () => ({ height: 70 } as DOMRect)
    expect(measureTop(document)).toBe(70)
    bar.style.position = 'static'
    expect(measureTop(document)).toBe(0)
  })
})

describe('applying the tweaks', () => {
  it('toggle the classes without reload, each on its own, and adopt no sheet while all are off', async () => {
    const p = new StylePipeline(document)
    const t = startTweaks(p, document, window)
    await t.ready
    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(html().className).not.toMatch(/fap-aio-/)
    await write('settings', { [TWEAK_KEY.compact]: true })
    await tick()
    expect(html().classList.contains(TWEAK_CLASS.compact)).toBe(true)
    expect(html().classList.contains(TWEAK_CLASS.wide)).toBe(false)
    expect(p.get('base')).toContain('fap-aio-compact')
    expect(document.adoptedStyleSheets).toHaveLength(1)
    await write('settings', { [TWEAK_KEY.wide]: true, [TWEAK_KEY.sticky]: true })
    await tick()
    expect([...html().classList].filter((c) => c.startsWith('fap-aio-')).sort()).toEqual(['fap-aio-sticky', 'fap-aio-wide'])
    await write('settings', {})
    await tick()
    expect(document.adoptedStyleSheets).toHaveLength(0)
    expect(html().getAttribute('style')).toBeNull()
  })

  it('apply stored options on a new page, before the first paint where possible', async () => {
    await write('settings', { [TWEAK_KEY.sticky]: true })
    const t = startTweaks(new StylePipeline(document), document, window)
    await t.ready
    expect(t.flags()).toEqual({ compact: false, wide: false, sticky: true })
    expect(html().classList.contains(TWEAK_CLASS.sticky)).toBe(true)
  })

  it('register three Appearance switches, off by default', () => {
    clearSettings()
    registerLayoutSettings()
    expect(settingDefs().map((d) => [d.key, d.section, d.type, d.default])).toEqual([
      [TWEAK_KEY.compact, 'appearance', 'toggle', false],
      [TWEAK_KEY.wide, 'appearance', 'toggle', false],
      [TWEAK_KEY.sticky, 'appearance', 'toggle', false],
    ])
  })
})
