// Shared bits of the schedule views: buttons, last-sync stamp, empty state and messages.
import type { ReactNode } from 'react'
import { ago } from '../../../content/panel/StatusStrip'

export const button = 'inline-flex h-8 items-center rounded border border-gray-300 px-3 text-sm hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
export const primary = 'inline-flex h-8 items-center rounded bg-orange-600 px-3 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'
export const select = 'h-8 rounded border border-gray-300 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

/** R8.6 */
export function LastSync({ at, what }: { at: number | null | undefined; what: string }) {
  return <p className="text-xs text-gray-600">{at ? `${what} synced ${ago(at)}` : `${what} not synced yet`}</p>
}

/** Names the space and offers the single action that fills it (panel-ux R9.3; core R8.5). */
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 p-3">
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  )
}

export function Message({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded px-2 py-1 text-xs ${tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'}`}>{children}</p>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** `Mon 5 Oct` from yyyy-mm-dd. */
export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
