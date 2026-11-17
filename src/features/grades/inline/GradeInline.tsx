// GradeInline (grades R6.1 to R6.4, R4.9, R4.10, R5; design "Views"): on /Report/Grade a block in its
// own shadow root after the mark sheet card with the pass status, the current average, the scores needed
// for the selected tier and the warnings. The tier selector saves the course goal. A MutationObserver on
// #grade-report (150 ms debounce) follows FAP's partial swaps. FAP's cells are never changed.
import { createElement, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import css from '../../../content/panel/panel.css?inline'
import { dataClient } from '../../../content/data-client'
import { LayoutChangedError } from '../../../content/fap/registry'
import { loadCourseModel, weakGroups, type CourseModel, type RulesLookup } from '../engine/course-model'
import { predict, round1, TIERS, type Prediction, type TierId } from '../engine/predict'
import { courseGoal } from '../engine/goals'
import { parseMarkSheet } from '../parse/marksheet'
import { setCourseGoal, useGradeSettings } from '../settings'
import type { MarkSheet } from '../types'

export const HOST_ID = 'fap-aio-grade-inline'
export const DEBOUNCE_MS = 150
const INLINE_CSS = ':host{position:static;display:block;z-index:auto;margin:12px 0}'
const TIER_IDS = Object.keys(TIERS) as TierId[]
const TIER_LABELS: Record<TierId, string> = { pass: 'Pass', fair: 'Fair', good: 'Good', excellent: 'Excellent' }
export const FLAG_TEXT: Record<string, string> = {
  'unmatched-groups': 'Some mark groups have no FLM syllabus row; the owner rules apply to them (finals at least 4, the rest above 0).',
  'fap-weights-not-100': 'FAP weights do not add up to 100%.',
  'late-penalty-unmodelled': '',
  'weights-not-100': 'The FLM syllabus weights do not add up to 100%.',
  'criterion-suspect': 'An FLM completion criterion looks unusual; check the syllabus.',
  'has-subcomponents': 'The FLM syllabus splits a component into parts.',
  'no-assessment': 'The FLM syllabus lists no assessment.',
  'type-unclassified': 'An FLM assessment has no clear type.',
  'pdf-artifacts': 'The FLM syllabus text came from a PDF and may be garbled.',
}

export interface Sheet { courseId: string | null; sheet: MarkSheet | null; layoutChanged: boolean }

export function readSheet(doc: Document): Sheet {
  const courseId = doc.querySelector<HTMLSelectElement>('#grade-report-course')?.value || null
  try {
    return { courseId, sheet: parseMarkSheet(doc), layoutChanged: false }
  } catch (e) {
    if (e instanceof LayoutChangedError) return { courseId, sheet: null, layoutChanged: true }
    throw e
  }
}

const chip = (on: boolean) => `inline-flex min-h-7 items-center rounded-full border px-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`

function statusLine(p: Prediction, model: CourseModel): { text: string; tone: string } {
  if (p.status === 'none') return { text: 'No prediction: there is neither an FLM syllabus nor any mark yet.', tone: 'text-gray-700' }
  if (p.status === 'unscored') return { text: `Not scored: FAP's status decides (${model.summary.status ?? 'not shown yet'}).`, tone: 'text-gray-700' }
  if (p.status === 'failed') return { text: 'Failing', tone: 'text-red-700' }
  if (p.status === 'passed') return { text: 'Passed', tone: 'text-green-700' }
  return { text: 'In progress', tone: 'text-gray-900' }
}

function Body({ sheet, rules }: { sheet: Sheet; rules: RulesLookup }) {
  const settings = useGradeSettings()
  const [model, setModel] = useState<CourseModel | null>(null)
  useEffect(() => {
    let live = true
    if (sheet.sheet) void loadCourseModel(sheet.sheet.header?.code ?? null, sheet.sheet.rows, rules).then((m) => { if (live) setModel(m) })
    return () => { live = false }
  }, [sheet, rules])

  if (sheet.layoutChanged) return <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">FAP-AIO could not read this mark sheet, so no prediction is shown.</p>
  if (!model || !settings) return null
  const courseId = sheet.courseId
  const goal = courseGoal(courseId ?? '', settings.courseGoals, settings.defaultTier)
  const p = predict(model.subject, model.scores, { moocDone: courseId ? settings.moocDone[courseId] === true : false })
  const st = statusLine(p, model)
  const full = p.status !== 'none' && p.status !== 'unscored' ? p : null
  const tier = full?.tiers.find((t) => t.tier === goal)
  const graded = full ? full.current.gradedWeight : 0
  const average = full && graded > 0 ? round1(Math.min(10, full.current.weightedSoFar / graded)) : null
  const flags = (model.subject?.flags ?? []).filter((f) => FLAG_TEXT[f])
  const weak = weakGroups(model)
  const late = model.subject?.latePenaltyPercent ?? 0
  return (
    <section aria-label="Pass prediction by FAP-AIO" className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-800 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Prediction by FAP-AIO</p>
        <p className={`text-base font-semibold ${st.tone}`}>{st.text}</p>
        {full && full.current.remainingWeight === 0 && tier && 'displayed' in tier && <p className="text-sm text-gray-700">Course average <b className="font-semibold text-gray-900">{tier.displayed.toFixed(1)}</b></p>}
        {full && full.current.remainingWeight > 0 && average !== null && <p className="text-sm text-gray-700">Average so far <b className="font-semibold text-gray-900">{average.toFixed(1)}</b> ({Math.round(graded * 100)}% graded)</p>}
        {full?.current.assumedBonus && <p className="text-xs text-orange-800">Assumes the MOOC bonus of 1.</p>}
      </div>
      {full && (
        <>
          <div role="group" aria-label="Goal for this course" className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-600">Goal</span>
            {TIER_IDS.map((t) => (
              <button key={t} type="button" aria-pressed={goal === t} className={chip(goal === t)} disabled={!courseId}
                onClick={() => courseId && void setCourseGoal(courseId, t === settings.defaultTier ? null : t)}>
                {TIER_LABELS[t]} {TIERS[t]}
              </button>
            ))}
          </div>
          {tier && (
            <div className="mt-2 text-sm">
              {'required' in tier && (tier.reachable ? (
                <>
                  <p className="text-gray-700">To reach {TIER_LABELS[goal]}, score at least:</p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {tier.required.map((r) => <li key={`${r.index}-${r.part}`} className="break-words"><span className="text-gray-700">{r.label}</span> <b className="font-semibold text-gray-900">{r.min.toFixed(1)}</b></li>)}
                  </ul>
                </>
              ) : <p className="text-red-700">{TIER_LABELS[goal]} is out of reach while a criterion is failed.</p>)}
              {'reason' in tier && <p className="text-gray-700">{TIER_LABELS[goal]} is not reachable: it needs more than 10 on every remaining component.</p>}
              {'displayed' in tier && <p className={tier.reachable ? 'text-green-800' : 'text-gray-700'}>{tier.reachable ? `${TIER_LABELS[goal]} reached.` : `${TIER_LABELS[goal]} not reached.`}</p>}
            </div>
          )}
          {full.issues.length > 0 && <ul aria-label="Failed criteria" className="mt-2 flex flex-col gap-0.5 text-sm text-red-700">{full.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        </>
      )}
      {(full?.warnings.length || weak.length || flags.length || late) ? (
        <ul aria-label="Warnings" className="mt-2 flex flex-col gap-0.5 text-xs text-amber-900">
          {full?.warnings.map((w) => <li key={w}>{w}</li>)}
          {weak.map((g) => <li key={g}>The group "{g}" matched its FLM row weakly; check its criterion.</li>)}
          {flags.map((f) => <li key={f}>{FLAG_TEXT[f]}</li>)}
          {late ? <li>FAP shows a late penalty of {late}%; its effect is not modelled.</li> : null}
        </ul>
      ) : null}
    </section>
  )
}

export interface Mounted { host: HTMLElement; root: Root; refresh: () => void; stop: () => void }

/** Mounts after the mark sheet card and follows partial swaps in #grade-report. */
export function mountGradeInline(doc: Document = document, rules: RulesLookup = (codes) => dataClient().rules(codes)): Mounted | null {
  const report = doc.getElementById('grade-report')
  if (!report) return null
  doc.getElementById(HOST_ID)?.remove()
  const host = doc.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  const inline = new CSSStyleSheet()
  inline.replaceSync(INLINE_CSS)
  shadow.adoptedStyleSheets = [sheet, inline]
  const mountPoint = doc.createElement('div')
  shadow.appendChild(mountPoint)
  const root = createRoot(mountPoint)

  const place = () => {
    const card = report.querySelector('table.student-mark-sheet')?.closest('.card') ?? null
    if (card) { if (card.nextSibling !== host) card.after(host) }
    else if (host.parentElement !== report) report.append(host)
  }
  const refresh = () => {
    place()
    root.render(createElement(Body, { sheet: readSheet(doc), rules }))
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const ours = (n: Node) => n === host
  const observer = new MutationObserver((list) => {
    // Our own insertion is not a FAP change.
    if (list.every((m) => [...m.addedNodes, ...m.removedNodes].every(ours) && m.target === report)) return
    clearTimeout(timer)
    timer = setTimeout(refresh, DEBOUNCE_MS)
  })
  refresh()
  observer.observe(report, { childList: true, subtree: true })
  return { host, root, refresh, stop: () => { observer.disconnect(); clearTimeout(timer); root.unmount(); host.remove() } }
}
