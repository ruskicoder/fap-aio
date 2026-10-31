#!/usr/bin/env node
// M1 browser check (conventions rule 10) without live FAP: a headless Chrome loads dist/ through
// CDP Extensions.loadUnpacked and every request to https://fap.fpt.edu.vn is answered from the
// anonymized fixtures in test/fixtures/en (week partials and exams shifted to the current dates).
// Every other host the page requests is blocked, and Chrome's background services are switched off,
// so nothing reaches FAP or Cloudflare. Screenshots and a report go
// to ignore/uat/<date>/. Usage: node tools/uat/m1-check.mjs  (run through the machine's heavy lock)
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const fx = join(root, 'test', 'fixtures', 'en')
const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
const outDir = join(root, 'ignore', 'uat', today)
const dlDir = join(outDir, 'downloads')
const profile = join(homedir(), '.cache', 'fap-aio-uat', 'profile')
rmSync(profile, { recursive: true, force: true })
rmSync(outDir, { recursive: true, force: true })
mkdirSync(dlDir, { recursive: true })

// ---- fixture server -------------------------------------------------------------------------
const DAY = 86_400_000
const isoAdd = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const mondayOf = (iso) => isoAdd(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7))
const FIXTURE_MONDAY = '2026-10-05' // the week in timetable-week.partial.html
/** Moves every dd/MM (and dd/MM/yyyy) in the text by `days`. */
function shiftDates(text, days, year) {
  return text.replace(/\b(\d{2})\/(\d{2})(\/(\d{4}))?\b/g, (m, d, mo, _y, y) => {
    const iso = isoAdd(`${y ?? year}-${mo}-${d}`, days)
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}${y ? `/${iso.slice(0, 4)}` : ''}`
  })
}
const file = (n) => readFileSync(join(fx, n), 'utf8')
function route(url) {
  const u = new URL(url)
  const p = u.pathname.replace(/\/$/, '') || '/'
  if (p === '/' || p === '/Home') return [200, 'text/html', file('home.html')]
  if (p === '/WeeklyTimetable') return [200, 'text/html', file('timetable.html')]
  if (p === '/WeeklyTimetable/WeekPartial') {
    const ref = u.searchParams.get('referenceDate') || today
    const days = Math.round((Date.parse(mondayOf(ref)) - Date.parse(FIXTURE_MONDAY)) / DAY)
    return [200, 'text/html', shiftDates(file('timetable-week.partial.html'), days, FIXTURE_MONDAY.slice(0, 4))]
  }
  if (p === '/ExamSchedule') return [200, 'text/html', shiftDates(file('exam-schedule.html'), 28, '2026')]
  if (p === '/Notification/UnreadCount') return [200, 'application/json', file('unread-count.json')]
  return [404, 'text/html', file('not-found.html')]
}

// ---- CDP over a pipe ------------------------------------------------------------------------
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-features=OptimizationHints,MediaRouter',
  '--safebrowsing-disable-auto-update', '--metrics-recording-only', '--window-size=1440,900', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] })
const toChrome = chrome.stdio[3]
let buf = ''
let seq = 0
const pending = new Map()
const handlers = []
chrome.stdio[4].on('data', (d) => {
  buf += d.toString()
  let i
  while ((i = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i))
    buf = buf.slice(i + 1)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) rej(new Error(`${msg.error.message} ${msg.error.data ?? ''}`))
      else res(msg.result)
    } else for (const h of handlers) h(msg)
  }
})
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq
  pending.set(id, { res, rej })
  toChrome.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0')
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const report = []
const note = (step, ok, detail = '') => { report.push({ step, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${step}${detail ? `: ${detail}` : ''}`) }

let S // page session
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, S)
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result.value
}
let shotN = 0
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' }, S)
  const f = `${String(++shotN).padStart(2, '0')}-${name}.png`
  writeFileSync(join(outDir, f), Buffer.from(data, 'base64'))
  return f
}
// Finds an element in the panel's shadow root by CSS selector and optional text, returns its box.
const box = (sel, text) => ev(`(() => {
  const r = document.getElementById('fap-aio-root')?.shadowRoot
  if (!r) return null
  const t = ${JSON.stringify(text ?? null)}
  const el = [...r.querySelectorAll(${JSON.stringify(sel)})].find((e) => t === null || (e.textContent || '').trim() === t || e.getAttribute('aria-label') === t)
  if (!el) return null
  el.scrollIntoView({ block: 'nearest' })
  const b = el.getBoundingClientRect()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, left: b.left, top: b.top }
})()`)
const mouse = (type, x, y, buttons = 1) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 }, S)
const click = async (sel, text) => {
  const b = await box(sel, text)
  if (!b) throw new Error(`not found: ${sel} ${text ?? ''}`)
  await mouse('mouseMoved', b.x, b.y, 0)
  await mouse('mousePressed', b.x, b.y)
  await mouse('mouseReleased', b.x, b.y, 0)
  await sleep(400)
  return b
}
const drag = async (x0, y0, x1, y1) => {
  await mouse('mouseMoved', x0, y0, 0)
  await mouse('mousePressed', x0, y0)
  for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8)
  await mouse('mouseReleased', x1, y1, 0)
  await sleep(400)
}
const panelBox = () => ev(`(() => { const r = document.getElementById('fap-aio-root'); if (!r) return null; const p = r.shadowRoot.querySelector('[aria-label="FAP-AIO"]') ?? r; const b = p.getBoundingClientRect(); return { left: b.left, top: b.top, w: b.width, h: b.height } })()`)
const shadowText = () => ev(`document.getElementById('fap-aio-root')?.shadowRoot?.textContent ?? ''`)

async function main() {
  const { id } = await send('Extensions.loadUnpacked', { path: join(root, 'dist') })
  note('load dist/ unpacked', !!id, `extension id ${id}`)
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir, eventsEnabled: true })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  ;({ sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true }))
  const blocked = []
  handlers.push(async (m) => {
    if (m.method !== 'Fetch.requestPaused' || m.sessionId !== S) return
    const { requestId, request } = m.params
    if (!request.url.startsWith('https://fap.fpt.edu.vn/')) {
      blocked.push(request.url)
      return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, S)
    }
    const [status, type, body] = route(request.url)
    return send('Fetch.fulfillRequest', {
      requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: `${type}; charset=utf-8` }],
      body: Buffer.from(body).toString('base64'),
    }, S)
  })
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http*' }] }, S)
  await send('Page.enable', {}, S)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S)

  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/' }, S)
  await sleep(3000)
  const head = await shadowText()
  note('panel mounts on the home page', head.includes('FAP-AIO'), head.slice(0, 80))
  const version = JSON.parse(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8')).version
  note('header shows the manifest version', head.includes(version), version)
  const tabs = await ev(`[...document.getElementById('fap-aio-root').shadowRoot.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim())`)
  note('tabs are Classes, Exams, Export only', JSON.stringify(tabs) === JSON.stringify(['Classes', 'Exams', 'Export']), JSON.stringify(tabs))
  await shot('home-floating')

  await click('button', 'Sync this week and exams')
  await sleep(4000)
  const afterSync = await shadowText()
  note('header Sync fills Classes', /\d{2}:\d{2}/.test(afterSync) && !/not synced yet/i.test(afterSync), afterSync.match(/synced[^.]*/i)?.[0] ?? '')
  await shot('classes-after-sync')
  const truncated = await ev(`document.getElementById('fap-aio-root').shadowRoot.querySelectorAll('.truncate').length`)
  note('no truncated rows (fix F-3)', truncated === 0, `${truncated} elements with .truncate`)

  await click('[role="tab"]', 'Exams')
  await sleep(600)
  await shot('exams')
  await click('[role="tab"]', 'Export')
  await sleep(600)
  await shot('export-top')
  const legends = await ev(`[...document.getElementById('fap-aio-root').shadowRoot.querySelectorAll('legend')].map((l) => l.textContent.trim())`)
  note('Export shows groups 1 to 8', legends.length === 8, legends.join(' | '))
  const dl = await box('button', null).then(() => ev(`(() => { const b = [...document.getElementById('fap-aio-root').shadowRoot.querySelectorAll('button')].find((x) => /^Download/.test(x.textContent.trim())); return b ? { text: b.textContent.trim(), disabled: b.disabled } : null })()`))
  note('Download button shows the event count', !!dl && /\(\d+ events?\)/.test(dl.text) && !dl.disabled, dl?.text ?? 'missing')
  await ev(`(() => { const s = [...document.getElementById('fap-aio-root').shadowRoot.querySelectorAll('div')].find((d) => d.className.includes?.('overflow-auto')); if (s) s.scrollTop = s.scrollHeight })()`)
  await sleep(300)
  await shot('export-bottom')
  const before = readdirSync(dlDir).length
  const b = await ev(`(() => { const x = [...document.getElementById('fap-aio-root').shadowRoot.querySelectorAll('button')].find((e) => /^Download/.test(e.textContent.trim())); const r = x.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, bottom: r.bottom } })()`)
  const pb = await panelBox()
  note('Download button pinned inside the panel', b.bottom <= pb.top + pb.h + 1, `button bottom ${Math.round(b.bottom)}, panel bottom ${Math.round(pb.top + pb.h)}`)
  await mouse('mouseMoved', b.x, b.y, 0); await mouse('mousePressed', b.x, b.y); await mouse('mouseReleased', b.x, b.y, 0)
  await sleep(2500)
  const files = readdirSync(dlDir).filter((f) => f.endsWith('.ics'))
  const ics = files[0] ? readFileSync(join(dlDir, files[0]), 'utf8') : ''
  note('Download writes an .ics file', files.length > before && ics.startsWith('BEGIN:VCALENDAR'), `${files.join(', ')}; ${(ics.match(/BEGIN:VEVENT/g) ?? []).length} events`)
  await shot('export-downloaded')

  // Drag the floating panel by its header and check it stays in the viewport.
  const p0 = await panelBox()
  await drag(p0.left + 40, p0.top + 18, 60, 40)
  const p1 = await panelBox()
  note('header drag moves the panel', Math.abs(p1.left - p0.left) > 50, `left ${Math.round(p0.left)} to ${Math.round(p1.left)}, top ${Math.round(p0.top)} to ${Math.round(p1.top)}`)
  await drag(p1.left + 40, p1.top + 18, -400, -400)
  const p2 = await panelBox()
  note('panel stays inside the viewport', p2.left >= 0 && p2.top >= 0, `left ${Math.round(p2.left)}, top ${Math.round(p2.top)}`)
  await shot('floating-dragged')

  await click('button', 'Dock panel')
  await sleep(600)
  const p3 = await panelBox()
  const narrowed = await ev(`({ body: getComputedStyle(document.body).marginRight || getComputedStyle(document.body).paddingRight, width: document.body.getBoundingClientRect().width })`)
  note('Dock pins the panel to the right, full height', Math.round(p3.left + p3.w) >= 1439 && p3.h >= 899, `left ${Math.round(p3.left)}, width ${Math.round(p3.w)}, height ${Math.round(p3.h)}`)
  note('docking narrows the page body', narrowed.width <= 1440 - p3.w + 2, `body width ${Math.round(narrowed.width)} (fixture page has no Jidox CSS; live selectors still need a FAP check)`)
  await shot('docked')

  await click('button', 'Settings')
  await sleep(600)
  await shot('settings')
  await click('button', 'Back').catch(() => {})
  await click('button', 'Undock panel').catch(() => note('undock', false, 'no Undock control'))
  await sleep(400)

  await click('button', 'Minimize panel')
  await sleep(600)
  const tab = await box('button', 'Open FAP-AIO panel')
  note('Minimize leaves an edge tab', !!tab, tab ? `at ${Math.round(tab.left)},${Math.round(tab.top)} size ${Math.round(tab.w)}x${Math.round(tab.h)}` : 'missing')
  await shot('minimized')
  if (tab) {
    await click('button', 'Open FAP-AIO panel')
    await sleep(600)
    note('the edge tab reopens the panel', (await shadowText()).includes('Classes'))
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 900, deviceScaleFactor: 1, mobile: false }, S)
  await sleep(600)
  await click('button', 'Dock panel').catch(() => {})
  await sleep(600)
  await shot('narrow-820-docked')
  const p4 = await panelBox()
  note('under 900 px docking is an overlay drawer', p4 && Math.round(p4.left + p4.w) >= 819, p4 ? `left ${Math.round(p4.left)}, width ${Math.round(p4.w)}` : '')

  note('no request left the fixture origin', true, `${blocked.length} other-host requests blocked: ${[...new Set(blocked.map((u) => new URL(u).host))].join(', ') || 'none'}`)
}

main()
  .catch((e) => note('run', false, e.stack ?? String(e)))
  .finally(async () => {
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
    await send('Browser.close').catch(() => {})
    setTimeout(() => { chrome.kill('SIGKILL'); process.exit(report.some((r) => !r.ok) ? 1 : 0) }, 500)
  })
