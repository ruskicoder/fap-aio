// PLT-7.2: the signed data channel client (platform R5.2 to R5.6, R7.1).
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { CHANNEL_BASE, channelStatus, checkChannel, versionAtMost } from '../src/background/data-channel'
import { ensureData, readFiles, openDataDb } from '../src/background/data/db'
import { read } from '../src/shared/storage/catalog'
import { deriveKey, newSecret, signBytes } from '../tools/data-sign/lib.mjs'

const root = resolve(__dirname, '..')
const readData = (p: string) => readFileSync(resolve(root, 'data', p))
const PACKAGED = JSON.parse(readData('manifest.json').toString('utf8')) as { dataVersion: number; files: { name: string; path: string; schema: string; sha256: string; bytes: number }[] }
const SECRET = Buffer.alloc(32, 7)
const key = deriveKey(SECRET)
const ring = [{ keyId: key.keyId, spki: key.spki, label: 'primary' as const }]
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

// A news rules file that differs in bytes only (one more trailing newline), so it is a valid changed file.
const NEWS2 = Buffer.concat([readData('news/news-rules.json'), Buffer.from('\n')])

interface Channel { files: Record<string, Uint8Array>; manifest: Record<string, unknown>; sig?: string; status?: number }
function channel(over: { version?: number; minExt?: string; keyId?: string; news?: Uint8Array; tamper?: boolean; signer?: Buffer } = {}): Channel {
  const files: Record<string, Uint8Array> = {}
  for (const f of PACKAGED.files) files[f.path] = f.name === 'news-rules.json' ? (over.news ?? NEWS2) : readData(f.path)
  const manifest = {
    format: 1, dataVersion: over.version ?? PACKAGED.dataVersion + 1, publishedAt: '2026-11-17T05:00:00.000Z',
    minExtensionVersion: over.minExt ?? '2.0.0', keyId: over.keyId ?? key.keyId,
    files: PACKAGED.files.map((f) => ({ ...f, sha256: sha(files[f.path]!), bytes: files[f.path]!.length })),
  }
  if (over.tamper) files['news/news-rules.json'] = Buffer.from('{"tampered": true}')
  return { files, manifest }
}

let c: FakeChrome
let idb: IDBFactory
let requests: { url: string; init?: RequestInit }[]
let progress: { state: string; version: number | null; skipped?: string }[]

function server(ch: Channel, signer: Uint8Array = SECRET): typeof fetch {
  const bytes = Buffer.from(`${JSON.stringify(ch.manifest, null, 2)}\n`)
  const sig = ch.sig ?? signBytes(deriveKey(signer).privateKey, bytes)
  return (async (url: string, init?: RequestInit) => {
    requests.push({ url, init })
    if (ch.status) return new Response('', { status: ch.status })
    const path = url.slice(CHANNEL_BASE.length)
    const body = path === 'manifest.json' ? bytes : path === 'manifest.json.sig' ? Buffer.from(sig) : ch.files[path]
    return body ? new Response(body as unknown as BodyInit) : new Response('', { status: 404 })
  }) as unknown as typeof fetch
}

const run = (ch: Channel, extra: { signer?: Uint8Array; extensionVersion?: string } = {}) =>
  checkChannel({ fetch: server(ch, extra.signer), ring, idb, extensionVersion: extra.extensionVersion ?? '2.0.0', now: () => 1_000, notify: async (m) => { progress.push(m) } })

beforeEach(async () => {
  c = installFakeChrome()
  idb = new IDBFactory()
  requests = []
  progress = []
  await ensureData('start', {
    idb, getURL: (p) => `chrome-extension://t/${p}`,
    fetch: (async (u: string) => new Response(readData(u.replace('chrome-extension://t/data/', '')) as unknown as BodyInit)) as unknown as typeof fetch,
  })
})

const activeFiles = async () => { const { db } = await openDataDb(idb); const f = await readFiles(db); db.close(); return f }

describe('data channel', () => {
  it('activates a valid update, downloading only the changed file, without cookies or cache', async () => {
    const r = await run(channel())
    expect(r).toEqual({ kind: 'updated', version: PACKAGED.dataVersion + 1 })
    expect(requests.map((q) => q.url.slice(CHANNEL_BASE.length))).toEqual(['manifest.json.sig', 'manifest.json', 'news/news-rules.json'])
    expect(requests.every((q) => q.init?.cache === 'no-store' && q.init?.credentials === 'omit' && !q.url.includes('?'))).toBe(true)
    expect(CHANNEL_BASE).toBe('https://raw.githubusercontent.com/ruskicoder/fap-aio/refs/heads/data/live/')
    const files = await activeFiles()
    expect(files.every((f) => f.source === 'channel' && f.dataVersion === PACKAGED.dataVersion + 1)).toBe(true)
    expect(files.find((f) => f.name === 'news-rules.json')!.sha256).toBe(sha(NEWS2))
    expect(await channelStatus()).toEqual({ acceptedVersion: PACKAGED.dataVersion + 1, lastCheck: 1_000, lastSkip: null, forcePackaged: false })
    expect(progress).toEqual([{ state: 'syncing', version: null }, { state: 'idle', version: PACKAGED.dataVersion + 1 }])
  })

  it('refuses an unknown key or a bad signature, keeping the active data', async () => {
    const before = await activeFiles()
    expect(await run(channel(), { signer: Buffer.alloc(32, 9) })).toEqual({ kind: 'skipped', reason: 'the manifest signature does not verify' })
    expect(await run(channel({ keyId: 'ffffffffffffffff' }))).toEqual({ kind: 'skipped', reason: expect.stringContaining('key this version does not know') })
    expect(await activeFiles()).toEqual(before)
    expect((await read('data.status'))!.lastSkip).toEqual({ reason: expect.stringContaining('does not know'), at: 1_000 })
    expect(progress.at(-1)).toEqual({ state: 'idle', version: null, skipped: expect.stringContaining('does not know') })
  })

  it('refuses a tampered file, a version that is not newer, and data for a newer extension', async () => {
    const before = await activeFiles()
    expect(await run(channel({ tamper: true }))).toEqual({ kind: 'skipped', reason: 'news-rules.json: SHA-256 mismatch' })
    expect(await run(channel({ minExt: '2.1.0' }))).toEqual({ kind: 'skipped', reason: 'the data needs FAP-AIO 2.1.0 or newer' })
    expect(await activeFiles()).toEqual(before)
    expect((await run(channel({ version: 5 }))).kind).toBe('updated')
    expect(await run(channel({ version: 4 }))).toEqual({ kind: 'skipped', reason: 'the channel offers version 4, not newer than 5' })
    expect(await run(channel({ version: 5 }))).toEqual({ kind: 'skipped', reason: 'the channel offers version 5, not newer than 5' })
  })

  it('keeps the packaged data when the channel is not newer than it, and reports an unreachable channel', async () => {
    expect(await run(channel({ version: PACKAGED.dataVersion }))).toEqual({ kind: 'current', version: PACKAGED.dataVersion })
    expect((await activeFiles()).every((f) => f.source === 'packaged')).toBe(true)
    expect(await run({ ...channel(), status: 503 })).toEqual({ kind: 'skipped', reason: 'the data channel answered 503 for manifest.json.sig' })
    expect(await run({ ...channel(), sig: 'not base64 !!' })).toEqual({ kind: 'skipped', reason: expect.stringMatching(/base64|signature/) })
  })

  it('compares extension versions numerically', () => {
    expect(versionAtMost('2.0.0', '2.0.0')).toBe(true)
    expect(versionAtMost('2.0.10', '2.0.9')).toBe(false)
    expect(versionAtMost('2.0', '2.0.1')).toBe(true)
    expect(newSecret()).toHaveLength(32)
  })

  it('schedules the check 60 s after install, then weekly', async () => {
    const { installDataChannel, ALARM } = await import('../src/background/data-channel')
    installDataChannel()
    const t0 = Date.now()
    ;(c.runtime as unknown as { onInstalled: { emit: (d: unknown) => void } }).onInstalled.emit({ reason: 'install' })
    await new Promise((r) => setTimeout(r, 0))
    const a = await c.alarms.get(ALARM)
    expect(a?.periodInMinutes).toBe(7 * 24 * 60)
    expect(a!.scheduledTime - t0).toBeGreaterThanOrEqual(59_000)
    expect(a!.scheduledTime - t0).toBeLessThanOrEqual(61_000)
  })
})

describe('check now and packaged data (PLT-7.3)', () => {
  const packagedFetch = (async (u: string) => new Response(readData(u.replace(/^chrome-extension:\/\/[^/]+\/data\//, '')) as unknown as BodyInit)) as unknown as typeof fetch
  const getURL = (p: string) => `chrome-extension://t/${p}`

  it('uses packaged data on request, pauses the weekly check, and Check now restores the accepted version', async () => {
    const { checkNow, usePackaged, installDataChannel, ALARM } = await import('../src/background/data-channel')
    expect((await run(channel())).kind).toBe('updated')
    const v = PACKAGED.dataVersion + 1
    expect(await usePackaged({ idb, fetch: packagedFetch, getURL, notify: async (m) => { progress.push(m) } })).toBe(PACKAGED.dataVersion)
    expect((await activeFiles()).every((f) => f.source === 'packaged')).toBe(true)
    expect(await channelStatus()).toMatchObject({ acceptedVersion: v, forcePackaged: true })
    // The weekly alarm does nothing while packaged data is forced.
    installDataChannel()
    requests.length = 0
    c.alarms.onAlarm.emit({ name: ALARM, scheduledTime: 0 })
    await new Promise((r) => setTimeout(r, 20))
    expect(requests).toEqual([])
    // Check now ends the forced state and may restore the same signed version, never a lower one.
    const r = await checkNow({ fetch: server(channel()), ring, idb, extensionVersion: '2.0.0', now: () => 2_000, notify: async () => {} })
    expect(r).toEqual({ kind: 'updated', version: v })
    expect((await activeFiles()).every((f) => f.source === 'channel')).toBe(true)
    expect(await channelStatus()).toMatchObject({ acceptedVersion: v, forcePackaged: false })
    expect(await checkNow({ fetch: server(channel()), ring, idb, extensionVersion: '2.0.0', notify: async () => {} })).toEqual({ kind: 'skipped', reason: `the channel offers version ${v}, not newer than ${v}` })
  })

  it('accepts a rollback republished under a higher version', async () => {
    expect((await run(channel({ version: 2 }))).kind).toBe('updated')
    const r = await run(channel({ version: 3, news: readData('news/news-rules.json') }))
    expect(r).toEqual({ kind: 'updated', version: 3 })
    expect((await activeFiles()).find((f) => f.name === 'news-rules.json')!.sha256).toBe(PACKAGED.files.find((f) => f.name === 'news-rules.json')!.sha256)
  })

  it('answers data.check and data.usePackaged', async () => {
    const { installDataChannel } = await import('../src/background/data-channel')
    const { handle } = await import('../src/background/router')
    installDataChannel()
    const sender = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 1 } as chrome.tabs.Tab }
    const g = globalThis as unknown as { fetch: typeof fetch; indexedDB?: IDBFactory }
    const real = { fetch: g.fetch, idb: g.indexedDB }
    g.indexedDB = idb
    g.fetch = (async (u: string) => (u.startsWith('chrome-extension://') ? packagedFetch(u) : new Response('', { status: 503 }))) as unknown as typeof fetch
    try {
      expect(await handle({ v: 1, type: 'data.check' }, sender)).toEqual({ ok: true, value: { kind: 'skipped', reason: 'the data channel answered 503 for manifest.json.sig' } })
      expect(await handle({ v: 1, type: 'data.usePackaged' }, sender)).toEqual({ ok: true, value: { version: PACKAGED.dataVersion } })
      expect((await channelStatus()).forcePackaged).toBe(true)
    } finally { g.fetch = real.fetch; g.indexedDB = real.idb }
  })
})
