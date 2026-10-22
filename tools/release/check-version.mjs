#!/usr/bin/env node
// Fails unless package.json, the built manifest and the tag (argument or GITHUB_REF_NAME) agree (R9.3).
import { readFileSync, existsSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8')).version
const errors = []
if (!existsSync('dist/manifest.json')) errors.push('dist/manifest.json missing; run npm run build first')
else {
  const man = JSON.parse(readFileSync('dist/manifest.json', 'utf8')).version
  if (man !== pkg) errors.push(`manifest version ${man} != package.json ${pkg}`)
}
const tag = process.argv[2] ?? (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined)
if (tag !== undefined && tag !== `v${pkg}`) errors.push(`tag ${tag} != v${pkg}`)
if (!/^\d+\.\d+\.\d+$/.test(pkg)) errors.push(`version ${pkg} is not numeric semver`)
if (errors.length) {
  for (const e of errors) console.error(e)
  process.exit(1)
}
console.log(`version ${pkg} ok${tag ? ` (tag ${tag})` : ''}`)
