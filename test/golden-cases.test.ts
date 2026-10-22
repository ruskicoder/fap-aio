import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const golden = JSON.parse(readFileSync('test/fixtures/grades/golden.json', 'utf8')) as {
  marks: string
  cases: { id: string; category: string; html: string; prediction: { failed?: boolean; scored?: boolean } | null }[]
}

describe('golden grade cases', () => {
  it('cover every validation category with synthetic marks', () => {
    expect(golden.marks).toBe('synthetic')
    const cats = new Set(golden.cases.map((c) => c.category))
    for (const c of ['pass', 'fail with an average of 5 or more', 'bonus', 'resit', 'unscored', 'uneven groups', 'summary rows only']) expect(cats).toContain(c)
  })

  it('carry the expected outcome from the reference tools', () => {
    const byId = Object.fromEntries(golden.cases.map((c) => [c.id, c]))
    expect(byId['fail-fe-below-4-csd201']!.prediction!.failed).toBe(true)
    expect(byId['pass-prf192']!.prediction!.failed).toBe(false)
    expect(byId['unscored-lab211']!.prediction!.scored).toBe(false)
    for (const c of golden.cases) expect(c.html).toContain('student-mark-sheet')
  })
})
