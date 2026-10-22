// Feature module contract (core design, "Bootstrap"). Modules add themselves with addModule;
// the bootstrap registers their sources and runs their page hooks on every FAP page.

export interface PageContext {
  path: string
  doc: Document
}

export interface FeatureModule {
  id: 'scheduler' | 'grades' | 'info' | 'appearance' | 'settings' | 'legacy' | 'core'
  /** Registers data sources with the core registry (CORE-3). */
  registerSources?(): void
  /** Registers panel views (panel-ux view registry). */
  registerViews?(): void
  /** Inline page enhancements (grades, appearance). */
  onPage?(ctx: PageContext): void | Promise<void>
}

export const modules: FeatureModule[] = []

export function addModule(m: FeatureModule): void {
  if (!modules.some((x) => x.id === m.id)) modules.push(m)
}

type Hook = (ctx: PageContext) => void | Promise<void>
/** Boot phases: `mount` shows the panel (CORE-4), `resume` continues a range sync (CORE-5). */
export const bootHooks: Record<'mount' | 'resume', Hook[]> = { mount: [], resume: [] }
export const onBoot = (phase: 'mount' | 'resume', h: Hook) => void bootHooks[phase].push(h)
