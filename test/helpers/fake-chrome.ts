// Minimal in-memory chrome.* fake for unit tests. Install with installFakeChrome().
/* eslint-disable @typescript-eslint/no-explicit-any */
type Listener = (...args: any[]) => any

export class FakeEvent<L extends Listener = Listener> {
  listeners: L[] = []
  addListener(l: L) { this.listeners.push(l) }
  removeListener(l: L) { this.listeners = this.listeners.filter((x) => x !== l) }
  hasListener(l: L) { return this.listeners.includes(l) }
  emit(...args: Parameters<L>) { return this.listeners.map((l) => l(...args)) }
}

function area(onChanged: FakeEvent, name: string) {
  let data: Record<string, unknown> = {}
  const clone = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)))
  return {
    get data() { return data },
    async get(keys?: string | string[] | null) {
      if (keys == null) return clone(data)
      const list = Array.isArray(keys) ? keys : [keys]
      const out: Record<string, unknown> = {}
      for (const k of list) if (k in data) out[k] = clone(data[k])
      return out
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {}
      for (const [k, val] of Object.entries(items)) {
        changes[k] = { oldValue: clone(data[k]), newValue: clone(val) }
        data[k] = clone(val)
      }
      onChanged.emit(changes, name)
    },
    async remove(keys: string | string[]) {
      const changes: Record<string, { oldValue?: unknown }> = {}
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (k in data) { changes[k] = { oldValue: data[k] }; delete data[k] }
      }
      if (Object.keys(changes).length) onChanged.emit(changes, name)
    },
    async clear() { const keys = Object.keys(data); await this.remove(keys); data = {} },
    async getBytesInUse(keys?: string | string[] | null) {
      const obj = await this.get(keys ?? null)
      return Object.entries(obj).reduce((n, [k, v]) => n + k.length + JSON.stringify(v).length, 0)
    },
  }
}

export function makeFakeChrome() {
  const onChanged = new FakeEvent()
  const onMessage = new FakeEvent()
  const alarms = new Map<string, { name: string; scheduledTime: number; periodInMinutes?: number }>()
  const granted = new Set<string>()
  const tabMessages: { tabId: number; msg: unknown }[] = []
  const notifications: { id: string; opts: unknown }[] = []
  const tabsMap = new Map<number, { id: number; url: string; active?: boolean; windowId?: number }>()
  const created: { id: number; url: string }[] = []
  const defaultSender: Partial<chrome.runtime.MessageSender> = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 1 } as chrome.tabs.Tab }
  const fake = {
    runtime: {
      id: 'test-extension-id',
      lastError: undefined as undefined | { message: string },
      onMessage,
      onInstalled: new FakeEvent(),
      onStartup: new FakeEvent(),
      getManifest: () => ({ version: '2.0.0', manifest_version: 3 }),
      getURL: (p: string) => `chrome-extension://test-extension-id/${p.replace(/^\//, '')}`,
      /** Delivers to onMessage listeners as if sent by `sender` (default: a FAP top-frame tab). */
      async sendMessage(msg: unknown, sender: Partial<chrome.runtime.MessageSender> = defaultSender): Promise<unknown> {
        return new Promise((resolve) => {
          let responded = false
          const respond = (r: unknown) => { if (!responded) { responded = true; resolve(r) } }
          const results = onMessage.emit(msg, sender, respond)
          if (!results.some((r) => r === true) && !responded) resolve(undefined)
        })
      },
    },
    storage: {
      onChanged,
      local: area(onChanged, 'local'),
      session: area(onChanged, 'session'),
    },
    alarms: {
      onAlarm: new FakeEvent(),
      _map: alarms,
      async create(name: string, info: { when?: number; delayInMinutes?: number; periodInMinutes?: number }) {
        const when = info.when ?? Date.now() + (info.delayInMinutes ?? info.periodInMinutes ?? 0) * 60_000
        alarms.set(name, { name, scheduledTime: when, periodInMinutes: info.periodInMinutes })
      },
      async clear(name: string) { return alarms.delete(name) },
      async clearAll() { alarms.clear(); return true },
      async get(name: string) { return alarms.get(name) },
      async getAll() { return [...alarms.values()] },
    },
    tabs: {
      _sent: tabMessages,
      _tabs: tabsMap,
      async sendMessage(tabId: number, msg: unknown) { tabMessages.push({ tabId, msg }); return { ok: true, value: null } },
      async query(q: { url?: string | string[]; active?: boolean }) {
        return [...tabsMap.values()].filter((t) => (q.active === undefined || t.active === q.active) && (!q.url || t.url.startsWith('https://fap.fpt.edu.vn/')))
      },
      async get(id: number) { const t = tabsMap.get(id); if (!t) throw new Error('No tab'); return t },
      async create(opts: { url: string }) { const id = 1000 + tabsMap.size; const t = { id, url: opts.url, active: true }; tabsMap.set(id, t); return t },
      async update(id: number, props: { active?: boolean; url?: string }) { const t = tabsMap.get(id); if (t) Object.assign(t, props); return t },
      onRemoved: new FakeEvent(),
    },
    windows: {
      _created: created,
      async create(opts: { url: string }) { const w = { id: 500 + created.length, url: opts.url }; created.push(w); return w },
      async update() { return {} },
      async remove() {},
      onRemoved: new FakeEvent(),
    },
    permissions: {
      _granted: granted,
      async contains(p: { permissions?: string[]; origins?: string[] }) { return [...(p.permissions ?? []), ...(p.origins ?? [])].every((x) => granted.has(x)) },
      async request(p: { permissions?: string[]; origins?: string[] }) { for (const x of [...(p.permissions ?? []), ...(p.origins ?? [])]) granted.add(x); return true },
      async getAll() { return { permissions: [...granted].filter((x) => !x.includes('://')), origins: [...granted].filter((x) => x.includes('://')) } },
      onRemoved: new FakeEvent(),
      onAdded: new FakeEvent(),
    },
    notifications: {
      _shown: notifications,
      async create(id: string, opts: unknown) { notifications.push({ id, opts }); return id },
      async clear() { return true },
      onClicked: new FakeEvent(),
    },
    commands: {
      async getAll() { return [{ name: 'toggle-panel', description: 'Show or hide the FAP-AIO panel', shortcut: 'Alt+Shift+F' }] },
      onCommand: new FakeEvent(),
    },
    action: { onClicked: new FakeEvent() },
    _defaultSender: defaultSender,
  }
  return fake
}

export type FakeChrome = ReturnType<typeof makeFakeChrome>

export function installFakeChrome(): FakeChrome {
  const c = makeFakeChrome()
  ;(globalThis as unknown as { chrome: unknown }).chrome = c
  return c
}
