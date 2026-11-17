// A settings switch that needs the `notifications` permission (platform R1.3, R1.6): turning it on asks
// Chrome through the grant flow first and stays off, saying why, when refused. Turning it off asks nothing.
import { useState } from 'react'
import { call } from '../../../shared/call'
import { settingDef, useSetting, writeSetting } from './registry'

export function PermissionToggle({ settingKey, reason }: { settingKey: string; reason: string }) {
  const def = settingDef(settingKey)!
  const on = useSetting(def) === true
  const [why, setWhy] = useState<string | null>(null)
  const flip = async () => {
    setWhy(null)
    if (on) { await writeSetting(def, false); return }
    const r = await call<{ granted: boolean }>({ type: 'perm.request', perm: 'notifications', reason })
    if (r.ok && r.value.granted) await writeSetting(def, true)
    else setWhy('It stays off: Chrome did not grant the notifications permission.')
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
