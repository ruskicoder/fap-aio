// Panel host (core design, "Panel"): #fap-aio-root on document.body with an open shadow root,
// the compiled Tailwind CSS adopted as a constructable stylesheet (FAP's CSP blocks <style>),
// and a React root. Registers itself as the bootstrap's mount hook.
import { Fragment, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import css from './panel.css?inline'
import { PanelApp } from './PanelApp'
import { ViewStatusStrip } from './StatusStrip'
import { PanelRouter, isOverlay, routeKey, useRoute } from './router'
import { installKeys, refresherFor, registerAction } from './keys'
import { ShortcutsSheet, registerShortcutSettings } from './shortcuts'
import { toggleInbox } from './inbox/store'
import { ViewOutlet, registerView, routeOfView, tabViews } from './views'
import { Navigation } from './nav'
import { pageRoute } from './page-aware'
import { SettingsView } from './SettingsView'
import { registerGeneralSettings } from './settings/general'
import { registerClearData } from './settings/clear-data'
import { TodayView } from './today/TodayView'
import { Welcome, isFirstRun } from './welcome/Welcome'
import { viewportSize } from './geometry'
import { runSyncAll, useSyncAll } from './actions'
import { readPrefs } from '../../shared/panel-prefs'
import { loadPanelState } from './store'
import { onBoot } from '../modules'
import { installPanelTheme } from '../../features/appearance/panel-theme'
import { IconSprite } from './icons'
import { useBanners } from './banners'
import { Bell, InboxPopover, useUnread } from './inbox/Inbox'
import { getSetting } from '../../shared/settings'
import { subscribe } from '../../shared/storage/catalog'
import { onMessage } from '../../shared/call'
import type { PanelState, Route } from '../../shared/panel-state'

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
  registerClearData()
  // Today: composed from the modules' providers (panel-ux R3).
  const Today = () => createElement(TodayView, { router })
  registerView({ tab: 'today', label: 'Today', icon: 'home', component: async () => Today, lastSync: [{ label: 'Classes', key: 'timetable' }, { label: 'Exams', key: 'exams' }] })
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
  opener = (r) => {
    updater?.((s) => ({ ...s, collapsed: false }))
    router.go(r, { source: 'deeplink' })
  }
  // Keyboard actions (panel-ux R7.1), their Settings rows and the shortcuts sheet.
  registerPanelActions(router, (fn) => updater?.(fn))
  registerShortcutSettings()
  registerView({ overlay: 'shortcuts', label: 'Shortcuts', icon: 'info', component: async () => ShortcutsSheet })
  removeKeys?.()
  removeKeys = installKeys(doc.defaultView ?? window)
  return { host, shadow, root, router }
}

let removeKeys: (() => void) | null = null

/** The page actions of R7.1; each opens the panel when it is minimized. */
export function registerPanelActions(router: PanelRouter, update: (fn: (s: PanelState) => PanelState) => void): void {
  const open = () => update((s) => (s.collapsed ? { ...s, collapsed: false } : s))
  for (let n = 1; n <= 9; n++) {
    registerAction({
      id: `tab.${n}`, title: `Open tab ${n}`, default: { win: `Alt+${n}`, mac: `Ctrl+${n}` },
      run: () => { const t = tabViews()[n - 1]; if (t) { open(); router.go(routeOfView(t)) } },
    })
  }
  const step = (by: number) => {
    const tabs = tabViews()
    if (!tabs.length) return
    const i = tabs.findIndex((t) => routeKey(routeOfView(t)) === routeKey(router.current()))
    open()
    router.go(routeOfView(tabs[(i + by + tabs.length) % tabs.length]!))
  }
  registerAction({ id: 'view.next', title: 'Next view', default: { win: 'Alt+]', mac: 'Alt+]' }, run: () => step(1) })
  registerAction({ id: 'view.prev', title: 'Previous view', default: { win: 'Alt+[', mac: 'Alt+[' }, run: () => step(-1) })
  registerAction({ id: 'view.refresh', title: 'Refresh this view', default: { win: 'Alt+R', mac: 'Alt+R' }, run: () => { const fn = refresherFor(routeKey(router.current())); if (fn) fn(); else void runSyncAll() } })
  registerAction({ id: 'panel.dock', title: 'Dock or undock the panel', default: { win: 'Alt+D', mac: 'Alt+D' }, run: () => update((s) => ({ ...s, collapsed: false, mode: s.mode === 'docked' ? 'floating' : 'docked' })) })
  registerAction({ id: 'inbox', title: 'Open alerts', default: { win: 'Alt+N', mac: 'Alt+N' }, run: () => { open(); toggleInbox() } })
  registerAction({ id: 'sheet', title: 'Show shortcuts', default: { win: '?', mac: '?' }, run: () => { open(); router.go({ overlay: 'shortcuts' }) } })
}

let opener: ((r: Route) => void) | null = null
/** Opens the panel (if minimized) at a route: for links in inline page blocks (grades R3.3). */
export function openPanelAt(r: Route): void {
  opener?.(r)
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
  }, createElement(Banners), createElement(Navigation, { router }), createElement(ViewOutlet, { router })))
}

/** Module banners above the tabs (the legacy cleanup offer). */
function Banners() {
  const list = useBanners()
  return createElement(Fragment, null, ...list.map((B, i) => createElement(B, { key: i })))
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
