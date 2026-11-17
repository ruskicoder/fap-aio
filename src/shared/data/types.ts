// Replies of the data handlers (platform design, "Messaging contract" and "IndexedDB"), shared by the
// service worker and the content-side dataClient.
import type { SubjectFull, SubjectRule, SubjectRulesFile } from './schemas'

export type EntrySource = 'packaged' | 'channel' | 'live'

/** One subject as served: the active entry, or a live FLM override that is at least as new (R6.5, R6.6). */
export interface SubjectEntry {
  /** The code that matched, which can differ from the requested one (trailing lowercase fallback). */
  code: string
  syllabusId: number | null
  approvedDate: string | null
  rules: SubjectRule | null
  full: SubjectFull | null
  source: EntrySource
  /** Set for a live FLM result. */
  fetchedAt?: number
}

/** `data.rules`: compact rubric entries by requested code, with the file's global rules and scrape date. */
export interface RulesReply {
  dataVersion: number
  scrapedAt: string
  rules: SubjectRulesFile['rules']
  subjects: Record<string, SubjectRule | null>
}

export interface SearchHit {
  code: string
  name: string
  nameVi: string | null
  credits: number | null
}

export interface DataFileStatus {
  name: string
  source: 'packaged' | 'channel'
  dataVersion: number
  bytes: number
  sha256: string
}
