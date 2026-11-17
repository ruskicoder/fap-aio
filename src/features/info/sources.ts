// Info sources (info design, "Sources"; core R4.4): unread flag (2 min), bell list (10 min, partial)
// and the curriculum (24 h).
import { register } from '../../content/fap/registry'
import { parseBell, parseCurriculum, parseUnread } from './parse'
import type { CurriculumRow, Notice, Unread } from './types'

export const INFO_UNREAD = 'info.unread'
export const INFO_BELL = 'info.bell'
export const INFO_CURRICULUM = 'info.curriculum'

const MIN = 60_000

export function registerInfoSources(): void {
  register<Unread>({ id: INFO_UNREAD, route: () => '/Notification/UnreadCount', partial: false, json: (v) => parseUnread(v), cacheTtlMs: 2 * MIN })
  register<Notice[]>({ id: INFO_BELL, route: () => '/Notification/BellList?pageIndex=1&pageSize=10', partial: true, parse: (doc) => parseBell(doc), cacheTtlMs: 10 * MIN })
  register<CurriculumRow[]>({ id: INFO_CURRICULUM, route: () => '/Curriculum', partial: false, parse: (doc) => parseCurriculum(doc), cacheTtlMs: 24 * 60 * MIN })
}
