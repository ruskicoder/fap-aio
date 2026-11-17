// Offline data signing (platform R5.8, R5.9, R9.4; design, "Keys and signing"). Node standard library only.
// A recovery phrase is 32 random bytes in Crockford base32 with a check symbol; the P-256 private key is
// derived from it deterministically with HKDF-SHA256, so the same phrase gives the same key anywhere.
import { createECDH, createHash, createPrivateKey, createPublicKey, hkdfSync, randomBytes, sign as nodeSign, webcrypto } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CHECK = ALPHABET + '*~$=U'
// P-256 group order n.
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n

/** The files of the channel, as packaged in data/ (design, "Layout of the data/live branch"). */
export const FILES = [
  { name: 'subject-rules.json', path: 'flm/subject-rules.json', schema: 'subject-rules@1' },
  { name: 'subject-list.json', path: 'flm/subject-list.json', schema: 'subject-list@1' },
  { name: 'news-rules.json', path: 'news/news-rules.json', schema: 'news-rules@1' },
]

const toBig = (buf) => BigInt(`0x${Buffer.from(buf).toString('hex') || '0'}`)

/** 32 bytes as 52 Crockford base32 symbols plus a check symbol, in groups of four. */
export function encodePhrase(bytes) {
  if (bytes.length !== 32) throw new Error('a phrase holds exactly 32 bytes')
  let v = toBig(bytes)
  let s = ''
  for (let i = 0; i < 52; i++) { s = ALPHABET[Number(v % 32n)] + s; v /= 32n }
  s += CHECK[Number(toBig(bytes) % 37n)]
  return s.match(/.{1,4}/g).join('-')
}

/** Reads a phrase back; tolerant of case, spaces, hyphens, I/L for 1 and O for 0; rejects a wrong check symbol. */
export function decodePhrase(phrase) {
  const s = String(phrase).toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0')
  if (s.length !== 53) throw new Error('a recovery phrase has 53 symbols')
  let v = 0n
  for (const ch of s.slice(0, 52)) {
    const i = ALPHABET.indexOf(ch)
    if (i < 0) throw new Error(`"${ch}" is not a recovery phrase symbol`)
    v = v * 32n + BigInt(i)
  }
  if (v >= 1n << 256n) throw new Error('the recovery phrase is out of range')
  if (CHECK[Number(v % 37n)] !== s[52]) throw new Error('the recovery phrase has a typo (check symbol does not match)')
  return Buffer.from(v.toString(16).padStart(64, '0'), 'hex')
}

export const newSecret = () => randomBytes(32)

const b64url = (b) => Buffer.from(b).toString('base64url')

/** d = (HKDF-SHA256(secret, "fap-aio/data-signing", "p256/v1", 48) mod (n - 1)) + 1, and its key pair. */
export function deriveKey(secret) {
  const okm = Buffer.from(hkdfSync('sha256', secret, 'fap-aio/data-signing', 'p256/v1', 48))
  const d = (toBig(okm) % (N - 1n)) + 1n
  const dBytes = Buffer.from(d.toString(16).padStart(64, '0'), 'hex')
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(dBytes)
  const pub = ecdh.getPublicKey(null, 'uncompressed')
  const jwk = { kty: 'EC', crv: 'P-256', x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)), d: b64url(dBytes) }
  const privateKey = createPrivateKey({ key: jwk, format: 'jwk' })
  const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
  const keyId = createHash('sha256').update(spki).digest('hex').slice(0, 16)
  return { privateKey, spki: Buffer.from(spki).toString('base64'), keyId }
}

/** ECDSA P-256 / SHA-256 in IEEE P1363 form (r||s), as WebCrypto verifies it; base64. */
export const signBytes = (privateKey, bytes) => nodeSign('sha256', bytes, { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64')

/** Verifies with WebCrypto, exactly as the extension does. */
export async function verifyBytes(spkiB64, bytes, sigB64) {
  const key = await webcrypto.subtle.importKey('spki', Buffer.from(spkiB64, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  return webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(sigB64, 'base64'), bytes)
}

/** The ring as written in src/shared/keyring.ts. */
export function readRing(file) {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/keyId:\s*'([0-9a-f]{16})',\s*spki:\s*'([A-Za-z0-9+/=]+)',\s*label:\s*'(primary|backup)'/g)].map((m) => ({ keyId: m[1], spki: m[2], label: m[3] }))
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex')

/**
 * Builds and signs manifest.json for the files in `dir`, with a dataVersion above both `currentVersion` (the
 * live channel) and `packagedVersion`. Returns the exact manifest bytes and the signature; refuses a key that
 * is not in the ring, and re-verifies the signature with WebCrypto before returning.
 */
export async function buildSigned({ dir, secret, ring, currentVersion = 0, packagedVersion = 0, minExtensionVersion, now = new Date() }) {
  const key = deriveKey(secret)
  const listed = ring.find((k) => k.keyId === key.keyId)
  if (!listed) throw new Error(`key ${key.keyId} is not in src/shared/keyring.ts; add it in a release first`)
  if (listed.spki !== key.spki) throw new Error(`key ${key.keyId} in the ring has a different public key`)
  const files = FILES.map((f) => {
    const p = join(dir, f.path)
    if (!existsSync(p)) throw new Error(`missing ${f.path} in ${dir}`)
    const bytes = readFileSync(p)
    try { JSON.parse(bytes.toString('utf8')) } catch { throw new Error(`${f.path} is not valid JSON`) }
    return { name: f.name, path: f.path, sha256: sha256(bytes), bytes: bytes.length, schema: f.schema }
  })
  const manifest = {
    format: 1,
    dataVersion: Math.max(currentVersion, packagedVersion) + 1,
    publishedAt: now.toISOString(),
    minExtensionVersion,
    keyId: key.keyId,
    files,
  }
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  const sig = signBytes(key.privateKey, bytes)
  if (!(await verifyBytes(listed.spki, bytes, sig))) throw new Error('the new signature does not verify; nothing written')
  return { manifest, bytes, sig }
}

/** Checks a published directory: signature with the ring, version format, and every file hash. */
export async function verifyDir(dir, ring) {
  const problems = []
  const bytes = readFileSync(join(dir, 'manifest.json'))
  const sig = readFileSync(join(dir, 'manifest.json.sig'), 'utf8').trim()
  let m
  try { m = JSON.parse(bytes.toString('utf8')) } catch { return ['manifest.json is not valid JSON'] }
  const key = ring.find((k) => k.keyId === m.keyId)
  if (!key) problems.push(`keyId ${m.keyId} is not in the ring`)
  else if (!(await verifyBytes(key.spki, bytes, sig))) problems.push('the signature does not verify')
  if (m.format !== 1) problems.push(`format ${m.format} is not 1`)
  for (const f of m.files ?? []) {
    const p = join(dir, f.path)
    if (!existsSync(p)) problems.push(`missing ${f.path}`)
    else if (sha256(readFileSync(p)) !== f.sha256) problems.push(`${f.path} does not match its sha256`)
  }
  return problems
}
