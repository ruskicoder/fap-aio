// Theme editor window entry (fix F-21), opened by the service worker with ?mode=css|import&tab=<id>[&theme=<id>].
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import './editor.css'
import { EditorPage } from './EditorPage'

const q = new URLSearchParams(location.search)
const tabId = Number(q.get('tab'))
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(createElement(EditorPage, {
    mode: q.get('mode') === 'import' ? 'import' : 'css',
    tabId: Number.isInteger(tabId) && tabId >= 0 ? tabId : null,
    themeId: q.get('theme'),
  }))
}
