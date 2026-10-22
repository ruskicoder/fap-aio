// Panel root (core R1.2 to R1.5, R1.8): drag on the header with viewport clamping, minimize to a
// 40 px handle restored by click or Enter. Layout, tabs and views are added by panel-ux.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { clampRect, type PanelState } from '../../shared/panel-state'
import { savePanelState } from './store'

export interface PanelAppProps {
  initial: PanelState
  host: HTMLElement
  children?: ReactNode
  onState?: (s: PanelState) => void
}

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight })

export function PanelApp({ initial, host, children, onState }: PanelAppProps) {
  const [state, setState] = useState<PanelState>(() => ({ ...initial, floating: clampRect(initial.floating, viewport().w, viewport().h) }))
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  const update = useCallback((fn: (s: PanelState) => PanelState) => {
    setState((s) => {
      const next = fn(s)
      savePanelState(next)
      onState?.(next)
      return next
    })
  }, [onState])

  // Position the host with CSSOM (allowed under FAP's style-src CSP).
  useEffect(() => {
    const r = state.collapsed ? { ...state.floating, width: 40, height: 40 } : state.floating
    host.style.setProperty('left', `${r.x}px`)
    host.style.setProperty('top', `${r.y}px`)
    host.style.setProperty('width', `${r.width}px`)
    host.style.setProperty('height', `${r.height}px`)
  }, [host, state.floating, state.collapsed])

  useEffect(() => {
    const onResize = () => update((s) => ({ ...s, floating: clampRect(s.floating, viewport().w, viewport().h) }))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [update])

  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { dx: e.clientX - state.floating.x, dy: e.clientY - state.floating.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    update((s) => ({ ...s, floating: clampRect({ ...s.floating, x: e.clientX - d.dx, y: e.clientY - d.dy }, viewport().w, viewport().h) }))
  }
  const onPointerUp = (e: RPointerEvent<HTMLElement>) => {
    drag.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  if (state.collapsed) {
    return (
      <button
        type="button"
        aria-label="Restore FAP-AIO panel"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 font-bold text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        onClick={() => update((s) => ({ ...s, collapsed: false }))}
      >
        F
      </button>
    )
  }

  return (
    <section aria-label="FAP-AIO" className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
      <header
        role="toolbar"
        aria-label="Panel header"
        className="flex h-10 shrink-0 cursor-move select-none items-center gap-2 border-b border-gray-200 px-3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="flex-1 font-semibold">FAP-AIO</span>
        <button
          type="button"
          aria-label="Minimize panel"
          className="h-6 w-6 rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2"
          onClick={() => update((s) => ({ ...s, collapsed: true }))}
        >
          –
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  )
}
