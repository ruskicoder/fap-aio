// Read side of `fap-aio-data` (platform R2.4, R6.5, R6.6; grades R12.2; info R2.1).
import { newsRulesFile, subjectRulesFile, type NewsRulesFile, type SubjectRulesFile } from '../../shared/data/schemas'
import { normalizeText, tokenize } from '../../shared/data/tokens'
import type { DataFileStatus, SearchHit, SubjectEntry } from '../../shared/data/types'
import type { FileRecord, OverrideRecord, SearchRecord, SubjectRecord } from './db'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

const get = <T>(db: IDBDatabase, store: string, key: IDBValidKey) =>
  req(db.transaction(store).objectStore(store).get(key) as IDBRequest<T | undefined>)

/**
 * True when the override's syllabus is newer than or equal to the active entry's: a higher syllabus id,
 * or the same id with an approval date that is not earlier (R6.5, R6.6).
 */
export function overrideWins(o: OverrideRecord, active: SubjectRecord | undefined): boolean {
  if (!active || active.syllabusId === null) return true
  if (o.syllabusId !== active.syllabusId) return o.syllabusId > active.syllabusId
  if (!o.approvedDate || !active.approvedDate) return true
  return o.approvedDate >= active.approvedDate
}

/** The code without its last lowercase letter (`IOT102t` to `IOT102`), or null (grades R12.2). */
export function fallbackCode(code: string): string | null {
  return /^[A-Z].*[0-9][a-z]$/.test(code) ? code.slice(0, -1) : null
}

async function entryFor(db: IDBDatabase, code: string): Promise<SubjectEntry | null> {
  const [active, override] = await Promise.all([
    get<SubjectRecord>(db, 'subjects', code),
    get<OverrideRecord>(db, 'overrides', code),
  ])
  if (override && overrideWins(override, active)) {
    const { code: c, syllabusId, approvedDate, rules, full, fetchedAt } = override
    return { code: c, syllabusId, approvedDate, rules, full, source: 'live', fetchedAt }
  }
  if (!active) return null
  const { code: c, syllabusId, approvedDate, rules, full, source } = active
  return { code: c, syllabusId, approvedDate, rules, full, source }
}

/** Looks a subject up, trying the code without a trailing lowercase letter when it is not found. */
export async function lookupSubject(db: IDBDatabase, code: string): Promise<SubjectEntry | null> {
  const direct = await entryFor(db, code)
  if (direct) return direct
  const alt = fallbackCode(code)
  return alt ? entryFor(db, alt) : null
}

export async function readFileRecord(db: IDBDatabase, name: FileRecord['name']): Promise<FileRecord | null> {
  return (await get<FileRecord>(db, 'files', name)) ?? null
}

export async function fileStatus(db: IDBDatabase): Promise<DataFileStatus[]> {
  const all = await req(db.transaction('files').objectStore('files').getAll() as IDBRequest<FileRecord[]>)
  return all.map(({ name, source, dataVersion, bytes, sha256 }) => ({ name, source, dataVersion, bytes, sha256 }))
}

// Parsed bodies per file, kept with their hash so a channel update (new hash) is parsed again.
const parsed = new Map<string, { sha256: string; value: unknown }>()
function parseBody<T>(rec: FileRecord, schema: { parse: (x: unknown) => T }): T {
  const hit = parsed.get(rec.name)
  if (hit?.sha256 === rec.sha256) return hit.value as T
  const value = schema.parse(JSON.parse(rec.body))
  parsed.set(rec.name, { sha256: rec.sha256, value })
  return value
}

export async function rulesFile(db: IDBDatabase): Promise<{ file: SubjectRulesFile; dataVersion: number } | null> {
  const rec = await readFileRecord(db, 'subject-rules.json')
  return rec ? { file: parseBody(rec, subjectRulesFile), dataVersion: rec.dataVersion } : null
}

export async function newsRules(db: IDBDatabase): Promise<NewsRulesFile | null> {
  const rec = await readFileRecord(db, 'news-rules.json')
  return rec ? parseBody(rec, newsRulesFile) : null
}

/**
 * Search by code or name: every query token must match the start of an indexed token. An exact code
 * comes first, then codes that start with the query, then the rest by code (info R2.1).
 */
export async function searchSubjects(db: IDBDatabase, q: string, limit: number): Promise<SearchHit[]> {
  const tokens = tokenize(q)
  if (!tokens.length) return []
  const store = db.transaction('search').objectStore('search')
  let codes = new Set<string>()
  for (const [i, t] of tokens.entries()) {
    const recs = await req(store.getAll(IDBKeyRange.bound(t, `${t}\uffff`)) as IDBRequest<SearchRecord[]>)
    const found = new Set(recs.flatMap((r) => r.codes))
    codes = i === 0 ? found : new Set([...codes].filter((c) => found.has(c)))
    if (!codes.size) return []
  }
  const nq = normalizeText(q).replace(/\s+/g, '')
  const rank = (c: string) => (normalizeText(c) === nq ? 0 : normalizeText(c).startsWith(nq) ? 1 : 2)
  const ordered = [...codes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, limit)
  const hits: SearchHit[] = []
  for (const code of ordered) {
    const e = await entryFor(db, code)
    if (!e) continue
    hits.push({
      code,
      name: e.full?.name.en ?? e.rules?.name ?? code,
      nameVi: e.full?.name.vi ?? null,
      credits: e.full?.credits ?? e.rules?.credits ?? null,
    })
  }
  return hits
}
