// GRD-6.1: grade exporter and the rubric schema guard (grades R11.1 to R11.3, R12.1, R12.3; platform R5.4).
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { BOM, buildExport, csvCell, exportFileName, toCsv, toJson } from '../src/features/grades/export'
import { rubricInfo, rubricText } from '../src/features/grades/rubric'
import { parseTranscript } from '../src/features/grades/parse/transcript'
import { DEFAULT_NON_GPA } from '../src/features/grades/engine/gpa'
import { checkFile, sha256Hex } from '../src/background/data/db'
import { clearRubricMigrations, registerRubricMigration, resolveSchema } from '../src/shared/data/schemas'
import type { Transcript, TranscriptRow } from '../src/features/grades/types'

const NOW = new Date('2026-11-17T08:00:00Z')
const row = (semester: string, code: string, name: string, credits: number, grade: number | null, status: TranscriptRow['status'] = 'passed'): TranscriptRow =>
  ({ id: `${semester}|${code}`, term: 1, semester, code, name, prerequisites: null, replaced: null, credits, grade, status })
const t: Transcript = {
  rows: [
    row('Spring2024', 'PRF192', 'Lập trình cơ bản, "C"', 3, 8),
    row('Spring2024', 'VOV114', 'Vovinam', 2, 9),
    row('Fall2024', 'MAE101', '=HYPERLINK("x")', 3, 6),
    row('Fall2024', 'CSD201', 'Data structures', 3, null, 'in-progress'),
  ],
  replaced: [{ semester: 'Fall2024', code: 'ENW492c', name: 'Writing', credits: 3, grade: 7, status: 'passed' }],
}

describe('grade export', () => {
  const e = buildExport(t, DEFAULT_NON_GPA, NOW)

  it('carries rows, per-semester and cumulative GPA, the non-GPA list and the date', () => {
    expect(e).toMatchObject({ formatVersion: 1, exportedAt: '2026-11-17T08:00:00.000Z', nonGpa: [...DEFAULT_NON_GPA], cumulative: { gpa: '7.00', credits: 6 } })
    expect(e.semesters).toEqual([{ name: 'Spring2024', gpa: '8.00', credits: 3 }, { name: 'Fall2024', gpa: '6.00', credits: 3 }])
    expect(e.rows.map((r) => [r.code, r.status, r.counted])).toEqual([['PRF192', 'Passed', true], ['VOV114', 'Passed', false], ['MAE101', 'Passed', true], ['CSD201', 'In progress', false]])
    expect(e.replaced).toEqual([{ semester: 'Fall2024', code: 'ENW492c', name: 'Writing', credits: 3, grade: 7, status: 'Passed' }])
    expect(JSON.parse(toJson(e))).toEqual(e)
  })

  it('writes UTF-8 CSV with a byte-order mark, quoting, and formula guards', () => {
    const csv = toCsv(e)
    expect(csv.startsWith(BOM)).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('FAP-AIO grade export')
    expect(lines[1]).toBe('Exported,2026-11-17T08:00:00.000Z')
    expect(lines[2]).toBe(`Not counted in GPA,"${DEFAULT_NON_GPA.join(', ')}"`)
    expect(lines[3]).toBe('Cumulative GPA,7.00,Counted credits,6')
    expect(csv).toContain('1,Spring2024,PRF192,"Lập trình cơ bản, ""C""",3,8,Passed,Yes,,')
    expect(csv).toContain(`1,Fall2024,MAE101,"'=HYPERLINK(""x"")",3,6,Passed,Yes,,`)
    expect(csv).toContain('Replaced or extra subjects (not counted)')
    expect([csvCell(-1.5), csvCell('+84'), csvCell(null)]).toEqual(['-1.5', "'+84", ''])
    expect([exportFileName('csv', NOW), exportFileName('json', NOW)]).toEqual(['fap-aio-grades-2026-11-17.csv', 'fap-aio-grades-2026-11-17.json'])
  })

  it('exports the transcript fixture', () => {
    const fx = parseTranscript(parseHTML(readFileSync('test/fixtures/vi/transcript.html', 'utf8')).document)
    const csv = toCsv(buildExport(fx, DEFAULT_NON_GPA, NOW))
    expect(csv.split('\r\n').filter((l) => /^\d+,(Spring|Summer|Fall)\d{4},/.test(l))).toHaveLength(fx.rows.length)
  })
})

describe('rubric guard', () => {
  afterEach(() => clearRubricMigrations())
  const rules = readFileSync('data/flm/subject-rules.json')
  const entry = async (schema: string, bytes: Uint8Array) => ({ name: 'subject-rules.json' as const, path: 'flm/subject-rules.json', schema, sha256: await sha256Hex(bytes), bytes: bytes.length })

  it('rejects a rubric of another major version unless a migration exists', async () => {
    const v2 = new TextEncoder().encode(JSON.stringify({ ...JSON.parse(rules.toString('utf8')), schemaVersion: 2, renamed: true }))
    expect(resolveSchema('subject-rules@2')).toBeNull()
    await expect(checkFile(await entry('subject-rules@2', v2), v2)).rejects.toThrow(/unsupported schema subject-rules@2/)
    registerRubricMigration(2, (raw) => ({ ...(raw as object), schemaVersion: 1 }))
    const r = await checkFile(await entry('subject-rules@2', v2), v2)
    expect((r.value as { schemaVersion: number }).schemaVersion).toBe(1)
    expect(JSON.parse(r.text).schemaVersion).toBe(1)
    expect(resolveSchema('news-rules@2')).toBeNull()
  })

  it('accepts version 1 and rejects a file whose content says another version', async () => {
    expect((await checkFile(await entry('subject-rules@1', rules), rules)).text).toBe(rules.toString('utf8'))
    const lying = new TextEncoder().encode(JSON.stringify({ ...JSON.parse(rules.toString('utf8')), schemaVersion: 2 }))
    await expect(checkFile(await entry('subject-rules@1', lying), lying)).rejects.toThrow(/does not match subject-rules@1/)
  })

  it('reports the scrape date and the data version', async () => {
    const info = await rubricInfo(async () => ({ ok: true, value: { dataVersion: 1, scrapedAt: '2026-10-10T16:03:12.457Z', rules: {} as never, subjects: {} } }))
    expect(info).toEqual({ scrapedAt: '2026-10-10T16:03:12.457Z', dataVersion: 1 })
    expect(rubricText(info!)).toBe('FLM rubric of 10 Oct 2026, data version 1')
    expect(await rubricInfo(async () => ({ ok: false, error: { kind: 'timeout' } }))).toBeNull()
  })
})
