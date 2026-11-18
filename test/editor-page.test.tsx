// @vitest-environment happy-dom
// F-21: the theme editor page (CSS editor and theme import) outside FAP pages, the service worker opening it,
// and its previews reaching the FAP page through the panel (appearance R4.1 to R4.3, R5.3, R5.4).
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import axe from 'axe-core'
import { EditorView } from '@codemirror/view'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { EditorPage } from '../src/pages/theme-editor/EditorPage'
import { EDITOR_PAGE, installEditorWindow } from '../src/background/editor-window'
import { handle } from '../src/background/router'
import { PREVIEW_EVENT } from '../src/features/appearance/preview'
import { relayEditorPreviews } from '../src/features/appearance/index'
import { presetById } from '../src/features/appearance/themes/presets'
import { addCustom, customThemes, saveCustom } from '../src/features/appearance/themes/store'
import { read } from '../src/shared/storage/catalog'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const base = { ...presetById('minimalist-white')!.theme, id: 'paper', name: 'Paper', preset: undefined }
type Sent = { tabId: number; msg: { type: string; preview: string | null } }

let c: FakeChrome
beforeEach(() => {
  c = installFakeChrome()
  document.body.innerHTML = ''
})

async function page(props: Parameters<typeof EditorPage>[0]) {
  const el = document.createElement('div')
  document.body.append(el)
  const root = createRoot(el)
  await act(async () => { root.render(<EditorPage {...props} />) })
  await tick(); await tick()
  const b = (name: string) => [...el.querySelectorAll('button')].find((x) => x.textContent === name || x.getAttribute('aria-label') === name)!
  return { el, root, b }
}
const previews = () => (c.tabs._sent as Sent[]).filter((s) => s.msg.type === 'theme.preview').map((s) => [s.tabId, s.msg.preview === null ? null : JSON.parse(s.msg.preview).style.css])

describe('CSS editor page', () => {
  it('edits one theme\'s CSS with a preview on its FAP tab, saves only the CSS, and passes axe', async () => {
    await addCustom(base)
    const { el, b, root } = await page({ mode: 'css', tabId: 7, themeId: 'paper' })
    expect(el.querySelector('h1')!.textContent).toBe('Custom CSS for Paper')
    const view = EditorView.findFromDOM(el.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '.card { color: red; }' } }) })
    await tick(350)
    expect(previews()).toEqual([[7, '.card { color: red; }']])
    // The panel changed a colour meanwhile; the page keeps that and adds only its CSS.
    await saveCustom({ ...base, roles: { ...base.roles, primary: '#0f766e' } })
    await act(async () => { b('Save').click() })
    await tick()
    const saved = (await customThemes())[0]!
    expect([saved.css, saved.roles.primary]).toEqual(['.card { color: red; }', '#0f766e'])
    expect(el.textContent).toContain('Saved.')
    expect(previews().at(-1)).toEqual([7, null])
    const r = await axe.run(el, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(r.violations.map((v) => v.id)).toEqual([])
    act(() => root.unmount())
    expect(previews().at(-1)).toEqual([7, null])
  })

  it('says so when the theme is gone', async () => {
    const { el } = await page({ mode: 'css', tabId: 7, themeId: 'missing' })
    expect(el.textContent).toContain('no longer in Your themes')
  })
})

describe('import page', () => {
  it('checks the file, shows the warning and what was removed, previews, and saves on request', async () => {
    const { el, b } = await page({ mode: 'import', tabId: 3, themeId: null })
    const file = new File([JSON.stringify({ ...base, name: 'Shared', css: '@import "x.css";\n.card{}' })], 'shared.json', { type: 'application/json' })
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    await tick(20)
    const region = el.querySelector('[role="region"][aria-label="Theme to import"]')!
    expect(region.textContent).toContain('Import Shared?')
    expect(region.textContent).toContain('This theme comes from outside FAP-AIO')
    expect(region.textContent).toContain('@import rule (custom CSS)')
    await act(async () => { b('Preview on the FAP page').click() })
    expect(previews().at(-1)).toEqual([3, '\n.card{}'])
    expect(await customThemes()).toEqual([])
    await act(async () => { b('Save to Your themes').click() })
    await tick()
    expect((await customThemes()).map((t) => t.id)).toEqual(['imported-shared'])
    expect(previews().at(-1)).toEqual([3, null])
    expect(el.textContent).toContain('Shared is in Your themes.')
  })
})

describe('opening the page and relaying previews', () => {
  it('opens one editor window for the asking tab', async () => {
    installEditorWindow()
    const sender = { id: 'test-extension-id', url: 'https://fap.fpt.edu.vn/', frameId: 0, tab: { id: 9 } as chrome.tabs.Tab }
    expect(await handle({ v: 1, type: 'editor.open', mode: 'css', themeId: 'paper' }, sender)).toEqual({ ok: true, value: { opened: true } })
    const w = c.windows._created as { url: string; type?: string }[]
    expect(w[0]!.url).toBe(`chrome-extension://test-extension-id/${EDITOR_PAGE}?mode=css&tab=9&theme=paper`)
    expect(w[0]!.type).toBe('popup')
    await handle({ v: 1, type: 'editor.open', mode: 'import' }, sender)
    expect(w[1]!.url).toContain('mode=import&tab=9')
  })

  it('passes the page\'s preview to the document_start entry on the FAP page', async () => {
    relayEditorPreviews()
    const got: (string | null)[] = []
    document.addEventListener(PREVIEW_EVENT, (e) => got.push((e as CustomEvent<string | null>).detail))
    await c.runtime.onMessage.emit({ v: 1, type: 'theme.preview', preview: '{"kind":"fap-default"}' }, { id: 'test-extension-id' } as chrome.runtime.MessageSender, () => {})
    await c.runtime.onMessage.emit({ v: 1, type: 'theme.preview', preview: null }, { id: 'test-extension-id' } as chrome.runtime.MessageSender, () => {})
    expect(got).toEqual(['{"kind":"fap-default"}', null])
    expect(await read('appearance.active')).toBeNull()
  })
})
