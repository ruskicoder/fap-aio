// Panel preferences (panel-ux design, PanelPrefs) under `panel.prefs`.
import { z } from 'zod'
import { read, update } from './storage/catalog'

export const PanelPrefsSchema = z.object({
  pageAware: z.boolean(),
  keybinds: z.record(z.string()),
  recents: z.array(z.string()),
  firstRun: z.enum(['pending', 'done']),
  /** While docked: narrow the FAP page or cover it (panel-ux R1.5). */
  docked: z.enum(['narrow', 'cover']).default('narrow'),
})
export type PanelPrefs = z.infer<typeof PanelPrefsSchema>

declare module './storage/catalog' {
  interface StoreMap { 'panel.prefs': PanelPrefs }
}

export const defaultPrefs = (): PanelPrefs => ({ pageAware: true, keybinds: {}, recents: [], firstRun: 'pending', docked: 'narrow' })

export async function readPrefs(): Promise<PanelPrefs> {
  const p = PanelPrefsSchema.safeParse(await read('panel.prefs'))
  return p.success ? p.data : defaultPrefs()
}

export function updatePrefs(fn: (p: PanelPrefs) => PanelPrefs): Promise<PanelPrefs> {
  return update('panel.prefs', (old) => {
    const p = PanelPrefsSchema.safeParse(old)
    return fn(p.success ? p.data : defaultPrefs())
  })
}
