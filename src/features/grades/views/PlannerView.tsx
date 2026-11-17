// Grades, Planner (grades R10.1 to R10.3): a target cumulative GPA and the remaining credits give the
// average needed over them; the credits default to the curriculum subjects not passed, minus the non-GPA
// list. Above 10 the target is reported unreachable with the highest reachable GPA. Nothing is saved.
import { useEffect, useState } from 'react'
import { Empty, Message, button, primary } from '../../scheduler/views/common'
import { read } from '../../../content/fap/registry'
import { errorText } from '../../../content/panel/errors'
import { computeGpa, formatGpa } from '../engine/gpa'
import { PASS_MARK, defaultRemaining, planTarget } from '../engine/whatif'
import { useGradeSettings } from '../settings'
import { parseMark, useTranscript } from './use-transcript'
import { INFO_CURRICULUM } from '../../info/sources'
import type { CurriculumRow } from '../../info/types'

const field = 'h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 aria-[invalid=true]:border-red-500'

export function PlannerView() {
  const settings = useGradeSettings()
  const { t, busy, error, load } = useTranscript('grades/planner')
  const [curriculum, setCurriculum] = useState<CurriculumRow[] | null>(null)
  const [curError, setCurError] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [credits, setCredits] = useState<string | null>(null)
  useEffect(() => {
    void read<CurriculumRow[]>(INFO_CURRICULUM, {}, { priority: 'user' })
      .then((r) => (r.ok ? setCurriculum(r.value) : setCurError(errorText(r.error))))
      .catch((e: unknown) => setCurError(String(e)))
  }, [])

  if (!t || !settings) {
    return (
      <div className="pb-3">
        {error && <div className="px-3 pt-2.5"><Message tone="error">{error}</Message></div>}
        {!busy && !error && (
          <Empty title="No transcript read yet">
            <button type="button" className={primary} onClick={() => void load(true)}>Read the transcript</button>
          </Empty>
        )}
      </div>
    )
  }

  const g = computeGpa({ rows: t.rows, nonGpa: settings.nonGpa })
  const def = curriculum ? defaultRemaining(curriculum, t.rows, settings.nonGpa) : null
  const targetText = target ?? (settings.gpaGoal !== null ? settings.gpaGoal.toFixed(2) : '')
  const creditsText = credits ?? (def ? String(def.credits) : '')
  const goal = parseMark(targetText)
  const n = Number(creditsText)
  const remaining = creditsText.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 300 ? n : null
  const plan = goal !== null && remaining !== null ? planTarget({ target: goal, done: { credits: g.credits, points: (g.cumulative ?? 0) * g.credits }, remaining }) : null

  return (
    <div className="pb-3">
      <p className="px-3 pb-1 pt-2.5 text-xs text-gray-600">Now {formatGpa(g.cumulative) ?? 'no GPA yet'} over {g.credits} counted credits. Nothing here is saved.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-3 py-1">
        <label className="flex items-center gap-2 text-sm text-gray-700">Target GPA
          <input type="number" inputMode="decimal" min={0} max={10} step={0.01} className={`${field} w-20`} aria-invalid={targetText.trim() !== '' && goal === null} value={targetText} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">Remaining credits
          <input type="number" inputMode="numeric" min={0} max={300} step={1} className={`${field} w-20`} aria-invalid={creditsText.trim() !== '' && remaining === null} value={creditsText} onChange={(e) => setCredits(e.target.value)} />
        </label>
      </div>
      <div className="px-3 text-xs text-gray-600">
        {def && <p>From your curriculum: {def.credits} credits not passed yet, without the non-GPA subjects.{def.unknown.length > 0 ? ` Credits unknown for ${def.unknown.join(', ')}.` : ''}</p>}
        {!def && curError && <p>The curriculum could not be read ({curError}); enter the remaining credits.</p>}
        {!def && !curError && <p>Reading the curriculum for the remaining credits.</p>}
        {def && credits !== null && credits !== String(def.credits) && <button type="button" className={`${button} mt-1`} onClick={() => setCredits(null)}>Use the curriculum credits</button>}
      </div>
      {plan && goal !== null && remaining !== null && (
        <div role="status" aria-live="polite" className={`mx-3 mt-2 rounded-lg border px-3 py-2 text-sm ${plan.reachable ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
          {plan.needed === null && <p>{plan.reachable ? `With no credits left, your GPA already meets ${goal.toFixed(2)}.` : `With no credits left, your GPA stays under ${goal.toFixed(2)}.`}</p>}
          {plan.needed !== null && plan.reachable && plan.needed > PASS_MARK && <p>You need an average of <b className="font-semibold">{(Math.ceil(plan.needed * 100 - 1e-6) / 100).toFixed(2)}</b> over {remaining} credits to reach {goal.toFixed(2)}.</p>}
          {plan.needed !== null && plan.reachable && plan.needed <= PASS_MARK && <p>Passing every remaining course (5.0 or more) is enough to reach {goal.toFixed(2)}.</p>}
          {!plan.reachable && plan.needed !== null && <p>{goal.toFixed(2)} is not reachable: it needs an average of {plan.needed.toFixed(2)} over {remaining} credits, above 10. The highest reachable GPA is {formatGpa(plan.highest)}.</p>}
        </div>
      )}
    </div>
  )
}
