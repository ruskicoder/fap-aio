// Shared bits of the schedule views: buttons, empty state, messages, chips, tags and cards.
import type { ReactNode } from 'react'

export const button = 'inline-flex h-8 items-center rounded border border-gray-300 px-3 text-sm hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
export const primary = 'inline-flex h-8 items-center rounded bg-orange-600 px-3 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'
export const select = 'h-8 rounded border border-gray-300 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

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

/** Soft tint tags (core R8.5, ui/schedule.html). */
export type Tint = 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'gray'
const TINTS: Record<Tint, string> = {
  green: 'bg-green-50 text-green-800', red: 'bg-red-50 text-red-800', amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-blue-50 text-blue-800', violet: 'bg-violet-50 text-violet-800', gray: 'bg-gray-100 text-gray-700',
}
export function Tag({ tint, children }: { tint: Tint; children: ReactNode }) {
  return <span className={`ml-1 inline-block rounded px-1.5 align-[1px] text-[11px] font-medium leading-4 ${TINTS[tint]}`}>{children}</span>
}

/** A card with the full title and tags, then label-value lines; nothing truncates (core R8.6). */
export function Card({ title, tags, children, label }: { title: string; tags: ReactNode; children: ReactNode; label?: string }) {
  return (
    <li className="mx-3 my-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2" aria-label={label}>
      <p className="break-words text-[13px] font-medium leading-snug">{title}{tags}</p>
      <p className="mt-0.5 flex flex-wrap gap-x-3 break-words text-xs leading-relaxed text-gray-600">{children}</p>
    </li>
  )
}
export const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <span><b className="font-medium text-gray-900">{label}:</b> {children}</span>
)

/** A toggle chip (aria-pressed), as drawn in ui/schedule.html. */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
    >{children}</button>
  )
}

/** Sub-view switch with counts (This week and All, Upcoming and Past). */
export function SubTabs<T extends string>({ items, value, onChange, label }: { items: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5 px-3 py-1.5">
      {items.map(([v, l]) => <Chip key={v} on={value === v} onClick={() => onChange(v)}>{l}</Chip>)}
    </div>
  )
}
