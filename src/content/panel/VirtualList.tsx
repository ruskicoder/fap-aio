// Virtualized list (panel-ux R10.7): lists longer than 100 items render only the rows in view plus an
// overscan, inside their own scroll box. Rows have a fixed height. Shorter lists render every row.
import { useState, type ReactNode } from 'react'

export const VIRTUALIZE_OVER = 100

export interface VirtualListProps<T> {
  items: T[]
  rowHeight: number
  /** Height of the scroll box in px. */
  height: number
  overscan?: number
  label: string
  itemKey: (item: T, index: number) => string
  render: (item: T, index: number) => ReactNode
}

/** The index range to render for a scroll position. */
export function visibleRange(count: number, rowHeight: number, height: number, scrollTop: number, overscan: number): [number, number] {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const last = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + overscan)
  return [first, last]
}

export function VirtualList<T>({ items, rowHeight, height, overscan = 6, label, itemKey, render }: VirtualListProps<T>) {
  const [top, setTop] = useState(0)
  if (items.length <= VIRTUALIZE_OVER) {
    return <ul aria-label={label} className="m-0 list-none p-0">{items.map((it, i) => <li key={itemKey(it, i)}>{render(it, i)}</li>)}</ul>
  }
  const [first, last] = visibleRange(items.length, rowHeight, height, top, overscan)
  return (
    <div style={{ height, overflowY: 'auto' }} onScroll={(e) => setTop(e.currentTarget.scrollTop)} data-virtual="true">
      <ul aria-label={label} aria-rowcount={items.length} className="relative m-0 list-none p-0" style={{ height: items.length * rowHeight }}>
        {items.slice(first, last).map((it, k) => {
          const i = first + k
          return (
            <li key={itemKey(it, i)} aria-posinset={i + 1} aria-setsize={items.length} style={{ position: 'absolute', top: i * rowHeight, left: 0, right: 0, height: rowHeight }}>
              {render(it, i)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
