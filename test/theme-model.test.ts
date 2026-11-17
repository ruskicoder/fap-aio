// APP-3.1: theme model and the role to variable map (appearance R1.2, R3.6).
import { describe, expect, it } from 'vitest'
import { BOOTSTRAP_VARS, CT_VARS, JIDOX_VARS } from '../src/features/appearance/themes/css-vars'
import { LEFT_ALONE, ROLE_MAP, TOKEN_VARS, roleVars, tokenVars } from '../src/features/appearance/themes/role-map'
import { parseTheme, themeVars, toActiveStyle, type ThemeInput } from '../src/features/appearance/themes/model'
import { activeStyle } from '../src/features/appearance/state'
import { assignRoles, contrast, harmony, parseColor, rgbToOklch } from '../src/features/appearance/color'

const mapped = Object.values(ROLE_MAP).flat()

describe('variable inventory and role map', () => {
  it('list the Bootstrap 5.3 root set renamed to --ct- plus the Jidox menu and top bar names', () => {
    expect(BOOTSTRAP_VARS).toHaveLength(117)
    expect(new Set(CT_VARS).size).toBe(CT_VARS.length)
    expect(CT_VARS.every((v) => /^--ct-[a-z0-9-]+$/.test(v))).toBe(true)
    expect(JIDOX_VARS).toContain('--ct-menu-bg')
  })

  it('put every variable in exactly one place: a role, a token, or left alone', () => {
    const places = new Map<string, string[]>()
    for (const [role, names] of Object.entries(ROLE_MAP)) for (const n of names) places.set(n, [...(places.get(n) ?? []), role])
    for (const n of TOKEN_VARS) places.set(n, [...(places.get(n) ?? []), 'token'])
    for (const n of LEFT_ALONE) places.set(n, [...(places.get(n) ?? []), 'alone'])
    const missing = CT_VARS.filter((v) => !places.has(v))
    const twice = [...places].filter(([, p]) => p.length > 1).map(([n, p]) => `${n}: ${p.join(', ')}`)
    const unknown = [...places.keys()].filter((n) => !CT_VARS.includes(n))
    expect({ missing, twice, unknown }).toEqual({ missing: [], twice: [], unknown: [] })
  })

  it('generate exactly the mapped names, readable in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const base of ['#f36f21', '#2563eb', '#ffe600', '#16a34a']) {
        const roles = assignRoles(harmony(rgbToOklch(parseColor(base)!), 'triadic').map((m) => m.hex), mode)
        const v = roleVars(roles, mode)
        expect(Object.keys(v).sort()).toEqual([...new Set(mapped)].sort())
        expect(contrast(v['--ct-body-color']!, v['--ct-body-bg']!)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--ct-link-color']!, v['--ct-body-bg']!)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--ct-link-hover-color']!, v['--ct-body-bg']!)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--ct-code-color']!, v['--ct-body-bg']!)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(v['--ct-highlight-color']!, v['--ct-highlight-bg']!)).toBeGreaterThanOrEqual(4.5)
        for (const k of ['primary', 'secondary', 'success', 'warning', 'danger', 'info']) {
          expect(contrast(v[`--ct-${k}-text-emphasis`]!, v[`--ct-${k}-bg-subtle`]!)).toBeGreaterThanOrEqual(4.5)
          expect(v[`--ct-${k}-rgb`]).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/)
        }
        expect(v['--ct-focus-ring-color']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.25\)$/)
      }
    }
  })

  it('turn tokens into radius, shadow and font variables', () => {
    const t = tokenVars({ radius: 12, shadow: 'glow', blur: 0, surfaceOpacity: 1, fontFamily: 'Inter, sans-serif' }, '#ff0000', 'light')
    expect(Object.keys(t).sort()).toEqual([...TOKEN_VARS].sort())
    expect(t['--ct-border-radius']).toBe('12px')
    expect(t['--ct-border-radius-sm']).toBe('7.9px')
    expect(t['--ct-box-shadow']).toBe('0 0 16px rgba(255, 0, 0, 0.35)')
    expect(tokenVars({ radius: 0, shadow: 'none', blur: 0, surfaceOpacity: 1, fontFamily: 'x' }, '#000', 'dark')['--ct-box-shadow-lg']).toBe('none')
  })
})

const sample = (over: Partial<ThemeInput> = {}): ThemeInput => ({
  formatVersion: 1, id: 'my-theme', name: 'My theme', mode: 'light',
  roles: { ...assignRoles(['#f36f21'], 'light'), primary: 'rgb(243, 111, 33)' },
  vars: { '--ct-link-color': '#123456' },
  tokens: { radius: 8, shadow: 'soft', blur: 0, surfaceOpacity: 1, fontFamily: 'system-ui, sans-serif' },
  effects: '', background: null, css: '', ...over,
})

describe('theme model', () => {
  it('validate a theme and store colours as hex', () => {
    const r = parseTheme(sample())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.theme.roles.primary).toBe('#f36f21')
  })

  it('reject bad ids, colours, variable names and unsafe values', () => {
    const bad = (o: Partial<ThemeInput>) => { const r = parseTheme(sample(o)); return r.ok ? '' : r.error }
    expect(bad({ id: 'My Theme' })).toMatch(/^id:/)
    expect(bad({ roles: { ...sample().roles, accent: 'blurple' } })).toContain('roles.accent: not a colour')
    expect(bad({ vars: { '--bs-primary': '#fff' } })).toContain('vars')
    expect(bad({ vars: { '--ct-primary': 'red; } body { display: none' } })).toContain('unsafe CSS value')
    expect(bad({ tokens: { ...sample().tokens, fontFamily: 'x}' } })).toContain('tokens.fontFamily')
    expect(parseTheme({ formatVersion: 2 }).ok).toBe(false)
  })

  it('resolve to an active style: roles, then tokens, then explicit overrides', () => {
    const r = parseTheme(sample())
    if (!r.ok) throw new Error(r.error)
    const vars = themeVars(r.theme)
    expect(vars['--ct-link-color']).toBe('#123456')
    expect(vars['--ct-primary']).toBe('#f36f21')
    expect(vars['--ct-border-radius']).toBe('8px')
    const s = toActiveStyle(r.theme)
    expect(activeStyle.safeParse(s).success).toBe(true)
    expect(s.roles.accent).toBe(r.theme.roles.accent)
  })
})
