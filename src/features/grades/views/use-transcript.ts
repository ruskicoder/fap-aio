// The transcript for the What-if and Planner views: read once on open (cached), again on Refresh or Alt+R.
import { useEffect, useState } from 'react'
import { errorText } from '../../../content/panel/errors'
import { registerRefresh } from '../../../content/panel/keys'
import { read } from '../../../content/fap/registry'
import { GRADES_TRANSCRIPT } from '../sources'
import type { Transcript } from '../types'

export interface TranscriptState { t: Transcript | null; at: number | null; busy: boolean; error: string | null; load: (force: boolean) => Promise<void> }

export function useTranscript(refreshId: string): TranscriptState {
  const [t, setT] = useState<Transcript | null>(null)
  const [at, setAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = async (force: boolean) => {
    setBusy(true)
    setError(null)
    const r = await read<Transcript>(GRADES_TRANSCRIPT, {}, { force, priority: 'user' }).catch((e: unknown) => ({ ok: false as const, error: { kind: 'network' as const, message: String(e) } }))
    setBusy(false)
    if (r.ok) { setT(r.value); setAt(r.fetchedAt) } else setError(errorText(r.error))
  }
  useEffect(() => { void load(false) }, [])
  useEffect(() => registerRefresh(refreshId, () => void load(true)), [])
  return { t, at, busy, error, load }
}

/** A mark or an average typed by the user: a number from 0 to 10, else null. */
export function parseMark(s: string | undefined): number | null {
  if (s === undefined || s.trim() === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null
}
