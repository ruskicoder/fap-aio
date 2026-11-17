// News classifier (info R7.4 to R7.9; design "Analyzers"; docs/20-architecture/fap-v2/news.md). The title
// step is a port of `classify` in tools/news/analyze-news.py and must match it on the committed fixture.
// The convention steps follow: personalization, watch keywords, detail enrichment and repost dedupe.
import type { NewsRulesFile } from '../../shared/data/schemas'

export type Priority = 'P1' | 'P2' | 'P3' | 'P4'

export interface TitleClass {
  tag: string
  families: string[]
  priority: Priority
  deadline: string | null
  term: Record<string, string | null>
}

/** Lowercase, NFD with combining marks removed, đ to d, whitespace collapsed (rules `normalize`). */
export function normTitle(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim()
}

const cache = new Map<string, RegExp>()
const rx = (src: string) => {
  let r = cache.get(src)
  if (!r) cache.set(src, (r = new RegExp(src)))
  return r
}

const isoDate = (d: number, m: number, y: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null
}

export function classifyTitle(title: string, rules: NewsRulesFile): TitleClass {
  const t = normTitle(title)
  const tag = rules.tags.find((x) => x.match && rx(x.match).test(t))?.id ?? 'other'
  const fams = rules.families.filter((f) => rx(f.match).test(t))
  const prio = fams.length ? fams.map((f) => f.priority).sort()[0]! : 'P4'
  const boost = rules.flags.filter((fl) => rx(fl.match).test(t)).reduce((n, fl) => n + fl.boost, 0)
  const level = Math.max(1, Number(prio[1]) - boost)
  let deadline: string | null = null
  for (const src of rules.deadline) {
    const m = rx(src).exec(t)
    if (m) {
      const [d, mo, y] = m.slice(-3).map(Number) as [number, number, number]
      deadline = isoDate(d, mo, y)
      break
    }
  }
  const term = Object.fromEntries(Object.entries(rules.term).map(([k, src]) => [k, rx(src).exec(t)?.[0] ?? null]))
  return { tag, families: fams.map((f) => f.id), priority: `P${level}` as Priority, deadline, term }
}

export interface NewsContext {
  /** Subjects in progress or not yet passed. */
  subjects: string[]
  courseraInProgress: boolean
  /** Enrolled in a thesis or capstone subject (`*490` to `*492`). */
  thesis: boolean
  /** Cohort token such as `k18`. */
  cohort: string | null
  /** The student's campus, as FAP names it. */
  campus: string | null
  watch: string[]
}

export interface NewsDetail { campus: string | null; expires: string | null; deadline: string | null; body?: string }

export interface NewsClass extends TitleClass {
  campus: string | null
  expires: string | null
  /** Why the priority moved: `subject:PRF192`, `thesis`, `coursera`, `cohort`, `watch:keyword`, `other-campus`. */
  personal: string[]
  /** Staff-only items are not shown to students. */
  hidden: boolean
  reposted: boolean
}

const raise = (p: Priority, by = 1): Priority => `P${Math.max(1, Number(p[1]) - by)}` as Priority
export const isThesisCode = (code: string) => /^[A-Z]{2,4}49[0-2][a-z]?$/.test(code)

/** Title step, then the convention's personalization and the user's watch keywords (R7.5, R7.6, R7.8). */
export function classifyNews(title: string, rules: NewsRulesFile, ctx: NewsContext, detail: NewsDetail | null = null): NewsClass {
  const base = classifyTitle(title, rules)
  let priority = base.priority
  const personal: string[] = []
  const codeRx = new RegExp(rules.personalize.subjectCode, 'g')
  const named = new Set([...(title.match(codeRx) ?? []), ...(detail?.body?.match(codeRx) ?? [])])
  const mine = [...named].filter((c) => ctx.subjects.includes(c))
  if (mine.length) { priority = raise(priority); personal.push(...mine.map((c) => `subject:${c}`)) }
  if (ctx.thesis && base.families.includes('thesis')) { priority = raise(priority); personal.push('thesis') }
  if (ctx.courseraInProgress && base.families.some((f) => f === 'exam-registration' || f === 'coursera-guidance')) { priority = raise(priority); personal.push('coursera') }
  if (ctx.cohort && base.families.includes('mandatory-program') && base.term.cohort === ctx.cohort.toLowerCase()) { priority = raise(priority); personal.push('cohort') }
  const nt = normTitle(title)
  const watched = ctx.watch.map((w) => normTitle(w)).filter((w) => w && nt.includes(w))
  if (watched.length) { priority = 'P1'; personal.push(...watched.map((w) => `watch:${w}`)) }
  const campus = detail?.campus ?? null
  if (campus && ctx.campus && normTitle(campus) !== normTitle(ctx.campus)) { priority = 'P4'; personal.push('other-campus') }
  return {
    ...base,
    priority,
    deadline: base.deadline ?? detail?.deadline ?? null,
    campus,
    expires: detail?.expires ?? null,
    personal,
    hidden: base.families.includes('staff-only'),
    reposted: false,
  }
}

/**
 * Repost dedupe (R7.9): the same normalized title within 30 days is one item; the newest stays and is
 * marked reposted. `createdAt` is yyyy-mm-dd or an ISO time.
 */
export function dedupeNews<T extends { title: string; createdAt: string; reposted?: boolean }>(items: T[], days = 30): T[] {
  const newestFirst = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const kept: T[] = []
  for (const it of newestFirst) {
    const key = normTitle(it.title)
    const newer = kept.find((k) => normTitle(k.title) === key && Date.parse(k.createdAt) - Date.parse(it.createdAt) <= days * 86_400_000)
    if (newer) { newer.reposted = true; continue }
    kept.push({ ...it })
  }
  return kept
}
