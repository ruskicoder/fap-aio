// Theme editor for a custom theme (appearance R3.1 to R3.6, R4.1 to R4.6): name and mode, the harmony helper
// that fills the roles from one colour, a picker per role, measured contrast with a one-click fix, single
// `--ct-*` variables, custom CSS, and a background image from a local file. Every change previews on this page; Save
// keeps it, Cancel drops it.
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Chip, Message, button, primary, select } from '../../scheduler/views/common'
import { assignRoles, harmony, parseColor, rgbToOklch, SCHEMES, type RoleName, type Scheme } from '../color'
import { sendPreview } from '../preview'
import { cssValue, parseTheme, themeVars, toActiveStyle, type Theme } from '../themes/model'
import { CT_VARS } from '../themes/css-vars'
import { applyTheme, saveCustom } from '../themes/store'
import { ColorField, field, small } from './ColorField'
import { checks, fixRole } from './checks'
import { ACCEPT, REMOTE_REFUSED, imageFromFile, isRemote } from './image'
import { SafeModeSwitch } from './SafeModeSwitch'
import { call } from '../../../shared/call'
import { useStore } from '../../../content/panel/use-store'

export const ROLE_LABELS: Record<RoleName, string> = {
  primary: 'Primary', secondary: 'Secondary', accent: 'Accent', surface: 'Page background', surfaceAlt: 'Panels and menus',
  text: 'Text', textMuted: 'Muted text', border: 'Borders', success: 'Success', warning: 'Warning', danger: 'Danger', info: 'Info',
}
const SCHEME_LABELS: Record<Scheme, string> = {
  complementary: 'Complementary', analogous: 'Analogous', triadic: 'Triadic', 'split-complementary': 'Split complementary', tetradic: 'Tetradic', square: 'Square',
}
const heading = 'pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500'

export function ThemeEditor({ theme, onDone }: { theme: Theme; onDone: (message: string | null) => void }) {
  const [draft, setDraft] = useState<Theme>(theme)
  const [base, setBase] = useState(theme.roles.primary)
  const [scheme, setScheme] = useState<Scheme>('triadic')
  const [newVar, setNewVar] = useState({ name: '', value: '' })
  const [error, setError] = useState<string | null>(null)
  const [imgNote, setImgNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [cssNote, setCssNote] = useState<string | null>(null)
  // The CSS belongs to the CSS editor window (F-21): saved CSS flows back here, and this editor never
  // overwrites it with an older copy.
  const storedCss = useStore('appearance.themes').data?.themes.find((t) => t.id === theme.id)?.css
  useEffect(() => { if (storedCss !== undefined) setDraft((d) => (d.css === storedCss ? d : { ...d, css: storedCss })) }, [storedCss])
  const openCss = async () => {
    setCssNote(null)
    const r = await call({ type: 'editor.open', mode: 'css', themeId: theme.id }).catch(() => null)
    if (!r || !r.ok) setCssNote('The CSS editor could not open. Reload this page and try again.')
  }

  // Live preview on this page, 150 ms after the last change; it ends when the editor closes.
  useEffect(() => {
    const t = setTimeout(() => { const r = parseTheme(draft); if (r.ok) sendPreview({ kind: 'style', style: toActiveStyle(r.theme) }) }, 150)
    return () => clearTimeout(t)
  }, [draft])
  useEffect(() => () => sendPreview(null), [])

  const set = (patch: Partial<Theme>) => setDraft((d) => ({ ...d, ...patch }))
  const setRole = (k: RoleName, hex: string) => setDraft((d) => ({ ...d, roles: { ...d.roles, [k]: hex } }))
  const fill = () => {
    const c = parseColor(base)
    if (c) set({ roles: assignRoles(harmony(rgbToOklch(c), scheme).map((m) => m.hex), draft.mode) })
  }
  const failing = checks(draft.roles).filter((c) => !c.ok)
  const effective = themeVars(draft)
  const varBad = newVar.value !== '' && !cssValue.safeParse(newVar.value).success
  const addVar = () => {
    if (!CT_VARS.includes(newVar.name) || newVar.value.trim() === '' || varBad) return
    set({ vars: { ...draft.vars, [newVar.name]: newVar.value.trim() } })
    setNewVar({ name: '', value: '' })
  }
  const takeFile = async (f: File | undefined) => {
    if (!f) return
    setImgNote('Preparing the image')
    const r = await imageFromFile(f)
    if ('error' in r) { setImgNote(r.error); return }
    setImgNote(null)
    set({ background: { dataUrl: r.dataUrl, fit: draft.background?.fit ?? 'cover', dim: draft.background?.dim ?? 0.2 } })
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) { void takeFile(f); return }
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (isRemote(text)) setImgNote(REMOTE_REFUSED)
  }
  const save = async (andApply: boolean) => {
    setBusy(true)
    setError(null)
    const err = await saveCustom(draft)
    if (!err && andApply) { const r = parseTheme(draft); if (r.ok) await applyTheme(r.theme) }
    setBusy(false)
    if (err) setError(err)
    else onDone(andApply ? `${draft.name} is saved and on for every FAP page.` : `${draft.name} is saved.`)
  }

  return (
    // Controls scrolled into view stop above the sticky Save bar (WCAG 2.4.11).
    <div className="pb-2 [&_button]:scroll-mb-20 [&_input]:scroll-mb-20 [&_select]:scroll-mb-20 [&_.cm-content]:scroll-mb-20">
      <div className="px-3 pt-2.5">
        <p className="text-xs text-gray-600">Changes show on this page as you make them. Nothing is kept until you save.</p>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">Name
          <input type="text" maxLength={60} className={`${field} min-w-0 flex-1`} aria-invalid={draft.name.trim() === ''} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Light or dark">
          <Chip on={draft.mode === 'light'} onClick={() => set({ mode: 'light' })}>Light</Chip>
          <Chip on={draft.mode === 'dark'} onClick={() => set({ mode: 'dark' })}>Dark</Chip>
        </div>

        <h3 className={heading}>From one colour</h3>
        <ColorField label="Base colour" value={base} onChange={setBase} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-700" htmlFor="aio-scheme">Harmony</label>
          <select id="aio-scheme" className={select} value={scheme} onChange={(e) => setScheme(e.target.value as Scheme)}>
            {(Object.keys(SCHEMES) as Scheme[]).map((s) => <option key={s} value={s}>{SCHEME_LABELS[s]}</option>)}
          </select>
          <button type="button" className={button} onClick={fill}>Fill the colours</button>
        </div>
        <div className="mt-1.5 flex gap-1" aria-label="Harmony preview">
          {(() => { const c = parseColor(base); return c ? harmony(rgbToOklch(c), scheme).map((m, i) => (
            <span key={i} title={m.adjusted ? `${m.hex}, brought into range` : m.hex} className="h-5 flex-1 rounded" style={{ background: m.hex, outline: m.adjusted ? '2px dashed #9ca3af' : undefined, outlineOffset: '-2px' }} />
          )) : null })()}
        </div>
        <p className="text-xs text-gray-600">A dashed swatch was too vivid for screens and has been toned down.</p>

        <h3 className={heading}>Colours</h3>
        {(Object.keys(ROLE_LABELS) as RoleName[]).map((k) => <ColorField key={k} label={ROLE_LABELS[k]} value={draft.roles[k]} onChange={(h) => setRole(k, h)} />)}

        <h3 className={heading}>Contrast</h3>
        {failing.length === 0
          ? <p className="text-sm text-green-800">All {checks(draft.roles).length} pairs are readable.</p>
          : (
            <ul className="text-sm">
              {failing.map((c) => (
                <li key={`${c.fg}-${c.bg}`} className="flex flex-wrap items-center gap-2 py-0.5">
                  <span className="flex-1 text-gray-800">{ROLE_LABELS[c.fg]} on {ROLE_LABELS[c.bg].toLowerCase()}: {c.ratio.toFixed(2)}:1, needs {c.min}:1</span>
                  <button type="button" className={small} aria-label={`Fix ${ROLE_LABELS[c.fg].toLowerCase()} on ${ROLE_LABELS[c.bg].toLowerCase()}`} onClick={() => setRole(c.fg, fixRole(draft.roles, c.fg, c.min))}>Fix</button>
                </li>
              ))}
            </ul>
          )}

        <h3 className={heading}>Single variables</h3>
        {Object.keys(draft.vars).length > 0 && (
          <ul className="text-xs">
            {Object.entries(draft.vars).map(([k, v]) => (
              <li key={k} className="flex flex-wrap items-center gap-2 py-0.5">
                <code className="break-all text-gray-800">{k}</code><span className="min-w-0 flex-1 break-all text-gray-600">{v}</span>
                <button type="button" className={small} aria-label={`Remove ${k}`} onClick={() => { const { [k]: _, ...rest } = draft.vars; void _; set({ vars: rest }) }}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <select aria-label="Variable" className={`${select} min-w-0 max-w-full`} value={newVar.name} onChange={(e) => setNewVar({ name: e.target.value, value: effective[e.target.value] ?? '' })}>
            <option value="">Choose a variable</option>
            {CT_VARS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <input type="text" aria-label="Value" spellCheck={false} className={`${field} min-w-0 flex-1`} aria-invalid={varBad} value={newVar.value} onChange={(e) => setNewVar((n) => ({ ...n, value: e.target.value }))} />
          <button type="button" className={small} disabled={!newVar.name || newVar.value.trim() === '' || varBad} onClick={addVar}>Set</button>
        </div>
        {varBad && <p className="text-xs text-red-700">A value cannot contain ; {'{'} {'}'} {'<'} {'>'} or a backslash.</p>}

        <h3 className={heading}>Custom CSS</h3>
        <p className="text-sm text-gray-700">{draft.css.trim() ? `${draft.css.split('\n').length} lines of custom CSS.` : 'No custom CSS yet.'}</p>
        <p className="text-xs text-gray-600">The CSS editor opens in its own window; this page shows your CSS as you type there.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button type="button" className={button} onClick={() => void openCss()}>Open the CSS editor</button>
        </div>
        {cssNote && <p role="status" className="mt-1 text-xs text-red-700">{cssNote}</p>}
        <div className="mt-1.5"><SafeModeSwitch /></div>

        <h3 className={heading}>Background image</h3>
        <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-700">
          {draft.background && <div aria-hidden="true" className="mb-2 h-16 rounded bg-cover bg-center" style={{ backgroundImage: `url("${draft.background.dataUrl}")` }} />}
          <p>Drop a picture here or choose a file. It is resized and stored with the theme (under 300 KB).</p>
          <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" aria-label="Background image file" onChange={(e) => { void takeFile(e.target.files?.[0]); e.target.value = '' }} />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button type="button" className={small} onClick={() => fileRef.current?.click()}>{draft.background ? 'Choose another file' : 'Choose a file'}</button>
            {draft.background && <button type="button" className={small} onClick={() => set({ background: null })}>Remove the image</button>}
          </div>
          {draft.background && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">Fit
                <select className={`${select} h-7 text-xs`} value={draft.background.fit} onChange={(e) => set({ background: { ...draft.background!, fit: e.target.value as 'cover' | 'contain' | 'tile' } })}>
                  <option value="cover">Fill the page</option><option value="contain">Whole picture</option><option value="tile">Repeat</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs">Darken
                <input type="range" min={0} max={0.8} step={0.05} value={draft.background.dim} onChange={(e) => set({ background: { ...draft.background!, dim: Number(e.target.value) } })} />
                <span className="w-8">{Math.round(draft.background.dim * 100)}%</span>
              </label>
            </div>
          )}
          {imgNote && <p role="status" className="mt-1.5 text-xs text-gray-800">{imgNote}</p>}
        </div>
      </div>
      <div className="sticky bottom-0 mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-3 py-2">
        {error && <div className="w-full"><Message tone="error">{error}</Message></div>}
        <button type="button" className={primary} disabled={busy || draft.name.trim() === ''} onClick={() => void save(true)}>Save and apply</button>
        <button type="button" className={button} disabled={busy || draft.name.trim() === ''} onClick={() => void save(false)}>Save</button>
        <button type="button" className={button} onClick={() => onDone(null)}>Cancel</button>
      </div>
    </div>
  )
}
