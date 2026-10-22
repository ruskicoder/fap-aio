// Content-script and page client for the message contract (platform R2.4, R2.5).
import { PROTOCOL_VERSION, parseMsg, timeoutFor, type MsgOf, type MsgType, type Outgoing, type Reply } from './messages'

export async function call<T = unknown>(m: Outgoing, timeoutMs?: number): Promise<Reply<T>> {
  const full = { v: PROTOCOL_VERSION, ...m }
  const limit = timeoutMs ?? timeoutFor(m.type)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Reply<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: { kind: 'timeout' } }), limit)
  })
  const send = (async (): Promise<Reply<T>> => {
    try {
      const r = (await chrome.runtime.sendMessage(full)) as Reply<T> | undefined
      if (r === undefined || r === null || typeof r !== 'object' || !('ok' in r)) return { ok: false, error: { kind: 'timeout' } }
      return r
    } catch (e) {
      return { ok: false, error: { kind: 'unreachable', detail: e instanceof Error ? e.message : String(e) } }
    }
  })()
  try {
    return await Promise.race([send, timeout])
  } finally {
    clearTimeout(timer)
  }
}

type Handler<T extends MsgType> = (m: MsgOf<T>) => unknown

/**
 * Subscribes to service-worker-to-tab messages of one type. Only messages from this extension
 * that pass the schema reach the handler. A handler's return value (or promise) is the reply.
 */
export function onMessage<T extends MsgType>(type: T, handler: Handler<T>): () => void {
  const listener = (raw: unknown, sender: chrome.runtime.MessageSender, sendResponse: (r: unknown) => void) => {
    if (sender.id !== chrome.runtime.id) return false
    const m = parseMsg(raw)
    if (!m || m.type !== type) return false
    const out = handler(m as MsgOf<T>)
    if (out instanceof Promise) {
      out.then((value) => sendResponse({ ok: true, value }), (e) => sendResponse({ ok: false, error: { kind: 'error', detail: String(e) } }))
      return true
    }
    sendResponse({ ok: true, value: out ?? null })
    return false
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}
