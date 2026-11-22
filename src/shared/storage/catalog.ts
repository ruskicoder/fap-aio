// The storage catalog (platform R4.1, R4.2, R4.5, R4.6; core R5.1, R5.2). Every
// chrome.storage.local key is listed here; all access goes through read, write, update and
// subscribe (migrations.ts also rewrites versioned records). Feature modules declare their value types by augmenting StoreMap.
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Versioned<T> {
  schemaVersion: number
  updatedAt: number
  data: T
}

/** Value types per key. Modules add their own: `declare module '.../catalog' { interface StoreMap { k: T } }`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StoreMap {}

const DAY = 86_400_000

export interface CatalogEntry {
  owner: string
  version: number
  size: string
  retention: string
  /** Applied inside write (R4.5). Receives the data and the current time. */
  prune?: (data: any, now: number) => any
}

const byAge = <T>(list: T[] | undefined, at: (x: T) => number, maxAge: number, now: number) =>
  (list ?? []).filter((x) => now - at(x) <= maxAge)
const dateMs = (d: string) => Date.parse(`${d}T00:00:00+07:00`)

export const CATALOG = {
  settings: { owner: 'panel-ux registry', version: 1, size: '< 10 KB', retention: 'permanent' },
  'panel.state': { owner: 'panel-ux', version: 2, size: '< 2 KB', retention: 'permanent' },
  'panel.prefs': {
    owner: 'panel-ux', version: 1, size: '< 5 KB', retention: 'recents 10',
    prune: (d: { recents?: string[] }) => ({ ...d, recents: (d.recents ?? []).slice(0, 10) }),
  },
  alerts: {
    owner: 'panel-ux inbox', version: 1, size: '< 100 KB', retention: '200 items, 60 days',
    prune: (d: { items?: { at: number }[] }, now: number) => ({
      ...d,
      items: byAge(d.items, (a) => a.at, 60 * DAY, now).sort((a, b) => b.at - a.at).slice(0, 200),
    }),
  },
  timetable: {
    owner: 'scheduler', version: 1, size: 'about 30 KB per term', retention: 'sessions older than 400 days pruned',
    prune: (d: { sessions?: { date: string }[] }, now: number) => ({ ...d, sessions: byAge(d.sessions, (s) => dateMs(s.date), 400 * DAY, now) }),
  },
  exams: {
    owner: 'scheduler', version: 1, size: '< 20 KB', retention: 'exams older than 400 days pruned',
    prune: (d: { exams?: { date: string }[] }, now: number) => ({ ...d, exams: byAge(d.exams, (e) => dateMs(e.date), 400 * DAY, now) }),
  },
  'sync.job': { owner: 'scheduler', version: 1, size: '< 2 KB', retention: 'deleted when the job ends' },
  'export.prefs': { owner: 'scheduler', version: 2, size: '< 2 KB', retention: 'removed when "Remember my choices" is unticked' },
  legacy: { owner: 'core', version: 1, size: '< 1 KB', retention: 'permanent' },
  'cache:*': {
    owner: 'registry', version: 1, size: 'per source, < 200 KB', retention: 'entries older than 30 days pruned',
    prune: (d: { entries?: Record<string, { fetchedAt: number }> }, now: number) => ({
      ...d,
      entries: Object.fromEntries(Object.entries(d.entries ?? {}).filter(([, e]) => now - e.fetchedAt <= 30 * DAY)),
    }),
  },
  'grades.cache': { owner: 'grades', version: 1, size: 'about 2 KB per mark sheet', retention: 'terms older than the last 12 pruned' },
  'grades.settings': { owner: 'grades', version: 1, size: '< 20 KB', retention: 'permanent' },
  // Full academic record (grades R14, GRD-7.2): every term's courses and mark sheets, kept past the registry's 30 days.
  'grades.record': { owner: 'grades', version: 1, size: 'about 2 KB per mark sheet, a few hundred KB in all', retention: 'permanent; replaced entry by entry on each read' },
  'grades.record.job': { owner: 'grades', version: 1, size: '< 20 KB', retention: 'deleted when the job ends' },
  'info.user': { owner: 'info', version: 1, size: '< 50 KB', retention: 'permanent' },
  'info.state': {
    owner: 'info', version: 1, size: '< 50 KB', retention: 'news seen 30 days',
    prune: (d: { newsSeen?: Record<string, number> }, now: number) => ({
      ...d,
      newsSeen: Object.fromEntries(Object.entries(d.newsSeen ?? {}).filter(([, at]) => now - at <= 30 * DAY)),
    }),
  },
  bg: { owner: 'info', version: 1, size: '< 1 KB', retention: 'permanent' },
  'appearance.active': { owner: 'appearance', version: 1, size: '< 450 KB (image up to 300 KB encoded)', retention: 'permanent' },
  'appearance.themes': { owner: 'appearance', version: 1, size: 'up to 1.5 MB per theme with an image', retention: '20 custom themes' },
  'data.status': { owner: 'platform', version: 1, size: '< 2 KB', retention: 'permanent' },
  'diag.counters': { owner: 'platform', version: 1, size: '< 2 KB', retention: 'reset by Copy diagnostics' },
  'storage.discarded': { owner: 'platform', version: 1, size: '< 1 KB', retention: 'cleared when the store is filled again' },
} satisfies Record<string, CatalogEntry>

type FixedKey = Exclude<keyof typeof CATALOG, 'cache:*'>
export type StoreKey = FixedKey | `cache:${string}`
type ValueOf<K extends StoreKey> = K extends keyof StoreMap ? StoreMap[K] : K extends `cache:${string}` ? CacheData : unknown

export interface CacheData { entries: Record<string, { value: unknown; fetchedAt: number }> }

export function entryFor(key: string): CatalogEntry | undefined {
  if (key.startsWith('cache:')) return CATALOG['cache:*']
  return (CATALOG as Record<string, CatalogEntry>)[key]
}

export function isCatalogKey(key: string): key is StoreKey {
  return entryFor(key) !== undefined
}

/** Reads the whole versioned record, any version. Used by migrations. */
export async function readRaw(key: StoreKey): Promise<Versioned<unknown> | null> {
  const got = (await chrome.storage.local.get(key))[key] as Versioned<unknown> | undefined
  return got ?? null
}

/**
 * Reads a store's data. A value written by an older schema version is not returned: the caller
 * gets null until the migration runs (see migrations.ts, readMigrated).
 */
export async function read<K extends StoreKey>(key: K): Promise<ValueOf<K> | null> {
  const got = await readRaw(key)
  if (!got || got.schemaVersion !== entryFor(key)!.version) return null
  return got.data as ValueOf<K>
}

export async function write<K extends StoreKey>(key: K, data: ValueOf<K>, now = Date.now()): Promise<void> {
  const entry = entryFor(key)
  if (!entry) throw new Error(`storage key not in catalog: ${key}`)
  const pruned = entry.prune ? entry.prune(data, now) : data
  await chrome.storage.local.set({ [key]: { schemaVersion: entry.version, updatedAt: now, data: pruned } satisfies Versioned<unknown> })
}

const chains = new Map<string, Promise<unknown>>()
/** Read-modify-write, serialized per key within this context. */
export function update<K extends StoreKey>(key: K, fn: (old: ValueOf<K> | null) => ValueOf<K>): Promise<ValueOf<K>> {
  const prev = chains.get(key) ?? Promise.resolve()
  const next = prev.then(async () => {
    const value = fn(await read(key))
    await write(key, value)
    return value
  })
  chains.set(key, next.catch(() => {}))
  return next
}

export async function remove(keys: StoreKey | StoreKey[]): Promise<void> {
  await chrome.storage.local.remove(keys as string | string[])
}

/** All keys currently stored. */
export async function storedKeys(): Promise<string[]> {
  return Object.keys(await chrome.storage.local.get(null))
}

/**
 * Calls back with the new data whenever the key changes in any context (replaces the
 * settings-changed broadcast). A key ending in ':' subscribes to the whole prefix.
 */
export function subscribe<K extends StoreKey>(key: K, cb: (data: ValueOf<K> | null, key: string) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local') return
    for (const [k, ch] of Object.entries(changes)) {
      const match = key.endsWith(':') ? k.startsWith(key) : k === key
      if (!match) continue
      const nv = ch.newValue as Versioned<unknown> | undefined
      cb(nv && nv.schemaVersion === entryFor(k)?.version ? (nv.data as ValueOf<K>) : null, k)
    }
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

/** Bytes per stored key and the total (R4.6). */
export async function usage(): Promise<{ perKey: Record<string, number>; total: number }> {
  const keys = await storedKeys()
  const perKey: Record<string, number> = {}
  for (const k of keys) perKey[k] = await chrome.storage.local.getBytesInUse(k)
  return { perKey, total: await chrome.storage.local.getBytesInUse(null) }
}
