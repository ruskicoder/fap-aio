// Calendar helpers on plain yyyy-mm-dd strings (no time zone involved).
export const pad2 = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
export const parseIso = (s: string) => new Date(`${s}T00:00:00Z`)
export const addDays = (iso: string, n: number) => isoOf(new Date(parseIso(iso).getTime() + n * 86_400_000))

/** Monday of the ISO week that contains `iso`. */
export function mondayOf(iso: string): string {
  const d = parseIso(iso)
  return addDays(iso, -((d.getUTCDay() + 6) % 7))
}

/** Today's date in Asia/Ho_Chi_Minh (UTC+7, no daylight saving). */
export function todayVn(now = Date.now()): string {
  return isoOf(new Date(now + 7 * 3_600_000))
}

/** dd/MM/yyyy to yyyy-mm-dd, or null. */
export function fromDmy(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${pad2(+m[2]!)}-${pad2(+m[1]!)}` : null
}

/** dd/MM with the year that puts the date nearest to `near` (yyyy-mm-dd). */
export function fromDmNear(s: string, near: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const y = +near.slice(0, 4)
  const cands = [y - 1, y, y + 1].map((yy) => `${yy}-${pad2(+m[2]!)}-${pad2(+m[1]!)}`)
  const t = parseIso(near).getTime()
  return cands.sort((a, b) => Math.abs(parseIso(a).getTime() - t) - Math.abs(parseIso(b).getTime() - t))[0]!
}

/** `12h30-14h45` or `12:30 - 14:45` to ['12:30', '14:45']. */
export function parseTimeRange(s: string): [string, string] | null {
  const m = s.match(/(\d{1,2})[h:](\d{2})\s*-\s*(\d{1,2})[h:](\d{2})/)
  return m ? [`${pad2(+m[1]!)}:${m[2]}`, `${pad2(+m[3]!)}:${m[4]}`] : null
}
