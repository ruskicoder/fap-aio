// Info parsers (info R5.4, R2.3 to R2.5; design "Sources" and "Parsers"): the unread flag (JSON), the
// bell list from `data-notification-*` attributes, and the curriculum table by column position.
import { z } from 'zod'
import { LayoutChangedError } from '../../content/fap/registry'
import type { CurriculumRow, Notice, Unread, Capstone } from './types'

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const CODE = /\b[A-Z][A-Za-z]{1,5}\d{3}[a-z]?\b/g

const unreadSchema = z.object({ hasUnread: z.boolean() }).passthrough()
export function parseUnread(value: unknown): Unread {
  const r = unreadSchema.safeParse(value)
  if (!r.success) throw new LayoutChangedError('/Notification/UnreadCount is not { hasUnread }')
  return { hasUnread: r.data.hasUnread }
}

/** Read state: the attribute when it says true or false, otherwise FAP's `unread-noti` class. */
function isRead(el: Element): boolean {
  const a = (el.getAttribute('data-notification-is-read') ?? '').toLowerCase()
  if (a === 'true') return true
  if (a === 'false') return false
  return !el.classList.contains('unread-noti')
}

export function parseBell(doc: Document): Notice[] {
  const items = [...doc.querySelectorAll('[data-notification-item]')]
  if (!items.length) {
    if (doc.querySelector('[data-notification-list], .jidox-notification-empty, .fap-empty-state')) return []
    throw new LayoutChangedError('no [data-notification-item] in the bell list')
  }
  return items.flatMap((el) => {
    const id = el.getAttribute('data-notification-id') ?? ''
    if (!id) return []
    return [{
      id,
      linkUrl: el.getAttribute('data-notification-link-url') ?? '',
      sourceCode: el.getAttribute('data-notification-source-code') ?? '',
      isRead: isRead(el),
      title: clean(el.querySelector('.jidox-notification-item__title, .noti-item-title')?.textContent),
      time: clean(el.querySelector('.jidox-notification-item__time')?.textContent),
    }]
  })
}

const codesIn = (s: string) => [...new Set(s.match(CODE) ?? [])]

export function parseCurriculum(doc: Document): CurriculumRow[] {
  const table = [...doc.querySelectorAll('.content-page table.fap-sheet')].find((t) => t.querySelectorAll('thead th').length >= 6)
  if (!table) {
    if (doc.querySelector('.content-page .fap-empty-state, .content-page .fap-empty-card')) return []
    throw new LayoutChangedError('no curriculum table.fap-sheet on /Curriculum')
  }
  return [...table.querySelectorAll('tbody tr')].flatMap((tr) => {
    const td = [...tr.querySelectorAll('td')]
    if (td.length < 6) return []
    const code = clean(td[1]!.textContent)
    if (!code) return []
    const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : null)
    const link = tr.querySelector<HTMLAnchorElement>('a[href*="/Subject/Detail/"]')?.getAttribute('href') ?? null
    return [{
      no: num(clean(td[0]!.textContent)),
      code,
      name: clean(td[2]!.textContent),
      term: num(clean(td[3]!.textContent)),
      prerequisites: codesIn(clean(td[4]!.textContent)),
      replacements: codesIn(clean(td[5]!.textContent)).filter((c) => c !== code),
      credits: null,
      detailUrl: link,
    }]
  })
}

// ---- Capstone project (info R10.1, INF-7.1) -------------------------------------------------------------
// Found by structure, so the Vietnamese culture works: each field is a div.student-profile-field whose own
// icon says what it holds; the value is in .student-profile-field__value. Labels are never matched.
const CAPSTONE_ICONS = { 'ri-lightbulb-line': 'titleEn', 'ri-translate-2': 'titleVi', 'ri-edit-line': 'updatedOn' } as const

const fieldValue = (field: Element) => {
  const v = (field.querySelector('.student-profile-field__value')?.textContent ?? '').replace(/\s+/g, ' ').trim()
  return v === '' || v === '-' ? null : v
}
const iconOf = (field: Element) => {
  const i = [...field.children].find((c) => c.tagName === 'I') ?? field.querySelector('i')
  return i ? (Object.keys(CAPSTONE_ICONS) as (keyof typeof CAPSTONE_ICONS)[]).find((k) => i.classList.contains(k)) ?? null : null
}

/** dd/MM/yyyy to yyyy-MM-dd; anything else is kept as FAP shows it. */
const isoDay = (s: string | null) => { const m = s ? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s) : null; return m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : s }

/** The capstone card's fields, or null when FAP shows no topic (no card, or "-" for both titles). */
export function parseCapstone(doc: Document): Capstone | null {
  const anchor = [...doc.querySelectorAll('div.student-profile-field')].find((f) => iconOf(f) === 'ri-lightbulb-line')
  if (!anchor) return null
  // The fields of the same card: the nearest container that holds the anchor's siblings.
  const scope = anchor.closest('.card') ?? anchor.closest('.student-profile-grid') ?? anchor.parentElement ?? doc.body
  const out: Capstone = { titleEn: null, titleVi: null, updatedOn: null }
  for (const f of scope.querySelectorAll('div.student-profile-field')) {
    const icon = iconOf(f)
    if (icon && out[CAPSTONE_ICONS[icon]] === null) out[CAPSTONE_ICONS[icon]] = fieldValue(f)
  }
  out.updatedOn = isoDay(out.updatedOn)
  return out.titleEn || out.titleVi ? out : null
}
