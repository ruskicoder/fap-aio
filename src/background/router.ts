// Service worker message router (platform R2.2, R2.3, R2.4): sender checks, schema validation,
// dispatch to registered handlers, exactly one Reply per request.
import { fail, ok, parseMsg, type MsgOf, type MsgType, type Reply } from '../shared/messages'
import { count } from './diag'

export const FAP_ORIGIN = 'https://fap.fpt.edu.vn'
const GRANT_PAGE = 'src/pages/grant/grant.html'
const PAGE_TYPES = new Set<MsgType>(['perm.result'])

export interface Ctx {
  from: 'content' | 'page'
  tabId: number | null
  url: string
}
type Handler<T extends MsgType> = (m: MsgOf<T>, ctx: Ctx) => Reply<unknown> | Promise<Reply<unknown>>

const handlers = new Map<MsgType, Handler<MsgType>>()

export function register<T extends MsgType>(type: T, h: Handler<T>): void {
  handlers.set(type, h as unknown as Handler<MsgType>)
}

/** Returns the sender context, or null when the sender may not talk to the service worker. */
export function checkSender(sender: chrome.runtime.MessageSender, type: MsgType): Ctx | null {
  if (sender.id !== chrome.runtime.id || !sender.url) return null
  let url: URL
  try {
    url = new URL(sender.url)
  } catch {
    return null
  }
  const extOrigin = new URL(chrome.runtime.getURL('/')).origin
  if (url.origin === extOrigin) {
    if (!PAGE_TYPES.has(type) || url.pathname !== `/${GRANT_PAGE}`) return null
    return { from: 'page', tabId: sender.tab?.id ?? null, url: sender.url }
  }
  if (url.origin !== FAP_ORIGIN || sender.frameId !== 0 || PAGE_TYPES.has(type)) return null
  return { from: 'content', tabId: sender.tab?.id ?? null, url: sender.url }
}

/** Handles one raw message. Resolves to undefined when the message is dropped. */
export async function handle(raw: unknown, sender: chrome.runtime.MessageSender): Promise<Reply<unknown> | undefined> {
  const m = parseMsg(raw)
  if (!m) {
    void count('msg.rejected.schema')
    return undefined
  }
  const ctx = checkSender(sender, m.type)
  if (!ctx) {
    void count('msg.rejected.sender')
    return undefined
  }
  const h = handlers.get(m.type)
  if (!h) return fail('unhandled', m.type)
  try {
    return await h(m, ctx)
  } catch (e) {
    void count(`handler.error.${m.type}`)
    return fail('error', e instanceof Error ? e.message : String(e))
  }
}

export function installRouter(): void {
  chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    void handle(raw, sender).then((r) => {
      if (r !== undefined) sendResponse(r)
      else sendResponse(undefined)
    })
    return true
  })
}

export { ok, fail }
