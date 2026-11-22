// Grade settings (grades R2.3, R7.1, R7.2, R7.7, R5.8; design "Settings added"; panel-ux R8.1):
// `grades.defaultTier`, `grades.nonGpa` and `grades.gpaGoal` are registry settings in the `settings`
// store; per-course goals and MOOC completion live in `grades.settings`. Every change is read back at
// once by `useGradeSettings`, so views recompute without a reload.
import { createElement, useEffect, useState } from 'react'
import { read, subscribe, update } from '../../shared/storage/catalog'
import { registerSetting } from '../../content/panel/settings/registry'
import { DEFAULT_NON_GPA } from './engine/gpa'
import { DEFAULT_TIER } from './engine/goals'
import { TIERS, type TierId } from './engine/predict'
import { MoocRow, NonGpaRow } from './settings-rows'
import { DEFAULT_SCALE, SCALE_LABELS, type GpaScale } from './engine/scale'
import { SCALE_KEY } from './scale-setting'

export interface GradeStore {
  /** Per-course tier, by FAP course id (R7.2). */
  courseGoals: Record<string, TierId>
  /** MOOCs completed on time, by FAP course id (R5.8). */
  moocDone: Record<string, boolean>
}

declare module '../../shared/storage/catalog' {
  interface StoreMap { 'grades.settings': GradeStore }
}

export interface GradeSettings extends GradeStore {
  defaultTier: TierId
  nonGpa: string[]
  gpaGoal: number | null
}

export const KEYS = { defaultTier: 'grades.defaultTier', nonGpa: 'grades.nonGpa', gpaGoal: 'grades.gpaGoal', mooc: 'grades.moocDone' } as const
const TIER_IDS = Object.keys(TIERS) as TierId[]
const TIER_LABELS: Record<TierId, string> = { pass: 'Pass', fair: 'Fair', good: 'Good', excellent: 'Excellent' }

/** Entries are prefixes compared case-insensitively; no wildcards (constraints.md). */
export function validateNonGpa(list: string[]): string | null {
  if (!Array.isArray(list) || !list.every((x) => typeof x === 'string')) return 'not a list of codes'
  if (list.length > 50) return 'Keep the list to 50 entries or fewer.'
  const bad = list.find((e) => !/^[\p{L}\p{N}]{1,12}$/u.test(e))
  return bad ? `"${bad}" is not a code prefix: use letters and digits only, up to 12.` : null
}

export function validateGpaGoal(v: number | null): string | null {
  if (v === null) return null
  return v >= 0 && v <= 10 ? null : 'Enter a GPA from 0 to 10, or leave it empty.'
}

export function registerGradeSettings(): void {
  registerSetting<TierId>({
    key: KEYS.defaultTier, section: 'grades', type: 'select', default: DEFAULT_TIER,
    options: TIER_IDS.map((t) => ({ value: t, label: `${TIER_LABELS[t]} (${TIERS[t]})` })),
    label: 'Default goal',
    description: 'The tier every course aims for unless you set its own goal.',
  })
  registerSetting<string[]>({
    key: KEYS.nonGpa, section: 'grades', type: 'custom', default: [...DEFAULT_NON_GPA], validate: validateNonGpa,
    label: 'Not counted in GPA',
    description: 'Subject codes that start with one of these, upper or lower case, are left out of GPA.',
    component: NonGpaRow,
  })
  registerSetting<GpaScale>({
    key: SCALE_KEY, section: 'grades', type: 'select', default: DEFAULT_SCALE,
    options: (['10', '4'] as const).map((v) => ({ value: v, label: SCALE_LABELS[v] })),
    validate: (v) => (v === '10' || v === '4' ? null : 'Choose the 10-point or the 4-point scale.'),
    label: 'GPA scale',
    description: 'Show GPA on the 10-point scale FAP uses, or on the 4-point scale through letter grades.',
  })
  registerSetting<number | null>({
    key: KEYS.gpaGoal, section: 'grades', type: 'number', default: null, min: 0, max: 10, step: 0.01, validate: validateGpaGoal,
    label: 'GPA goal',
    description: 'The cumulative GPA you aim for; empty means no goal.',
  })
  registerSetting<null>({
    key: KEYS.mooc, section: 'grades', type: 'custom', default: null, transfer: false,
    label: 'MOOCs completed on time',
    description: 'Tick a course when its MOOCs are done before the final exam, to count the 1 point bonus early.',
    component: () => createElement(MoocRow),
  })
}

const EMPTY: GradeStore = { courseGoals: {}, moocDone: {} }

export async function readGradeSettings(): Promise<GradeSettings> {
  const [all, store] = await Promise.all([read('settings'), read('grades.settings')])
  const s = all ?? {}
  const tier = s[KEYS.defaultTier]
  const goal = s[KEYS.gpaGoal]
  return {
    defaultTier: TIER_IDS.includes(tier as TierId) ? (tier as TierId) : DEFAULT_TIER,
    nonGpa: Array.isArray(s[KEYS.nonGpa]) ? (s[KEYS.nonGpa] as string[]) : [...DEFAULT_NON_GPA],
    gpaGoal: typeof goal === 'number' ? goal : null,
    ...EMPTY,
    ...(store ?? {}),
  }
}

export function setCourseGoal(courseId: string, tier: TierId | null): Promise<GradeStore> {
  return update('grades.settings', (old) => {
    const courseGoals = { ...(old?.courseGoals ?? {}) }
    if (tier) courseGoals[courseId] = tier
    else delete courseGoals[courseId]
    return { ...EMPTY, ...old, courseGoals }
  })
}

export function setMoocDone(courseId: string, done: boolean): Promise<GradeStore> {
  return update('grades.settings', (old) => ({ ...EMPTY, ...old, moocDone: { ...(old?.moocDone ?? {}), [courseId]: done } }))
}

/** Grade settings that follow every change at once (R2.3: recompute immediately). */
export function useGradeSettings(): GradeSettings | null {
  const [s, setS] = useState<GradeSettings | null>(null)
  useEffect(() => {
    let live = true
    const load = () => void readGradeSettings().then((v) => { if (live) setS(v) })
    load()
    const a = subscribe('settings', load)
    const b = subscribe('grades.settings', load)
    return () => { live = false; a(); b() }
  }, [])
  return s
}
