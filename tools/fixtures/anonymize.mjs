#!/usr/bin/env node
// Turns raw FAP pages (ignore/fixtures-raw/<culture>/) into synthetic committed fixtures
// (test/fixtures/<culture>/) with the same elements, classes, attributes and columns
// (platform R8.1, R8.2). Deterministic from --seed: the same input and seed give the same output,
// and a value maps to the same replacement on every page of a run.
//   node tools/fixtures/anonymize.mjs [--seed s] [--in ignore/fixtures-raw] [--out test/fixtures]
import { parseHTML } from 'linkedom'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const RULES = JSON.parse(readFileSync(join(here, 'fields.json'), 'utf8'))
const fold = (s) => s.normalize('NFC').toLowerCase()

export function makeAnonymizer({ seed = 'fap-aio', deny = [] } = {}) {
  const keepExact = new Set(RULES.keepExact.map(fold))
  const keepWords = new Set(RULES.keepWords.map(fold))
  for (const p of RULES.keepExact) for (const w of p.split(/\s+/)) if (/^\p{L}+$/u.test(w)) keepWords.add(fold(w))
  const denyF = deny.map(fold).filter(Boolean)
  const hashInt = (...parts) => createHash('sha256').update([seed, ...parts].join('\u0000')).digest().readUInt32BE(0)
  const SHIFT_DAYS = -7 * ((hashInt('date-shift') % 26) + 1)

  // Deterministic per-character remap; the hash uses the lowercased token so case variants stay consistent.
  const LOWER = 'abcdefghiklmnoprstuvy'
  const UPPER = LOWER.toUpperCase()
  function remapToken(tok, salt = 0) {
    const key = fold(tok)
    let out = ''
    let i = 0
    for (const ch of tok) {
      const h = hashInt('tok', key, String(i++), String(salt))
      if (/\p{Lu}/u.test(ch)) out += UPPER[h % UPPER.length]
      else if (/\p{L}/u.test(ch)) out += LOWER[h % LOWER.length]
      else if (/\d/.test(ch)) out += String(h % 10)
      else out += ch
    }
    return out
  }
  const safe = (gen) => {
    for (let salt = 0; salt < 20; salt++) {
      const v = gen(salt)
      const f = fold(v)
      if (!denyF.some((d) => f.includes(d))) return v
    }
    throw new Error('could not avoid a deny-list value')
  }
  const tokenMap = (tok) => safe((salt) => remapToken(tok, salt))

  function shiftDate(y, m, d) {
    const t = Date.UTC(y, m - 1, d) + SHIFT_DAYS * 86_400_000
    const x = new Date(t)
    return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]
  }
  const p2 = (n) => String(n).padStart(2, '0')

  function mark(num) {
    const decimals = (num.split(/[.,]/)[1] ?? '').length
    const sep = num.includes(',') ? ',' : '.'
    const h = hashInt('mark', num, String(markCounter++))
    const v = decimals ? ((h % 101) / 10).toFixed(Math.min(decimals, 2)) : String(h % 11)
    return v.replace('.', sep)
  }
  let markCounter = 0

  const RE = new RegExp(
    [
      /(?<email>[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/.source,
      /(?<iso>\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?\b)/.source,
      /(?<dmy>\b\d{1,2}\/\d{1,2}\/\d{4}\b)/.source,
      /(?<dm>\b\d{1,2}\/\d{1,2}\b)/.source,
      /(?<week>\b\d{4}-W\d{2}\b)/.source,
      /(?<time>\b\d{1,2}[h:]\d{2}\b)/.source,
      /(?<term>\b(?:Spring|Summer|Fall)\d{4}\b)/.source,
      /(?<code>\b[A-Z]{2,4}\d{3}[a-z]?\b)/.source,
      /(?<num>\b\d+(?:[.,]\d+)?\b)/.source,
      /(?<word>[\p{L}\p{N}_]+)/u.source,
    ].join('|'),
    'gu',
  )

  function replaceToken(g, m, mode) {
    if (g.email) {
      const [local, domain] = m.split('@')
      const keepDomain = /(^|\.)(fpt|fe)\.edu\.vn$/i.test(domain)
      return `${tokenMap(local)}@${keepDomain ? domain : 'example.com'}`
    }
    if (g.iso) {
      const [y, mo, d] = shiftDate(+m.slice(0, 4), +m.slice(5, 7), +m.slice(8, 10))
      return `${y}-${p2(mo)}-${p2(d)}${m.slice(10)}`
    }
    if (g.dmy) {
      const [d, mo, y] = m.split('/').map(Number)
      if (mo > 12 || d > 31) return tokenMap(m)
      const [ny, nm, nd] = shiftDate(y, mo, d)
      return `${p2(nd)}/${p2(nm)}/${ny}`
    }
    if (g.dm) {
      const [d, mo] = m.split('/').map(Number)
      if (mo > 12 || d > 31 || mo === 0 || d === 0) return m
      const [, nm, nd] = shiftDate(2026, mo, d)
      return `${p2(nd)}/${p2(nm)}`
    }
    if (g.week) {
      const y = +m.slice(0, 4)
      const w = +m.slice(6)
      const shifted = w + SHIFT_DAYS / 7
      return shifted >= 1 ? `${y}-W${p2(shifted)}` : `${y - 1}-W${p2(52 + shifted)}`
    }
    if (g.time || g.term) return m
    if (g.code) {
      const [, letters, digits, suffix] = m.match(/^([A-Z]{2,4})(\d{3})([a-z]?)$/)
      const keep = RULES.keepPrefixes.some((p) => letters.startsWith(p) || p.startsWith(letters))
      const newLetters = keep ? letters : tokenMap(letters)
      const newDigits = safe((salt) => remapToken(`${letters}${digits}`, salt).slice(letters.length))
      return newLetters + newDigits + suffix
    }
    if (g.num) {
      if (mode === 'mark') return mark(m)
      if (/^\d{1,2}$/.test(m)) return m
      return tokenMap(m)
    }
    // word
    if (/\d/.test(m)) return keepWords.has(fold(m)) ? m : tokenMap(m)
    if (mode === 'label' || mode === 'mark' || keepWords.has(fold(m))) return m
    return tokenMap(m)
  }

  function text(s, mode = 'text') {
    if (mode === 'raw' || !s.trim()) return s
    if (keepExact.has(fold(s.trim().replace(/\s+/g, ' ')))) return s
    return s.replace(RE, (m, ...args) => replaceToken(args.at(-1), m, mode))
  }

  function url(s) {
    // Keep scheme and host; treat the rest as label text.
    const m = s.match(/^([a-z][\w+.-]*:\/\/[^/?#]*)?(.*)$/is)
    return (m[1] ?? '') + text(m[2], 'label')
  }

  const attrMode = (name) => {
    if (RULES.keepAttributes.includes(name)) return 'keep'
    if (['href', 'src', 'action'].includes(name) || name.endsWith('-url') || name.endsWith('-href')) return 'url'
    if (RULES.labelAttributes.includes(name)) return 'label'
    return 'text'
  }

  function html(raw) {
    const isDoc = /^\s*(<!doctype|<html)/i.test(raw)
    const { document } = parseHTML(isDoc ? raw : `<!doctype html><html><head></head><body>${raw}</body></html>`)
    const modes = new Map()
    for (const rule of [...RULES.selectors].reverse()) {
      for (const el of document.querySelectorAll(rule.select)) modes.set(el, rule.mode)
    }
    const modeOf = (node) => {
      for (let el = node.parentNode; el; el = el.parentNode) if (modes.has(el)) return modes.get(el)
      return 'text'
    }
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 8) { child.remove(); continue }
        if (child.nodeType === 3) { child.nodeValue = text(child.nodeValue, modeOf(child)); continue }
        if (child.nodeType !== 1) continue
        const tag = child.tagName.toLowerCase()
        for (const a of [...child.attributes]) {
          const m = attrMode(a.name)
          if (m === 'keep') continue
          child.setAttribute(a.name, m === 'url' ? url(a.value) : text(a.value, m))
        }
        if (tag === 'script' || tag === 'style') {
          if (tag === 'script' && child.textContent.trim()) child.textContent = ''
          continue
        }
        walk(child)
      }
    }
    walk(isDoc ? document : document.body)
    return isDoc ? document.toString() : document.body.innerHTML
  }

  function json(value) {
    if (typeof value === 'string') return /^(https?:)?\//.test(value) ? url(value) : text(value)
    if (typeof value === 'number') return /^\d{1,2}$/.test(String(value)) ? value : Number(tokenMap(String(value)))
    if (Array.isArray(value)) return value.map(json)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, json(v)]))
    return value
  }

  return { html, json, text, shiftDays: SHIFT_DAYS }
}

export function readDeny(path) {
  return existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
  const inDir = arg('--in', 'ignore/fixtures-raw')
  const outDir = arg('--out', 'test/fixtures')
  const an = makeAnonymizer({ seed: arg('--seed', 'fap-aio'), deny: readDeny(arg('--deny', 'ignore/fixture-denylist.txt')) })
  let n = 0
  for (const culture of ['en', 'vi']) {
    const dir = join(inDir, culture)
    if (!existsSync(dir)) continue
    mkdirSync(join(outDir, culture), { recursive: true })
    for (const f of readdirSync(dir).sort()) {
      if (f === 'index.json') continue
      const raw = readFileSync(join(dir, f), 'utf8')
      const out = f.endsWith('.json') ? JSON.stringify(an.json(JSON.parse(raw)), null, 1) + '\n' : an.html(raw)
      writeFileSync(join(outDir, culture, f), out)
      n++
    }
  }
  console.log(`anonymized ${n} files into ${outDir} (date shift ${an.shiftDays} days)`)
}
