#!/usr/bin/env node
// Golden grade cases with synthetic marks (platform R8.4; grades R4, R5). Each case is a FAP
// mark sheet (rows and the equivalent table.student-mark-sheet HTML) for a real FLM subject;
// the expected course model and prediction come from the validated reference tools.
//   node tools/fixtures/grade-cases.mjs   -> test/fixtures/grades/golden.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { courseModel, rowsFromTable } from '../flm-scraper/marksheet.mjs'
import { predict } from '../flm-scraper/predict.mjs'

const rules = JSON.parse(readFileSync('data/flm/subject-rules.json', 'utf8')).subjects

// item(group, name, weight%, mark) ; total(weight%, mark) ; summary(late, bonus, avg, status)
const item = (group, name, weight, value = '-') => ({ kind: 'item', group, name, weight: `${weight}`, value: `${value}` })
const total = (group, weight, value) => ({ kind: 'group-total', group, name: 'Total', weight: `${weight}%`, value: `${value}` })
const summary = (bonus, avg, status) => [
  { kind: 'summary', label: 'Late penalty (%)', value: '0%', status: null },
  { kind: 'summary', label: 'Mark bonus', value: bonus, status: null },
  { kind: 'summary', label: 'Course total', value: avg, status },
]
const group = (name, entries, groupWeight, groupMark) => [...entries.map(([n, w, v]) => item(name, n, w, v)), total(name, groupWeight, groupMark)]

const CASES = [
  {
    id: 'pass-prf192', category: 'pass', code: 'PRF192',
    rows: [
      ...group('Assignment', [['Assignment', 15, 8.5]], 15, 8.5),
      ...group('Practical Exam', [['Practical Exam', 30, 7.0]], 30, 7.0),
      ...group('Progress test', [['Progress test 1', 7.5, 6.0], ['Progress test 2', 7.5, 8.0]], 15, 7.0),
      ...group('Workshop', [1, 2, 3, 4, 5].map((k) => [`Workshop ${k}`, 2, 9.0]), 10, 9.0),
      ...group('Final exam', [['Final exam', 30, 6.5]], 30, 6.5),
      ...summary('-', '7.3', 'passed'),
    ],
  },
  {
    id: 'fail-fe-below-4-csd201', category: 'fail with an average of 5 or more', code: 'CSD201',
    rows: [
      ...group('Progress test (PT)', [['Progress test (PT) 1', 10, 9.0], ['Progress test (PT) 2', 10, 9.5]], 20, 9.3),
      ...group('Assignment (AS)', [['Assignment (AS) 1', 10, 9.0], ['Assignment (AS) 2', 10, 8.0]], 20, 8.5),
      ...group('Practical Exam', [['Practical Exam', 30, 8.0]], 30, 8.0),
      ...group('Final exam', [['Final exam', 30, 3.5]], 30, 3.5),
      ...summary('-', '6.6', 'failed'),
    ],
  },
  {
    id: 'bonus-pmg201c', category: 'bonus', code: 'PMG201c',
    rows: [
      ...group('PE', [['PE', 50, 6.0]], 50, 6.0),
      ...group('TE', [['TE', 50, 5.0]], 50, 5.0),
      ...summary('1', '6.5', 'passed'),
    ],
    opts: { courseraDone: true },
  },
  {
    id: 'resit-csd201', category: 'resit', code: 'CSD201',
    rows: [
      ...group('Progress test (PT)', [['Progress test (PT) 1', 10, 6.0], ['Progress test (PT) 2', 10, 7.0]], 20, 6.5),
      ...group('Assignment (AS)', [['Assignment (AS) 1', 10, 7.0], ['Assignment (AS) 2', 10, 7.0]], 20, 7.0),
      ...group('Practical Exam', [['Practical Exam', 30, 6.0]], 30, 6.0),
      ...group('Final exam', [['Final exam', 30, 2.0]], 30, 2.0),
      ...group('Final exam (Resit)', [['Final exam', 30, 6.0]], 30, 6.0),
      ...summary('-', '6.3', 'passed'),
    ],
  },
  {
    id: 'unscored-lab211', category: 'unscored', code: 'LAB211',
    rows: [
      ...group('Lab', [['Lab', 100, '-']], 100, '-'),
      ...summary('-', '0', 'passed'),
    ],
  },
  {
    id: 'in-progress-mae101', category: 'in progress', code: 'MAE101',
    rows: [
      ...group('Assignments/Exercises', [['Assignment 1', 10, 8.0], ['Assignment 2', 10, 7.0], ['Assignment 3', 10, '-']], 30, '-'),
      ...group('Progress Test', [['Progress Test 1', 10, 6.0], ['Progress Test 2', 10, '-'], ['Progress Test 3', 10, '-']], 30, '-'),
      ...group('Final Exam', [['Final Exam', 40, '-']], 40, '-'),
      ...summary('-', '0', 'studying'),
    ],
    opts: { attendance: { attended: 18, total: 20 } },
  },
  {
    id: 'progress-zero-mae101', category: 'fail on a zero progress score', code: 'MAE101',
    rows: [
      ...group('Assignments/Exercises', [['Assignment 1', 10, 8.0], ['Assignment 2', 10, 0], ['Assignment 3', 10, 8.0]], 30, 5.3),
      ...group('Progress Test', [['Progress Test 1', 10, 7.0], ['Progress Test 2', 10, 7.0], ['Progress Test 3', 10, 7.0]], 30, 7.0),
      ...group('Final Exam', [['Final Exam', 40, 7.0]], 40, 7.0),
      ...summary('-', '6.5', 'failed'),
    ],
  },
  {
    id: 'uneven-jpd113', category: 'uneven groups', code: 'JPD113',
    rows: [
      ...group('Kiểm tra nhỏ (small test)', [['Small test 1', 20, 7.0], ['Small test 2', 20, 8.0]], 40, 7.5),
      ...group('Tham gia giờ học tại giảng đường', [['Participation', 15, 9.0]], 15, 9.0),
      ...group('Thi cuối kỳ', [['Từ vựng, ngữ pháp, chữ Hán', 15, 6.0], ['Nói', 30, '-']], 45, '-'),
      ...summary('-', '0', 'studying'),
    ],
  },
  {
    id: 'summary-only-mae101', category: 'summary rows only', code: 'MAE101',
    rows: [...summary('-', '0', 'studying')],
  },
]

function html(rows) {
  const out = ['<table class="table table-vcenter mb-0 student-mark-sheet"><thead><tr><th scope="col">Mark group</th><th scope="col">Mark name</th><th scope="col" class="student-mark-col-score">Weight (%)</th><th scope="col" class="student-mark-col-score">Final mark</th><th scope="col">Comment</th></tr></thead><tbody>']
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (r.kind === 'summary') {
      const value = r.status
        ? `<td class="text-center">Average</td><td class="text-center"><span class="grade-average grade-status--${r.status}">${r.value}</span></td><td><span class="grade-status grade-status--${r.status}">${r.status}</span></td>`
        : `<td class="text-center" colspan="2">${r.value}</td><td></td>`
      out.push(`<tr class="sheet-grand-total"><td></td><td class="text-end">${r.label}</td>${value}</tr>`)
      continue
    }
    if (r.kind === 'group-total') {
      out.push(`<tr class="sheet-row-total"><td class="text-center">Total</td><td class="text-center mark-score">${r.weight}</td><td class="text-center mark-score">${r.value}</td><td></td></tr>`)
      continue
    }
    const first = i === 0 || rows[i - 1].group !== r.group || rows[i - 1].kind !== 'item'
    const span = rows.slice(i).findIndex((x) => x.group !== r.group || x.kind === 'summary')
    const groupCell = first ? `<td rowspan="${span === -1 ? rows.length - i : span}" class="sheet-group-cell">${r.group}</td>` : ''
    out.push(`<tr>${groupCell}<td>${r.name}</td><td class="text-center mark-score">${r.weight}</td><td class="text-center mark-score">${r.value}</td><td>-</td></tr>`)
  }
  out.push('</tbody></table>')
  return out.join('')
}

const cases = CASES.map((c) => {
  const flm = rules[c.code]
  if (!flm) throw new Error(`no FLM entry for ${c.code}`)
  const sheet = html(c.rows)
  const { document } = parseHTML(`<html><body>${sheet}</body></html>`)
  const parsed = rowsFromTable(document.querySelector('table'))
  if (JSON.stringify(parsed) !== JSON.stringify(c.rows)) throw new Error(`${c.id}: HTML does not round-trip through rowsFromTable`)
  const model = courseModel(flm, c.rows)
  const prediction = model.subject ? predict(model.subject, model.scores, c.opts ?? {}) : null
  return { id: c.id, category: c.category, code: c.code, opts: c.opts ?? {}, rows: c.rows, html: sheet, model, prediction }
})

mkdirSync('test/fixtures/grades', { recursive: true })
writeFileSync('test/fixtures/grades/golden.json', JSON.stringify({ generatedBy: 'tools/fixtures/grade-cases.mjs', marks: 'synthetic', cases }, null, 1) + '\n')
console.log(`wrote ${cases.length} golden cases: ${cases.map((c) => `${c.id}=${c.prediction?.failed === undefined ? (c.prediction?.scored === false ? 'unscored' : 'n/a') : c.prediction.failed ? 'failed' : 'ok'}`).join(', ')}`)
