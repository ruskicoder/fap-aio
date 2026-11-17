// INF-2.2: newsClassifier port, parity with tools/news/analyze-news.py, and the convention steps.
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { classifyNews, classifyTitle, dedupeNews, normTitle, type NewsContext } from '../src/features/info/news'
import { newsRulesFile } from '../src/shared/data/schemas'

const rules = newsRulesFile.parse(JSON.parse(readFileSync('data/news/news-rules.json', 'utf8')))
const fixture = JSON.parse(readFileSync('test/fixtures/news/titles.json', 'utf8')) as { titles: string[] }
const expected = JSON.parse(readFileSync('test/fixtures/news/expected.json', 'utf8')) as { items: { title: string }[] }
const ctx: NewsContext = { subjects: ['PRF192', 'SEP490', 'MKT101c'], courseraInProgress: false, thesis: false, cohort: null, campus: 'Cơ sở TP. Hồ Chí Minh', watch: [] }

function python(): string | null {
  try {
    return execFileSync('python3', ['tools/news/classify-fixture.py'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

describe('title step parity', () => {
  it('matches the reference output on every synthetic title', () => {
    expect(expected.items.map((i) => i.title)).toEqual(fixture.titles)
    for (const item of expected.items) expect(classifyTitle(item.title, rules), item.title).toEqual(Object.fromEntries(Object.entries(item).filter(([k]) => k !== 'title')))
    expect(new Set(expected.items.flatMap((i) => (i as unknown as { families: string[] }).families)).size).toBe(rules.families.length)
  })

  it('keeps the committed expected output current when Python is available', () => {
    const out = python()
    if (out === null) return
    expect(JSON.parse(out)).toEqual(expected)
  })

  it('normalizes as the rules say', () => {
    expect(normTitle('  [QLĐT]  Đăng ký   MÔN học ')).toBe('[qldt] dang ky mon hoc')
  })
})

describe('personalization', () => {
  const title = 'Kế hoạch học tập kỳ FA26 cho môn SWP391 và SEP490'

  it('raises one level for a subject the student takes, and names it', () => {
    const r = classifyNews(title, rules, ctx)
    expect([r.priority, r.personal]).toEqual(['P1', ['subject:SEP490']])
    expect(classifyNews(title, rules, { ...ctx, subjects: [] }).priority).toBe('P2')
  })

  it('raises thesis, Coursera and cohort items for the students they concern', () => {
    expect(classifyNews('Hướng dẫn học các môn Coursera kỳ Fall2026', rules, { ...ctx, courseraInProgress: true })).toMatchObject({ priority: 'P1', personal: ['coursera'] })
    expect(classifyNews('Lịch học GDQP cho K19', rules, { ...ctx, cohort: 'K19' }).personal).toEqual(['cohort'])
    expect(classifyNews('Lịch học GDQP cho K19', rules, { ...ctx, cohort: 'K18' }).personal).toEqual([])
  })

  it('makes watch keywords P1, hides staff-only items, and drops other campuses to P4', () => {
    expect(classifyNews('Thư viện giới thiệu sách mới', rules, { ...ctx, watch: ['sách mới'] })).toMatchObject({ priority: 'P1', personal: ['watch:sach moi'] })
    expect(classifyNews('Quy định nghỉ lễ cho cán bộ, giảng viên, giáo viên', rules, ctx).hidden).toBe(true)
    const other = classifyNews('Thông báo thu học phí', rules, ctx, { campus: 'Cơ sở Hà Nội', expires: '2026-12-01', deadline: '2026-11-30' })
    expect(other).toMatchObject({ priority: 'P4', campus: 'Cơ sở Hà Nội', expires: '2026-12-01', deadline: '2026-11-30' })
    expect(other.personal).toContain('other-campus')
  })

  it('takes subject codes and the deadline from the detail when the title has none', () => {
    const r = classifyNews('Thông báo về lịch thi', rules, ctx, { campus: 'Cơ sở TP. Hồ Chí Minh', expires: null, deadline: '2026-11-25', body: 'Sinh viên học môn MKT101c lưu ý' })
    expect([r.priority, r.deadline, r.personal]).toEqual(['P1', '2026-11-25', ['subject:MKT101c']])
  })
})

describe('repost dedupe', () => {
  it('keeps the newest of the same normalized title within 30 days and marks it reposted', () => {
    const out = dedupeNews<{ title: string; createdAt: string; reposted?: boolean }>([
      { title: 'Lịch thi Fall2026', createdAt: '2026-10-01' },
      { title: 'LỊCH THI  Fall2026', createdAt: '2026-10-20' },
      { title: 'Lịch thi Fall2026', createdAt: '2026-08-01' },
      { title: 'Khác', createdAt: '2026-10-05' },
    ])
    expect(out.map((o) => [o.createdAt, !!o.reposted])).toEqual([['2026-10-20', true], ['2026-10-05', false], ['2026-08-01', false]])
  })
})
