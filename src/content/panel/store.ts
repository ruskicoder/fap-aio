// Panel state persistence: read once at mount, debounced writes (250 ms) through the catalog.
import { write } from '../../shared/storage/catalog'
import { readMigrated } from '../../shared/storage/migrations'
import { PanelStateSchema, defaultPanelState, type PanelState } from '../../shared/panel-state'

declare module '../../shared/storage/catalog' {
  interface StoreMap { 'panel.state': PanelState }
}

export const SAVE_DEBOUNCE_MS = 250

export async function loadPanelState(viewport: { width: number; height: number }): Promise<PanelState> {
  const raw = await readMigrated('panel.state')
  const parsed = PanelStateSchema.safeParse(raw)
  return parsed.success ? parsed.data : defaultPanelState(viewport)
}

let timer: ReturnType<typeof setTimeout> | undefined
let pending: PanelState | null = null
export function savePanelState(s: PanelState): void {
  pending = s
  clearTimeout(timer)
  timer = setTimeout(() => void flushPanelState(), SAVE_DEBOUNCE_MS)
}

export async function flushPanelState(): Promise<void> {
  clearTimeout(timer)
  if (!pending) return
  const s = pending
  pending = null
  await write('panel.state', s)
}
