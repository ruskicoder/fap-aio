// Settings view (panel-ux R8.1 to R8.3, R2.4): sections in the R8.1 order with only the settings that
// have shipped, a search over label, description and key, and per row its description, its default and
// a "modified" marker. Changes save at once. A section index appears when there are two or more sections:
// a sticky list on the left while docked, a select on top while floating.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { SECTION_LABELS, activeSections, isModified, searchSettings, settingDefs, useSetting, writeSetting, type SectionId, type SettingDef } from './settings/registry'
import { useStore } from './use-store'

const field = 'h-control rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

function optionLabel(def: SettingDef, v: unknown): string {
  if (def.type === 'toggle') return v ? 'On' : 'Off'
  return def.options?.find((o) => JSON.stringify(o.value) === JSON.stringify(v))?.label ?? String(v)
}

function Control({ def, value, set, labelId }: { def: SettingDef; value: unknown; set: (v: unknown) => void; labelId: string }) {
  if (def.component) {
    const C = def.component
    return <C def={def} value={value} set={set} />
  }
  if (def.type === 'toggle') {
    const on = value === true
    return (
      <button type="button" role="switch" aria-checked={on} aria-labelledby={labelId} onClick={() => set(!on)}
        className="inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
        style={{ background: on ? '#ea580c' : '#d1d5db' }}>
        <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    )
  }
  if (def.type === 'select' && (def.options?.length ?? 0) <= 3) {
    return (
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col">
        {def.options!.map((o) => (
          <label key={String(o.value)} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-gray-900">
            <input type="radio" name={`aio-${def.key}`} className="h-4 w-4 accent-orange-600" checked={JSON.stringify(value) === JSON.stringify(o.value)} onChange={() => set(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    )
  }
  if (def.type === 'select') {
    return (
      <select aria-labelledby={labelId} className={field} value={String(value)} onChange={(e) => set(def.options!.find((o) => String(o.value) === e.target.value)!.value)}>
        {def.options!.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    )
  }
  if (def.type === 'number') {
    return <input type="number" aria-labelledby={labelId} className={`${field} w-24`} min={def.min} max={def.max} value={String(value ?? '')} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
  }
  if (def.type === 'list') {
    const list = Array.isArray(value) ? (value as string[]) : []
    return <textarea aria-labelledby={labelId} rows={3} className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" value={list.join('\n')} onChange={(e) => set(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />
  }
  return <input type="text" aria-labelledby={labelId} className={`${field} w-full`} value={String(value ?? '')} onChange={(e) => set(e.target.value)} />
}

function Row({ def }: { def: SettingDef }) {
  const value = useSetting(def)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const modified = isModified(def, value)
  const set = (v: unknown) => void writeSetting(def, v).then(setError)
  const inline = def.type === 'toggle'
  return (
    <div className="border-b border-gray-100 px-row-x py-row-y last:border-b-0" data-setting={def.key}>
      <div className={inline ? 'flex items-start gap-3' : ''}>
        <div className="min-w-0 flex-1">
          <p id={id} className="text-[13px] font-medium text-gray-900">
            {def.label}
            {modified && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-orange-600 align-middle" title="Changed from the default" aria-label="Changed from the default" role="img" />}
          </p>
          <p className="text-xs text-gray-600">{def.description}</p>
          <p className="text-[11px] text-gray-500">Default: {optionLabel(def, def.default)}</p>
        </div>
        {inline && <Control def={def} value={value} set={set} labelId={id} />}
      </div>
      {!inline && <div className="mt-1.5"><Control def={def} value={value} set={set} labelId={id} /></div>}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}

export function SettingsView({ section }: { section?: string }) {
  const [q, setQ] = useState('')
  const docked = useStore('panel.state').data?.mode === 'docked'
  const sections = activeSections()
  const all = useMemo(() => settingDefs(), [])
  const shown = q.trim() ? searchSettings(q) : all
  const refs = useRef(new Map<SectionId, HTMLElement>())
  const go = (s: SectionId) => refs.current.get(s)?.scrollIntoView?.({ block: 'start' })
  useEffect(() => { if (section) go(section as SectionId) }, [section])
  const withIndex = sections.length > 1 && !q.trim()

  const body = (
    <div className="min-w-0 flex-1">
      {sections.map((s) => {
        const rows = shown.filter((d) => d.section === s)
        if (!rows.length) return null
        return (
          <section key={s} ref={(el) => { if (el) refs.current.set(s, el) }} aria-labelledby={`aio-set-${s}`} className="mb-gap">
            <h3 id={`aio-set-${s}`} className="px-row-x pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{SECTION_LABELS[s]}</h3>
            {rows.map((d) => <Row key={d.key} def={d} />)}
          </section>
        )
      })}
      {q.trim() && !shown.length && <p className="px-row-x py-3 text-sm text-gray-600">No settings match "{q.trim()}".</p>}
    </div>
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 px-3 py-2">
        <input type="search" aria-label="Search settings" placeholder="Search settings" className={`${field} min-w-0 flex-1`} value={q} onChange={(e) => setQ(e.target.value)} />
        {withIndex && !docked && (
          <select aria-label="Go to section" className={field} value="" onChange={(e) => go(e.target.value as SectionId)}>
            <option value="" disabled>Go to section</option>
            {sections.map((s) => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
          </select>
        )}
      </div>
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {withIndex && docked && (
          <nav aria-label="Settings sections" className="sticky top-0 w-32 shrink-0 self-start border-r border-gray-100 py-2">
            {sections.map((s) => (
              <button key={s} type="button" className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500" onClick={() => go(s)}>{SECTION_LABELS[s]}</button>
            ))}
          </nav>
        )}
        {body}
      </div>
    </div>
  )
}
