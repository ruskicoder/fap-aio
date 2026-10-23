// Reads a catalog store and follows its changes from any context (storage.onChanged).
import { useEffect, useState } from 'react'
import { read, subscribe, type StoreKey, type StoreMap } from '../../shared/storage/catalog'

export function useStore<K extends StoreKey & keyof StoreMap>(key: K): { data: StoreMap[K] | null; loading: boolean } {
  const [state, setState] = useState<{ data: StoreMap[K] | null; loading: boolean }>({ data: null, loading: true })
  useEffect(() => {
    let live = true
    void read(key).then((d) => { if (live) setState({ data: d as StoreMap[K] | null, loading: false }) })
    const off = subscribe(key, (d) => setState({ data: d as StoreMap[K] | null, loading: false }))
    return () => { live = false; off() }
  }, [key])
  return state
}
