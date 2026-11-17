// StylePipeline (appearance design): one persistent constructed stylesheet per layer, adopted by the
// document after FAP's own adopted sheets in a fixed order. Constructed sheets are CSSOM, which FAP's
// `style-src 'self'` does not block. Nothing is written to FAP storage (R1.6).
import type { ActiveStyle } from './state'

export const LAYERS = ['base', 'vars', 'effects', 'classic', 'dock', 'user'] as const
export type Layer = (typeof LAYERS)[number]

/** Layers that belong to the theme. Classic and dock are layout and stay on under FAP default (R6.1, panel-ux R1.5). */
export const THEME_LAYERS: readonly Layer[] = ['vars', 'effects', 'user']

export class StylePipeline {
  private readonly sheets = new Map<Layer, CSSStyleSheet>()
  private readonly texts = new Map<Layer, string>()

  constructor(private readonly doc: Document = document) {}

  /** Sets one layer's CSS (null or empty turns it off). Call apply() to adopt. */
  set(layer: Layer, css: string | null): void {
    if (!css) {
      this.texts.delete(layer)
      return
    }
    let sheet = this.sheets.get(layer)
    if (!sheet) this.sheets.set(layer, (sheet = new CSSStyleSheet()))
    if (this.texts.get(layer) !== css) sheet.replaceSync(css)
    this.texts.set(layer, css)
  }

  get(layer: Layer): string | null {
    return this.texts.get(layer) ?? null
  }

  /** Keeps every sheet that is not ours in place and puts ours after them in layer order (R4.5). */
  apply(): void {
    const ours = new Set(this.sheets.values())
    const foreign = this.doc.adoptedStyleSheets.filter((s) => !ours.has(s))
    const active = LAYERS.filter((l) => this.texts.has(l)).map((l) => this.sheets.get(l)!)
    this.doc.adoptedStyleSheets = [...foreign, ...active]
  }
}

/** `--ct-*` overrides scoped above Jidox's `:root` and `[data-bs-theme]` rules (R1.2, R3.6). */
export function varsCss(style: ActiveStyle): string {
  const decls = Object.entries(style.vars).map(([k, v]) => `${k}:${v};`).join('')
  return decls ? `html[data-bs-theme=${style.mode}]{${decls}}` : ''
}

/** Background image and custom CSS; custom CSS is left out in safe mode (R4.4, R4.5, R4.6). */
export function userCss(style: ActiveStyle, safe: boolean): string {
  const parts: string[] = []
  const bg = style.background
  if (bg) {
    const dim = `linear-gradient(rgba(0,0,0,${bg.dim}),rgba(0,0,0,${bg.dim}))`
    const size = bg.fit === 'tile' ? 'auto' : bg.fit
    const repeat = bg.fit === 'tile' ? 'repeat' : 'no-repeat'
    // Same specificity as the preset effects' body rule, so the later user layer wins (R4.5).
    parts.push(`html[data-bs-theme] body{background-image:${dim},url("${bg.dataUrl}");background-size:${size};background-repeat:${repeat};background-position:center;background-attachment:fixed}`)
  }
  if (!safe && style.css) parts.push(style.css)
  return parts.join('\n')
}
