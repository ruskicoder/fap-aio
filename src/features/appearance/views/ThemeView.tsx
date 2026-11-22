// Theme overlay (appearance R2.5, R2.6, R1.4, R5.5): the preset gallery and custom themes, a live preview on
// this page before applying, FAP default, duplicating a theme into an editable custom theme, and auto mode
// with a light and a dark choice that follows the system colour scheme. A preview ends when the view closes.
import { useEffect, useRef, useState } from 'react'
import { Chip, Message, button, primary } from '../../scheduler/views/common'

const small = 'inline-flex h-7 items-center rounded border border-gray-300 px-2 text-xs hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 aria-pressed:border-orange-500 aria-pressed:bg-orange-50'
import { useStore } from '../../../content/panel/use-store'
import { parseActive } from '../state'
import { sendPreview } from '../preview'
import { parseTheme, toActiveStyle, type Theme } from '../themes/model'
import { PRESETS, presetById } from '../themes/presets'
import { addCustom, applyAuto, applyFapDefault, applyTheme, choiceOf, deleteCustom, duplicateTheme, MAX_CUSTOM } from '../themes/store'
import { downloadTheme, newTheme } from '../themes/io'
import { call } from '../../../shared/call'
import { ThemeEditor } from '../editor/ThemeEditor'

type Mode = 'single' | 'auto'

/** A small picture of the theme: its page background, a card with text and a primary button. */
function Swatch({ t }: { t: Theme }) {
  const p = presetById(t.preset ?? t.id)
  return (
    <div aria-hidden="true" className="flex h-14 w-20 shrink-0 items-end rounded-md p-1.5" style={{ background: p ? p.look.body : t.roles.surfaceAlt }}>
      <div className="flex w-full items-center gap-1 rounded px-1.5 py-1" style={{ background: t.roles.surface, border: `1px solid ${t.roles.border}` }}>
        <span className="h-1 flex-1 rounded-full" style={{ background: t.roles.text }} />
        <span className="h-2.5 w-4 rounded-full" style={{ background: t.roles.primary }} />
      </div>
    </div>
  )
}

export function ThemeView() {
  const active = parseActive(useStore('appearance.active').data)
  const custom = (useStore('appearance.themes').data?.themes ?? []).flatMap((t) => { const r = parseTheme(t); return r.ok ? [r.theme] : [] })
  const choice = choiceOf(active)
  const [mode, setMode] = useState<Mode>(choice.mode === 'auto' ? 'auto' : 'single')
  const [pair, setPair] = useState<{ light: string | null; dark: string | null }>(choice.mode === 'auto' ? { light: choice.light, dark: choice.dark } : { light: null, dark: null })
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState<Theme | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const all = [...PRESETS.map((p) => p.theme), ...custom]
  const byId = (id: string | null) => all.find((t) => t.id === id) ?? null
  const nameOf = (id: string) => byId(id)?.name ?? 'a theme that no longer exists'

  // The preview belongs to this view: it ends when the view closes.
  useEffect(() => () => sendPreview(null), [])
  const preview = (id: string | null) => {
    setPreviewing(id)
    if (id === null) sendPreview(null)
    else if (id === 'fap-default') sendPreview({ kind: 'fap-default' })
    else { const t = byId(id); if (t) sendPreview({ kind: 'style', style: toActiveStyle(t) }) }
  }
  const done = (text: string) => { preview(null); setNote({ tone: 'info', text }) }
  const apply = async (t: Theme) => { await applyTheme(t); done(`${t.name} is on for every FAP page.`) }
  const fapDefault = async () => { await applyFapDefault(); done('FAP default is on: FAP looks as it does without FAP-AIO.') }
  const applyPair = async () => {
    const l = byId(pair.light)
    const d = byId(pair.dark)
    if (!l || !d) return
    await applyAuto(l, d)
    done(`${l.name} in light mode and ${d.name} in dark mode, following your system.`)
  }
  const duplicate = async (t: Theme) => {
    const r = await duplicateTheme(t)
    setNote(typeof r === 'string' ? { tone: 'error', text: r } : { tone: 'info', text: `${r.name} is in Your themes; choose Edit to change it.` })
  }

  const taken = custom.map((t) => t.id)
  const create = async () => {
    const t = newTheme(taken)
    const err = await addCustom(t)
    if (err) setNote({ tone: 'error', text: err })
    else { preview(null); setNote(null); setEditing(t) }
  }
  // Import runs in the theme editor window, which holds the CSS parser (F-21).
  const importFile = async () => {
    setNote(null)
    const r = await call({ type: 'editor.open', mode: 'import' }).catch(() => null)
    if (!r || !r.ok) setNote({ tone: 'error', text: 'The import window could not open. Reload this page and try again.' })
  }

  const current = choice.mode === 'fap-default' ? 'FAP default' : choice.mode === 'single' ? nameOf(choice.id) : `${nameOf(choice.light)} (light) and ${nameOf(choice.dark)} (dark)`

  const card = (t: Theme, isCustom: boolean) => {
    const on = mode === 'single' ? choice.mode === 'single' && choice.id === t.id : pair[t.mode] === t.id
    return (
      <li key={t.id} className={`flex gap-2.5 rounded-lg border p-2 ${on ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200'}`}>
        <Swatch t={t} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-gray-900">{t.name}{on && <span className="font-normal text-gray-600">{mode === 'single' ? ' · in use' : ` · ${t.mode}`}</span>}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button type="button" className={small} aria-pressed={previewing === t.id} aria-label={`${previewing === t.id ? 'Stop preview of' : 'Preview'} ${t.name}`} onClick={() => preview(previewing === t.id ? null : t.id)}>{previewing === t.id ? 'Stop preview' : 'Preview'}</button>
            {mode === 'single'
              ? <button type="button" className={small} aria-label={`Apply ${t.name}`} onClick={() => void apply(t)}>Apply</button>
              : <button type="button" className={small} aria-pressed={pair[t.mode] === t.id} aria-label={`Use ${t.name} for ${t.mode}`} onClick={() => setPair((p) => ({ ...p, [t.mode]: t.id }))}>Use for {t.mode}</button>}
            <button type="button" className={small} aria-label={`Duplicate ${t.name}`} onClick={() => void duplicate(t)}>Duplicate</button>
            {isCustom && <button type="button" className={small} aria-label={`Edit ${t.name}`} onClick={() => { preview(null); setNote(null); setEditing(t) }}>Edit</button>}
            {isCustom && <button type="button" className={small} aria-label={`Export ${t.name}`} onClick={() => downloadTheme(rootRef.current ?? document.body, t)}>Export</button>}
            {isCustom && <button type="button" className={small} aria-label={`Delete ${t.name}`} onClick={() => void deleteCustom(t.id)}>Delete</button>}
          </div>
        </div>
      </li>
    )
  }
  const section = (title: string, list: Theme[], isCustom = false) => list.length > 0 && (
    <section className="px-3 pt-3" aria-label={title}>
      <h3 className="pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <ul className="flex flex-col gap-2">{list.map((t) => card(t, isCustom))}</ul>
    </section>
  )

  if (editing) {
    return <ThemeEditor key={editing.id} theme={editing} onDone={(msg) => { setEditing(null); if (msg) setNote({ tone: 'info', text: msg }) }} />
  }

  return (
    // Controls scrolled into view (focus, find) stop below the sticky preview bar (WCAG 2.4.11).
    <div ref={rootRef} className="pb-4 [&_button]:scroll-mt-40 [&_input]:scroll-mt-40 [&_select]:scroll-mt-40">
      {/* In use, the mode chips and the preview bar stay in reach while the gallery scrolls (panel-ux R11.4; F-23). */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-3 pb-2 pt-2.5">
        <p className="text-sm text-gray-700">In use: <b className="font-semibold text-gray-900">{current}</b></p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="How themes apply">
          <Chip on={mode === 'single'} onClick={() => setMode('single')}>One theme</Chip>
          <Chip on={mode === 'auto'} onClick={() => setMode('auto')}>Light and dark</Chip>
        </div>
        {previewing && (
          <div role="status" className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-gray-900 shadow-sm">
            <span className="flex-1">Previewing {previewing === 'fap-default' ? 'FAP default' : nameOf(previewing)} on this page. Nothing changes until you apply.</span>
            <button type="button" className={button} onClick={() => preview(null)}>Stop preview</button>
          </div>
        )}
      </div>
      <div className="px-3">
        {mode === 'auto' && (
          <div className="mt-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
            <p>Light: <b className="font-medium text-gray-900">{pair.light ? nameOf(pair.light) : 'choose below'}</b> · Dark: <b className="font-medium text-gray-900">{pair.dark ? nameOf(pair.dark) : 'choose below'}</b></p>
            <p className="text-xs text-gray-600">FAP-AIO switches between them with your system's light or dark setting.</p>
            <button type="button" className={`${primary} mt-1.5`} disabled={!pair.light || !pair.dark} onClick={() => void applyPair()}>Apply light and dark</button>
          </div>
        )}
        {note && <div className="mt-2"><Message tone={note.tone}>{note.text}</Message></div>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className={button} aria-pressed={previewing === 'fap-default'} onClick={() => preview(previewing === 'fap-default' ? null : 'fap-default')}>{previewing === 'fap-default' ? 'Stop preview' : 'Preview FAP default'}</button>
          <button type="button" className={button} disabled={choice.mode === 'fap-default'} onClick={() => void fapDefault()}>Use FAP default</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className={button} disabled={custom.length >= MAX_CUSTOM} onClick={() => void create()}>New theme</button>
          <button type="button" className={button} disabled={custom.length >= MAX_CUSTOM} onClick={() => void importFile()}>Import a theme</button>
        </div>
      </div>
      {section('Light themes', PRESETS.filter((p) => p.theme.mode === 'light').map((p) => p.theme))}
      {section('Dark themes', PRESETS.filter((p) => p.theme.mode === 'dark').map((p) => p.theme))}
      {section(`Your themes (${custom.length} of ${MAX_CUSTOM})`, custom, true)}
    </div>
  )
}
