// Panel host (core design, "Panel"): #fap-aio-root on document.body with an open shadow root,
// the compiled Tailwind CSS adopted as a constructable stylesheet (FAP's CSP blocks <style>),
// and a React root. Registers itself as the bootstrap's mount hook.
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import css from './panel.css?inline'
import { PanelApp } from './PanelApp'
import { StatusStrip } from './StatusStrip'
import { PanelRouter } from './router'
import { ViewOutlet } from './views'
import { loadPanelState } from './store'
import { onBoot } from '../modules'
import { onMessage } from '../../shared/call'
import type { PanelState } from '../../shared/panel-state'

export const HOST_ID = 'fap-aio-root'

export interface MountedPanel {
  host: HTMLElement
  shadow: ShadowRoot
  root: Root
  router: PanelRouter
}

/** The router of the mounted panel, for modules that deep-link (Today, inbox, palette). */
export let panelRouter: PanelRouter | null = null

export async function mountPanel(doc: Document = document, cssText: string = css): Promise<MountedPanel> {
  doc.getElementById(HOST_ID)?.remove()
  const host = doc.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(cssText)
  shadow.adoptedStyleSheets = [sheet]
  const mountPoint = doc.createElement('div')
  mountPoint.style.setProperty('height', '100%')
  shadow.appendChild(mountPoint)
  doc.body.appendChild(host)
  const initial = await loadPanelState({ width: window.innerWidth, height: window.innerHeight })
  const root = createRoot(mountPoint)
  let updater: ((fn: (s: PanelState) => PanelState) => void) | null = null
  const router = new PanelRouter(initial.route)
  panelRouter = router
  // The route persists in panel.state.route (panel-ux R1.8).
  router.subscribe((route) => updater?.((s) => ({ ...s, route })))
  root.render(createElement(PanelApp, { initial, host, bind: (u) => { updater = u }, onMenu: (overlay) => router.go({ overlay }) },
    createElement(ViewOutlet, { router }), createElement(StatusStrip)))
  // Toolbar button and the toggle-panel command (panel-ux R7.1).
  onMessage('panel.toggle', () => updater?.((s) => ({ ...s, collapsed: !s.collapsed })))
  return { host, shadow, root, router }
}

export function registerPanelHost(): void {
  onBoot('mount', async () => {
    await mountPanel()
  })
}
