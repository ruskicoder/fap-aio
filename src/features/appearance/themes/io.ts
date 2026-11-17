// Theme files (appearance R5.1 to R5.4; design, "Import and export"; platform R7.4): export a theme as JSON
// through a blob link, and import one as untrusted input: size caps, the zod schema, then the CSS, the
// preset-style effects and every variable value sanitized (`@import` and web addresses removed, each listed
// for the student). The caller previews the result with an outside-CSS warning before it is saved.
import { call } from '../../../shared/call'
import { stillUnsafe } from '../../../shared/css-safety'
import { assignRoles } from '../color/roles'
import { parseTheme, type Theme } from './model'
import { presetById } from './presets'

export const MAX_FILE = 2_000_000
export const MAX_CSS = 200_000

export const exportText = (t: Theme) => JSON.stringify(t, null, 2)
export const exportName = (t: Theme) => `fap-aio-theme-${t.id}.json`

/** Starts the download from a blob link in the panel (platform amendment: no `downloads`). */
export function downloadTheme(container: Node, t: Theme): void {
  const url = URL.createObjectURL(new Blob([exportText(t)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = exportName(t)
  a.hidden = true
  container.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export type Sanitize = (css: string) => Promise<{ css: string; removed: string[] } | { error: string }>
export const sanitizeInWorker: Sanitize = async (css) => {
  const r = await call<{ css: string; removed: string[] } | { error: string }>({ type: 'css.sanitize', css }).catch(() => null)
  return r && r.ok ? r.value : { error: 'The CSS could not be checked right now; try again.' }
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'theme'

/** A fresh custom theme to start from (R5.1). */
export function newTheme(taken: readonly string[]): Theme {
  let n = 1
  while (taken.includes(`custom-${n}`)) n++
  return {
    formatVersion: 1, id: `custom-${n}`, name: n === 1 ? 'My theme' : `My theme ${n}`, mode: 'light',
    roles: assignRoles(['#f36f21'], 'light'), vars: {},
    tokens: { radius: 8, shadow: 'soft', blur: 0, surfaceOpacity: 1, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    effects: '', background: null, css: '',
  }
}

export interface Imported { theme: Theme; removed: string[] }

export async function importTheme(text: string, taken: readonly string[], sanitize: Sanitize = sanitizeInWorker): Promise<Imported | { error: string }> {
  if (text.length > MAX_FILE) return { error: 'This file is over 2 MB, which is too large for a theme.' }
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { error: 'This file is not a FAP-AIO theme (it is not JSON).' } }
  const o = raw as { css?: unknown; effects?: unknown }
  for (const k of ['css', 'effects'] as const) {
    if (typeof o?.[k] === 'string' && (o[k] as string).length > MAX_CSS) return { error: `Its ${k === 'css' ? 'custom CSS is' : 'style rules are'} over 200 KB.` }
  }
  const p = parseTheme(raw)
  if (!p.ok) return { error: `This file is not a FAP-AIO theme: ${p.error}` }
  const t = p.theme
  const removed: string[] = []
  const clean = async (css: string, where: string) => {
    if (!css) return ''
    const r = await sanitize(css)
    if ('error' in r) throw new Error(r.error)
    removed.push(...r.removed.map((x) => `${x} (${where})`))
    return r.css
  }
  let css: string
  let effects: string
  try {
    css = await clean(t.css, 'custom CSS')
    effects = await clean(t.effects, 'style rules')
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(t.vars)) {
    if (stillUnsafe(v)) removed.push(`web address in ${k}`)
    else vars[k] = v
  }
  let id = `imported-${slug(t.name)}`
  for (let n = 2; taken.includes(id) || presetById(id); n++) id = `imported-${slug(t.name)}-${n}`
  return { theme: { ...t, id, css, effects, vars, preset: t.preset && presetById(t.preset) ? t.preset : undefined }, removed }
}
