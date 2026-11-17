// Grant window entry (opened by the service worker with ?perm=notifications or ?perm=flm).
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import './grant.css'
import { GrantPage } from './GrantPage'

const perm = new URLSearchParams(location.search).get('perm')
const root = document.getElementById('root')
if (root) createRoot(root).render(createElement(GrantPage, { perm }))
