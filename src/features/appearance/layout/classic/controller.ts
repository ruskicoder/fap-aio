// The Classic layout switch (appearance R6.1, R6.8): on, it adopts the `classic` layer and applies the
// patches of every registered Classic part, re-applying them after FAP swaps a partial; off, it reverts
// them in reverse order and clears the layer, without reload. Independent of the theme and of FAP default.
import { read, subscribe } from '../../../../shared/storage/catalog'
import type { StylePipeline } from '../../pipeline'
import { HIDDEN_CLASS, PatchLog, type Patch } from './patch'

export const CLASSIC_KEY = 'appearance.layout.classic'
export const CLASSIC_CLASS = 'fap-aio-classic'
const BASE_CSS = `.${HIDDEN_CLASS} { display: none !important; }`

export interface ClassicPart {
  id: string
  /** Rules for the `classic` layer. */
  css?: string
  /** Patches for this page; called each time Classic turns on. */
  patches?: (doc: Document) => Patch[]
}

const parts: ClassicPart[] = []
export function registerClassicPart(part: ClassicPart): void {
  const i = parts.findIndex((p) => p.id === part.id)
  if (i >= 0) parts[i] = part
  else parts.push(part)
}
export const classicParts = (): readonly ClassicPart[] => parts
export function clearClassicParts(): void { parts.length = 0 }

export interface Classic {
  readonly on: boolean
  /** Patch ids whose target was missing on this page ("Classic layout partly unavailable"). */
  readonly missing: readonly string[]
  set(on: boolean): void
  ready: Promise<void>
}

export function startClassic(pipeline: StylePipeline, doc: Document = document): Classic {
  const log = new PatchLog()
  let on = false
  let missing: string[] = []
  let observer: MutationObserver | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const patchPage = () => {
    if (!on || log.size) return
    const r = log.apply(parts.flatMap((p) => p.patches?.(doc) ?? []))
    missing = r.missing
    observer = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => { if (on) log.refresh() }, 50)
    })
    observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true })
  }

  const set = (next: boolean) => {
    if (next === on) return
    on = next
    doc.documentElement.classList.toggle(CLASSIC_CLASS, on)
    if (on) {
      pipeline.set('classic', [BASE_CSS, ...parts.map((p) => p.css ?? '')].filter(Boolean).join('\n'))
      pipeline.apply()
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', patchPage, { once: true })
      else patchPage()
    } else {
      observer?.disconnect()
      observer = null
      clearTimeout(timer)
      log.revertAll()
      missing = []
      pipeline.set('classic', null)
      pipeline.apply()
    }
  }

  let changed = false
  subscribe('settings', (v) => { changed = true; set(v?.[CLASSIC_KEY] === true) })
  const first = (v: Record<string, unknown> | null) => { if (!changed) set(v?.[CLASSIC_KEY] === true) }
  const ready = read('settings').then(first, () => first(null))
  return {
    get on() { return on },
    get missing() { return missing },
    set,
    ready,
  }
}
