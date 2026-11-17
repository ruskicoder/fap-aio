// Density, width and sticky headers (appearance R7.1 to R7.5; design, "Density, width, sticky"): one CSS
// fragment per option in the `base` layer, switched by `html` classes so FAP's own attributes stay
// untouched. Each option is its own setting, off by default, applied without reload on every FAP page.
import { read, subscribe } from '../../../shared/storage/catalog'
import type { StylePipeline } from '../pipeline'

export const TWEAKS = ['compact', 'wide', 'sticky'] as const
export type Tweak = (typeof TWEAKS)[number]
export type TweakFlags = Record<Tweak, boolean>

export const TWEAK_CLASS: Record<Tweak, string> = { compact: 'fap-aio-compact', wide: 'fap-aio-wide', sticky: 'fap-aio-sticky' }
export const TWEAK_KEY: Record<Tweak, string> = { compact: 'appearance.layout.compact', wide: 'appearance.layout.wide', sticky: 'appearance.layout.sticky' }

const SHEETS = ['table.fap-sheet', 'table.student-mark-sheet']
const C = `html.${TWEAK_CLASS.compact}`
const W = `html.${TWEAK_CLASS.wide}`
const S = `html.${TWEAK_CLASS.sticky}`

/** The fragment for all three options; only the ones whose class is on `html` take effect. */
export function tweaksCss(stickyTop: number): string {
  const top = Math.max(0, Math.round(stickyTop))
  return [
    // Compact (R7.1): cell padding 0.25rem 0.5rem, line height 1.3, card body padding 0.75rem.
    `${C} .table > :not(caption) > * > * { padding: 0.25rem 0.5rem; }`,
    `${C} .table { line-height: 1.3; }`,
    `${C} .card-body { padding: 0.75rem; }`,
    `${C} .page-title-box { min-height: 0; padding-top: 0.25rem; padding-bottom: 0.25rem; }`,
    // Wide (R7.2): no max-width on the Jidox wrappers and containers.
    `${W} .wrapper, ${W} .content-page, ${W} .content-page .content, ${W} .container-fluid, ${W} .container, ${W} .container-xxl, ${W} .container-xl, ${W} .container-lg { max-width: none !important; }`,
    // Sticky (R7.3): the header row stays under the top bar; the table's scroll box must not capture it.
    `${S} { --fap-aio-sticky-top: ${top}px; }`,
    `${S} .table-responsive:has(> ${SHEETS[0]}), ${S} .table-responsive:has(> ${SHEETS[1]}) { overflow: visible; }`,
    `${SHEETS.map((t) => `${S} ${t} > thead > tr > th`).join(', ')} { position: sticky; top: var(--fap-aio-sticky-top, 0px); z-index: 2; background-color: var(--ct-card-bg, var(--ct-secondary-bg, var(--ct-body-bg, #fff))); box-shadow: inset 0 -1px 0 var(--ct-border-color, #dee2e6); }`,
  ].join('\n')
}

export function flagsOf(settings: Record<string, unknown> | null | undefined): TweakFlags {
  return Object.fromEntries(TWEAKS.map((t) => [t, settings?.[TWEAK_KEY[t]] === true])) as TweakFlags
}

/** The height of FAP's top bar when it stays on screen (fixed or sticky), else 0. */
export function measureTop(doc: Document): number {
  const bar = doc.querySelector<HTMLElement>('.navbar-custom')
  if (!bar) return 0
  const pos = doc.defaultView?.getComputedStyle(bar).position
  return pos === 'fixed' || pos === 'sticky' ? bar.getBoundingClientRect().height : 0
}

export interface Tweaks { apply(flags: TweakFlags): void; flags(): TweakFlags; ready: Promise<void> }

export function startTweaks(pipeline: StylePipeline, doc: Document = document, win: Window = window): Tweaks {
  let flags: TweakFlags = flagsOf(null)
  let top = 0
  const render = () => {
    for (const t of TWEAKS) doc.documentElement.classList.toggle(TWEAK_CLASS[t], flags[t])
    // No sheet at all while every option is off.
    pipeline.set('base', TWEAKS.some((t) => flags[t]) ? tweaksCss(top) : null)
    pipeline.apply()
  }
  const apply = (next: TweakFlags) => { flags = next; render() }
  // The top bar exists only once the page is parsed; its height changes with the window (R7.3).
  const remeasure = () => {
    const h = measureTop(doc)
    if (h !== top) { top = h; render() }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', remeasure, { once: true })
  else remeasure()
  win.addEventListener('resize', remeasure)

  let changed = false
  subscribe('settings', (v) => { changed = true; apply(flagsOf(v)) })
  const first = (v: Record<string, unknown> | null) => { if (!changed) apply(flagsOf(v)) }
  const ready = read('settings').then(first, () => first(null))
  return { apply, flags: () => flags, ready }
}
