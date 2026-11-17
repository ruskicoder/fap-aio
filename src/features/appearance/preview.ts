// Live preview of a theme on this page only (appearance R2.5): the panel sends a DOM event that the
// document_start entry listens for; nothing is stored, so other tabs and the next page are unaffected.
// The style is validated like a stored one before it is applied.
import { activeStyle, type ActiveStyle } from './state'

export const PREVIEW_EVENT = 'fap-aio:theme-preview'

export type Preview = { kind: 'style'; style: ActiveStyle } | { kind: 'fap-default' }

/** Shows a preview, or ends it with null. */
export function sendPreview(p: Preview | null, doc: Document = document): void {
  doc.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: p ? JSON.stringify(p) : null }))
}

/** Reads a preview event; anything invalid ends the preview. */
export function readPreview(e: Event): Preview | null {
  const raw = (e as CustomEvent<unknown>).detail
  if (typeof raw !== 'string') return null
  try {
    const p = JSON.parse(raw) as { kind?: unknown; style?: unknown }
    if (p.kind === 'fap-default') return { kind: 'fap-default' }
    if (p.kind === 'style') { const s = activeStyle.safeParse(p.style); return s.success ? { kind: 'style', style: s.data } : null }
  } catch { /* not ours */ }
  return null
}
