// Source registry (core R4.1 to R4.3): each FAP data source is declared once with its route,
// page or partial, parser and cache lifetime. Reads go through the queued access layer; results
// are cached in `cache:<sourceId>` keyed by params; a parser failure becomes `layout-changed`
// naming the source and the last good copy is kept.
import { read as readStore, update } from '../../shared/storage/catalog'
import { queuedGet, type Priority } from './queue'
import type { FapError, FapResult } from './access'

export type Params = Record<string, string>

export interface SourceDef<T> {
  id: string
  route: (params: Params) => string
  partial: boolean
  parse: (doc: Document, params: Params) => T
  cacheTtlMs: number
  background?: { periodMin: number }
}

/** Thrown by parsers when the structure they need is missing. */
export class LayoutChangedError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = 'LayoutChangedError'
  }
}

export type SourceResult<T> = (FapResult<T> & { cached?: boolean }) | { ok: false; error: FapError }

const defs = new Map<string, SourceDef<unknown>>()

export function register<T>(def: SourceDef<T>): void {
  defs.set(def.id, def as SourceDef<unknown>)
}

export function sources(): SourceDef<unknown>[] {
  return [...defs.values()]
}

export const paramKey = (p: Params) => JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]))

/** The cached copy, whatever its age. */
export async function peek<T>(id: string, params: Params = {}): Promise<{ value: T; fetchedAt: number } | null> {
  const c = await readStore(`cache:${id}`)
  const e = c?.entries[paramKey(params)]
  return e ? { value: e.value as T, fetchedAt: e.fetchedAt } : null
}

export async function read<T>(id: string, params: Params = {}, opts: { force?: boolean; priority?: Priority } = {}): Promise<SourceResult<T>> {
  const def = defs.get(id) as SourceDef<T> | undefined
  if (!def) throw new Error(`unknown source ${id}`)
  if (!opts.force) {
    const c = await peek<T>(id, params)
    if (c && Date.now() - c.fetchedAt < def.cacheTtlMs) return { ok: true, value: c.value, fetchedAt: c.fetchedAt, cached: true }
  }
  const r = await queuedGet(def.route(params), { partial: def.partial, source: id, priority: opts.priority ?? 'user' })
  if (!r.ok) return r
  let value: T
  try {
    value = def.parse(r.value, params)
  } catch (e) {
    return { ok: false, error: { kind: 'layout-changed', source: id, detail: e instanceof Error ? e.message : String(e) } }
  }
  const key = paramKey(params)
  await update(`cache:${id}`, (old) => ({ entries: { ...(old?.entries ?? {}), [key]: { value, fetchedAt: r.fetchedAt } } }))
  return { ok: true, value, fetchedAt: r.fetchedAt }
}
