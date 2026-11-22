// Info records (info design, "Data Models").
export interface Unread { hasUnread: boolean }

export interface Notice {
  id: string
  linkUrl: string
  sourceCode: string
  isRead: boolean
  title: string
  /** As FAP shows it, `dd/MM/yyyy HH:mm`. */
  time: string
}

export interface CurriculumRow {
  no: number | null
  code: string
  name: string
  term: number | null
  prerequisites: string[]
  replacements: string[]
  /** Not in FAP's curriculum table as captured; filled from the FLM rubric where needed. */
  credits: number | null
  /** FAP's /Subject/Detail/{guid} link when the row carries one (R2.3). */
  detailUrl: string | null
}

/** FAP's capstone card on /Account (info R10). Absent fields are null. */
export interface Capstone { titleEn: string | null; titleVi: string | null; updatedOn: string | null }
