// "Capstone project" card in Info (info R10.2, R10.3; INF-7.1): the English and Vietnamese titles and the
// last update from FAP's /Account page (read when Info opens, cached 6 hours). Nothing is shown without a
// topic, or when the page cannot be read.
import { useEffect, useState } from 'react'
import { read } from '../../../content/fap/registry'
import { INFO_ACCOUNT } from '../sources'
import type { Capstone } from '../types'

const dayText = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
}

export function CapstoneCard() {
  const [c, setC] = useState<Capstone | null>(null)
  useEffect(() => {
    let live = true
    void read<Capstone | null>(INFO_ACCOUNT, {}, { priority: 'user' }).then((r) => { if (live && r.ok) setC(r.value) }, () => undefined)
    return () => { live = false }
  }, [])
  if (!c) return null
  return (
    <section aria-labelledby="aio-capstone" className="mx-3 mt-2.5 rounded-lg border border-gray-200 px-3 py-2">
      <h3 id="aio-capstone" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Capstone project</h3>
      {c.titleEn && <p className="mt-1 break-words text-sm font-medium text-gray-900">{c.titleEn}</p>}
      {c.titleVi && <p lang="vi" className="mt-0.5 break-words text-sm text-gray-700">{c.titleVi}</p>}
      {c.updatedOn && <p className="mt-1 text-xs text-gray-600">Updated {dayText(c.updatedOn)}</p>}
    </section>
  )
}
