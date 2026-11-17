// The document_start part of the appearance module (R1.1, R1.3 to R1.6, R4.6, R5.5): reads
// `appearance.active`, adopts the theme layers, forces the mode, and re-applies on change without reload.
// Holding Shift while the page loads starts in safe mode for this page (custom CSS off).
import { read, subscribe } from '../../shared/storage/catalog'
import { StylePipeline, THEME_LAYERS, userCss, varsCss } from './pipeline'
import { ModeGuard } from './mode'
import { parseActive, resolveStyle, type AppearanceActive } from './state'

export const SAFE_CLASS = 'fap-aio-safe'

export interface Appearance {
  pipeline: StylePipeline
  mode: ModeGuard
  /** Applies a state now (used on load, on storage change and on a colour-scheme change). */
  render(state: AppearanceActive): void
  ready: Promise<void>
}

export function startAppearance(doc: Document = document, win: Window = window): Appearance {
  const pipeline = new StylePipeline(doc)
  const mode = new ModeGuard(doc.documentElement)
  const media = win.matchMedia?.('(prefers-color-scheme: dark)')
  let state: AppearanceActive = parseActive(null)
  let shiftSafe = false

  const render = (next: AppearanceActive) => {
    state = next
    const style = resolveStyle(state, media?.matches ?? false)
    if (!style) {
      for (const l of THEME_LAYERS) pipeline.set(l, null)
      pipeline.apply()
      mode.restore()
      return
    }
    pipeline.set('vars', varsCss(style))
    pipeline.set('effects', style.effects)
    pipeline.set('user', userCss(style, state.safeMode || shiftSafe))
    pipeline.apply()
    mode.force(style.mode)
  }

  // Shift held during load: safe mode for this page only, signalled to the panel by a class (R4.6).
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Shift' || shiftSafe) return
    shiftSafe = true
    doc.documentElement.classList.add(SAFE_CLASS)
    render(state)
  }
  doc.addEventListener('keydown', onKey, true)
  win.addEventListener('load', () => doc.removeEventListener('keydown', onKey, true), { once: true })

  media?.addEventListener?.('change', () => render(state))
  // A change that arrives before the first read wins over that read's older value.
  let changed = false
  subscribe('appearance.active', (v) => { changed = true; render(parseActive(v)) })
  const first = (v: unknown) => { if (!changed) render(parseActive(v)) }
  const ready = read('appearance.active').then(first, () => first(null))
  return { pipeline, mode, render, ready }
}
