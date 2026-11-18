// Live FLM overrides (platform R6.5, R6.6; design, "Live FLM read"): a syllabus read from FLM is kept per
// code with its fetch time and wins over the active entry while it is at least as new; indexing drops the
// overrides that a newer channel or packaged syllabus has overtaken; the student can remove one.
import type { SubjectFull, SubjectRule } from '../../shared/data/schemas'
import { ok, register } from '../router'
import { openDataDb, type OverrideRecord, type SubjectRecord } from './db'
import { overrideWins } from './query'

const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

export async function storeOverride(db: IDBDatabase, parsed: { full: SubjectFull; rules: SubjectRule }, fetchedAt = Date.now()): Promise<OverrideRecord> {
  const rec: OverrideRecord = { code: parsed.full.code, syllabusId: parsed.full.sylId, approvedDate: parsed.full.approvedDate, rules: parsed.rules, full: parsed.full, fetchedAt }
  const tx = db.transaction('overrides', 'readwrite')
  tx.objectStore('overrides').put(rec)
  await done(tx)
  return rec
}

export async function removeOverride(db: IDBDatabase, code: string): Promise<boolean> {
  const tx = db.transaction('overrides', 'readwrite')
  const store = tx.objectStore('overrides')
  const had = !!(await req(store.get(code)))
  store.delete(code)
  await done(tx)
  return had
}

/** Deletes, inside the indexing transaction, every override the new active entries overtake. */
export function pruneOverrides(tx: IDBTransaction, subjects: readonly SubjectRecord[]): void {
  const byCode = new Map(subjects.map((s) => [s.code, s]))
  const store = tx.objectStore('overrides')
  const r = store.getAll() as IDBRequest<OverrideRecord[]>
  r.onsuccess = () => { for (const o of r.result) if (!overrideWins(o, byCode.get(o.code))) store.delete(o.code) }
}

export function installOverrides(idb?: IDBFactory): void {
  register('flm.remove', async (m) => {
    const { db } = await openDataDb(idb)
    try { return ok({ removed: await removeOverride(db, m.code) }) } finally { db.close() }
  })
}
