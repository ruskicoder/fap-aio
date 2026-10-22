import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseHTML } from 'linkedom'
// @ts-expect-error untyped tool module
import { makeAnonymizer } from '../tools/fixtures/anonymize.mjs'

type An = { html(s: string): string; text(s: string, mode?: string): string }

const SAMPLE = `<!doctype html><html><head><title>Grade report</title></head><body>
<div class="content-page"><h4 class="fap-page-title">Report for Nguyen Van An SE180001</h4>
<table class="fap-sheet"><thead><tr><th>Date</th><th>Mon (12/10)</th></tr></thead>
<tbody><tr><td data-reference-date="2026-10-12">12/10/2026</td><td title="Lecturer">TinVT6</td><td>an.nv@fpt.edu.vn</td>
<td><a href="/Report/Grade?termId=63&amp;courseId=123456">PRF192 - Programming</a></td><td>Present</td><td>12h30-14h45</td></tr></tbody></table>
<table class="student-mark-sheet"><tr><td>Lab 1</td><td class="mark-score">10</td><td class="mark-score">7.5</td><td>-</td></tr></table>
</div><script>var user = "secret"</script><!-- comment --></body></html>`

function shape(html: string) {
  const { document } = parseHTML(html)
  const tags: string[] = []
  const classes: string[] = []
  const attrs: string[] = []
  for (const el of document.querySelectorAll('*')) {
    tags.push(el.tagName)
    classes.push(...el.classList)
    attrs.push(...[...el.attributes].filter((a) => !(a.name === "class" && a.value === "")).map((a) => `${el.tagName}@${a.name}`))
  }
  return { tags, classes: classes.sort(), attrs: attrs.sort() }
}

describe('fixture anonymizer', () => {
  const an: An = makeAnonymizer({ seed: 'test' })
  const out = an.html(SAMPLE)

  it('is deterministic for a seed and differs across seeds', () => {
    expect(makeAnonymizer({ seed: 'test' }).html(SAMPLE)).toBe(out)
    expect(makeAnonymizer({ seed: 'other' }).html(SAMPLE)).not.toBe(out)
  })

  it('keeps the element, class and attribute sets', () => {
    const a = shape(SAMPLE)
    const b = shape(out)
    expect(b.tags).toEqual(a.tags)
    expect(b.classes).toEqual(a.classes)
    expect(b.attrs).toEqual(a.attrs)
  })

  it('replaces personal values and keeps structural labels and formats', () => {
    for (const v of ['Nguyen', 'SE180001', 'TinVT6', 'an.nv@', '123456', 'PRF192', 'secret', 'comment', '>7.5<']) expect(out).not.toContain(v)
    for (const v of ['Present', '12h30-14h45', '@fpt.edu.vn', '<th>Date</th>', '>10<']) expect(out).toContain(v)
    expect(out).toMatch(/Mon \(\d{2}\/\d{2}\)/)
    expect(out).toMatch(/data-reference-date="\d{4}-\d{2}-\d{2}"/)
    expect(out).toMatch(/[A-Z]{3}\d{3} - /)
  })

  it('shifts dates by whole weeks and maps a value the same way everywhere', () => {
    const d = an.text('2026-10-12', 'label')
    expect(new Date(`${d}T00:00:00Z`).getUTCDay()).toBe(new Date('2026-10-12T00:00:00Z').getUTCDay())
    expect(an.text('TinVT6')).toBe(an.text('TinVT6'))
    expect(an.text('tinvt6').toLowerCase()).toBe(an.text('TinVT6').toLowerCase())
  })

  const raw = 'ignore/fixtures-raw/en'
  it.skipIf(!existsSync(raw))('keeps the structure of every captured page', () => {
    const full: An = makeAnonymizer({ seed: 'fap-aio' })
    for (const f of readdirSync(raw).filter((n) => n.endsWith('.html'))) {
      const src = readFileSync(join(raw, f), 'utf8')
      if (!src.trim()) continue
      const wrap = (s: string) => (/^\s*(<!doctype|<html)/i.test(s) ? s : `<html><body>${s}</body></html>`)
      const a = shape(wrap(src))
      const b = shape(wrap(full.html(src)))
      expect(b.classes, f).toEqual(a.classes)
      expect(b.attrs, f).toEqual(a.attrs)
    }
  })
})
