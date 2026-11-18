// csstree for the theme editor page only (appearance R4.3, R5.4; fix F-21): syntax errors with line and
// column, and the import sanitizer. It is imported by src/pages/theme-editor and nothing else, so no script
// that runs on every FAP page, and not the service worker, carries the parser.
// Browsers drop invalid rules silently, which is why the check exists.
import { parse, walk } from 'css-tree'
import { isDataUrl as isData, stillUnsafe } from '../../../shared/css-safety'

export interface CssProblem { line: number; column: number; offset: number; message: string }

export function validateCss(css: string): CssProblem[] {
  const out: CssProblem[] = []
  try {
    parse(css, {
      positions: true,
      parseValue: false,
      onParseError: (e: { line?: number; column?: number; offset?: number; message?: string; formattedMessage?: string }) => {
        if (out.length < 50) out.push({ line: e.line ?? 1, column: e.column ?? 1, offset: e.offset ?? 0, message: (e.message ?? 'Syntax error').replace(/\s+/g, ' ').trim() })
      },
    })
  } catch (e) {
    out.push({ line: 1, column: 1, offset: 0, message: e instanceof Error ? e.message : String(e) })
  }
  return out
}


// ---- Import sanitizer (appearance R5.3, R5.4; platform R7.4) ----------------------------------------
// Imported themes are untrusted: `@import` and every web address (`url()` that is not a `data:` URL, a
// string inside `image-set()`) are cut out on the syntax tree, so CSS escapes and odd spacing do not hide
// them, and the original text keeps its formatting. A last check on the escape-decoded text refuses
// anything that still looks like a web address.

export interface Sanitized { css: string; removed: string[] }

export function sanitizeCss(css: string): Sanitized | { error: string } {
  const cuts: { start: number; end: number; with: string; what: string }[] = []
  let ast: unknown
  try { ast = parse(css, { positions: true, parseCustomProperty: true, onParseError: () => {} }) } catch { return { error: 'The CSS could not be read.' } }
  walk(ast, (node) => {
    const loc = node.loc
    if (!loc) return
    if (node.type === 'Atrule' && node.name?.toLowerCase() === 'import') {
      cuts.push({ start: loc.start.offset, end: loc.end.offset, with: '', what: '@import rule' })
    } else if (node.type === 'Url' && !isData(node.value ?? '')) {
      cuts.push({ start: loc.start.offset, end: loc.end.offset, with: 'none', what: `web address ${String(node.value ?? '').slice(0, 80)}` })
    } else if (node.type === 'Function' && /^(-webkit-)?image-set$/i.test(node.name ?? '') && /['"]\s*(https?:|\/\/)/i.test(css.slice(loc.start.offset, loc.end.offset))) {
      cuts.push({ start: loc.start.offset, end: loc.end.offset, with: 'none', what: 'web address in image-set()' })
    }
  })
  // Outer ranges first; a range inside one already cut is dropped.
  cuts.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: typeof cuts = []
  for (const c of cuts) if (!kept.some((k) => c.start >= k.start && c.end <= k.end)) kept.push(c)
  let out = css
  for (const c of [...kept].reverse()) out = out.slice(0, c.start) + c.with + out.slice(c.end)
  if (stillUnsafe(out)) return { error: 'The CSS holds web addresses that could not be removed safely, so it was not imported.' }
  return { css: out, removed: kept.map((c) => c.what) }
}
