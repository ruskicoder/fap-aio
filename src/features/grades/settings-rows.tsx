// Custom Settings rows for grades: the non-GPA list with a reset to the default (R2.3), and MOOC
// completion per current course that grants a MOOC bonus (R5.8).
import { useEffect, useState } from 'react'
import type { SettingDef } from '../../content/panel/settings/registry'
import { peek } from '../../content/fap/registry'
import { dataClient } from '../../content/data-client'
import { useStore } from '../../content/panel/use-store'
import { DEFAULT_NON_GPA } from './engine/gpa'
import { GRADES_TERM_COURSES } from './sources'
import type { CourseRef, TermCourses } from './types'
import { setMoocDone } from './settings'

const quiet = 'inline-flex h-control items-center rounded border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'

export function NonGpaRow({ def, value, set }: { def: SettingDef<string[]>; value: string[]; set: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  useEffect(() => setText(value.join(', ')), [value])
  const commit = (t: string) => set(t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))
  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_NON_GPA)
  return (
    <div className="flex flex-col gap-1.5">
      <textarea aria-label={def.label} rows={2} className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        value={text} onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)} />
      <p className="text-[11px] text-gray-500">Separate entries with commas. Changes apply when you leave the field.</p>
      <div><button type="button" className={quiet} disabled={isDefault} onClick={() => set([...DEFAULT_NON_GPA])}>Reset to default</button></div>
    </div>
  )
}

/** Current-term courses whose syllabus grants a MOOC bonus, from the cached grade page and the rubric. */
function useMoocCourses(): CourseRef[] | null {
  const [list, setList] = useState<CourseRef[] | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      const cached = await peek<TermCourses>(GRADES_TERM_COURSES, {})
      const courses = (cached?.value.courses ?? []).filter((c) => c.code)
      if (!courses.length) { if (live) setList([]); return }
      const r = await dataClient().rules(courses.map((c) => c.code!))
      const bonus = r.ok ? courses.filter((c) => r.value.subjects[c.code!]?.coursera.bonus) : []
      if (live) setList(bonus)
    })()
    return () => { live = false }
  }, [])
  return list
}

export function MoocRow() {
  const courses = useMoocCourses()
  const done = useStore('grades.settings').data?.moocDone ?? {}
  if (courses === null) return null
  if (!courses.length) return <p className="text-xs text-gray-600">No current course grants a MOOC bonus. Courses appear here after the grade page has been read.</p>
  return (
    <ul className="flex flex-col">
      {courses.map((c) => (
        <li key={c.id}>
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-gray-900">
            <input type="checkbox" className="h-4 w-4 accent-orange-600" checked={done[c.id] === true} onChange={(e) => void setMoocDone(c.id, e.target.checked)} />
            <span className="break-words">{c.label}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}
