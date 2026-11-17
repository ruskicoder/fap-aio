// KeybindEngine (panel-ux R7.1 to R7.6; design "KeybindEngine"): page actions with platform defaults, user
// overrides in `panel.prefs.keybinds` (overrides only), one capture-phase keydown listener that ignores
// typing in fields and IME composition, and checks for conflicts with other actions and browser chords.
import { readPrefs, updatePrefs } from '../../shared/panel-prefs'
import { subscribe } from '../../shared/storage/catalog'

export interface ActionDef {
  id: string
  title: string
  default: { win: string; mac: string }
  run(): void
}

const actions = new Map<string, ActionDef>()
export function registerAction(a: ActionDef): void {
  actions.set(a.id, a)
}
export const actionDefs = () => [...actions.values()]
export function clearActions(): void {
  actions.clear()
}

export function isMac(nav: Navigator = navigator): boolean {
  const p = (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? nav.platform ?? ''
  return /mac/i.test(p)
}

const KEY_NAMES: Record<string, string> = { ' ': 'Space', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }

/** The chord of a key event: modifiers in the order Ctrl, Cmd, Alt, Shift, then the key. `?` stands alone. */
export function chordOf(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift', 'AltGraph', 'CapsLock'].includes(e.key)) return null
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) return '?'
  // Alt changes the key on macOS (Alt+1 gives ¡), so digits, letters and brackets come from the code.
  let key = /^Digit\d$/.test(e.code) ? e.code.slice(5)
    : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3)
    : e.code === 'BracketLeft' ? '[' : e.code === 'BracketRight' ? ']'
    : KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  if (!key) return null
  const mods = [e.ctrlKey && 'Ctrl', e.metaKey && 'Cmd', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean)
  key = key === '+' ? 'Plus' : key
  return [...mods, key].join('+')
}

/** Chords the browser keeps for itself (R7.3), as a table. */
export const RESERVED: string[] = (['Ctrl', 'Cmd'] as const).flatMap((m) =>
  ['T', 'W', 'N', 'Shift+N', 'Shift+T', 'Tab', 'Shift+Tab', 'L', 'D', 'R', 'F', 'P', 'S', 'H', 'J', 'Q', 'K', 'E', 'O', 'U', 'Shift+Delete', 'Shift+I', 'Shift+J', 'Shift+C', 'F4', 'PageUp', 'PageDown', ...'123456789'].map((k) => `${m}+${k}`),
).concat(['Alt+F4', 'Alt+Left', 'Alt+Right', 'Alt+Home', 'F5', 'F6', 'F11', 'F12', 'Alt+F', 'Alt+E', 'Esc', 'Tab', 'Shift+Tab'])

export type Overrides = Record<string, string>

export function keybindOf(id: string, overrides: Overrides, mac: boolean): string {
  const a = actions.get(id)
  if (!a) return ''
  return id in overrides ? overrides[id]! : mac ? a.default.mac : a.default.win
}

/** Why a chord cannot be used for this action, or null (R7.3). The tab chords on macOS are allowed defaults. */
export function conflict(id: string, chord: string, overrides: Overrides, mac: boolean, toggleChord = 'Alt+Shift+F'): string | null {
  if (chord === toggleChord) return 'It opens and closes the panel (set on Chrome\'s shortcuts page).'
  const other = actionDefs().find((a) => a.id !== id && keybindOf(a.id, overrides, mac) === chord)
  if (other) return `It is already used by "${other.title}".`
  const isDefault = actionDefs().some((a) => (mac ? a.default.mac : a.default.win) === chord)
  if (RESERVED.includes(chord) && !isDefault) return 'The browser uses it.'
  if (!/[A-Za-z0-9[\]?]|F\d|Up|Down|Left|Right|Space/.test(chord.split('+').at(-1) ?? '')) return 'Pick a letter, digit or bracket key.'
  if (chord !== '?' && !/^(Ctrl|Cmd|Alt)\+/.test(chord)) return 'Add Ctrl, Alt or Cmd so typing on FAP does not trigger it.'
  return null
}

export async function setKeybind(id: string, chord: string | null): Promise<void> {
  await updatePrefs((p) => {
    const keybinds = { ...p.keybinds }
    if (chord === null) delete keybinds[id]
    else keybinds[id] = chord
    return { ...p, keybinds }
  })
}
/** Clearing stores an empty chord, so the action has none until reset. */
export const clearKeybind = (id: string) => setKeybind(id, '')
export const resetKeybind = (id: string) => setKeybind(id, null)

/** True when typing: inputs, textareas, selects and contenteditable, on FAP or in the panel (R7.5). */
export function isTyping(e: Event): boolean {
  const path = e.composedPath?.() ?? []
  const el = (path[0] ?? e.target) as Element | null
  if (!el || !('tagName' in el)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable === true
}

// While a Settings row records a chord, actions do not run.
let recording = false
export const setRecording = (v: boolean) => { recording = v }

// "Refresh current view" (Alt+R): a view registers its own refresh by route key; the header sync is the fallback.
const refreshers = new Map<string, () => void>()
export function registerRefresh(routeKey: string, fn: () => void): () => void {
  refreshers.set(routeKey, fn)
  return () => { if (refreshers.get(routeKey) === fn) refreshers.delete(routeKey) }
}
export const refresherFor = (routeKey: string) => refreshers.get(routeKey)

/** One capture-phase listener for every page action. Returns the remover. */
export function installKeys(win: Window = window, mac = isMac(win.navigator)): () => void {
  let overrides: Overrides = {}
  void readPrefs().then((p) => { overrides = p.keybinds })
  const off = subscribe('panel.prefs', (p) => { overrides = (p as { keybinds?: Overrides } | null)?.keybinds ?? {} })
  const onKey = (e: KeyboardEvent) => {
    if (recording || e.isComposing || e.repeat || isTyping(e)) return
    const chord = chordOf(e)
    if (!chord) return
    const a = actionDefs().find((x) => keybindOf(x.id, overrides, mac) === chord)
    if (!a) return
    e.preventDefault()
    e.stopPropagation()
    a.run()
  }
  win.addEventListener('keydown', onKey, true)
  return () => { win.removeEventListener('keydown', onKey, true); off() }
}
