// PanelShell (panel-ux R1.1 to R1.9, R2.3, R2.4; agreed visual ui/shell.html): a floating card or a
// docked full-height pane. The whole header drags, the floating panel resizes from every edge and
// corner and never leaves the viewport, minimize leaves a draggable edge tab, and docking narrows
// the FAP page unless the user chose to cover it.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import type { PanelState } from '../../shared/panel-state'
import { savePanelState } from './store'
import { useStore } from './use-store'
import { setPageDock } from './page-dock'
import { Icon } from './icons'
import {
  DRAWER_BELOW, EDGE_TAB, UNDOCK_PX, bottomRight, clampDockWidth, clampFloating, clampTabTop, defaultTabTop, moveRect, resizeRect,
  type Dir, type Rect,
} from './geometry'

export { clampFloating, LIMITS } from './geometry'

export interface PanelAppProps {
  initial: PanelState
  host: HTMLElement
  /** Shown as subtext under the title (R2.3). */
  version?: string
  /** Navigation and the view outlet. */
  children?: ReactNode
  /** The status strip, always at the bottom (R2.6). */
  status?: ReactNode
  syncing?: boolean
  onSync?: () => void
  onSettings?: () => void
  onState?: (s: PanelState) => void
  /** Exposes the state updater to the host (toggle command, router). */
  bind?: (update: (fn: (s: PanelState) => PanelState) => void) => void
}

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight })
const btn = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

const HANDLES: [Dir, string][] = [
  ['n', 'top-0 inset-x-3 h-1.5 cursor-ns-resize'], ['s', 'bottom-0 inset-x-3 h-1.5 cursor-ns-resize'],
  ['e', 'right-0 inset-y-3 w-1.5 cursor-ew-resize'], ['w', 'left-0 inset-y-3 w-1.5 cursor-ew-resize'],
  ['nw', 'left-0 top-0 h-3 w-3 cursor-nwse-resize'], ['ne', 'right-0 top-0 h-3 w-3 cursor-nesw-resize'],
  ['sw', 'left-0 bottom-0 h-3 w-3 cursor-nesw-resize'], ['se', 'right-0 bottom-0 h-3 w-3 cursor-nwse-resize'],
]

type Op =
  | { kind: 'move'; x0: number; y0: number; r: Rect }
  | { kind: 'resize'; dir: Dir; x0: number; y0: number; r: Rect; dockW: number }

export function PanelApp({ initial, host, version = '', children, status, syncing = false, onSync, onSettings, onState, bind }: PanelAppProps) {
  const [vp, setVp] = useState(viewport)
  const [state, setState] = useState<PanelState>(() => ({ ...initial, floating: clampFloating(initial.floating, vp.w, vp.h) }))
  const [dragging, setDragging] = useState(false)
  const prefs = useStore('panel.prefs')
  const op = useRef<Op | null>(null)
  const tabDrag = useRef<{ y0: number; top0: number; moved: boolean } | null>(null)
  const tabMoved = useRef(false)

  const update = useCallback((fn: (s: PanelState) => PanelState) => {
    setState((s) => {
      const next = fn(s)
      if (next !== s) {
        savePanelState(next)
        onState?.(next)
      }
      return next
    })
  }, [onState])
  useEffect(() => bind?.(update), [bind, update])

  const docked = state.mode === 'docked'
  const drawer = docked && vp.w < DRAWER_BELOW
  const dockW = clampDockWidth(state.dockedWidth, vp.w)
  const tabTop = clampTabTop(state.edgeTabTop ?? defaultTabTop(vp.h), vp.h)
  const cover = prefs.data?.docked === 'cover'

  // Position the host through CSSOM, which FAP's style-src CSP allows.
  useEffect(() => {
    const r = state.collapsed ? { x: vp.w - EDGE_TAB.w, y: tabTop, width: EDGE_TAB.w, height: EDGE_TAB.h }
      : drawer ? { x: 0, y: 0, width: vp.w, height: vp.h }
        : docked ? { x: vp.w - dockW, y: 0, width: dockW, height: vp.h }
          : state.floating
    host.style.setProperty('left', `${r.x}px`)
    host.style.setProperty('top', `${r.y}px`)
    host.style.setProperty('width', `${r.width}px`)
    host.style.setProperty('height', docked && !state.collapsed ? '100vh' : `${r.height}px`)
  }, [host, vp, state.collapsed, state.floating, docked, drawer, dockW, tabTop])

  // Narrow the page while docked (R1.5), not in the drawer (R1.9), not when the user chose cover.
  useEffect(() => {
    setPageDock(docked && !state.collapsed && !drawer && !cover ? dockW : null)
  }, [docked, state.collapsed, drawer, cover, dockW])
  useEffect(() => () => setPageDock(null), [])

  useEffect(() => {
    const onResize = () => {
      const v = viewport()
      setVp(v)
      update((s) => ({ ...s, floating: clampFloating(s.floating, v.w, v.h) }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [update])

  const collapse = useCallback(() => update((s) => ({ ...s, collapsed: true })), [update])
  useEffect(() => {
    if (!drawer || state.collapsed) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, state.collapsed, collapse])

  const open = () => update((s) => ({ ...s, collapsed: false, floating: s.mode === 'floating' ? bottomRight(s.floating, vp.w, vp.h) : s.floating }))
  const toggleDock = () => update((s) => ({ ...s, mode: s.mode === 'docked' ? 'floating' : 'docked' }))

  const onDown = (e: RPointerEvent<HTMLElement>) => {
    const t = e.target as HTMLElement
    const handle = t.closest<HTMLElement>('[data-dir]')
    if (handle) op.current = { kind: 'resize', dir: handle.dataset.dir as Dir, x0: e.clientX, y0: e.clientY, r: state.floating, dockW }
    else if (t.closest('[data-drag]') && !t.closest('button')) op.current = { kind: 'move', x0: e.clientX, y0: e.clientY, r: state.floating }
    else return
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }
  const onMove = (e: RPointerEvent<HTMLElement>) => {
    const o = op.current
    if (!o) return
    const dx = e.clientX - o.x0
    const dy = e.clientY - o.y0
    if (o.kind === 'move') {
      if (state.mode === 'docked') {
        if (dx > -UNDOCK_PX || drawer) return
        // Undock at the pointer (R1.3) and keep dragging the floating panel.
        const r = clampFloating({ ...state.floating, x: e.clientX - state.floating.width / 2, y: e.clientY - 20 }, vp.w, vp.h)
        op.current = { kind: 'move', x0: e.clientX, y0: e.clientY, r }
        update((s) => ({ ...s, mode: 'floating', floating: r }))
      } else update((s) => ({ ...s, floating: moveRect(o.r, dx, dy, vp.w, vp.h) }))
    } else if (state.mode === 'docked') update((s) => ({ ...s, dockedWidth: clampDockWidth(o.dockW - dx, vp.w) }))
    else update((s) => ({ ...s, floating: resizeRect(o.r, o.dir, dx, dy, vp.w, vp.h) }))
  }
  const onUp = (e: RPointerEvent<HTMLElement>) => {
    op.current = null
    setDragging(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  if (state.collapsed) {
    const tabDown = (e: RPointerEvent<HTMLButtonElement>) => {
      tabDrag.current = { y0: e.clientY, top0: tabTop, moved: false }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    const tabMove = (e: RPointerEvent<HTMLButtonElement>) => {
      const d = tabDrag.current
      if (!d) return
      const dy = e.clientY - d.y0
      if (Math.abs(dy) > 3) d.moved = true
      if (d.moved) update((s) => ({ ...s, edgeTabTop: clampTabTop(d.top0 + dy, vp.h) }))
    }
    const tabUp = (e: RPointerEvent<HTMLButtonElement>) => {
      tabMoved.current = !!tabDrag.current?.moved
      tabDrag.current = null
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    }
    const tabClick = () => {
      if (tabMoved.current) { tabMoved.current = false; return }
      open()
    }
    const tabKey = (e: RKeyboardEvent<HTMLButtonElement>) => {
      const step = e.key === 'ArrowUp' ? -16 : e.key === 'ArrowDown' ? 16 : 0
      if (!step) return
      e.preventDefault()
      update((s) => ({ ...s, edgeTabTop: clampTabTop(tabTop + step, vp.h) }))
    }
    return (
      <button type="button" aria-label="Open FAP-AIO panel" title="Click to open, drag to move"
        onPointerDown={tabDown} onPointerMove={tabMove} onPointerUp={tabUp} onClick={tabClick} onKeyDown={tabKey}
        className="flex h-full w-full cursor-pointer touch-none select-none flex-col items-center justify-center gap-1.5 rounded-l-lg border border-r-0 border-orange-300 bg-orange-100 text-orange-900 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
        <Icon name="grip" size={14} />
        <span className="text-xs font-semibold [writing-mode:vertical-rl]">FAP-AIO</span>
      </button>
    )
  }

  const panel = (
    <section aria-label="FAP-AIO" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      className={`relative flex h-full w-full flex-col overflow-hidden border border-gray-300 bg-white shadow-xl ${docked ? 'border-y-0 border-r-0' : 'rounded-lg'}`}>
      <header data-drag="" className={`flex h-[50px] shrink-0 touch-none select-none items-center gap-1 border-b border-gray-200 bg-gray-50 pl-3.5 pr-2 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-base font-semibold text-gray-900">FAP-AIO</div>
          {version && <div className="text-xs text-gray-500">v{version}</div>}
        </div>
        <button type="button" aria-label="Sync this week and exams" title="Sync this week and exams" aria-busy={syncing} className={btn} onClick={onSync}>
          <Icon name="refresh" className={syncing ? 'animate-spin motion-reduce:animate-none' : ''} />
        </button>
        <button type="button" aria-label={docked ? 'Undock panel' : 'Dock panel'} title={docked ? 'Undock' : 'Dock'} aria-pressed={docked}
          className={`${btn} ${docked ? 'bg-orange-100 text-orange-900' : ''}`} onClick={toggleDock}>
          <Icon name="dock" />
        </button>
        <button type="button" aria-label="Settings" title="Settings" className={btn} onClick={onSettings}><Icon name="settings" /></button>
        <button type="button" aria-label="Minimize panel" title="Minimize" className={btn} onClick={collapse}><Icon name="minus" /></button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {status}
      {HANDLES.filter(([d]) => (docked ? d === 'w' && !drawer : true)).map(([d, cls]) => (
        <div key={d} aria-hidden="true" data-dir={d} className={`absolute z-10 touch-none ${docked ? 'inset-y-0 left-0 w-1.5 cursor-ew-resize' : cls}`} />
      ))}
    </section>
  )

  if (drawer) {
    return (
      <div className="relative h-full w-full">
        <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={collapse} />
        <div className="absolute inset-y-0 right-0" style={{ width: dockW }}>{panel}</div>
      </div>
    )
  }
  return panel
}
