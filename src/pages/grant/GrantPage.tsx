// Grant window (platform R1.6; decision D-4): the FAP-AIO header bar, one sentence of purpose and one
// button. Chrome's own prompt needs the click as a user gesture. Closing the window counts as refused.
import { useEffect, useState } from 'react'
import { call } from '../../shared/call'
import { EXPIRED_TEXT, GRANT_COPY, GRANT_TIMEOUT_MS, PERMS, isPermId, type PermId } from '../../shared/permissions'

export type GrantState = 'ask' | 'waiting' | 'granted' | 'refused' | 'expired'
export const CLOSE_AFTER_MS = 1500

const button = 'inline-flex h-9 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'
const quiet = 'inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'

export function GrantPage({ perm, close = () => window.close() }: { perm: string | null; close?: () => void }) {
  const known = isPermId(perm)
  const [state, setState] = useState<GrantState>(known ? 'ask' : 'expired')
  const copy = known ? GRANT_COPY[perm as PermId] : null

  // The service worker stops waiting after 120 s; the page says so too.
  useEffect(() => {
    if (!known) return
    const t = setTimeout(() => setState((s) => (s === 'ask' ? 'expired' : s)), GRANT_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [known])

  useEffect(() => {
    if (state !== 'granted') return
    const t = setTimeout(close, CLOSE_AFTER_MS)
    return () => clearTimeout(t)
  }, [state, close])

  const allow = async () => {
    if (!known) return
    setState('waiting')
    let granted = false
    try {
      granted = await chrome.permissions.request(PERMS[perm as PermId])
    } catch {
      granted = false
    }
    await call({ type: 'perm.result', perm: perm as PermId, granted })
    setState(granted ? 'granted' : 'refused')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[50px] flex-none items-center gap-2.5 border-b border-[#e2e0d8] bg-[#eeede6] px-3.5">
        <img src="/img/logo-32.png" alt="" width={24} height={24} />
        <div className="leading-tight">
          <p className="text-base font-semibold text-gray-900">FAP-AIO</p>
          <p className="text-xs text-gray-500">Permission</p>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-3 px-4 py-4" aria-live="polite">
        {state === 'expired' || !copy ? (
          <>
            <p className="text-sm text-gray-800">{EXPIRED_TEXT}</p>
            <div><button type="button" className={quiet} onClick={close}>Close</button></div>
          </>
        ) : state === 'granted' ? (
          <p role="status" className="text-[15px] font-medium text-gray-900">{copy.granted}</p>
        ) : state === 'refused' ? (
          <>
            <p role="status" className="text-[15px] font-medium text-gray-900">{copy.refused}</p>
            <div><button type="button" className={quiet} onClick={close}>Close</button></div>
          </>
        ) : (
          <>
            <h1 className="text-[15px] font-semibold text-gray-900">{copy.title}</h1>
            <p className="text-sm text-gray-700">{copy.purpose}</p>
            <div><button type="button" className={button} disabled={state === 'waiting'} onClick={() => void allow()}>{copy.button}</button></div>
          </>
        )}
      </main>
    </div>
  )
}
