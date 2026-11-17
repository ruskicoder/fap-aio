// "Clear data" (core R5.5, R13; panel-ux R8.1 Data and privacy): after a confirmation, removes every stored
// key except `settings`, and asks the service worker to clear its caches except the packaged data.
import { createElement, useState } from 'react'
import { call } from '../../../shared/call'
import { remove, storedKeys, type StoreKey } from '../../../shared/storage/catalog'
import { registerSetting } from './registry'

export async function clearData(): Promise<{ removed: number; caches: boolean }> {
  const keys = (await storedKeys()).filter((k) => k !== 'settings')
  if (keys.length) await remove(keys as StoreKey[])
  const r = await call({ type: 'data.clearCaches' })
  return { removed: keys.length, caches: r.ok }
}

const quiet = 'inline-flex h-control items-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
const danger = 'inline-flex h-control items-center rounded bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1'

export function ClearDataRow() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy'>('idle')
  const [note, setNote] = useState<string | null>(null)
  const go = async () => {
    setStep('busy')
    const r = await clearData()
    setStep('idle')
    setNote(r.caches ? `Cleared ${r.removed} stored items and the data caches. Settings were kept.` : `Cleared ${r.removed} stored items. Settings were kept. The data caches could not be cleared; reload the page and try again.`)
  }
  if (step === 'confirm' || step === 'busy') {
    return (
      <div role="alertdialog" aria-label="Confirm clear data" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
        <p className="text-gray-900">Clear your synced classes, exams, grades, alerts and panel layout? Settings stay. This cannot be undone.</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className={danger} disabled={step === 'busy'} onClick={() => void go()}>Clear data</button>
          <button type="button" className={quiet} disabled={step === 'busy'} onClick={() => setStep('idle')}>Cancel</button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className={quiet} onClick={() => { setNote(null); setStep('confirm') }}>Clear data</button>
      {note && <p role="status" className="text-xs text-gray-600">{note}</p>}
    </div>
  )
}

export function registerClearData(): void {
  registerSetting<null>({
    key: 'data.clear', section: 'data', type: 'custom', default: null, transfer: false,
    label: 'Clear data',
    description: 'Removes everything FAP-AIO stored except your settings; the next sync reads it again.',
    component: () => createElement(ClearDataRow),
  })
}
