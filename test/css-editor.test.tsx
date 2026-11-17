// @vitest-environment happy-dom
// APP-4.3: CSS editor, validation positions, last valid CSS kept, snippets, safe mode (appearance R4.1 to R4.6).
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { installFakeChrome } from './helpers/fake-chrome'
import { validateCss } from '../src/background/css-validate'
import { PART_SNIPPETS, checkCss } from '../src/features/appearance/editor/css-check'
import { CssEditor, SafeModeSwitch } from '../src/features/appearance/editor/CssEditor'
import { read, write } from '../src/shared/storage/catalog'
import { userCss } from '../src/features/appearance/pipeline'
import { toActiveStyle } from '../src/features/appearance/themes/model'
import { presetById } from '../src/features/appearance/themes/presets'
import { EditorView } from '@codemirror/view'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

beforeEach(() => {
  installFakeChrome()
  document.body.innerHTML = ''
})

describe('validation', () => {
  it('reports syntax errors with line and column, and nothing for valid CSS', () => {
    expect(validateCss('.card { color: red; }\n.btn { border-radius: 8px }')).toEqual([])
    const p = validateCss('.card { color: red; }\n.btn { color: blue;\n  }}\n@media (min-width: { }')
    expect(p.length).toBeGreaterThan(0)
    expect(p[0]!.line).toBeGreaterThanOrEqual(3)
    expect(p[0]!.column).toBeGreaterThan(0)
    expect(p[0]!.message).not.toBe('')
  })

  it('passes worker problems through and survives a worker that does not answer', async () => {
    expect(await checkCss('.a{}', async () => [{ line: 2, column: 3, offset: 9, message: 'x' }])).toEqual([{ line: 2, column: 3, offset: 9, message: 'x' }])
    expect(await checkCss('.a{}', async () => null)).toEqual([])
  })

  it('applies custom CSS after preset styles, and not in safe mode', () => {
    const s = { ...toActiveStyle(presetById('minimalist-white')!.theme), css: '.card{color:red}' }
    expect(userCss(s, false)).toBe('.card{color:red}')
    expect(userCss(s, true)).toBe('')
  })

  it('offers snippets for the main FAP parts', () => {
    expect(PART_SNIPPETS.map((s) => s.label)).toEqual(['Cards', 'Buttons', 'Tables', 'Sidebar', 'Top bar', 'Forms', 'Page background'])
  })
})

describe('editor', () => {
  async function mount(validate: (css: string) => Promise<{ line: number; column: number; offset: number; message: string }[] | null>) {
    const applied: string[] = []
    const el = document.createElement('div')
    document.body.append(el)
    await act(async () => { createRoot(el).render(<CssEditor value=".card { }" onChange={(c) => applied.push(c)} validate={validate} />) })
    const view = EditorView.findFromDOM(el.querySelector('.cm-editor') as HTMLElement)!
    const set = async (text: string) => {
      await act(async () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }) })
      await tick(350)
    }
    return { el, view, set, applied }
  }

  it('shows line numbers and highlighting, applies valid CSS after 300 ms, and keeps the last valid CSS on an error', async () => {
    const { el, set, applied, view } = await mount(async (css) => (css.includes('}}') ? [{ line: 2, column: 4, offset: 0, message: 'Unexpected }' }] : []))
    expect(el.querySelector('.cm-lineNumbers')).toBeTruthy()
    expect(el.querySelector('[aria-label="Custom CSS"]')).toBeTruthy()
    await set('.card { color: red; }')
    expect(applied).toEqual(['.card { color: red; }'])
    await set('.card { color: red; }\n.btn }}')
    expect(applied).toEqual(['.card { color: red; }'])
    expect(el.querySelector('[role="status"]')!.textContent).toContain('Line 2, column 4: Unexpected }. The last valid CSS stays applied.')
    expect(el.querySelectorAll('.cm-lint-marker-error').length + el.querySelectorAll('.cm-lintRange-error').length).toBeGreaterThan(0)
    await set('.btn { color: blue; }')
    expect(applied.at(-1)).toBe('.btn { color: blue; }')
    expect(view.state.doc.toString()).toBe('.btn { color: blue; }')
  })

  it('inserts snippets and variables at the cursor', async () => {
    const { el, view } = await mount(async () => [])
    await act(async () => { view.dispatch({ selection: { anchor: view.state.doc.length } }) })
    const sel = el.querySelector<HTMLSelectElement>('#aio-css-snippet')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, 'var(--ct-primary)')
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(view.state.doc.toString()).toBe('.card { }var(--ct-primary)')
    expect(sel.value).toBe('')
  })

  it('turns safe mode on and off for every page', async () => {
    await write('appearance.active', { active: { mode: 'fap-default' }, safeMode: false })
    const el = document.createElement('div')
    document.body.append(el)
    await act(async () => { createRoot(el).render(<SafeModeSwitch />) })
    await tick()
    const sw = el.querySelector<HTMLButtonElement>('[role="switch"]')!
    await act(async () => { sw.click() })
    await tick()
    expect((await read('appearance.active'))!.safeMode).toBe(true)
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })
})
