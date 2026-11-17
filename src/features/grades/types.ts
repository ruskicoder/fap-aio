// Grade records (grades design, "Data Models").
import type { TranscriptStatus } from '../../content/fap/parse/constants'

export type { TranscriptStatus }

export interface TranscriptRow {
  /** `${semester}|${code}` */
  id: string
  term: number | null
  semester: string
  code: string
  name: string
  prerequisites: string | null
  replaced: string | null
  credits: number
  grade: number | null
  status: TranscriptStatus
}

/** Replaced or extra subjects: shown as information only, never counted (R1.2). */
export interface ReplacedRow {
  semester: string
  code: string
  name: string
  credits: number
  grade: number | null
  status: TranscriptStatus
}

export interface Transcript {
  rows: TranscriptRow[]
  replaced: ReplacedRow[]
}

export interface Term {
  id: string
  name: string
  /** The term FAP selects when the grade page is opened without a term (only known on that read). */
  current: boolean
}

export interface CourseRef {
  id: string
  termId: string
  label: string
  code: string | null
}

export interface TermCourses {
  terms: Term[]
  /** The term the page was showing; its courses are listed in `courses`. */
  selectedTermId: string | null
  courses: CourseRef[]
}
