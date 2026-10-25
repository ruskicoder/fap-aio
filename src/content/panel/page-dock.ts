// Narrows the FAP page while the panel is docked (panel-ux R1.5). A constructed stylesheet is
// adopted by the document (CSSOM, allowed by FAP's CSP); the width travels in a custom property.
// Jidox's fixed top bar and footer selectors are checked on live FAP in the M1 browser check.
export const DOCK_CLASS = 'fap-aio-docked'
const CSS = `html.${DOCK_CLASS} body{margin-right:var(--fap-aio-dock-w)!important}`
  + `html.${DOCK_CLASS} .navbar-custom,html.${DOCK_CLASS} .footer{right:var(--fap-aio-dock-w)!important}`

const sheets = new WeakMap<Document, CSSStyleSheet>()

export function setPageDock(width: number | null, doc: Document = document): void {
  const root = doc.documentElement
  if (width === null) {
    root.classList.remove(DOCK_CLASS)
    root.style.removeProperty('--fap-aio-dock-w')
    return
  }
  if (!sheets.has(doc)) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(CSS)
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]
    sheets.set(doc, sheet)
  }
  root.style.setProperty('--fap-aio-dock-w', `${width}px`)
  root.classList.add(DOCK_CLASS)
}
