// Colour conversions (appearance R3.1): sRGB, linear sRGB, OKLab and OKLCH with Björn Ottosson's
// matrices, and hex, rgb(), hsl() and oklch() parsing and formatting. Pure.

/** sRGB channels from 0 to 1 (gamma encoded). */
export interface Rgb { r: number; g: number; b: number }
export interface Oklab { L: number; a: number; b: number }
/** Lightness 0 to 1, chroma from 0 (about 0.4 at most in sRGB), hue in degrees 0 to 360. */
export interface Oklch { l: number; c: number; h: number }

const EPS = 1e-6
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const normHue = (h: number) => ((h % 360) + 360) % 360

export const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
export const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.sign(v) * Math.abs(v) ** (1 / 2.4) - 0.055)

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/** May return channels outside 0 to 1 for colours outside sRGB; see `inGamut`. */
export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  }
}

export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const c = Math.hypot(a, b)
  return { l: L, c, h: c < 1e-4 ? 0 : normHue((Math.atan2(b, a) * 180) / Math.PI) }
}

export function oklchToOklab({ l, c, h }: Oklch): Oklab {
  const r = (h * Math.PI) / 180
  return { L: l, a: c * Math.cos(r), b: c * Math.sin(r) }
}

export const rgbToOklch = (c: Rgb) => oklabToOklch(rgbToOklab(c))
export const oklchToRgb = (c: Oklch) => oklabToRgb(oklchToOklab(c))

export const inGamut = (c: Rgb) => [c.r, c.g, c.b].every((v) => v >= -EPS && v <= 1 + EPS)

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < EPS) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: normHue(h * 60), s, l }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return { r: f(0), g: f(8), b: f(4) }
}

const hex2 = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')
export const toHex = ({ r, g, b }: Rgb) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

const num = (s: string, scale: number) => (s.endsWith('%') ? (parseFloat(s) / 100) * scale : parseFloat(s))

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `hsl()` and `oklch()`; alpha is ignored. Null when unreadable. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase()
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s)
  if (m) {
    const h = m[1]!.length <= 4 ? [...m[1]!.slice(0, 3)].map((x) => x + x).join('') : m[1]!.slice(0, 6)
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }
  }
  m = /^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/.exec(s)
  if (!m) return null
  const parts = m[2]!.split(/[\s,/]+/).filter(Boolean).slice(0, 3)
  if (parts.length < 3 || parts.some((p) => !/^-?[\d.]+(%|deg)?$/.test(p))) return null
  const fn = m[1]!
  if (fn.startsWith('rgb')) {
    const [r, g, b] = parts.map((p) => num(p, 255) / 255)
    return { r: clamp01(r!), g: clamp01(g!), b: clamp01(b!) }
  }
  if (fn.startsWith('hsl')) return hslToRgb(normHue(parseFloat(parts[0]!)), clamp01(num(parts[1]!, 1) / (parts[1]!.endsWith('%') ? 1 : 100)), clamp01(num(parts[2]!, 1) / (parts[2]!.endsWith('%') ? 1 : 100)))
  const l = parts[0]!.endsWith('%') ? parseFloat(parts[0]!) / 100 : parseFloat(parts[0]!)
  const c = parts[1]!.endsWith('%') ? (parseFloat(parts[1]!) / 100) * 0.4 : parseFloat(parts[1]!)
  const rgb = oklchToRgb({ l: clamp01(l), c: Math.max(0, c), h: normHue(parseFloat(parts[2]!)) })
  return { r: clamp01(rgb.r), g: clamp01(rgb.g), b: clamp01(rgb.b) }
}

export const formatOklch = ({ l, c, h }: Oklch) => `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`
export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(clamp01(r) * 255)} ${Math.round(clamp01(g) * 255)} ${Math.round(clamp01(b) * 255)})`
}
export function formatHsl(c: Rgb): string {
  const { h, s, l } = rgbToHsl(c)
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
}
