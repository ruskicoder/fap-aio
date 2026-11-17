// Panel host (core design, "Panel"): #fap-aio-root on document.body with an open shadow root,
// the compiled Tailwind CSS adopted as a constructable stylesheet (FAP's CSP blocks <style>),
// and a React root. Registers itself as the bootstrap's mount hook.
import { Fragment, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import css from './panel.css?inline'
import { PanelApp } from './PanelApp'
import { ViewStatusStrip } from './StatusStrip'
import { PanelRouter, isOverlay, useRoute } from './router'
import { ViewOutlet, registerView } from './views'
import { Navigation } from './nav'
import { pageRoute } from './page-aware'
import { SettingsView } from './SettingsView'
import { registerGeneralSettings } from './settings/general'
import { TodayView } from './today/TodayView'
import { Welcome, isFirstRun } from './welcome/Welcome'
import { viewportSize } from './geometry'
import { runSyncAll, useSyncAll } from './actions'
import { readPrefs } from '../../shared/panel-prefs'
import { loadPanelState } from './store'
import { onBoot } from '../modules'
import { installPanelTheme } from '../../features/appearance/panel-theme'
import { IconSprite } from './icons'
import { Bell, InboxPopover, useUnread } from './inbox/Inbox'
import { getSetting } from '../../shared/settings'
import { subscribe } from '../../shared/storage/catalog'
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
  // Theme mode and roles for the panel (appearance R1.7); empty under FAP default.
  installPanelTheme(shadow, doc.defaultView ?? window)
  installDensity(host)
  const mountPoint = doc.createElement('div')
  mountPoint.style.setProperty('height', '100%')
  shadow.appendChild(mountPoint)
  doc.body.appendChild(host)
  const vp = viewportSize(doc)
  const loaded = await loadPanelState({ width: vp.w, height: vp.h })
  // First run on an authenticated page: open docked to show the welcome (panel-ux R9.1).
  const initial = (await isFirstRun()) ? { ...loaded, mode: 'docked' as const, collapsed: false } : loaded
  const root = createRoot(mountPoint)
  let updater: ((fn: (s: PanelState) => PanelState) => void) | null = null
  const router = new PanelRouter(initial.route)
  panelRouter = router
  // The route persists in panel.state.route (panel-ux R1.8).
  router.subscribe((route) => updater?.((s) => ({ ...s, route })))
  // Page-aware tab, once per page load (panel-ux R4.1, R4.2).
  if ((await readPrefs()).pageAware) router.go(pageRoute(doc.location?.pathname ?? '/', doc), { source: 'page' })
  registerGeneralSettings()
  // Today: composed from the modules' providers (panel-ux R3).
  const Today = () => createElement(TodayView, { router })
  registerView({ tab: 'today', label: 'Today', icon: 'home', component: async () => Today })
  // The route's section (deep links such as the non-GPA setting) scrolls Settings to it.
  const SettingsOverlay = () => {
    const r = useRoute(router)
    return createElement(SettingsView, { section: isOverlay(r) && 'section' in r ? r.section : undefined })
  }
  registerView({ overlay: 'settings', label: 'Settings', icon: 'settings', component: async () => SettingsOverlay })
  const version = chrome.runtime.getManifest?.().version ?? ''
  root.render(createElement(Shell, { initial: { ...initial, route: router.current() }, host, version, router, bind: (u: Updater) => { updater = u } }))
  // Toolbar button and the toggle-panel command (panel-ux R7.1).
  onMessage('panel.toggle', () => updater?.((s) => ({ ...s, collapsed: !s.collapsed })))
  return { host, shadow, root, router }
}

type Updater = (fn: (s: PanelState) => PanelState) => void

/** The agreed shell (ui/shell.html): header Sync and Settings, tabs, view outlet, status strip. */
function Shell({ initial, host, version, router, bind }: { initial: PanelState; host: HTMLElement; version: string; router: PanelRouter; bind: (u: Updater) => void }) {
  const sync = useSyncAll()
  const unread = useUnread()
  return createElement(Fragment, null, createElement(IconSprite), createElement(PanelApp, {
    initial, host, version, bind, syncing: sync.running,
    headerActions: createElement(Bell), overlay: createElement(Fragment, null, createElement(InboxPopover, { router }), createElement(Welcome)), tabBadge: unread,
    onSync: () => void runSyncAll(),
    onSettings: () => router.go({ overlay: 'settings' }),
    status: createElement(ViewStatusStrip, { router }),
  }, createElement(Navigation, { router }), createElement(ViewOutlet, { router })))
}

export type Density = 'comfortable' | 'compact'

/** Keeps `data-density` on the host in step with the `general.density` setting (panel-ux R10.1). */
export function installDensity(host: HTMLElement): () => void {
  const apply = (v: unknown) => host.setAttribute('data-density', v === 'compact' ? 'compact' : 'comfortable')
  apply('comfortable')
  void getSetting<Density>('general.density', 'comfortable').then(apply)
  return subscribe('settings', (all) => apply(all?.['general.density']))
}

export function registerPanelHost(): void {
  onBoot('mount', async () => {
    await mountPanel()
  })
}
