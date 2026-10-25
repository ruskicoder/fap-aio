// Settings, M1 content (panel-ux R2.4, R1.5): the docked behaviour. The other sections come with
// the Settings audit (gate G-UI-SETTINGS).
import { useStore } from './use-store'
import { updatePrefs } from '../../shared/panel-prefs'

export function SettingsView() {
  const { data } = useStore('panel.prefs')
  const value = data?.docked ?? 'narrow'
  const pick = (docked: 'narrow' | 'cover') => void updatePrefs((p) => ({ ...p, docked }))
  return (
    <div className="p-4 text-sm">
      <fieldset>
        <legend className="mb-2 font-semibold text-gray-900">When docked</legend>
        {([['narrow', 'Narrow the page'], ['cover', 'Cover the page']] as const).map(([v, l]) => (
          <label key={v} className="flex min-h-8 cursor-pointer items-center gap-2 text-gray-900">
            <input type="radio" name="aio-docked" className="h-4 w-4" checked={value === v} onChange={() => pick(v)} />
            {l}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
