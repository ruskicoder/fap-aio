// Signed data channel client (platform R5.2 to R5.6, R7.1; design, "Client flow"). The manifest and its
// signature come from the data/live branch with no cookies and no cache; the signature must verify with a key
// of the ring, the dataVersion must be new, the extension new enough and the format known. Only changed files
// are downloaded, each checked by SHA-256 and schema, and the new set is activated in one transaction. Any
// failure keeps the active data and records why.
import { KEYRING, type RingKey } from '../shared/keyring'
import { dataManifest, type DataFileName, type DataManifest, type SubjectListFile, type SubjectRulesFile } from '../shared/data/schemas'
import { read, update } from '../shared/storage/catalog'
import { buildIndex, checkFile, indexPackaged, openDataDb, readFiles, readPackagedManifest, writeIndex, type FileRecord, type PreparedData } from './data/db'
import { ok, register } from './router'
import { broadcast } from './tabs'

export const CHANNEL_BASE = 'https://raw.githubusercontent.com/ruskicoder/fap-aio/refs/heads/data/live/'
export const ALARM = 'data-check'
export const WEEK_MIN = 7 * 24 * 60

export interface ChannelStatus {
  /** Highest dataVersion accepted from the channel; never lowered (R5.8). */
  acceptedVersion: number
  lastCheck: number | null
  lastSkip: { reason: string; at: number } | null
  /** "Use packaged data" pauses the weekly check (R5.7; PLT-7.3). */
  forcePackaged: boolean
}

declare module '../shared/storage/catalog' {
  interface StoreMap { 'data.status': ChannelStatus }
}

export const EMPTY_STATUS: ChannelStatus = { acceptedVersion: 0, lastCheck: null, lastSkip: null, forcePackaged: false }
export async function channelStatus(): Promise<ChannelStatus> {
  return { ...EMPTY_STATUS, ...((await read('data.status')) ?? {}) }
}

export interface ChannelDeps {
  fetch?: typeof fetch
  ring?: readonly RingKey[]
  idb?: IDBFactory
  extensionVersion?: string
  now?: () => number
  notify?: (m: { state: 'syncing' | 'idle'; version: number | null; skipped?: string }) => Promise<void>
  /** After "Use packaged data", a manual check may restore the version already accepted (never a lower one). */
  allowEqual?: boolean
}

export type CheckResult = { kind: 'updated'; version: number } | { kind: 'current'; version: number } | { kind: 'skipped'; reason: string }

class Skip extends Error {}

/** Compares dotted numeric versions; true when `a` is at most `b`. */
export function versionAtMost(a: string, b: string): boolean {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d < 0
  }
  return true
}

const b64 = (s: string) => Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0))

async function get(f: typeof fetch, path: string): Promise<Uint8Array> {
  let res: Response
  try { res = await f(CHANNEL_BASE + path, { cache: 'no-store', credentials: 'omit' }) } catch { throw new Skip('the data channel could not be reached') }
  if (!res.ok) throw new Skip(`the data channel answered ${res.status} for ${path}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** Verifies the manifest bytes against the ring (R5.3). */
export async function verifyManifest(bytes: Uint8Array, sig: Uint8Array, ring: readonly RingKey[]): Promise<DataManifest> {
  let raw: unknown
  try { raw = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new Skip('the manifest is not valid JSON') }
  const parsed = dataManifest.safeParse(raw)
  if (!parsed.success) throw new Skip('the manifest format is not supported')
  const m = parsed.data
  const key = ring.find((k) => k.keyId === m.keyId)
  if (!key) throw new Skip(`the manifest is signed by a key this version does not know (${m.keyId ?? 'none'})`)
  const pub = await crypto.subtle.importKey('spki', b64(key.spki) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig as BufferSource, bytes as BufferSource)
  if (!ok) throw new Skip('the manifest signature does not verify')
  return m
}

let running: Promise<CheckResult> | null = null

/** One check of the channel; concurrent calls share the same run. */
export function checkChannel(deps: ChannelDeps = {}): Promise<CheckResult> {
  if (!running) running = runCheck(deps).finally(() => { running = null })
  return running
}

async function runCheck(deps: ChannelDeps): Promise<CheckResult> {
  const f = deps.fetch ?? fetch
  const ring = deps.ring ?? KEYRING
  const now = deps.now ?? Date.now
  const notify = deps.notify ?? ((m) => broadcast({ type: 'data.progress', ...m }))
  const extVersion = deps.extensionVersion ?? chrome.runtime.getManifest().version
  const status = await channelStatus()
  await notify({ state: 'syncing', version: null })
  const { db } = await openDataDb(deps.idb)
  try {
    const stored = await readFiles(db)
    const activeVersion = Math.max(0, ...stored.map((r) => r.dataVersion))
    const sigText = new TextDecoder().decode(await get(f, 'manifest.json.sig'))
    const bytes = await get(f, 'manifest.json')
    let sig: Uint8Array
    try { sig = b64(sigText) } catch { throw new Skip('the signature file is not base64') }
    const m = await verifyManifest(bytes, sig, ring)
    if (m.dataVersion < status.acceptedVersion || (m.dataVersion === status.acceptedVersion && !deps.allowEqual)) throw new Skip(`the channel offers version ${m.dataVersion}, not newer than ${status.acceptedVersion}`)
    if (m.minExtensionVersion && !versionAtMost(m.minExtensionVersion, extVersion)) throw new Skip(`the data needs FAP-AIO ${m.minExtensionVersion} or newer`)
    if (m.dataVersion <= activeVersion) {
      await update('data.status', (o) => ({ ...EMPTY_STATUS, ...(o ?? {}), acceptedVersion: m.dataVersion, lastCheck: now(), lastSkip: null }))
      await notify({ state: 'idle', version: activeVersion })
      return { kind: 'current', version: activeVersion }
    }
    // Changed files only (R5.4); every file, new or kept, is checked again before activation.
    const files: FileRecord[] = []
    const values = new Map<DataFileName, unknown>()
    for (const entry of m.files) {
      const have = stored.find((r) => r.name === entry.name && r.sha256 === entry.sha256)
      const fileBytes = have ? new TextEncoder().encode(have.body) : await get(f, entry.path)
      let checked: { text: string; value: unknown }
      try { checked = await checkFile(entry, fileBytes) } catch (e) { throw new Skip(e instanceof Error ? e.message : String(e)) }
      values.set(entry.name, checked.value)
      files.push({ name: entry.name, source: 'channel', dataVersion: m.dataVersion, sha256: entry.sha256, bytes: fileBytes.length, schema: entry.schema, body: checked.text })
    }
    const index = buildIndex(
      (values.get('subject-rules.json') as SubjectRulesFile | undefined) ?? null,
      (values.get('subject-list.json') as SubjectListFile | undefined) ?? null,
      'channel',
    )
    const prepared: PreparedData = { files, ...index }
    await writeIndex(db, prepared)
    await update('data.status', (o) => ({ ...EMPTY_STATUS, ...(o ?? {}), acceptedVersion: m.dataVersion, lastCheck: now(), lastSkip: null }))
    await notify({ state: 'idle', version: m.dataVersion })
    return { kind: 'updated', version: m.dataVersion }
  } catch (e) {
    if (!(e instanceof Skip)) throw e
    await update('data.status', (o) => ({ ...EMPTY_STATUS, ...(o ?? {}), lastCheck: now(), lastSkip: { reason: e.message, at: now() } }))
    await notify({ state: 'idle', version: null, skipped: e.message })
    return { kind: 'skipped', reason: e.message }
  } finally {
    db.close()
  }
}

/**
 * "Use packaged data" (R5.7): index the packaged files again and pause the weekly check; the accepted
 * version stays, so an older channel manifest is still refused later (R5.8).
 */
export async function usePackaged(deps: ChannelDeps & { getURL?: (p: string) => string } = {}): Promise<number> {
  await update('data.status', (o) => ({ ...EMPTY_STATUS, ...(o ?? {}), forcePackaged: true }))
  const { db } = await openDataDb(deps.idb)
  try {
    const manifest = await readPackagedManifest({ fetch: deps.fetch, getURL: deps.getURL })
    await indexPackaged(db, { fetch: deps.fetch, getURL: deps.getURL }, manifest)
    await (deps.notify ?? ((m) => broadcast({ type: 'data.progress', ...m })))({ state: 'idle', version: manifest.dataVersion })
    return manifest.dataVersion
  } finally {
    db.close()
  }
}

/** "Check for data updates" (R5.6, R5.7): ends a forced packaged state and checks the channel now. */
export async function checkNow(deps: ChannelDeps = {}): Promise<CheckResult> {
  const forced = (await channelStatus()).forcePackaged
  if (forced) await update('data.status', (o) => ({ ...EMPTY_STATUS, ...(o ?? {}), forcePackaged: false }))
  return checkChannel({ ...deps, allowEqual: forced })
}

/** 60 s after install or update, then weekly; paused while packaged data is forced (R5.2, R5.7). */
export function installDataChannel(): void {
  register('data.check', async () => ok(await checkNow()))
  register('data.usePackaged', async () => ok({ version: await usePackaged() }))
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.alarms.create(ALARM, { when: Date.now() + 60_000, periodInMinutes: WEEK_MIN })
  })
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name !== ALARM) return
    void channelStatus().then((s) => { if (!s.forcePackaged) void checkChannel().catch(() => undefined) })
  })
}
