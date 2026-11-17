// Preset effects (appearance R2.3; design, presets table): one builder turns a preset's look into style
// rules on FAP's own selectors (`.card`, `.btn`, `.table`, `.leftside-menu`, `.navbar-custom`,
// `.form-control`, `.dropdown-menu`, `.modal-content`). Gradients are CSS only, so no image is needed.
// Rules sit in the `effects` layer, after FAP's sheets; the panel is in its own shadow root and unaffected.

export interface Look {
  /** CSS background of the page body. */
  body: string
  /** Background of cards, menus and dialogs (may be translucent). */
  surface: string
  /** Border of those surfaces. */
  edge: string
  shadow: string
  radius: number
  /** Frosted glass: blur in px and saturation in percent. */
  blur?: number
  saturate?: number
  /** Background of the sidebar and the top bar. */
  chrome: string
  /** Form field border, at least 3:1 against the surface (R2.4). */
  inputBorder: string
  /** Extra declarations for buttons, such as a gloss. */
  button?: string
  /** Shadow of pressed buttons and focused fields (neumorphism, clay). */
  pressed?: string
  /** Any further rules. */
  extra?: string
}

const S = 'html[data-bs-theme]'

export function effectsCss(l: Look): string {
  const glass = l.blur ? `backdrop-filter: blur(${l.blur}px) saturate(${l.saturate ?? 100}%);` : ''
  const r = l.radius
  return [
    `${S} body { background: ${l.body}; background-attachment: fixed; }`,
    `${S} .card, ${S} .dropdown-menu, ${S} .modal-content { background: ${l.surface}; border: ${l.edge}; box-shadow: ${l.shadow}; border-radius: ${r}px; ${glass} }`,
    `${S} .card > .card-header, ${S} .card > .card-footer { background: transparent; }`,
    `${S} .page-title-box { background: ${l.surface}; border: ${l.edge}; border-radius: ${r}px; padding: 0.25rem 0.75rem; margin-top: 0.75rem; ${glass} }`,
    `${S} .leftside-menu, ${S} .navbar-custom { background: ${l.chrome}; ${glass} }`,
    `${S} .table { --ct-table-bg: transparent; background: transparent; }`,
    `${S} .form-control, ${S} .form-select { border-color: ${l.inputBorder}; border-radius: ${Math.round(r * 0.66)}px; }`,
    `${S} .btn { border-radius: ${Math.round(r * 0.75)}px; ${l.button ?? ''} }`,
    l.pressed ? `${S} .btn:active, ${S} .btn.active, ${S} .form-control:focus, ${S} .form-select:focus { box-shadow: ${l.pressed}; }` : '',
    l.extra ?? '',
  ].filter(Boolean).join('\n')
}
