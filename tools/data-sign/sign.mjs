#!/usr/bin/env node
// Data channel signing tool, run offline on the owner's machine (platform R5.8, R5.9, R9.4). Never in CI.
//   node tools/data-sign/sign.mjs keygen             new recovery phrase, its keyId and SPKI for the ring
//   node tools/data-sign/sign.mjs keyid              keyId and SPKI of an existing phrase
//   node tools/data-sign/sign.mjs publish <dir> [--current <manifest.json>] [--min-extension <x.y.z>]
//   node tools/data-sign/sign.mjs verify <dir>
// The phrase is read from FAP_AIO_SIGNING_PHRASE, a pipe, or a prompt that does not echo; never pass it as an
// argument, which would leave it in the shell history.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { buildSigned, decodePhrase, deriveKey, encodePhrase, newSecret, readRing, verifyDir } from './lib.mjs'

const root = resolve(import.meta.dirname, '..', '..')
const RING = join(root, 'src/shared/keyring.ts')
const [cmd, ...rest] = process.argv.slice(2)
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }

async function readPhrase() {
  if (process.env.FAP_AIO_SIGNING_PHRASE) return process.env.FAP_AIO_SIGNING_PHRASE
  if (!process.stdin.isTTY) { let s = ''; for await (const c of process.stdin) s += c; return s.trim() }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  rl._writeToOutput = (s) => { if (s.includes('Recovery phrase')) process.stdout.write(s) }
  const answer = await new Promise((res) => rl.question('Recovery phrase: ', res))
  rl.close()
  process.stdout.write('\n')
  return answer
}

/** dataVersion of the live channel: --current file, else git's data/live or origin/data/live, else 0. */
function currentVersion() {
  const file = flag('--current')
  const text = file ? readFileSync(file, 'utf8') : (() => {
    for (const ref of ['data/live', 'origin/data/live']) {
      try { return execFileSync('git', ['-C', root, 'show', `${ref}:manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { /* next */ }
    }
    return null
  })()
  return text ? Number(JSON.parse(text).dataVersion) || 0 : 0
}

async function main() {
  if (cmd === 'keygen') {
    const secret = newSecret()
    const k = deriveKey(secret)
    console.log('Recovery phrase (write it down; store primary and backup apart, never in the repository):')
    console.log(`  ${encodePhrase(secret)}`)
    console.log(`keyId: ${k.keyId}`)
    console.log(`spki:  ${k.spki}`)
    console.log(`Ring entry for src/shared/keyring.ts:\n  { keyId: '${k.keyId}', spki: '${k.spki}', label: 'primary' },`)
    return
  }
  if (cmd === 'keyid') {
    const k = deriveKey(decodePhrase(await readPhrase()))
    console.log(`keyId: ${k.keyId}\nspki:  ${k.spki}`)
    return
  }
  if (cmd === 'publish') {
    const dir = resolve(rest[0] ?? '')
    if (!rest[0] || !existsSync(dir)) throw new Error('usage: publish <dir> [--current <manifest.json>] [--min-extension <x.y.z>]')
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
    const packaged = JSON.parse(readFileSync(join(root, 'data/manifest.json'), 'utf8')).dataVersion
    const { manifest, bytes, sig } = await buildSigned({
      dir, secret: decodePhrase(await readPhrase()), ring: readRing(RING),
      currentVersion: currentVersion(), packagedVersion: packaged, minExtensionVersion: flag('--min-extension') ?? pkg,
    })
    writeFileSync(join(dir, 'manifest.json'), bytes)
    writeFileSync(join(dir, 'manifest.json.sig'), `${sig}\n`)
    const day = manifest.publishedAt.slice(0, 10)
    console.log(`Signed dataVersion ${manifest.dataVersion} with key ${manifest.keyId}; the signature verifies with the ring.`)
    console.log('Review the files, then publish by hand (add -2, -3 to the snapshot branch if that day already has one):')
    console.log(`  git -C ${dir} add -A`)
    console.log(`  git -C ${dir} commit -m "data: dataVersion ${manifest.dataVersion}"`)
    console.log(`  git -C ${dir} push origin HEAD:refs/heads/data/live`)
    console.log(`  git -C ${dir} push origin HEAD:refs/heads/data/${day}`)
    return
  }
  if (cmd === 'verify') {
    const problems = await verifyDir(resolve(rest[0] ?? '.'), readRing(RING))
    if (problems.length) { for (const p of problems) console.error(p); process.exit(1) }
    console.log('manifest signature, format and file hashes verify')
    return
  }
  console.error('usage: sign.mjs keygen | keyid | publish <dir> | verify <dir>')
  process.exit(2)
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1) })
