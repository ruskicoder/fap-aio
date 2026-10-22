// PanelShell (panel-ux R1.1, R1.4, R1.6, R1.7, R1.8, R2.3; core R1.2 to R1.5, R1.8): floating card
// or docked full-height pane, header controls, floating resize within the size limits, and the
// collapsed pill (floating) or 48 px rail (docked). Tabs, views and overlays plug in through props.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { clampRect, type PanelState } from '../../shared/panel-state'
import { savePanelState } from './store'

export const LIMITS = { floating: { minW: 320, maxW: 720, minH: 360 }, docked: { minW: 320, maxW: 640 }, rail: 48, pill: 40 }

export interface ShellSlots {
  unread?: number
  onPalette?: () => void
  onBell?: () => void
  onMenu?: (item: 'theme' | 'settings' | 'help' | 'shortcuts') => void
  railItems?: ReactNode
}

export interface PanelAppProps extends ShellSlots {
  initial: PanelState
  host: HTMLElement
  children?: ReactNode
  onState?: (s: PanelState) => void
  /** Exposes the state updater to the host (toggle command, router). */
  bind?: (update: (fn: (s: PanelState) => PanelState) => void) => void
}

const vp = () => ({ w: window.innerWidth, h: window.innerHeight })
const btn = 'inline-flex h-7 min-w-7 items-center justify-center rounded px-1 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

export function clampFloating(r: PanelState['floating'], w: number, h: number): PanelState['floating'] {
  const sized = {
    ...r,
    width: Math.min(Math.max(r.width, LIMITS.floating.minW), LIMITS.floating.maxW),
    height: Math.min(Math.max(r.height, LIMITS.floating.minH), h),
  }
  return clampRect(sized, w, h)
}

export function PanelApp({ initial, host, children, onState, bind, unread = 0, onPalette, onBell, onMenu, railItems }: PanelAppProps) {
  const [state, setState] = useState<PanelState>(() => ({ ...initial, floating: clampFloating(initial.floating, vp().w, vp().h) }))
  const [menuOpen, setMenuOpen] = useState(false)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

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

  // Position the host through CSSOM, which FAP's style-src CSP allows.
  useEffect(() => {
    const docked = state.mode === 'docked'
    const r = docked
      ? { x: vp().w - (state.collapsed ? LIMITS.rail : state.dockedWidth), y: 0, width: state.collapsed ? LIMITS.rail : state.dockedWidth, height: vp().h }
      : state.collapsed
        ? { ...state.floating, width: LIMITS.pill, height: LIMITS.pill }
        : state.floating
    host.style.setProperty('left', `${r.x}px`)
    host.style.setProperty('top', `${r.y}px`)
    host.style.setProperty('width', `${r.width}px`)
    host.style.setProperty('height', docked ? '100vh' : `${r.height}px`)
  }, [host, state.mode, state.floating, state.collapsed, state.dockedWidth])

  useEffect(() => {
    const onResize = () => update((s) => ({ ...s, floating: clampFloating(s.floating, vp().w, vp().h) }))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [update])

  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    if (state.mode !== 'floating' || (e.target as HTMLElement).closest('button')) return
    drag.current = { dx: e.clientX - state.floating.x, dy: e.clientY - state.floating.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (d) update((s) => ({ ...s, floating: clampFloating({ ...s.floating, x: e.clientX - d.dx, y: e.clientY - d.dy }, vp().w, vp().h) }))
  }
  const endDrag = (e: RPointerEvent<HTMLElement>) => {
    drag.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }
  const onGripDown = (e: RPointerEvent<HTMLElement>) => {
    resize.current = { x: e.clientX, y: e.clientY, w: state.floating.width, h: state.floating.height }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onGripMove = (e: RPointerEvent<HTMLElement>) => {
    const r = resize.current
    if (r) update((s) => ({ ...s, floating: clampFloating({ ...s.floating, width: r.w + e.clientX - r.x, height: r.h + e.clientY - r.y }, vp().w, vp().h) }))
  }
  const endGrip = (e: RPointerEvent<HTMLElement>) => {
    resize.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  const expand = () => update((s) => ({ ...s, collapsed: false }))
  const badge = unread > 0 ? <span className="ml-0.5 rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">{unread > 99 ? '99+' : unread}</span> : null

  if (state.collapsed && state.mode === 'floating') {
    return (
      <button type="button" aria-label={`Restore FAP-AIO panel${unread ? `, ${unread} unread alerts` : ''}`} onClick={expand}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 font-bold text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
        F{badge}
      </button>
    )
  }
  if (state.collapsed) {
    return (
      <nav aria-label="FAP-AIO rail" className="flex h-full w-12 flex-col items-center gap-2 border-l border-gray-200 bg-white py-2 shadow-xl">
        <button type="button" aria-label="Expand panel" className={btn} onClick={expand}>«</button>
        {railItems}
        <button type="button" aria-label={`Alerts, ${unread} unread`} className={btn} onClick={() => { expand(); onBell?.() }}>🔔{badge}</button>
      </nav>
    )
  }

  const menu: ['theme' | 'settings' | 'help' | 'shortcuts', string][] = [['theme', 'Theme'], ['settings', 'Settings'], ['help', 'Help'], ['shortcuts', 'Shortcuts']]
  return (
    <section aria-label="FAP-AIO" className={`relative flex h-full w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-xl ${state.mode === 'floating' ? 'rounded-lg' : ''}`}>
      <header role="toolbar" aria-label="Panel header" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag}
        className={`flex h-10 shrink-0 select-none items-center gap-1 border-b border-gray-200 px-2 ${state.mode === 'floating' ? 'cursor-move' : ''}`}>
        <span aria-hidden="true" className="text-gray-400">⠿</span>
        <span className="flex-1 truncate font-semibold">FAP-AIO</span>
        <button type="button" aria-label="Open command palette" className={btn} onClick={onPalette}>⌘K</button>
        <button type="button" aria-label={`Alerts, ${unread} unread`} className={btn} onClick={onBell}>🔔{badge}</button>
        <button type="button" aria-label={state.mode === 'docked' ? 'Undock panel' : 'Dock panel'} aria-pressed={state.mode === 'docked'} className={btn}
          onClick={() => update((s) => ({ ...s, mode: s.mode === 'docked' ? 'floating' : 'docked' }))}>⇥</button>
        <div className="relative">
          <button type="button" aria-label="Menu" aria-haspopup="menu" aria-expanded={menuOpen} className={btn} onClick={() => setMenuOpen((o) => !o)}>⚙</button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-8 z-10 w-36 rounded border border-gray-200 bg-white py-1 shadow-lg">
              {menu.map(([id, label]) => (
                <button key={id} role="menuitem" type="button" className="block w-full px-3 py-1.5 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  onClick={() => { setMenuOpen(false); onMenu?.(id) }}>{label}</button>
              ))}
            </div>
          )}
        </div>
        <button type="button" aria-label="Minimize panel" className={btn} onClick={() => update((s) => ({ ...s, collapsed: true }))}>–</button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {state.mode === 'floating' && (
        <div aria-hidden="true" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={endGrip}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize" />
      )}
    </section>
  )
}
