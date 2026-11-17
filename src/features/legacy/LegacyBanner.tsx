// The one-time legacy cleanup offer above the tabs (core R12.1, R12.2, R12.4) and the Settings row that
// brings it back. Accept downloads the export first, then removes only the matched keys.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { downloadJson } from '../../content/panel/settings/transfer'
import { exportLegacy, isDismissed, removeLegacy, scanLegacy, setDismissed } from './legacy'

// Shared between the banner and the Settings row: a request to look again.
let reviews = 0
const listeners = new Set<() => void>()
export function reviewLegacy(): void {
  reviews++
  for (const l of listeners) l()
}
const useReviews = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => reviews)

const primary = 'inline-flex h-control items-center rounded bg-orange-600 px-3 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'
const quiet = 'inline-flex h-control items-center rounded px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

export function LegacyBanner({ storage }: { storage?: Storage }) {
  const asked = useReviews()
  const [keys, setKeys] = useState<string[]>([])
  const [done, setDone] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let live = true
    setDone(null)
    void (async () => {
      if (asked === 0 && (await isDismissed())) { if (live) setKeys([]); return }
      let found: string[] = []
      try { found = scanLegacy(storage) } catch { found = [] }
      if (live) setKeys(found)
    })()
    return () => { live = false }
  }, [asked, storage])

  if (done !== null) {
    return (
      <div role="status" className="flex items-center gap-2 border-b border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900">
        <span className="flex-1">Removed {done} old {done === 1 ? 'item' : 'items'} from FAP's storage. The export is in your downloads.</span>
        <button type="button" className="rounded px-2 py-1 font-medium hover:bg-green-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => setDone(null)}>Close</button>
      </div>
    )
  }
  if (!keys.length) return null
  const accept = () => {
    downloadJson(box.current ?? document.body, `fap-aio-legacy-${new Date().toISOString().slice(0, 10)}.json`, exportLegacy(keys, storage))
    // The download has started; only now are the keys removed (R12.2).
    const n = removeLegacy(keys, storage)
    setKeys([])
    setDone(n)
  }
  const decline = () => { void setDismissed(true); setKeys([]) }
  return (
    <div ref={box} role="region" aria-label="Old FAP-AIO data" className="border-b border-orange-200 bg-orange-50 px-3 py-2 text-sm text-gray-900">
      <p>An older FAP-AIO left {keys.length} {keys.length === 1 ? 'item' : 'items'} in FAP's own storage. Save them to a file and remove them from FAP?</p>
      <div className="mt-1.5 flex gap-2">
        <button type="button" className={primary} onClick={accept}>Export and remove</button>
        <button type="button" className={quiet} onClick={decline}>Not now</button>
      </div>
    </div>
  )
}

/** Settings row: look for legacy data again, even after "Not now" (R12.4). */
export function LegacyReviewRow({ storage }: { storage?: Storage }) {
  const [note, setNote] = useState<string | null>(null)
  const look = async () => {
    await setDismissed(false)
    let n = 0
    try { n = scanLegacy(storage).length } catch { n = 0 }
    setNote(n ? `Found ${n}. The offer is shown above the tabs.` : 'No old FAP-AIO data found in FAP\'s storage.')
    reviewLegacy()
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="inline-flex h-control items-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => void look()}>Look for old data</button>
      {note && <p role="status" className="text-xs text-gray-600">{note}</p>}
    </div>
  )
}
