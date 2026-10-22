// Panel preferences (panel-ux design, PanelPrefs) under `panel.prefs`.
import { z } from 'zod'
import { read, update } from './storage/catalog'

export const PanelPrefsSchema = z.object({
  pageAware: z.boolean(),
  keybinds: z.record(z.string()),
  recents: z.array(z.string()),
  firstRun: z.enum(['pending', 'done']),
})
export type PanelPrefs = z.infer<typeof PanelPrefsSchema>

declare module './storage/catalog' {
  interface StoreMap { 'panel.prefs': PanelPrefs }
}

export const defaultPrefs = (): PanelPrefs => ({ pageAware: true, keybinds: {}, recents: [], firstRun: 'pending' })

export async function readPrefs(): Promise<PanelPrefs> {
  const p = PanelPrefsSchema.safeParse(await read('panel.prefs'))
  return p.success ? p.data : defaultPrefs()
}

export function updatePrefs(fn: (p: PanelPrefs) => PanelPrefs): Promise<PanelPrefs> {
  return update('panel.prefs', (old) => fn(PanelPrefsSchema.safeParse(old).success ? old! : defaultPrefs()))
}
