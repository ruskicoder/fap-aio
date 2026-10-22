// Registered migration steps. Imported by the service worker, which runs them on update.
import { addMigration } from './migrations'
import type { PanelState, Route } from '../panel-state'

/** Core panel state v1 `{ x, y, width, height, minimized, view }` to the panel-ux v2 schema. */
export function panelStateV1toV2(v1: { x?: number; y?: number; width?: number; height?: number; minimized?: boolean; view?: string }): PanelState {
  const views: Record<string, Route> = {
    schedule: { tab: 'schedule', sub: 'week' },
    week: { tab: 'schedule', sub: 'week' },
    sessions: { tab: 'schedule', sub: 'week' },
    exams: { tab: 'schedule', sub: 'exams' },
    export: { tab: 'schedule', sub: 'export' },
    settings: { overlay: 'settings' },
  }
  return {
    mode: 'floating',
    floating: { x: v1.x ?? 0, y: v1.y ?? 72, width: v1.width ?? 400, height: v1.height ?? 600 },
    dockedWidth: 400,
    collapsed: !!v1.minimized,
    route: views[v1.view ?? ''] ?? { tab: 'today' },
    density: 'comfortable',
  }
}

export function registerMigrationSteps(): void {
  addMigration('panel.state', 1, panelStateV1toV2)
}
