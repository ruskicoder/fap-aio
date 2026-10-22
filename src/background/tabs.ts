// Known FAP tabs and the most recently focused one (platform R3.8), the toolbar action and the
// global toggle command (panel-ux R7.1, R7.4). State lives in storage.session so it survives
// service worker restarts.
import { ok, register, FAP_ORIGIN } from './router'
import { PROTOCOL_VERSION, type Outgoing } from '../shared/messages'

const KEY = 'tabs.known'
interface TabsState { ready: Record<string, number>; focused: number | null }

async function load(): Promise<TabsState> {
  const got = (await chrome.storage.session.get(KEY))[KEY] as TabsState | undefined
  return got ?? { ready: {}, focused: null }
}
let chain: Promise<unknown> = Promise.resolve()
function update(fn: (s: TabsState) => void): Promise<TabsState> {
  const p = chain.then(async () => {
    const s = await load()
    fn(s)
    await chrome.storage.session.set({ [KEY]: s })
    return s
  })
  chain = p.catch(() => {})
  return p
}

export async function knownTabs(): Promise<number[]> {
  await chain
  return Object.keys((await load()).ready).map(Number)
}

/** The tab that timer work should run in: the focused one, else the latest `tab-ready` sender. */
export async function targetTab(): Promise<number | null> {
  await chain
  const s = await load()
  if (s.focused !== null && String(s.focused) in s.ready) return s.focused
  const latest = Object.entries(s.ready).sort((a, b) => b[1] - a[1])[0]
  return latest ? Number(latest[0]) : null
}

export function sendToTab(tabId: number, m: Outgoing): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, { v: PROTOCOL_VERSION, ...m }).catch(() => undefined)
}

export async function broadcast(m: Outgoing): Promise<void> {
  await Promise.all((await knownTabs()).map((id) => sendToTab(id, m)))
}

type ReadyHook = (tabId: number) => void | Promise<void>
const readyHooks: ReadyHook[] = []
export const onTabReady = (h: ReadyHook) => void readyHooks.push(h)

const isFap = (url?: string) => !!url && url.startsWith(`${FAP_ORIGIN}/`)

async function toggleIn(tab?: chrome.tabs.Tab): Promise<void> {
  if (tab?.id !== undefined && isFap(tab.url)) await sendToTab(tab.id, { type: 'panel.toggle' })
  else await chrome.tabs.create({ url: `${FAP_ORIGIN}/` })
}

export function installTabs(): void {
  register('tab-ready', async (_m, ctx) => {
    if (ctx.tabId === null) return ok(null)
    const id = ctx.tabId
    await update((s) => { s.ready[String(id)] = Date.now() })
    for (const h of readyHooks) await h(id)
    return ok(null)
  })
  register('tab-focus', async (_m, ctx) => {
    if (ctx.tabId !== null) {
      const id = ctx.tabId
      await update((s) => { s.focused = id; s.ready[String(id)] ??= Date.now() })
    }
    return ok(null)
  })
  register('commands.list', async () => ok(await chrome.commands.getAll()))

  chrome.tabs.onRemoved.addListener((tabId: number) => {
    void update((s) => {
      delete s.ready[String(tabId)]
      if (s.focused === tabId) s.focused = null
    })
  })
  chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => void toggleIn(tab))
  chrome.commands.onCommand.addListener((name: string, tab?: chrome.tabs.Tab) => {
    if (name !== 'toggle-panel') return
    void (async () => toggleIn(tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]))()
  })
}
