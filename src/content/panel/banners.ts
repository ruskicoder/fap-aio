// Banner slot above the panel's tabs: modules register a component that decides itself whether to show
// (for example the one-time legacy cleanup offer, core R12.1).
import { useSyncExternalStore, type ComponentType } from 'react'

const banners: ComponentType[] = []
const listeners = new Set<() => void>()

export function registerBanner(c: ComponentType): void {
  if (banners.includes(c)) return
  banners.push(c)
  for (const l of listeners) l()
}
export function clearBanners(): void {
  banners.length = 0
}
let snapshot: ComponentType[] = []
export function useBanners(): ComponentType[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => {
    if (snapshot.length !== banners.length) snapshot = [...banners]
    return snapshot
  })
}
