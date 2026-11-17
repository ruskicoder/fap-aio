#!/usr/bin/env node
// Fails when a built script holds a Unicode noncharacter (U+FDD0 to U+FDEF, U+FFFE, U+FFFF): Chrome then
// refuses to load it as a content script ("isn't UTF-8 encoded"). Runs after every build, over all of
// dist/, because the content scripts are built in a separate pass. Standard library only.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p] })
const bad = []
for (const f of walk(process.argv[2] ?? 'dist').filter((p) => /\.(m?js|css|html)$/.test(p))) {
  const text = readFileSync(f, 'utf8')
  const m = /[﷐-﷯￾￿]/.exec(text)
  if (m) bad.push(`${f}: U+${m[0].charCodeAt(0).toString(16).toUpperCase()} at ${m.index}`)
}
if (bad.length) {
  for (const b of bad) console.error(b)
  console.error('Chrome would refuse these files; keep esbuild charset "ascii" in vite.config.ts.')
  process.exit(1)
}
console.log('dist text ok: no Unicode noncharacters')
