// Reversible DOM patches for the Classic layout (appearance R6.8; design, ClassicLayout): FAP elements
// are hidden by a class or moved, never removed, and our own blocks are inserted as separate hosts.
// Reverting restores the page byte for byte, attribute text included.

export const HIDDEN_CLASS = 'fap-aio-classic-hidden'
export const HOST_ATTR = 'data-fap-aio-classic'

export interface Patch {
  readonly id: string
  /** Applies the patch; false when its target is missing (the FAP layout changed). */
  apply(): boolean
  /** True while the page still shows the patch; false after FAP re-rendered its target. */
  applied(): boolean
  revert(): void
}

type Find = () => Element | null

/** Hides an element with a class; the original `class` attribute text comes back on revert. */
export function hide(id: string, find: Find): Patch {
  let el: Element | null = null
  let original: string | null = null
  const restore = () => {
    if (!el) return
    const tokens = (el.getAttribute('class') ?? '').split(/\s+/).filter((t) => t && t !== HIDDEN_CLASS)
    const before = (original ?? '').split(/\s+/).filter(Boolean)
    if (tokens.join(' ') === before.join(' ')) {
      if (original === null) el.removeAttribute('class')
      else el.setAttribute('class', original)
    } else el.classList.remove(HIDDEN_CLASS)
    el = null
  }
  return {
    id,
    apply() {
      const t = find()
      if (!t) return false
      if (t === el && t.classList.contains(HIDDEN_CLASS)) return true
      restore()
      el = t
      original = t.getAttribute('class')
      t.classList.add(HIDDEN_CLASS)
      return true
    },
    applied: () => !!el && el.isConnected && el === find() && el.classList.contains(HIDDEN_CLASS),
    revert: restore,
  }
}

const tokens = (v: string | null) => (v ?? '').split(/\s+/).filter(Boolean)

/**
 * Adds classes to every element `findAll` returns, including ones FAP renders later (re-applied by the
 * log's refresh); revert gives each element back its original `class` attribute text. Never reports a
 * missing target, since the elements may arrive with a partial after the patch is applied.
 */
export function markAll(id: string, findAll: () => Element[], classesOf: (el: Element) => string[]): Patch {
  const marked = new Map<Element, { original: string | null; added: string[] }>()
  const restore = (el: Element) => {
    const m = marked.get(el)
    if (!m) return
    marked.delete(el)
    const rest = tokens(el.getAttribute('class')).filter((t) => !m.added.includes(t))
    if (rest.join(' ') === tokens(m.original).join(' ')) {
      if (m.original === null) el.removeAttribute('class')
      else el.setAttribute('class', m.original)
    } else el.classList.remove(...m.added)
  }
  const fits = (el: Element) => marked.has(el) && classesOf(el).every((c) => el.classList.contains(c))
  return {
    id,
    apply() {
      for (const el of [...marked.keys()]) if (!el.isConnected) marked.delete(el)
      for (const el of findAll()) {
        if (fits(el)) continue
        restore(el)
        const added = classesOf(el).filter((c) => !el.classList.contains(c))
        marked.set(el, { original: el.getAttribute('class'), added })
        el.classList.add(...added)
      }
      return true
    },
    applied: () => findAll().every(fits),
    revert() { for (const el of [...marked.keys()]) restore(el) },
  }
}

/** Moves an element into a new parent (before `before` when given); revert puts it back in its place. */
export function move(id: string, find: Find, parent: Find, before: Find = () => null): Patch {
  let el: Element | null = null
  let home: { parent: Node; next: Node | null } | null = null
  return {
    id,
    apply() {
      const t = find()
      const p = parent()
      if (!t || !p || !t.parentNode) return false
      if (t === el && t.parentNode === p) return true
      el = t
      home = { parent: t.parentNode, next: t.nextSibling }
      const b = before()
      p.insertBefore(t, b && b.parentNode === p ? b : null)
      return true
    },
    applied: () => !!el && el.isConnected && el === find() && el.parentNode === parent(),
    revert() {
      if (el && home && home.parent.isConnected) home.parent.insertBefore(el, home.next && home.next.parentNode === home.parent ? home.next : null)
      el = null
      home = null
    },
  }
}

/** Inserts a host element of ours (marked with `data-fap-aio-classic`) at the start of a parent or before an element. */
export function insert(id: string, parent: Find, make: (doc: Document) => HTMLElement, before: Find | 'start' = 'start'): Patch {
  let host: HTMLElement | null = null
  return {
    id,
    apply() {
      const p = parent()
      if (!p) return false
      if (host?.isConnected && host.parentNode === p) return true
      host?.remove()
      host = make(p.ownerDocument ?? document)
      host.setAttribute(HOST_ATTR, id)
      const b = before === 'start' ? p.firstChild : before()
      p.insertBefore(host, b && b.parentNode === p ? b : null)
      return true
    },
    applied: () => !!host && host.isConnected && host.parentNode === parent(),
    revert() { host?.remove(); host = null },
  }
}

/**
 * Applied patches in order; `revertAll` undoes them in reverse order. `refresh` re-applies the ones a
 * partial swap undid, so it can run from a MutationObserver without looping on our own changes.
 */
export class PatchLog {
  private readonly log: Patch[] = []

  apply(patches: readonly Patch[]): { applied: string[]; missing: string[] } {
    const applied: string[] = []
    const missing: string[] = []
    for (const p of patches) {
      if (p.apply()) { applied.push(p.id); if (!this.log.includes(p)) this.log.push(p) } else missing.push(p.id)
    }
    return { applied, missing }
  }

  refresh(): string[] {
    const redone: string[] = []
    for (const p of this.log) if (!p.applied() && p.apply()) redone.push(p.id)
    return redone
  }

  revertAll(): void {
    for (const p of [...this.log].reverse()) p.revert()
    this.log.length = 0
  }

  get size(): number { return this.log.length }
}
