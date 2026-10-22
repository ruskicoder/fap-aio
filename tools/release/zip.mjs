#!/usr/bin/env node
// Zips dist/ to fap-aio-<version>.zip and writes its SHA-256 (R9.2). Standard library only.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { deflateRawSync, crc32 } from 'node:zlib'
import { createHash } from 'node:crypto'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const out = `fap-aio-${version}.zip`

function walk(dir) {
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

// Fixed timestamp (1980-01-01) keeps the archive reproducible.
const DOS_TIME = 0
const DOS_DATE = (0 << 9) | (1 << 5) | 1
const local = []
const central = []
let offset = 0
for (const file of walk('dist')) {
  const name = Buffer.from(relative('dist', file).split('\\').join('/'))
  const data = readFileSync(file)
  const comp = deflateRawSync(data, { level: 9 })
  const crc = crc32(data)
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6)
  head.writeUInt16LE(8, 8); head.writeUInt16LE(DOS_TIME, 10); head.writeUInt16LE(DOS_DATE, 12)
  head.writeUInt32LE(crc, 14); head.writeUInt32LE(comp.length, 18); head.writeUInt32LE(data.length, 22)
  head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28)
  local.push(head, name, comp)
  const cen = Buffer.alloc(46)
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6)
  cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10); cen.writeUInt16LE(DOS_TIME, 12)
  cen.writeUInt16LE(DOS_DATE, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20)
  cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42)
  central.push(cen, name)
  offset += head.length + name.length + comp.length
}
const cenBuf = Buffer.concat(central)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10)
end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16)
const zip = Buffer.concat([...local, cenBuf, end])
writeFileSync(out, zip)
const sha = createHash('sha256').update(zip).digest('hex')
writeFileSync(`${out}.sha256`, `${sha}  ${out}\n`)
console.log(`${out} ${zip.length} bytes sha256 ${sha}`)
