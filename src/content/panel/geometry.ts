// Panel geometry (panel-ux R1.2, R1.4, R1.6, R1.7; agreed visual ui/shell.html): pure functions for
// moving, resizing, snapping and the minimized edge tab, all kept inside the viewport.
export interface Rect { x: number; y: number; width: number; height: number }
export type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const LIMITS = { floating: { minW: 320, maxW: 720, minH: 400 }, docked: { minW: 320, maxW: 640 } }
export const SNAP_PX = 10
export const MARGIN_PX = 8
export const UNDOCK_PX = 48
export const DRAWER_BELOW = 900
export const EDGE_TAB = { w: 32, h: 100 }

const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Size limits, then fully inside the viewport. Limits shrink to the viewport when it is smaller. */
export function clampFloating(r: Rect, vw: number, vh: number): Rect {
  const width = cl(r.width, Math.min(LIMITS.floating.minW, vw), Math.min(LIMITS.floating.maxW, vw))
  const height = cl(r.height, Math.min(LIMITS.floating.minH, vh), vh)
  return { width, height, x: cl(r.x, 0, vw - width), y: cl(r.y, 0, vh - height) }
}

/** Weak edge snapping: an edge within SNAP_PX of the viewport edge sticks to it. */
export function snap(r: Rect, vw: number, vh: number): Rect {
  let { x, y } = r
  if (x < SNAP_PX) x = 0
  else if (vw - (x + r.width) < SNAP_PX) x = vw - r.width
  if (y < SNAP_PX) y = 0
  else if (vh - (y + r.height) < SNAP_PX) y = vh - r.height
  return { ...r, x, y }
}

export const moveRect = (r: Rect, dx: number, dy: number, vw: number, vh: number): Rect =>
  snap(clampFloating({ ...r, x: r.x + dx, y: r.y + dy }, vw, vh), vw, vh)

/** Resize from an edge or corner; the opposite edge stays put and the result stays in the viewport. */
export function resizeRect(o: Rect, dir: Dir, dx: number, dy: number, vw: number, vh: number): Rect {
  const minW = Math.min(LIMITS.floating.minW, vw)
  const maxW = Math.min(LIMITS.floating.maxW, vw)
  const minH = Math.min(LIMITS.floating.minH, vh)
  let { x, y, width, height } = o
  if (dir.includes('e')) {
    width = cl(o.width + dx, minW, Math.min(maxW, vw - o.x))
    if (vw - (x + width) < SNAP_PX && vw - x <= maxW) width = vw - x
  }
  if (dir.includes('w')) {
    const right = o.x + o.width
    width = cl(o.width - dx, minW, Math.min(maxW, right))
    x = right - width
    if (x < SNAP_PX && right <= maxW) { x = 0; width = right }
  }
  if (dir.includes('s')) {
    height = cl(o.height + dy, minH, vh - o.y)
    if (vh - (y + height) < SNAP_PX) height = vh - y
  }
  if (dir.includes('n')) {
    const bottom = o.y + o.height
    height = cl(o.height - dy, minH, bottom)
    y = bottom - height
    if (y < SNAP_PX) { y = 0; height = bottom }
  }
  return { x, y, width, height }
}

/** Where a floating panel reopens: the bottom-right corner, keeping its size (R1.6). */
export function bottomRight(r: Rect, vw: number, vh: number): Rect {
  const c = clampFloating(r, vw, vh)
  return { ...c, x: Math.max(0, vw - c.width - MARGIN_PX), y: Math.max(0, vh - c.height - MARGIN_PX) }
}

export const clampDockWidth = (w: number, vw: number) => cl(w, Math.min(LIMITS.docked.minW, vw), Math.min(LIMITS.docked.maxW, vw))
export const clampTabTop = (t: number, vh: number) => cl(t, 0, Math.max(0, vh - EDGE_TAB.h))
export const defaultTabTop = (vh: number) => clampTabTop(vh - EDGE_TAB.h - 96, vh)

/**
 * The visible page area without scrollbars (fix F-10). `innerWidth` includes a classic scrollbar, which
 * put the edge tab and the docked pane under it. Falls back to the window size when the document
 * reports no layout (an empty page or a test DOM).
 */
export function viewportSize(doc: Document = document, win: Window = window): { w: number; h: number } {
  const el = doc.documentElement
  return { w: el.clientWidth || win.innerWidth, h: el.clientHeight || win.innerHeight }
}
