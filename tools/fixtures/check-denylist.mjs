#!/usr/bin/env node
// Fails if a committed fixture contains a deny-listed value (platform R8.3).
// List: --list <file>, else $FIXTURE_DENYLIST_FILE, else ignore/fixture-denylist.txt. No list: notice and pass.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const argList = process.argv.indexOf('--list')
const listPath = argList > 0 ? process.argv[argList + 1] : process.env.FIXTURE_DENYLIST_FILE || 'ignore/fixture-denylist.txt'
const dirs = ['test/fixtures']
const SKIP = new Set(['test/fixtures/README.md'])

if (!listPath || !existsSync(listPath)) {
  console.log(`notice: no deny list at ${listPath || '(unset)'}; fixture check skipped`)
  process.exit(0)
}
const fold = (s) => s.normalize('NFC').toLowerCase()
const entries = readFileSync(listPath, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map(fold)

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

let hits = 0
let files = 0
for (const file of dirs.flatMap(walk).filter((f) => !SKIP.has(f.split('\\').join('/')))) {
  files++
  const text = fold(readFileSync(file, 'utf8'))
  entries.forEach((e, i) => {
    if (text.includes(e)) {
      hits++
      console.error(`${file}: deny-list entry #${i + 1} found`)
    }
  })
}
if (hits) process.exit(1)
console.log(`fixture deny-list check: ${files} files, ${entries.length} entries, no match`)
