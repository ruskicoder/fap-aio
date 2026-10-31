// Rooms with their site (core R8.9, R9.14; fix F-8). FAP writes campus rooms as `P.011` in the
// timetable and as a bare `011` in the exam list, and Nhà Văn hóa Sinh viên rooms as `NVH 302`. The
// owner reads the site from the prefix, so every room shown or exported reads `P.xxx` or `NVH.xxx`.
// Stored records keep FAP's text; this only formats.

const NVH = /^nvh\s*\.?\s*([0-9]{1,4}[a-z]?)$/i
const CAMPUS = /^p\s*\.?\s*([0-9]{1,4}[a-z]?)$/i
const BARE = /^([0-9]{1,4}[a-z]?)$/i

export function siteRoom(room: string): string
export function siteRoom(room: string | null): string | null
export function siteRoom(room: string | null): string | null {
  if (!room) return room
  const r = room.trim()
  const m = r.match(NVH) ?? null
  if (m) return `NVH.${m[1]!.toUpperCase()}`
  const c = r.match(CAMPUS) ?? r.match(BARE)
  if (c) return `P.${c[1]!.toUpperCase()}`
  return r
}
