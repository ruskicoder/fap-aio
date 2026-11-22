// Printable grade list entry (GRD-7.3), opened by the service worker with ?components=1&attendance=0.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import './print.css'
import { PrintPage } from './PrintPage'

const q = new URLSearchParams(location.search)
const root = document.getElementById('root')
if (root) createRoot(root).render(createElement(PrintPage, { components: q.get('components') === '1', attendance: q.get('attendance') === '1' }))
