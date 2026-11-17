// Info and alerts settings (info R8.1, R9.1, R9.2; platform R1.3; panel-ux R8.1): browser notifications per
// alert kind, off by default; turning one on asks for the `notifications` permission first. Only kinds that
// are produced today are listed; background refresh and watch keywords register with their features.
import { createElement, useState } from 'react'
import { call } from '../../shared/call'
import type { AlertKind } from '../../shared/alerts'
import { registerSetting, settingDef, useSetting, writeSetting } from '../../content/panel/settings/registry'

export const NOTIFY_KINDS: { kind: AlertKind; label: string; description: string }[] = [
  { kind: 'grade', label: 'Notify grade warnings', description: 'A browser notification when a course is failing or its goal falls out of reach.' },
  { kind: 'coursera', label: 'Notify Coursera deadlines', description: 'A browser notification when Coursera courses are due before a final exam.' },
]

export function NotifyToggle({ kind }: { kind: AlertKind }) {
  const def = settingDef(`alerts.notify.${kind}`)!
  const on = useSetting(def) === true
  const [why, setWhy] = useState<string | null>(null)
  const flip = async () => {
    setWhy(null)
    if (on) { await writeSetting(def, false); return }
    const r = await call<{ granted: boolean }>({ type: 'perm.request', perm: 'notifications', reason: 'Show alerts as browser notifications.' })
    if (r.ok && r.value.granted) await writeSetting(def, true)
    else setWhy('Notifications stay off: Chrome did not grant the permission.')
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" role="switch" aria-checked={on} aria-label={def.label} onClick={() => void flip()}
        className="inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
        style={{ background: on ? '#ea580c' : '#d1d5db' }}>
        <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
      {why && <p role="alert" className="text-xs text-red-700">{why}</p>}
    </div>
  )
}

export function registerInfoSettings(): void {
  for (const k of NOTIFY_KINDS) {
    registerSetting<boolean>({
      key: `alerts.notify.${k.kind}`, section: 'info', type: 'custom', default: false,
      label: k.label, description: k.description,
      component: () => createElement(NotifyToggle, { kind: k.kind }),
    })
  }
}
