// Checks shared by the theme importer in the panel and the sanitizer in the service worker (appearance
// R5.4; platform R7.4). No parser here, so the content bundle does not pull in csstree.

export const isDataUrl = (v: string) => /^\s*data:/i.test(v)

/** CSS escapes (`\75 rl(`) decoded, so a check sees what the browser would see. */
export const unescapeCss = (s: string) =>
  s.replace(/\\([0-9a-f]{1,6})\s?/gi, (_, h: string) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff) || 0xfffd)).replace(/\\(.)/g, '$1')

/** True when text holds `@import` or a web address (a `url()` that is not `data:`, or a remote image-set or src). */
export function stillUnsafe(css: string): boolean {
  const t = unescapeCss(css).toLowerCase()
  if (/@import/.test(t)) return true
  for (const m of t.matchAll(/(url|image-set|-webkit-image-set|src)\s*\(\s*(['"]?)\s*([^'")\s]*)/g)) {
    const target = m[3] ?? ''
    if (m[1] === 'url' && !isDataUrl(target)) return true
    if (m[1] !== 'url' && /^[a-z][a-z0-9+.-]*:|^\/\//.test(target) && !isDataUrl(target)) return true
  }
  return false
}
