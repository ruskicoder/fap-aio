// Rubric facts the Grades view shows (grades R12.1): the FLM scrape date and the active data version,
// from the service worker's data service.
import { dataClient } from '../../content/data-client'
import type { RulesLookup } from './engine/course-model'

export interface RubricInfo { scrapedAt: string; dataVersion: number }

export async function rubricInfo(rules: RulesLookup = (codes) => dataClient().rules(codes)): Promise<RubricInfo | null> {
  const r = await rules([])
  return r.ok ? { scrapedAt: r.value.scrapedAt, dataVersion: r.value.dataVersion } : null
}

/** "FLM rubric of 10 Oct 2026, data version 1". */
export function rubricText(info: RubricInfo): string {
  const d = new Date(info.scrapedAt)
  const date = Number.isNaN(d.getTime()) ? info.scrapedAt : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
  return `FLM rubric of ${date}, data version ${info.dataVersion}`
}
