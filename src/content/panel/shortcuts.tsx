// Shortcuts in Settings and the shortcuts sheet (panel-ux R7.2 to R7.4, R7.6): every action with its
// current chord, Record (refused with the conflict named), Clear and Reset; the toggle-panel chord from
// chrome.commands with a button to Chrome's own shortcuts page; the `?` sheet lists them all.
import { createElement, useEffect, useState } from 'react'
import { call } from '../../shared/call'
import { useStore } from './use-store'
import { actionDefs, chordOf, conflict, clearKeybind, isMac, keybindOf, resetKeybind, setKeybind, setRecording, type ActionDef } from './keys'
import { registerSetting } from './settings/registry'

const small = 'inline-flex h-7 items-center rounded border border-gray-300 px-2 text-xs font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

export function Kbd({ chord }: { chord: string }) {
  if (!chord) return <span className="text-xs text-gray-500">None</span>
  return <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-900">{chord}</kbd>
}

function useToggleChord(): string | null {
  const [chord, setChord] = useState<string | null>(null)
  useEffect(() => {
    void call<{ name?: string; shortcut?: string }[]>({ type: 'commands.list' }).then((r) => {
      if (r.ok) setChord(r.value.find((c) => c.name === 'toggle-panel')?.shortcut ?? '')
    })
  }, [])
  return chord
}

export function KeybindRow({ action, mac = isMac() }: { action: ActionDef; mac?: boolean }) {
  const overrides = useStore('panel.prefs').data?.keybinds ?? {}
  const chord = keybindOf(action.id, overrides, mac)
  const [rec, setRec] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!rec) return
    setRecording(true)
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setRec(false); return }
      const c = chordOf(e)
      if (!c) return
      const why = conflict(action.id, c, overrides, mac)
      if (why) { setError(`${c} cannot be used. ${why}`); setRec(false); return }
      setError(null)
      setRec(false)
      void setKeybind(action.id, c)
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); setRecording(false) }
  }, [rec, action.id, overrides, mac])
  const overridden = action.id in overrides
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {rec ? <span role="status" className="text-xs font-medium text-orange-800">Press the new keys, or Esc to cancel</span> : <Kbd chord={chord} />}
        <span className="flex-1" />
        <button type="button" className={small} aria-label={`Record a shortcut for ${action.title.toLowerCase()}`} disabled={rec} onClick={() => { setError(null); setRec(true) }}>Record</button>
        <button type="button" className={small} aria-label={`Clear the shortcut for ${action.title.toLowerCase()}`} disabled={!chord} onClick={() => void clearKeybind(action.id)}>Clear</button>
        <button type="button" className={small} aria-label={`Reset the shortcut for ${action.title.toLowerCase()}`} disabled={!overridden} onClick={() => void resetKeybind(action.id)}>Reset</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  )
}

export function ToggleRow() {
  const chord = useToggleChord()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chord === null ? null : <Kbd chord={chord} />}
      <span className="flex-1" />
      <button type="button" className={small} onClick={() => void call({ type: 'shortcuts.open' })}>Change in Chrome</button>
    </div>
  )
}

/** Settings, Shortcuts: one row per action, plus the browser-managed toggle (R7.2, R7.4). */
export function registerShortcutSettings(): void {
  registerSetting<null>({
    key: 'keys.toggle', section: 'shortcuts', type: 'custom', default: null, transfer: false,
    label: 'Show or hide the panel',
    description: "Works in any FAP tab; Chrome manages this one on its own shortcuts page.",
    component: () => createElement(ToggleRow),
  })
  for (const a of actionDefs()) {
    registerSetting<null>({
      key: `keys.${a.id}`, section: 'shortcuts', type: 'custom', default: null, transfer: false,
      label: a.title,
      description: (isMac() ? a.default.mac : a.default.win)
        ? `Default: ${isMac() ? a.default.mac : a.default.win}. Not active while you type in a field.`
        : 'No default, so it never clashes with Chrome or your system: record your own.',
      component: () => createElement(KeybindRow, { action: a }),
    })
  }
}

/** The `?` sheet (R7.6). */
export function ShortcutsSheet({ mac = isMac() }: { mac?: boolean }) {
  const overrides = useStore('panel.prefs').data?.keybinds ?? {}
  const toggle = useToggleChord()
  return (
    <div className="p-3">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="pb-2 text-left text-xs text-gray-600">Shortcuts do not run while you type in a field, except Show or hide the panel. Actions marked None have no default; record one in Settings, Shortcuts.</caption>
        <tbody>
          <tr className="border-b border-gray-100"><td className="py-1.5 pr-3">Show or hide the panel</td><td className="py-1.5">{toggle === null ? null : <Kbd chord={toggle} />}</td></tr>
          {actionDefs().map((a) => (
            <tr key={a.id} className="border-b border-gray-100"><td className="py-1.5 pr-3">{a.title}</td><td className="py-1.5"><Kbd chord={keybindOf(a.id, overrides, mac)} /></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
