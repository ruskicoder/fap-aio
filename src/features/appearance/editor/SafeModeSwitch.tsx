// Safe mode (appearance R4.6): turns custom CSS off on every FAP page at once; stored with the active theme.
import { update } from '../../../shared/storage/catalog'
import { useStore } from '../../../content/panel/use-store'
import { parseActive } from '../state'

export function SafeModeSwitch() {
  const active = parseActive(useStore('appearance.active').data)
  const on = active.safeMode
  return (
    <label className="flex items-center gap-2 text-sm text-gray-800">
      <button type="button" role="switch" aria-checked={on} aria-label="Safe mode"
        onClick={() => void update('appearance.active', (a) => ({ ...parseActive(a), safeMode: !on }))}
        className="inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        style={{ background: on ? 'rgb(var(--c-orange-600))' : 'rgb(var(--c-gray-300))' }}>
        <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
      <span>Safe mode: custom CSS off on every FAP page</span>
    </label>
  )
}
