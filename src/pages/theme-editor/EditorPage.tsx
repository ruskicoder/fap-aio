// Theme editor page (appearance R4.1 to R4.3, R5.3, R5.4; fix F-21). It holds CodeMirror and csstree, so
// neither loads with FAP pages: the CSS editor for one custom theme, and theme import with sanitizing and
// the outside-CSS warning. Changes preview on the FAP tab that opened it (typed `theme.preview` message);
// Save goes through storage, which every FAP page and the panel follow. Closing the window ends the preview.
import { useEffect, useRef, useState } from 'react'
import { PROTOCOL_VERSION } from '../../shared/messages'
import { read } from '../../shared/storage/catalog'
import { Message } from '../../features/scheduler/views/common'
import { CssEditor } from '../../features/appearance/editor/CssEditor'
import { sanitizeCss } from '../../features/appearance/editor/csstree'
import { parseTheme, toActiveStyle, type Theme } from '../../features/appearance/themes/model'
import { importTheme, type Imported } from '../../features/appearance/themes/io'
import { addCustom, applyTheme, saveCustom } from '../../features/appearance/themes/store'

const button = 'inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
const primary = 'inline-flex h-9 items-center rounded-md bg-orange-600 px-3 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1'

export interface EditorPageProps { mode: 'css' | 'import'; tabId: number | null; themeId: string | null }

/** Shows a theme on the FAP tab, or ends the preview with null. */
export function previewOnTab(tabId: number | null, t: Theme | null): void {
  if (tabId === null) return
  const preview = t ? JSON.stringify({ kind: 'style', style: toActiveStyle(t) }) : null
  void chrome.tabs.sendMessage(tabId, { v: PROTOCOL_VERSION, type: 'theme.preview', preview }).catch(() => undefined)
}

async function storedTheme(id: string | null): Promise<Theme | null> {
  if (!id) return null
  const raw = (await read('appearance.themes'))?.themes.find((t) => t.id === id)
  if (!raw) return null
  const r = parseTheme(raw)
  return r.ok ? r.theme : null
}

function CssMode({ tabId, themeId }: { tabId: number | null; themeId: string | null }) {
  const [theme, setTheme] = useState<Theme | null | undefined>(undefined)
  const [css, setCss] = useState<string | null>(null)
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void storedTheme(themeId).then(setTheme) }, [])
  if (theme === undefined) return <p className="text-sm text-gray-600">Loading the theme</p>
  if (theme === null) return <Message tone="error">This theme is no longer in Your themes. Close this window and choose Edit on a theme in the panel.</Message>
  const save = async (andApply: boolean) => {
    setBusy(true)
    // Only the CSS is this window's; the rest is taken fresh from storage, so panel edits are kept.
    const latest = (await storedTheme(theme.id)) ?? theme
    const next = { ...latest, css: css ?? latest.css }
    const err = await saveCustom(next)
    if (!err && andApply) await applyTheme(next)
    setBusy(false)
    if (err) { setNote({ tone: 'error', text: err }); return }
    previewOnTab(tabId, null)
    setNote({ tone: 'info', text: andApply ? `Saved; ${next.name} is on for every FAP page.` : 'Saved.' })
  }
  return (
    <>
      <h1 className="text-lg font-semibold">Custom CSS for {theme.name}</h1>
      <p className="mb-2 text-sm text-gray-600">{tabId === null ? 'Open this editor from the panel on a FAP page to see a preview there.' : 'Changes show on the FAP page as you type. Nothing is kept until you save.'}</p>
      <CssEditor value={theme.css} onChange={(c) => { setCss(c); setNote(null); previewOnTab(tabId, { ...theme, css: c }) }} />
      {note && <div className="mt-2"><Message tone={note.tone}>{note.text}</Message></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={busy} onClick={() => void save(true)}>Save and apply</button>
        <button type="button" className={button} disabled={busy} onClick={() => void save(false)}>Save</button>
        <button type="button" className={button} onClick={() => window.close()}>Close</button>
      </div>
    </>
  )
}

function ImportMode({ tabId }: { tabId: number | null }) {
  const [incoming, setIncoming] = useState<Imported | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const readFile = async (f: File | undefined) => {
    if (!f) return
    setNote(null)
    setPreviewing(false)
    previewOnTab(tabId, null)
    const taken = ((await read('appearance.themes'))?.themes ?? []).map((t) => t.id)
    const r = await importTheme(await f.text(), taken, async (css) => sanitizeCss(css))
    if ('error' in r) { setIncoming(null); setNote({ tone: 'error', text: r.error }); return }
    setIncoming(r)
  }
  const toggle = () => {
    if (!incoming) return
    previewOnTab(tabId, previewing ? null : incoming.theme)
    setPreviewing(!previewing)
  }
  const save = async () => {
    if (!incoming) return
    const err = await addCustom(incoming.theme)
    previewOnTab(tabId, null)
    setPreviewing(false)
    setNote(err ? { tone: 'error', text: err } : { tone: 'info', text: `${incoming.theme.name} is in Your themes. You can close this window.` })
    if (!err) setIncoming(null)
  }
  return (
    <>
      <h1 className="text-lg font-semibold">Import a theme</h1>
      <p className="mb-2 text-sm text-gray-600">Choose a FAP-AIO theme file (.json). It is checked before anything is saved.</p>
      <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Theme file" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = '' }} />
      <button type="button" className={button} onClick={() => file.current?.click()}>Choose a theme file</button>
      {incoming && (
        <div role="region" aria-label="Theme to import" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Import {incoming.theme.name}?</p>
          <p>This theme comes from outside FAP-AIO. Its CSS can change how every FAP page looks; preview it before you save.</p>
          {incoming.removed.length > 0 && (
            <>
              <p className="mt-1 font-medium">Removed for safety:</p>
              <ul className="list-disc pl-5">{incoming.removed.map((r, i) => <li key={i} className="break-all">{r}</li>)}</ul>
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={button} aria-pressed={previewing} disabled={tabId === null} onClick={toggle}>{previewing ? 'Stop preview' : 'Preview on the FAP page'}</button>
            <button type="button" className={primary} onClick={() => void save()}>Save to Your themes</button>
            <button type="button" className={button} onClick={() => { previewOnTab(tabId, null); setPreviewing(false); setIncoming(null) }}>Cancel</button>
          </div>
        </div>
      )}
      {note && <div className="mt-2"><Message tone={note.tone}>{note.text}</Message></div>}
      <div className="mt-3"><button type="button" className={button} onClick={() => window.close()}>Close</button></div>
    </>
  )
}

export function EditorPage({ mode, tabId, themeId }: EditorPageProps) {
  // A preview belongs to this window: it ends when the window closes.
  useEffect(() => {
    const end = () => previewOnTab(tabId, null)
    window.addEventListener('pagehide', end)
    return () => { window.removeEventListener('pagehide', end); end() }
  }, [])
  return <main className="mx-auto max-w-3xl p-4">{mode === 'import' ? <ImportMode tabId={tabId} /> : <CssMode tabId={tabId} themeId={themeId} />}</main>
}
