// The theme editor page (appearance R4, R5; fix F-21): the CSS editor and theme import run in their own
// extension page, so CodeMirror and csstree never load with FAP pages. The panel asks for it with
// `editor.open`; the page previews on the asking tab and saves through storage. One window at a time.
import { fail, ok, register } from './router'

export const EDITOR_PAGE = 'src/pages/theme-editor/editor.html'
let windowId: number | null = null

export function editorUrl(mode: 'css' | 'import', tabId: number, themeId?: string): string {
  const q = new URLSearchParams({ mode, tab: String(tabId) })
  if (themeId) q.set('theme', themeId)
  return chrome.runtime.getURL(`${EDITOR_PAGE}?${q}`)
}

export function installEditorWindow(): void {
  register('editor.open', async (m, ctx) => {
    if (ctx.tabId === null) return fail('no-tab')
    const url = editorUrl(m.mode, ctx.tabId, m.themeId)
    if (windowId !== null) await chrome.windows.remove(windowId).catch(() => undefined)
    const w = await chrome.windows.create({ url, type: 'popup', width: 760, height: 720, focused: true })
    windowId = w?.id ?? null
    return ok({ opened: true })
  })
  chrome.windows.onRemoved?.addListener((id) => { if (id === windowId) windowId = null })
}
