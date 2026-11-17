#!/usr/bin/env node
// Writes the unsigned data/manifest.json that ships inside the package (platform R5.1, design "Build and release").
// Usage: node tools/data/packaged-manifest.mjs [--data-version N] [--check]
// Without --data-version the current dataVersion is kept (1 when the file does not exist yet).
// --check exits 1 when the committed manifest does not match the files.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** The packaged files, with the path used both in data/ and in the build output under data/. */
export const PACKAGED_FILES = [
  { name: 'subject-rules.json', path: 'flm/subject-rules.json', schema: 'subject-rules@1' },
  { name: 'subject-list.json', path: 'flm/subject-list.json', schema: 'subject-list@1' },
  { name: 'news-rules.json', path: 'news/news-rules.json', schema: 'news-rules@1' },
]

export const MANIFEST_PATH = resolve(root, 'data/manifest.json')

export function buildPackagedManifest({ dataVersion, dataDir = resolve(root, 'data') }) {
  const files = PACKAGED_FILES.map((f) => {
    const bytes = readFileSync(resolve(dataDir, f.path))
    return { ...f, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
  })
  return { format: 1, dataVersion, files }
}

export function readCommittedManifest() {
  return existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : null
}

function main(argv) {
  const current = readCommittedManifest()
  const i = argv.indexOf('--data-version')
  const dataVersion = i >= 0 ? Number(argv[i + 1]) : (current?.dataVersion ?? 1)
  if (!Number.isInteger(dataVersion) || dataVersion < 1) throw new Error('--data-version must be a positive integer')
  const next = buildPackagedManifest({ dataVersion })
  const text = JSON.stringify(next, null, 2) + '\n'
  if (argv.includes('--check')) {
    const same = current && JSON.stringify(current, null, 2) + '\n' === text
    if (!same) { console.error('data/manifest.json is stale: run node tools/data/packaged-manifest.mjs'); process.exit(1) }
    console.log('data/manifest.json matches the packaged files')
    return
  }
  writeFileSync(MANIFEST_PATH, text)
  console.log(`wrote data/manifest.json, dataVersion ${dataVersion}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
