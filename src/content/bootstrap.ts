// Content bootstrap (core design, "Content script lifecycle"): top-frame check, page guard,
// settings, panel mount, module registration, sync resume, then `tab-ready`.
import { isAuthenticatedPage } from './guard'
import { bootHooks, modules, type PageContext } from './modules'
import { announceReady } from './tab'
import { readMigrated } from '../shared/storage/migrations'
import { wireQueue } from './fap/queue'

export type BootResult = 'not-top-frame' | 'not-authenticated' | 'ready'

export async function bootstrap(win: Window = window): Promise<BootResult> {
  if (win.top !== win) return 'not-top-frame'
  const doc = win.document
  if (!isAuthenticatedPage(doc)) return 'not-authenticated'
  const ctx: PageContext = { path: win.location.pathname, doc }
  wireQueue()
  await readMigrated('settings')
  for (const h of bootHooks.mount) await h(ctx)
  for (const m of modules) {
    m.registerSources?.()
    m.registerViews?.()
  }
  for (const m of modules) await m.onPage?.(ctx)
  for (const h of bootHooks.resume) await h(ctx)
  announceReady()
  return 'ready'
}
