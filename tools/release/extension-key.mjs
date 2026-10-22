#!/usr/bin/env node
// Generates the extension signing key for a stable unpacked id (gate G-EXT-KEY).
// Private key: ignore/keys/extension-key.pem (keep offline). Public key: src/manifest-key.txt (commit).
import { generateKeyPairSync, createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const pemPath = resolve(root, 'ignore/keys/extension-key.pem')
const pubPath = resolve(root, 'src/manifest-key.txt')

export function extensionIdFromSpki(spkiDer) {
  const hex = createHash('sha256').update(spkiDer).digest('hex').slice(0, 32)
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (existsSync(pemPath) && !process.argv.includes('--force')) {
    console.error(`${pemPath} exists; pass --force to replace it (the extension id changes).`)
    process.exit(1)
  }
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const spki = publicKey.export({ type: 'spki', format: 'der' })
  mkdirSync(dirname(pemPath), { recursive: true })
  writeFileSync(pemPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  writeFileSync(pubPath, spki.toString('base64') + '\n')
  console.log(`private key: ${pemPath} (keep offline, never commit)`)
  console.log(`public key:  ${pubPath} (commit)`)
  console.log(`extension id: ${extensionIdFromSpki(spki)}`)
}
