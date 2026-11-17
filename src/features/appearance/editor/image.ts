// Background images (appearance R4.4; design, "CSS editor", D-6): a local file is downscaled to at most
// 2560 px on its longer side, encoded as WebP (JPEG where WebP encoding is missing) under 300 KB, and kept
// in the theme as a `data:` URL, which FAP's `img-src` allows. Remote addresses are refused.

export const MAX_SIDE = 2560
export const MAX_BYTES = 300 * 1024
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

export const REMOTE_REFUSED = 'Images from web addresses cannot be used: FAP only allows images stored with the theme. Save the picture to your computer, then choose the file.'

/** The size that fits in `max` on the longer side, never larger than the original. */
export function fitSize(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

export type Encoder = (scale: number, quality: number) => Promise<Blob>

/**
 * Tries lower quality, then smaller sizes, until the image is under the limit. Null when even the
 * smallest attempt is too large.
 */
export async function encodeUnder(encode: Encoder, limit = MAX_BYTES): Promise<Blob | null> {
  for (const scale of [1, 0.75, 0.5, 0.35]) {
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      const b = await encode(scale, q)
      if (b.size <= limit) return b
    }
  }
  return null
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result))
  r.onerror = () => rej(r.error)
  r.readAsDataURL(b)
})

/** Reads a chosen file into a `data:` URL under the limit, or an error text for the person. */
export async function imageFromFile(file: File): Promise<{ dataUrl: string } | { error: string }> {
  if (!ACCEPT.split(',').includes(file.type)) return { error: 'Choose a PNG, JPEG, WebP or GIF image.' }
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file) } catch { return { error: 'This file could not be read as an image.' } }
  const base = fitSize(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return { error: 'This browser cannot resize images here.' }
  const encode: Encoder = (scale, quality) => new Promise((res, rej) => {
    canvas.width = Math.max(1, Math.round(base.w * scale))
    canvas.height = Math.max(1, Math.round(base.h * scale))
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((b) => {
      if (!b) { rej(new Error('encode')); return }
      if (b.type === 'image/webp') { res(b); return }
      canvas.toBlob((j) => (j ? res(j) : rej(new Error('encode'))), 'image/jpeg', quality)
    }, 'image/webp', quality)
  })
  const blob = await encodeUnder(encode).catch(() => null)
  bmp.close()
  if (!blob) return { error: 'This image stays above 300 KB even when made smaller. Try a simpler picture.' }
  return { dataUrl: await blobToDataUrl(blob) }
}

/** True when a dropped or pasted text is a web address rather than a file. */
export const isRemote = (text: string) => /^\s*(https?:|\/\/|ftp:|blob:)/i.test(text)
