// CSS editor (appearance R4.1 to R4.3, R4.6; design, "CSS editor"): CodeMirror 6 in the panel's shadow root
// with syntax highlighting and line numbers, snippets for FAP's parts and the theme variables, error marks
// with line and column, and a safe mode switch. Checked CSS goes to the theme 300 ms after typing stops, so
// the page preview follows; CSS with an error is held back and the last valid CSS stays applied.
import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { css } from '@codemirror/lang-css'
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { update } from '../../../shared/storage/catalog'
import { useStore } from '../../../content/panel/use-store'
import { parseActive } from '../state'
import { CT_VARS } from '../themes/css-vars'
import { select } from '../../scheduler/views/common'
import { PART_SNIPPETS, checkCss, type CssProblem, type Validate } from './css-check'

const theme = EditorView.theme({
  '&': { fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff' },
  '&.cm-focused': { outline: '2px solid #ea580c', outlineOffset: '1px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', minHeight: '12rem', maxHeight: '22rem' },
  '.cm-content': { padding: '6px 0' },
})

export function SafeModeSwitch() {
  const active = parseActive(useStore('appearance.active').data)
  const on = active.safeMode
  return (
    <label className="flex items-center gap-2 text-sm text-gray-800">
      <button type="button" role="switch" aria-checked={on} aria-label="Safe mode"
        onClick={() => void update('appearance.active', (a) => ({ ...parseActive(a), safeMode: !on }))}
        className="inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        style={{ background: on ? '#ea580c' : '#d1d5db' }}>
        <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
      <span>Safe mode: custom CSS off on every FAP page</span>
    </label>
  )
}

export function CssEditor({ value, onChange, validate }: { value: string; onChange: (css: string) => void; validate?: Validate }) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const [problems, setProblems] = useState<CssProblem[]>([])
  const [checking, setChecking] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const parent = host.current!
    let timer: ReturnType<typeof setTimeout> | undefined
    let seq = 0
    const run = (text: string) => {
      clearTimeout(timer)
      setChecking(true)
      timer = setTimeout(() => {
        const mine = ++seq
        void checkCss(text, validate).then((found) => {
          if (mine !== seq || !view.current) return
          setChecking(false)
          setProblems(found)
          const doc = view.current.state.doc
          const diags: Diagnostic[] = found.map((p) => {
            const line = doc.line(Math.min(Math.max(1, p.line), doc.lines))
            const from = Math.min(line.from + Math.max(0, p.column - 1), line.to)
            return { from, to: Math.min(from + 1, line.to), severity: 'error', message: p.message }
          })
          view.current.dispatch(setDiagnostics(view.current.state, diags))
          if (!found.length) onChangeRef.current(text)
        })
      }, 300)
    }
    view.current = new EditorView({
      parent,
      root: parent.getRootNode() as ShadowRoot | Document,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), history(), drawSelection(), indentOnInput(), bracketMatching(), highlightActiveLine(),
          syntaxHighlighting(defaultHighlightStyle), css(), lintGutter(), theme,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.contentAttributes.of({ 'aria-label': 'Custom CSS' }),
          EditorView.updateListener.of((u) => { if (u.docChanged) run(u.state.doc.toString()) }),
        ],
      }),
    })
    return () => { clearTimeout(timer); view.current?.destroy(); view.current = null }
    // The editor owns its text after mount; `value` seeds it once.
  }, [])

  const insert = (text: string) => {
    const v = view.current
    if (!v || !text) return
    const { from, to } = v.state.selection.main
    v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length - (text.endsWith('}\n') ? 3 : 0) } })
    v.focus()
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <label className="text-xs text-gray-700" htmlFor="aio-css-snippet">Insert</label>
        <select id="aio-css-snippet" className={`${select} h-7 min-w-0 max-w-full text-xs`} value="" onChange={(e) => insert(e.target.value)}>
          <option value="">Choose a FAP part or a variable</option>
          <optgroup label="FAP parts">{PART_SNIPPETS.map((s) => <option key={s.label} value={s.text}>{s.label}</option>)}</optgroup>
          <optgroup label="Theme variables">{CT_VARS.map((v) => <option key={v} value={`var(${v})`}>{v}</option>)}</optgroup>
        </select>
      </div>
      <div ref={host} />
      <p role="status" className={`mt-1 text-xs ${problems.length ? 'text-red-700' : 'text-gray-600'}`}>
        {checking ? 'Checking' : problems.length
          ? `Line ${problems[0]!.line}, column ${problems[0]!.column}: ${problems[0]!.message}.${problems.length > 1 ? ` ${problems.length - 1} more.` : ''} The last valid CSS stays applied.`
          : 'Applied after the preset and colours; the page shows it as you type.'}
      </p>
    </div>
  )
}
