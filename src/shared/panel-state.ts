// Panel state schema v2 (panel-ux design, "Data Models"), stored under `panel.state`.
import { z } from 'zod'

export const RouteSchema = z.union([
  z.object({ tab: z.literal('today') }),
  z.object({ tab: z.literal('schedule'), sub: z.enum(['week', 'exams', 'export']), params: z.object({ date: z.string().optional() }).optional() }),
  z.object({ tab: z.literal('grades'), sub: z.enum(['courses', 'gpa', 'whatif', 'planner']), params: z.object({ courseId: z.string().optional() }).optional() }),
  z.object({ tab: z.literal('info'), sub: z.enum(['subjects', 'lecturers', 'news', 'status']), params: z.object({ id: z.string().optional() }).optional() }),
  z.object({ overlay: z.enum(['theme', 'settings', 'help', 'shortcuts']), section: z.string().optional() }),
])
export type Route = z.infer<typeof RouteSchema>

export const PanelStateSchema = z.object({
  mode: z.enum(['floating', 'docked']),
  floating: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  dockedWidth: z.number(),
  collapsed: z.boolean(),
  route: RouteSchema,
  density: z.enum(['comfortable', 'compact']),
  /** Minimized edge tab, px from the viewport top (panel-ux R1.6). */
  edgeTabTop: z.number().optional(),
})
export type PanelState = z.infer<typeof PanelStateSchema>

export const FLOATING_DEFAULT = { width: 400, height: 600 }
export const DOCKED_DEFAULT_WIDTH = 400

export function defaultPanelState(viewport = { width: 1280, height: 800 }): PanelState {
  return {
    mode: 'floating',
    // Bottom-right corner, 8 px from the edges (agreed shell, ui/shell.html).
    floating: { x: Math.max(0, viewport.width - FLOATING_DEFAULT.width - 8), y: Math.max(0, viewport.height - FLOATING_DEFAULT.height - 8), ...FLOATING_DEFAULT },
    dockedWidth: DOCKED_DEFAULT_WIDTH,
    collapsed: false,
    route: { tab: 'today' },
    density: 'comfortable',
  }
}

/** Keeps a floating rectangle fully inside the viewport (core R1.2, R1.5). */
export function clampRect<T extends { x: number; y: number; width: number; height: number }>(r: T, vw: number, vh: number): T {
  const width = Math.min(r.width, vw)
  const height = Math.min(r.height, vh)
  return { ...r, width, height, x: Math.min(Math.max(0, r.x), vw - width), y: Math.min(Math.max(0, r.y), vh - height) }
}
