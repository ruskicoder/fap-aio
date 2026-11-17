// First-run welcome (panel-ux R9.1, R9.2; design "First run"): a dialog inside the docked panel with up
// to three skippable steps: the tabs, "Sync this week" with live progress, and the optional features (all
// off). Finishing or skipping sets `panel.prefs.firstRun` to done; Settings can show it again.
// Only shipped tabs are described and the optional-features step shows only features that have shipped.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { readPrefs, updatePrefs } from '../../../shared/panel-prefs'
import { runSyncAll, useSyncAll } from '../actions'
import { tabViews } from '../views'
import type { TabId } from '../router'
import { useStore } from '../use-store'
import { settingDef, useSetting, writeSetting } from '../settings/registry'

export const TAB_TOUR: Record<TabId, string> = {
  today: 'What needs your attention today: the next class, exams soon and warnings.',
  schedule: 'Your classes and exams from FAP, and calendar files for your phone.',
  grades: 'Your GPA, pass checks and the scores you need on what is left.',
  info: 'Subjects and syllabi, lecturers, news and attendance.',
}
const TAB_NAMES: Record<TabId, string> = { today: 'Today', schedule: 'Schedule', grades: 'Grades', info: 'Info' }

/** Optional features listed in step 3 by the setting key that turns them on (R9.1: all off). */
const optional: string[] = []
export function registerOptionalFeature(settingKey: string): void {
  if (!optional.includes(settingKey)) optional.push(settingKey)
}
export const optionalFeatures = () => [...optional]
export function clearOptionalFeatures(): void {
  optional.length = 0
}

// Reopened from Settings while the flag is already done.
let reopened = false
const listeners = new Set<() => void>()
export function showWelcome(): void {
  reopened = true
  for (const l of listeners) l()
}
function hideWelcome(): void {
  reopened = false
  for (const l of listeners) l()
}
const useReopened = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => reopened)

export async function finishWelcome(): Promise<void> {
  hideWelcome()
  await updatePrefs((p) => ({ ...p, firstRun: 'done' }))
}

/** True on the first run: the panel opens docked (R9.1). */
export async function isFirstRun(): Promise<boolean> {
  return (await readPrefs()).firstRun === 'pending'
}

const primary = 'inline-flex h-control items-center rounded bg-orange-600 px-3 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'
const quiet = 'inline-flex h-control items-center rounded px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

function FeatureRow({ settingKey }: { settingKey: string }) {
  const def = settingDef(settingKey)!
  const on = useSetting(def) === true
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-gray-900">{def.label}</span>
        <span className="block text-xs text-gray-600">{def.description}</span>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={def.label} onClick={() => void writeSetting(def, !on)}
        className="inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1" style={{ background: on ? '#ea580c' : '#d1d5db' }}>
        <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </li>
  )
}

export function Welcome() {
  // A fresh install has no stored preferences yet: that is the first run too.
  const prefs = useStore('panel.prefs')
  const again = useReopened()
  const open = again || (!prefs.loading && (prefs.data?.firstRun ?? 'pending') === 'pending')
  const [step, setStep] = useState(0)
  const sync = useSyncAll()
  const [synced, setSynced] = useState<'idle' | 'running' | 'done'>('idle')
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => { if (open) title.current?.focus() }, [open, step])
  useEffect(() => { if (synced === 'running' && !sync.running) setSynced('done') }, [sync.running, synced])
  if (!open) return null

  const features = optionalFeatures().filter((k) => settingDef(k))
  const steps = ['tabs', 'sync', ...(features.length ? ['features'] : [])] as const
  const at = steps[Math.min(step, steps.length - 1)]!
  const last = step >= steps.length - 1
  const close = () => { setStep(0); setSynced('idle'); void finishWelcome() }
  const shipped = new Set(tabViews().map((v) => v.tab))
  const tabs = (Object.keys(TAB_NAMES) as TabId[]).filter((t) => shipped.has(t))

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="aio-welcome-title" className="absolute inset-x-0 bottom-0 top-[50px] z-30 flex flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs text-gray-500">Step {step + 1} of {steps.length}</p>
        {at === 'tabs' && (
          <>
            <h2 id="aio-welcome-title" ref={title} tabIndex={-1} className="mt-1 text-base font-semibold text-gray-900 focus:outline-none">Welcome to FAP-AIO</h2>
            <p className="mt-1 text-sm text-gray-700">The panel stays beside FAP on every page. Its tabs:</p>
            <ul className="mt-2 space-y-2">
              {tabs.map((t) => (
                <li key={t} className="rounded-lg border border-gray-200 px-3 py-2">
                  <span className="block text-[13px] font-medium text-gray-900">{TAB_NAMES[t]}</span>
                  <span className="block text-xs text-gray-600">{TAB_TOUR[t]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {at === 'sync' && (
          <>
            <h2 id="aio-welcome-title" ref={title} tabIndex={-1} className="mt-1 text-base font-semibold text-gray-900 focus:outline-none">Sync this week</h2>
            <p className="mt-1 text-sm text-gray-700">FAP-AIO reads this week's classes and your exams from FAP, at a pace FAP accepts. The status bar below shows the progress.</p>
            <div className="mt-3">
              <button type="button" className={primary} disabled={sync.running} aria-busy={sync.running} onClick={() => { setSynced('running'); void runSyncAll() }}>
                {sync.running ? 'Syncing this week' : 'Sync this week'}
              </button>
            </div>
            {synced === 'done' && !sync.error && <p role="status" className="mt-2 text-sm text-green-800">This week is synced.</p>}
            {synced === 'done' && sync.error && <p role="alert" className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">{sync.error}</p>}
          </>
        )}
        {at === 'features' && (
          <>
            <h2 id="aio-welcome-title" ref={title} tabIndex={-1} className="mt-1 text-base font-semibold text-gray-900 focus:outline-none">Optional features</h2>
            <p className="mt-1 text-sm text-gray-700">These are off. Turn on what you want; you can change them later in Settings.</p>
            <ul className="mt-2">{features.map((k) => <FeatureRow key={k} settingKey={k} />)}</ul>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-3">
        <button type="button" className={quiet} onClick={close}>Skip</button>
        <span className="flex-1" />
        {step > 0 && <button type="button" className={quiet} onClick={() => setStep(step - 1)}>Back</button>}
        <button type="button" className={primary} onClick={() => (last ? close() : setStep(step + 1))}>{last ? 'Done' : 'Next'}</button>
      </div>
    </div>
  )
}

/** Settings row that shows the welcome again (R9.2: Help reopens it). */
export function WelcomeAgain() {
  return <button type="button" className="inline-flex h-control items-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={showWelcome}>Show the welcome</button>
}
