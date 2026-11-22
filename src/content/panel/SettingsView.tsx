// Settings view (panel-ux R8.1 to R8.3, R2.4): sections in the R8.1 order with only the settings that
// have shipped, a search over label, description and key, and per row its description, its default and
// a "modified" marker. Changes save at once. A section index appears when there are two or more sections:
// a sticky list on the left while docked, a select on top while floating. The foot of the view exports,
// imports (with a list of changes to confirm) and resets settings (R8.4, R8.5).
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { SECTION_LABELS, activeSections, isModified, searchSettings, settingDefs, settingDef, useSetting, writeSetting, type SectionId, type SettingDef } from './settings/registry'
import { applyChanges, downloadJson, exportSettings, planImport, resetSettings, type ImportPlan } from './settings/transfer'
import { useStore } from './use-store'

const quiet = 'inline-flex h-control items-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
const strong = 'inline-flex h-control items-center rounded bg-orange-600 px-3 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'

type Pending = { kind: 'reset'; section: SectionId | null } | { kind: 'import'; plan: ImportPlan }

function valueText(key: string, v: unknown): string {
  const def = settingDef(key)
  if (def) return optionLabel(def, v)
  return JSON.stringify(v)
}

function Confirm({ pending, onDone }: { pending: Pending; onDone: (msg: string | null) => void }) {
  if (pending.kind === 'reset') {
    const what = pending.section ? `the ${SECTION_LABELS[pending.section]} settings` : 'all settings'
    return (
      <div role="alertdialog" aria-label="Confirm reset" className="mx-3 my-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">
        <p className="text-gray-900">Reset {what} to their defaults?</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className={strong} onClick={() => void resetSettings(pending.section).then(() => onDone('Defaults restored.'))}>Reset</button>
          <button type="button" className={quiet} onClick={() => onDone(null)}>Cancel</button>
        </div>
      </div>
    )
  }
  const { changes, refused, unknown } = pending.plan
  return (
    <div role="alertdialog" aria-label="Confirm import" className="mx-3 my-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">
      {changes.length ? (
        <>
          <p className="font-medium text-gray-900">Import changes {changes.length === 1 ? '1 setting' : `${changes.length} settings`}:</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-gray-800">
            {changes.map((c) => <li key={c.key} className="break-words">{c.label}: {valueText(c.key, c.from)} to {valueText(c.key, c.to)}</li>)}
          </ul>
        </>
      ) : <p className="text-gray-900">This file changes nothing.</p>}
      {refused.length > 0 && <p className="mt-1 text-xs text-red-800">Not imported: {refused.map((r) => `${settingDef(r.key)?.label ?? r.key} (${r.reason})`).join(', ')}.</p>}
      {unknown.length > 0 && <p className="mt-1 text-xs text-gray-600">Ignored, not settings of this version: {unknown.join(', ')}.</p>}
      <div className="mt-2 flex gap-2">
        {changes.length > 0 && <button type="button" className={strong} onClick={() => void applyChanges(changes).then(() => onDone('Settings imported.'))}>Apply</button>}
        <button type="button" className={quiet} onClick={() => onDone(null)}>{changes.length ? 'Cancel' : 'Close'}</button>
      </div>
    </div>
  )
}

const field = 'h-control rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

function optionLabel(def: SettingDef, v: unknown): string {
  if (def.type === 'toggle') return v ? 'On' : 'Off'
  if (v === null || v === undefined || v === '') return 'None'
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'None'
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
        style={{ background: on ? 'rgb(var(--c-orange-600))' : 'rgb(var(--c-gray-300))' }}>
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
    return <input type="number" aria-labelledby={labelId} className={`${field} w-24`} min={def.min} max={def.max} step={def.step} value={String(value ?? '')} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
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
  const modified = def.transfer !== false && isModified(def, value)
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
          {def.transfer !== false && <p className="text-[11px] text-gray-500">Default: {def.defaultText ?? optionLabel(def, def.default)}</p>}
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
  const [pending, setPending] = useState<Pending | null>(null)
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const foot = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const doExport = async () => {
    downloadJson(foot.current ?? document.body, `fap-aio-settings-${new Date().toISOString().slice(0, 10)}.json`, await exportSettings())
    setNote({ tone: 'info', text: 'Settings exported.' })
  }
  const doImport = async (f: File | undefined) => {
    if (!f) return
    const plan = await planImport(await f.text())
    if (file.current) file.current.value = ''
    if ('error' in plan) setNote({ tone: 'error', text: plan.error })
    else { setNote(null); setPending({ kind: 'import', plan }) }
  }
  const done = (msg: string | null) => { setPending(null); if (msg) setNote({ tone: 'info', text: msg }) }
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
            <div className="flex items-center gap-2 px-row-x pb-1 pt-2">
              <h3 id={`aio-set-${s}`} className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{SECTION_LABELS[s]}</h3>
              {!q.trim() && <button type="button" aria-label={`Reset ${SECTION_LABELS[s].toLowerCase()} settings`} className="rounded px-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" onClick={() => setPending({ kind: 'reset', section: s })}>Reset section</button>}
            </div>
            {rows.map((d) => <Row key={d.key} def={d} />)}
          </section>
        )
      })}
      {q.trim() && !shown.length && <p className="px-row-x py-3 text-sm text-gray-600">No settings match "{q.trim()}".</p>}
      {pending && <Confirm pending={pending} onDone={done} />}
      {note && <p role={note.tone === 'error' ? 'alert' : 'status'} className={`mx-3 my-2 rounded px-2 py-1 text-xs ${note.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'}`}>{note.text}</p>}
      <div ref={foot} className="flex flex-wrap gap-2 border-t border-gray-200 px-3 py-3">
        <button type="button" className={quiet} onClick={() => void doExport()}>Export settings</button>
        <button type="button" className={quiet} onClick={() => file.current?.click()}>Import settings</button>
        <input ref={file} type="file" accept="application/json,.json" hidden aria-hidden="true" tabIndex={-1} onChange={(e) => void doImport(e.target.files?.[0])} />
        <button type="button" className={quiet} onClick={() => setPending({ kind: 'reset', section: null })}>Reset all</button>
      </div>
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
