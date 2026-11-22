// The printable grade list (grades R15.1, GRD-7.3): an extension page opened by the service worker in a
// popup window, like the theme editor (F-21). The page reads the stored record itself; no message flows
// back, no resource is web accessible and no `downloads` permission is needed. One window at a time.
import { ok, register } from './router'

export const PRINT_PAGE = 'src/pages/print/print.html'
let windowId: number | null = null

export function printUrl(components: boolean, attendance: boolean): string {
  const q = new URLSearchParams({ components: components ? '1' : '0', attendance: attendance ? '1' : '0' })
  return chrome.runtime.getURL(`${PRINT_PAGE}?${q}`)
}

export function installPrintWindow(): void {
  register('print.open', async (m) => {
    if (windowId !== null) await chrome.windows.remove(windowId).catch(() => undefined)
    const w = await chrome.windows.create({ url: printUrl(m.components, m.attendance), type: 'popup', width: 900, height: 900, focused: true })
    windowId = w?.id ?? null
    return ok({ opened: true })
  })
  chrome.windows.onRemoved?.addListener((id) => { if (id === windowId) windowId = null })
}
