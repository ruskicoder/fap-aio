// PLT-7.1: the offline signing tool (platform R5.8, R5.9, R9.4; design, "Keys and signing").
import { describe, expect, it } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { webcrypto } from 'node:crypto'
import { buildSigned, decodePhrase, deriveKey, encodePhrase, newSecret, readRing, signBytes, verifyBytes, verifyDir } from '../tools/data-sign/lib.mjs'

const SECRET = Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex')

describe('recovery phrases and keys', () => {
  it('round-trip a phrase, tolerate case and lookalikes, and catch typos', () => {
    const p = encodePhrase(SECRET)
    expect(p.replace(/-/g, '')).toHaveLength(53)
    expect(decodePhrase(p)).toEqual(SECRET)
    expect(decodePhrase(p.toLowerCase().replace(/-/g, ' '))).toEqual(SECRET)
    const typo = p.replace(/^(.)/, (c: string) => (c === '0' ? '1' : '0'))
    expect(() => decodePhrase(typo)).toThrow(/typo/)
    expect(() => decodePhrase('short')).toThrow(/53 symbols/)
    const r = newSecret()
    expect(decodePhrase(encodePhrase(r))).toEqual(r)
  })

  it('derive the same keyId from the same phrase twice, and a different one from another', () => {
    const a = deriveKey(decodePhrase(encodePhrase(SECRET)))
    const b = deriveKey(SECRET)
    expect(a.keyId).toBe(b.keyId)
    expect(a.spki).toBe(b.spki)
    expect(a.keyId).toMatch(/^[0-9a-f]{16}$/)
    expect(deriveKey(newSecret()).keyId).not.toBe(a.keyId)
  })

  it('sign so that WebCrypto in Node verifies it, and not a changed byte', async () => {
    const k = deriveKey(SECRET)
    const bytes = Buffer.from('{"dataVersion":2}\n')
    const sig = signBytes(k.privateKey, bytes)
    expect(Buffer.from(sig, 'base64')).toHaveLength(64)
    expect(await verifyBytes(k.spki, bytes, sig)).toBe(true)
    const key = await webcrypto.subtle.importKey('spki', Buffer.from(k.spki, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(sig, 'base64'), Buffer.from('{"dataVersion":3}\n'))).toBe(false)
  })
})

describe('publish and verify', () => {
  const k = deriveKey(SECRET)
  const ring = [{ keyId: k.keyId, spki: k.spki, label: 'primary' as const }]

  function dataDir() {
    const dir = mkdtempSync(join(tmpdir(), 'fap-aio-sign-'))
    cpSync('data/flm', join(dir, 'flm'), { recursive: true })
    cpSync('data/news', join(dir, 'news'), { recursive: true })
    return dir
  }

  it('signs the next dataVersion above the live and packaged versions, with every file hashed', async () => {
    const dir = dataDir()
    try {
      const r = await buildSigned({ dir, secret: SECRET, ring, currentVersion: 4, packagedVersion: 1, minExtensionVersion: '2.0.0', now: new Date('2026-11-17T05:00:00Z') })
      expect(r.manifest).toMatchObject({ format: 1, dataVersion: 5, publishedAt: '2026-11-17T05:00:00.000Z', minExtensionVersion: '2.0.0', keyId: k.keyId })
      const packaged = JSON.parse(readFileSync('data/manifest.json', 'utf8')) as { files: { path: string; sha256: string; bytes: number }[] }
      expect(r.manifest.files.map((f) => [f.path, f.sha256, f.bytes])).toEqual(packaged.files.map((f) => [f.path, f.sha256, f.bytes]))
      writeFileSync(join(dir, 'manifest.json'), r.bytes)
      writeFileSync(join(dir, 'manifest.json.sig'), `${r.sig}\n`)
      expect(await verifyDir(dir, ring)).toEqual([])
      writeFileSync(join(dir, 'news/news-rules.json'), '{"tampered":true}')
      expect(await verifyDir(dir, ring)).toEqual(['news/news-rules.json does not match its sha256'])
      writeFileSync(join(dir, 'manifest.json'), r.bytes.toString().replace('"dataVersion": 5', '"dataVersion": 9'))
      expect(await verifyDir(dir, ring)).toContain('the signature does not verify')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('refuses a key that is not in the ring, and missing or broken files', async () => {
    const dir = dataDir()
    try {
      await expect(buildSigned({ dir, secret: newSecret(), ring, minExtensionVersion: '2.0.0' })).rejects.toThrow(/not in src\/shared\/keyring.ts/)
      writeFileSync(join(dir, 'flm/subject-list.json'), 'not json')
      await expect(buildSigned({ dir, secret: SECRET, ring, minExtensionVersion: '2.0.0' })).rejects.toThrow(/subject-list.json is not valid JSON/)
      cpSync('data/flm/subject-list.json', join(dir, 'flm/subject-list.json'))
      rmSync(join(dir, 'news'), { recursive: true })
      await expect(buildSigned({ dir, secret: SECRET, ring, minExtensionVersion: '2.0.0' })).rejects.toThrow(/missing news\/news-rules.json/)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('reads the ring from src/shared/keyring.ts, empty until the owner adds keys', () => {
    expect(readRing('src/shared/keyring.ts')).toEqual([])
    const dir = mkdtempSync(join(tmpdir(), 'fap-aio-ring-'))
    try {
      writeFileSync(join(dir, 'ring.ts'), `export const KEYRING = [\n  { keyId: '${k.keyId}', spki: '${k.spki}', label: 'primary' },\n]\n`)
      expect(readRing(join(dir, 'ring.ts'))).toEqual(ring)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
