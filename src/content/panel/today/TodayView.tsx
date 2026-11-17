// Today view (panel-ux R3.1 to R3.4): sections from the providers in the R3.1 order, empty ones hidden;
// a calm line when nothing needs attention; the last sync time and one Refresh for every source.
import { useEffect, useState } from 'react'
import type { PanelRouter } from '../router'
import { ago } from '../StatusStrip'
import { onProvidersChanged, refreshAll, todayProviders, type TodayItem, type TodayProvider } from './providers'
import { subscribe } from '../../../shared/storage/catalog'

export const CALM_TEXT = 'Nothing needs your attention today.'
export const NO_NEXT_CLASS = 'No upcoming class in your synced schedule.'

const TONES: Record<TodayItem['tone'], string> = {
  neutral: 'border-l-gray-300',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-600',
  success: 'border-l-green-600',
}
const refreshBtn = 'inline-flex h-control items-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

interface Loaded { provider: TodayProvider; items: TodayItem[] }

function useToday(): { sections: Loaded[]; syncedAt: number | null; now: number; providers: TodayProvider[] } {
  const [now, setNow] = useState(() => Date.now())
  const [version, setVersion] = useState(0)
  const [sections, setSections] = useState<Loaded[]>([])
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const providers = todayProviders()
  useEffect(() => onProvidersChanged(() => setVersion((v) => v + 1)), [])
  // Countdowns and "today" move with the clock.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const keys = [...new Set(todayProviders().flatMap((p) => p.keys ?? []))]
    const offs = keys.map((k) => subscribe(k, () => setVersion((v) => v + 1)))
    return () => offs.forEach((off) => off())
  }, [version])
  useEffect(() => {
    let live = true
    const list = todayProviders()
    void Promise.all(list.map(async (p) => ({ provider: p, items: await Promise.resolve(p.items({ now })).catch(() => []) }))).then((s) => { if (live) setSections(s) })
    void Promise.all(list.map((p) => p.syncedAt?.().catch(() => null) ?? null)).then((all) => {
      const known = all.filter((x): x is number => typeof x === 'number')
      if (live) setSyncedAt(known.length ? Math.max(...known) : null)
    })
    return () => { live = false }
  }, [now, version])
  return { sections, syncedAt, now, providers }
}

function Item({ item, router }: { item: TodayItem; router: PanelRouter }) {
  return (
    <li>
      <button type="button" onClick={() => router.go(item.link, { source: 'user' })}
        className={`mx-3 my-1.5 block w-[calc(100%-24px)] rounded-lg border border-l-4 border-gray-200 bg-white px-2.5 py-2 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${TONES[item.tone]}`}>
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug text-gray-900">{item.title}</span>
          {item.when && <span className="shrink-0 text-xs font-medium text-orange-700">{item.when}</span>}
        </span>
        {item.detail && <span className="mt-0.5 block break-words text-xs leading-relaxed text-gray-600">{item.detail}</span>}
      </button>
    </li>
  )
}

export function TodayView({ router }: { router: PanelRouter }) {
  const { sections, syncedAt, now, providers } = useToday()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canRefresh = providers.some((p) => p.refresh)
  const shown = sections.filter((s) => s.items.length)
  const calm = !shown.some((s) => s.provider.attention)
  const nextClass = sections.find((s) => s.provider.id === 'nextClass')
  const refresh = async () => {
    setBusy(true)
    setError(null)
    const r = await refreshAll()
    setBusy(false)
    if (!r.ok) setError(r.text ?? 'Refresh failed. Try again later.')
  }
  return (
    <div className="pb-3">
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <p className="min-w-0 flex-1 text-xs text-gray-600">{syncedAt != null ? `Synced ${ago(syncedAt, now)}` : 'Not synced yet'}</p>
        {canRefresh && <button type="button" className={refreshBtn} disabled={busy} aria-busy={busy} onClick={() => void refresh()}>{busy ? 'Refreshing' : 'Refresh'}</button>}
      </div>
      {error && <p role="alert" className="mx-3 my-1 rounded bg-red-50 px-2 py-1 text-xs text-red-800">{error}</p>}
      {calm && <p role="status" className="mx-3 my-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{CALM_TEXT}</p>}
      {calm && !nextClass?.items.length && <p className="mx-3 my-1 text-xs text-gray-600">{NO_NEXT_CLASS}</p>}
      {shown.map((s) => (
        <section key={s.provider.id} aria-labelledby={`aio-today-${s.provider.id}`}>
          <h3 id={`aio-today-${s.provider.id}`} className="px-3 pb-0.5 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.provider.label}</h3>
          <ul className="m-0 list-none p-0">{s.items.map((it) => <Item key={it.id} item={it} router={router} />)}</ul>
        </section>
      ))}
    </div>
  )
}
