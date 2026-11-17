// Data query handlers (platform R2.4, R6.5, R6.6; grades R12.2; info R2.1): content scripts cannot open
// the extension's IndexedDB, so they ask the service worker by message.
import { fail, ok, register } from '../router'
import { indexPackaged, openDataDb, queueEnsure, type DataDeps } from './db'
import { fileStatus, lookupSubject, newsRules, rulesFile, searchSubjects } from './query'
import type { DataFileStatus, RulesReply } from '../../shared/data/types'

export const SEARCH_LIMIT_MAX = 50

/** Opens the database after making sure it holds a complete data set (re-indexed if it was lost). */
export async function withData<T>(fn: (db: IDBDatabase) => Promise<T>, deps: DataDeps = {}): Promise<T> {
  await queueEnsure('start', deps)
  const { db } = await openDataDb(deps.idb)
  try {
    return await fn(db)
  } finally {
    db.close()
  }
}

/** Data part of `data.status`: the active files and the data version in use. */
export async function dataFilesStatus(deps: DataDeps = {}): Promise<{ files: DataFileStatus[]; version: number | null }> {
  const files = await withData(fileStatus, deps)
  return { files, version: files.length ? Math.min(...files.map((f) => f.dataVersion)) : null }
}

export function installDataHandlers(deps: DataDeps = {}): void {
  register('data.rules', async (m) => {
    const reply = await withData(async (db) => {
      const rf = await rulesFile(db)
      if (!rf) return null
      const subjects: RulesReply['subjects'] = {}
      for (const code of new Set(m.codes)) subjects[code] = (await lookupSubject(db, code))?.rules ?? null
      return { dataVersion: rf.dataVersion, scrapedAt: rf.file.source.scrapedAt, rules: rf.file.rules, subjects } satisfies RulesReply
    }, deps)
    return reply ? ok(reply) : fail('data-unavailable', 'subject-rules.json')
  })
  register('data.subject', async (m) => ok(await withData((db) => lookupSubject(db, m.code), deps)))
  register('data.search', async (m) =>
    ok(await withData((db) => searchSubjects(db, m.q, Math.min(m.limit, SEARCH_LIMIT_MAX)), deps)))
  // "Clear data" (core R5.5): drop live FLM overrides and channel copies; packaged data stays indexed.
  register('data.clearCaches', async () => ok(await withData(async (db) => {
    const tx = db.transaction('overrides', 'readwrite')
    tx.objectStore('overrides').clear()
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
    const files = await fileStatus(db)
    const channel = files.some((f) => f.source === 'channel')
    if (channel) await indexPackaged(db, deps)
    return { overrides: 'cleared', reindexed: channel }
  }, deps)))
  register('data.file', async () => {
    const file = await withData(newsRules, deps)
    return file ? ok(file) : fail('data-unavailable', 'news-rules.json')
  })
}
