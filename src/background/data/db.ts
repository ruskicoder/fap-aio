// IndexedDB `fap-aio-data`, owned by the service worker (platform R4.2, R5.1, R7.4; design "IndexedDB").
// The packaged data files are read with fetch(chrome.runtime.getURL(...)), checked against the packaged
// manifest (SHA-256 and schema), validated with zod and indexed in one transaction.
import {
  DATA_SCHEMAS,
  dataManifest,
  isSupportedSchema,
  type DataFileName,
  type DataManifest,
  type SubjectFull,
  type SubjectListFile,
  type SubjectRule,
  type SubjectRulesFile,
} from '../../shared/data/schemas'
import { tokenize } from '../../shared/data/tokens'
import { count } from '../diag'

export const DB_NAME = 'fap-aio-data'
export const DB_VERSION = 1
export const PACKAGED_MANIFEST = 'data/manifest.json'

export type DataSource = 'packaged' | 'channel'

const dataManifestFileCount = 3

export interface FileRecord {
  name: DataFileName
  source: DataSource
  dataVersion: number
  sha256: string
  bytes: number
  schema: string
  /** The file text exactly as received, so its hash can be compared later. */
  body: string
}

export interface SubjectRecord {
  code: string
  syllabusId: number | null
  approvedDate: string | null
  rules: SubjectRule | null
  full: SubjectFull | null
  source: DataSource
}

/** Live FLM result (PLT-9); the store is created here and written by the FLM read. */
export interface OverrideRecord {
  code: string
  syllabusId: number
  approvedDate: string | null
  rules: SubjectRule | null
  full: SubjectFull | null
  fetchedAt: number
}

export interface SearchRecord {
  token: string
  codes: string[]
}

export interface PreparedData {
  files: FileRecord[]
  subjects: SubjectRecord[]
  search: SearchRecord[]
}

export interface DataDeps {
  idb?: IDBFactory
  fetch?: typeof fetch
  getURL?: (path: string) => string
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
}

/** Opens the database; `created` is true when it did not exist (missing or evicted). */
export function openDataDb(idb: IDBFactory = indexedDB): Promise<{ db: IDBDatabase; created: boolean }> {
  return new Promise((resolve, reject) => {
    let created = false
    const r = idb.open(DB_NAME, DB_VERSION)
    r.onupgradeneeded = (e) => {
      const db = r.result
      if (e.oldVersion === 0) created = true
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'name' })
      if (!db.objectStoreNames.contains('subjects')) db.createObjectStore('subjects', { keyPath: 'code' })
      if (!db.objectStoreNames.contains('overrides')) db.createObjectStore('overrides', { keyPath: 'code' })
      if (!db.objectStoreNames.contains('search')) db.createObjectStore('search', { keyPath: 'token' })
    }
    r.onsuccess = () => resolve({ db: r.result, created })
    r.onerror = () => reject(r.error)
  })
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getBytes(f: typeof fetch, url: string): Promise<Uint8Array> {
  const res = await f(url)
  if (!res.ok) throw new Error(`cannot read ${url}: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function readPackagedManifest(deps: DataDeps = {}): Promise<DataManifest> {
  const f = deps.fetch ?? fetch
  const getURL = deps.getURL ?? chrome.runtime.getURL
  const text = new TextDecoder().decode(await getBytes(f, getURL(PACKAGED_MANIFEST)))
  return dataManifest.parse(JSON.parse(text))
}

/**
 * Checks one file against its manifest entry (hash and supported schema), then parses and validates it.
 * Throws on any mismatch, so nothing unchecked reaches the index (R5.4, R7.4).
 */
export async function checkFile(
  entry: DataManifest['files'][number],
  bytes: Uint8Array,
): Promise<{ text: string; value: unknown }> {
  if (!isSupportedSchema(entry.schema)) throw new Error(`${entry.name}: unsupported schema ${entry.schema}`)
  const hash = await sha256Hex(bytes)
  if (hash !== entry.sha256) throw new Error(`${entry.name}: SHA-256 mismatch`)
  const text = new TextDecoder().decode(bytes)
  const parsed = DATA_SCHEMAS[entry.schema].safeParse(JSON.parse(text))
  if (!parsed.success) throw new Error(`${entry.name}: does not match ${entry.schema}`)
  return { text, value: parsed.data }
}

/** Builds the subject and search records from the two FLM files. */
export function buildIndex(
  rulesFile: SubjectRulesFile | null,
  listFile: SubjectListFile | null,
  source: DataSource,
): Pick<PreparedData, 'subjects' | 'search'> {
  const codes = new Set([...Object.keys(rulesFile?.subjects ?? {}), ...Object.keys(listFile?.subjects ?? {})])
  const subjects: SubjectRecord[] = []
  const tokens = new Map<string, Set<string>>()
  const add = (token: string, code: string) => {
    let set = tokens.get(token)
    if (!set) tokens.set(token, (set = new Set()))
    set.add(code)
  }
  for (const code of [...codes].sort()) {
    const rules = rulesFile?.subjects[code] ?? null
    const full = listFile?.subjects[code] ?? null
    subjects.push({
      code,
      syllabusId: full?.sylId ?? rules?.sylId ?? null,
      approvedDate: full?.approvedDate ?? null,
      rules,
      full,
      source,
    })
    const text = [code, rules?.name ?? '', full?.name.en ?? '', full?.name.vi ?? ''].join(' ')
    for (const t of tokenize(text)) add(t, code)
  }
  const search = [...tokens].map(([token, set]) => ({ token, codes: [...set].sort() }))
  return { subjects, search }
}

/** Reads, checks and indexes the packaged files in memory; throws if any check fails. */
export async function preparePackaged(deps: DataDeps = {}, manifest?: DataManifest): Promise<PreparedData> {
  const f = deps.fetch ?? fetch
  const getURL = deps.getURL ?? chrome.runtime.getURL
  const m = manifest ?? (await readPackagedManifest(deps))
  const files: FileRecord[] = []
  const values = new Map<DataFileName, unknown>()
  for (const entry of m.files) {
    const bytes = await getBytes(f, getURL(`data/${entry.path}`))
    const { text, value } = await checkFile(entry, bytes)
    values.set(entry.name, value)
    files.push({
      name: entry.name,
      source: 'packaged',
      dataVersion: m.dataVersion,
      sha256: entry.sha256,
      bytes: bytes.length,
      schema: entry.schema,
      body: text,
    })
  }
  const index = buildIndex(
    (values.get('subject-rules.json') as SubjectRulesFile | undefined) ?? null,
    (values.get('subject-list.json') as SubjectListFile | undefined) ?? null,
    'packaged',
  )
  return { files, ...index }
}

/** Replaces the files, subjects and search stores in one transaction; overrides are kept. */
export async function writeIndex(db: IDBDatabase, data: PreparedData): Promise<void> {
  const tx = db.transaction(['files', 'subjects', 'search'], 'readwrite')
  const finished = done(tx)
  const files = tx.objectStore('files')
  const subjects = tx.objectStore('subjects')
  const search = tx.objectStore('search')
  subjects.clear()
  search.clear()
  for (const r of data.files) files.put(r)
  for (const r of data.subjects) subjects.put(r)
  for (const r of data.search) search.put(r)
  await finished
}

export async function readFiles(db: IDBDatabase): Promise<FileRecord[]> {
  return req(db.transaction('files').objectStore('files').getAll() as IDBRequest<FileRecord[]>)
}

export async function indexPackaged(db: IDBDatabase, deps: DataDeps = {}, manifest?: DataManifest): Promise<void> {
  await writeIndex(db, await preparePackaged(deps, manifest))
}

/**
 * Makes sure the database holds a complete data set.
 * - `start` (every service worker start, and install): index the packaged files when the database is
 *   missing or incomplete, so features work with no network access (R5.1).
 * - `update`: also re-index when the packaged data is newer than the active copy; an active channel
 *   copy with an equal or higher dataVersion is kept (design: the higher dataVersion wins).
 * Returns true when the packaged files were indexed.
 */
export async function ensureData(reason: 'start' | 'update', deps: DataDeps = {}): Promise<boolean> {
  const { db, created } = await openDataDb(deps.idb)
  try {
    const files = created ? [] : await readFiles(db)
    const complete = files.length >= dataManifestFileCount
    if (complete && reason === 'start') return false
    const manifest = await readPackagedManifest(deps)
    if (complete && files.every((r) => r.dataVersion >= manifest.dataVersion)) return false
    await indexPackaged(db, deps, manifest)
    return true
  } finally {
    db.close()
  }
}


let chain: Promise<unknown> = Promise.resolve()

/** Serializes ensureData calls so a start and an install event do not index twice at once. */
export function queueEnsure(reason: 'start' | 'update', deps: DataDeps = {}): Promise<boolean> {
  const next = chain.then(() => ensureData(reason, deps))
  chain = next.catch(() => undefined)
  return next.catch((e: unknown) => {
    console.warn('[fap-aio] data store:', e instanceof Error ? e.message : e)
    void count('data.indexFailed')
    return false
  })
}

export function installDataStore(): void {
  void queueEnsure('start')
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update') void queueEnsure('update')
  })
}
