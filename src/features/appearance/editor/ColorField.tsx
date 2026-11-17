// One colour of a theme (appearance R3.1): a swatch with the system picker, a text field that reads hex,
// rgb(), hsl() or oklch(), and on request the same colour in every format plus the curated swatches.
import { useEffect, useId, useState } from 'react'
import { FAMILY_LABELS, SWATCHES, formatHsl, formatOklch, formatRgb, parseColor, rgbToOklch, toHex, type Family } from '../color'
import { select } from '../../scheduler/views/common'

export const field = 'h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 aria-[invalid=true]:border-red-500'
export const small = 'inline-flex h-7 items-center rounded border border-gray-300 px-2 text-xs hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 aria-pressed:border-orange-500 aria-pressed:bg-orange-50'

/** A text field that commits a colour once it reads as one. */
function ColorText({ label, value, onChange, className = 'w-28' }: { label: string; value: string; onChange: (hex: string) => void; className?: string }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const bad = parseColor(text) === null
  return (
    <input type="text" aria-label={label} spellCheck={false} className={`${field} ${className}`} aria-invalid={bad} value={text}
      onChange={(e) => { setText(e.target.value); const c = parseColor(e.target.value); if (c) onChange(toHex(c)) }}
      onBlur={() => setText(value)} />
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  // Inside a sentence the colour's name is lower case (`Pick primary`).
  const lower = label.toLowerCase()
  const [open, setOpen] = useState(false)
  const [family, setFamily] = useState<Family>('vivid')
  const id = useId()
  const rgb = parseColor(value) ?? { r: 0, g: 0, b: 0 }
  return (
    <div className="py-1">
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" aria-label={`Pick ${lower}`} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5" value={toHex(rgb)} onChange={(e) => onChange(e.target.value)} />
        <span id={id} className="min-w-0 flex-1 text-sm text-gray-800">{label}</span>
        <ColorText label={`${label} colour`} value={value} onChange={onChange} />
        <button type="button" className={small} aria-expanded={open} aria-label={`More for ${lower}`} onClick={() => setOpen((o) => !o)}>{open ? 'Less' : 'More'}</button>
      </div>
      {open && (
        <div role="group" aria-labelledby={id} className="mt-1.5 rounded-md border border-gray-200 p-2">
          <div className="grid grid-cols-1 gap-1.5">
            {([['Hex', toHex(rgb)], ['RGB', formatRgb(rgb)], ['HSL', formatHsl(rgb)], ['OKLCH', formatOklch(rgbToOklch(rgb))]] as const).map(([f, v]) => (
              <label key={f} className="flex items-center gap-1.5 text-xs text-gray-700"><span className="w-10 shrink-0">{f}</span>
                <ColorText label={`${label} as ${f === 'Hex' ? 'hex' : f}`} value={v} onChange={onChange} className="w-full min-w-0" />
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-gray-700" htmlFor={`${id}-fam`}>Swatches</label>
            <select id={`${id}-fam`} className={`${select} h-7 text-xs`} value={family} onChange={(e) => setFamily(e.target.value as Family)}>
              {(Object.keys(SWATCHES) as Family[]).map((f) => <option key={f} value={f}>{FAMILY_LABELS[f]}</option>)}
            </select>
          </div>
          <div className="mt-1.5 grid grid-cols-6 gap-1.5">
            {SWATCHES[family].map((h) => (
              <button key={h} type="button" aria-label={`Use ${h}`} aria-pressed={h === toHex(rgb)} onClick={() => onChange(h)}
                className="h-7 rounded border border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 aria-pressed:ring-2 aria-pressed:ring-orange-500" style={{ background: h }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
