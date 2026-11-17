// The document_start part of the appearance module (R1.1, R1.3 to R1.6, R4.6, R5.5): reads
// `appearance.active`, adopts the theme layers, forces the mode, and re-applies on change without reload.
// Holding Shift while the page loads starts in safe mode for this page (custom CSS off).
import { read, subscribe } from '../../shared/storage/catalog'
import { StylePipeline, THEME_LAYERS, userCss, varsCss } from './pipeline'
import { ModeGuard } from './mode'
import { parseActive, resolveStyle, type AppearanceActive } from './state'
import { startTweaks, type Tweaks } from './layout/tweaks'
import { startClassic, type Classic } from './layout/classic/controller'
import { PREVIEW_EVENT, readPreview, type Preview } from './preview'

export const SAFE_CLASS = 'fap-aio-safe'

export interface Appearance {
  pipeline: StylePipeline
  mode: ModeGuard
  /** Compact, wide and sticky (R7), independent of the theme and of FAP default. */
  tweaks: Tweaks
  /** Classic layout (R6), independent of the theme and of FAP default. */
  classic: Classic
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
  // A theme previewed from the panel on this page; it wins over the stored choice until it ends (R2.5).
  let preview: Preview | null = null

  const render = (next: AppearanceActive) => {
    state = next
    const style = preview ? (preview.kind === 'style' ? preview.style : null) : resolveStyle(state, media?.matches ?? false)
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
  doc.addEventListener(PREVIEW_EVENT, (e) => { preview = readPreview(e); render(state) })
  // A change that arrives before the first read wins over that read's older value.
  let changed = false
  subscribe('appearance.active', (v) => { changed = true; render(parseActive(v)) })
  const first = (v: unknown) => { if (!changed) render(parseActive(v)) }
  const tweaks = startTweaks(pipeline, doc, win)
  const classic = startClassic(pipeline, doc)
  const ready = Promise.all([read('appearance.active').then(first, () => first(null)), tweaks.ready, classic.ready]).then(() => undefined)
  return { pipeline, mode, tweaks, classic, render, ready }
}
