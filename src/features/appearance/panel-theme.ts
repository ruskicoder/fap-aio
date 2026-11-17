// Derived `panel-theme` sheet adopted by the panel's shadow root (R1.7; panel-ux design "Visual system"):
// the active theme's mode and roles as `--aio-*` variables. Under FAP default the sheet is empty, so the
// agreed panel look is unchanged until a theme is chosen.
import { read, subscribe } from '../../shared/storage/catalog'
import { parseActive, resolveStyle, type ActiveStyle, type PanelRole } from './state'

const AIO_VARS: [PanelRole, string][] = [
  ['surface', '--aio-surface'],
  ['surfaceAlt', '--aio-surface-alt'],
  ['text', '--aio-text'],
  ['textMuted', '--aio-text-muted'],
  ['border', '--aio-border'],
  ['success', '--aio-success'],
  ['warning', '--aio-warning'],
  ['danger', '--aio-danger'],
]

export function panelThemeCss(style: ActiveStyle | null): string {
  if (!style) return ''
  const decls = [`color-scheme:${style.mode};`]
  const accent = style.roles.accent ?? style.roles.primary
  if (accent) decls.push(`--aio-accent:${accent};`)
  for (const [role, name] of AIO_VARS) {
    const v = style.roles[role]
    if (v) decls.push(`${name}:${v};`)
  }
  return `:host{${decls.join('')}}`
}

/** Adopts the panel-theme sheet into the shadow root and keeps it current. Returns an unsubscribe. */
export function installPanelTheme(shadow: ShadowRoot, win: Window = window): () => void {
  const sheet = new CSSStyleSheet()
  shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet]
  const media = win.matchMedia?.('(prefers-color-scheme: dark)')
  let state = parseActive(null)
  const render = () => sheet.replaceSync(panelThemeCss(resolveStyle(state, media?.matches ?? false)))
  const onMedia = () => render()
  media?.addEventListener?.('change', onMedia)
  void read('appearance.active').then((v) => { state = parseActive(v); render() })
  const off = subscribe('appearance.active', (v) => { state = parseActive(v); render() })
  return () => { off(); media?.removeEventListener?.('change', onMedia) }
}
