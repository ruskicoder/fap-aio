// The GPA scale setting (grades R13.1, R13.5; GRD-7.1): `grades.gpaScale` in the `settings` store, shown in
// the Grades settings section and as the chips of the GPA view. Kept apart from readGradeSettings so the
// prediction and goal code, which works on the 10-point scale only, is unchanged.
import { useEffect, useState } from 'react'
import { subscribe } from '../../shared/storage/catalog'
import { getSetting, setSettings } from '../../shared/settings'
import { DEFAULT_SCALE, isScale, type GpaScale } from './engine/scale'

export const SCALE_KEY = 'grades.gpaScale'

export async function readGpaScale(): Promise<GpaScale> {
  const v = await getSetting<unknown>(SCALE_KEY, DEFAULT_SCALE)
  return isScale(v) ? v : DEFAULT_SCALE
}

export const setGpaScale = (scale: GpaScale) => setSettings({ [SCALE_KEY]: scale })

/** The chosen scale, following every change at once (R13.5). Null until it is read. */
export function useGpaScale(): GpaScale | null {
  const [s, setS] = useState<GpaScale | null>(null)
  useEffect(() => {
    let live = true
    const load = () => void readGpaScale().then((v) => { if (live) setS(v) })
    load()
    const off = subscribe('settings', load)
    return () => { live = false; off() }
  }, [])
  return s
}
