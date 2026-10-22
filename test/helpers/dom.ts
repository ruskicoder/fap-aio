import { DOMParser as LinkedomParser } from 'linkedom'

/** Gives Node tests a DOMParser like the browser's. */
export function installDomParser(): void {
  Object.defineProperty(globalThis, 'DOMParser', { value: LinkedomParser, configurable: true, writable: true })
}

export function res(body: string, init: { status?: number; headers?: Record<string, string>; url?: string; redirected?: boolean } = {}): Response {
  const r = new Response(init.status === 204 ? null : body, { status: init.status ?? 200, headers: init.headers })
  Object.defineProperty(r, 'url', { value: init.url ?? 'https://fap.fpt.edu.vn/x' })
  Object.defineProperty(r, 'redirected', { value: init.redirected ?? false })
  return r
}
