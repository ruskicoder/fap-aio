#!/usr/bin/env node
// M2 browser check (conventions rule 10) without live FAP: the M1 harness (tools/uat/m1-check.mjs) with
// the M2 screens: first-run welcome, Today, Grades Courses and GPA, the transcript summary, the
// prediction under the mark sheet, Settings sections and the alerts inbox.
// A headless Chrome loads dist/ through
// CDP Extensions.loadUnpacked and every request to https://fap.fpt.edu.vn is answered from the
// anonymized fixtures in test/fixtures/en (week partials and exams shifted to the current dates).
// Every other host the page requests is blocked, and Chrome's background services are switched off,
// so nothing reaches FAP or Cloudflare. Screenshots and a report go
// to ignore/uat/<date>/. Usage: node tools/uat/m2-check.mjs  (run through the machine's heavy lock)
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const fx = join(root, 'test', 'fixtures', 'en')
const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
const outDir = join(root, 'ignore', 'uat', `${today}-m2`)
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
  if (p === '/Report/Transcript') return [200, 'text/html', file('transcript.html')]
  // A course in the query is the mark sheet partial; without one, the grade page with its selectors.
  if (p === '/Report/Grade') return [200, 'text/html', u.searchParams.get('courseId') ? file('grade-default.partial.html') : file('grade.html')]
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
  const root$ = `document.getElementById('fap-aio-root').shadowRoot`

  // First run: the panel opens docked with the welcome (panel-ux R9.1).
  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/' }, S)
  await sleep(3000)
  const welcome = await ev(`${root$}.querySelector('[aria-labelledby="aio-welcome-title"]')?.textContent ?? ''`)
  note('first run shows the welcome', welcome.includes('Welcome to FAP-AIO'), welcome.slice(0, 60))
  const docked = await panelBox()
  note('first run opens docked', docked && docked.h >= 899, docked ? `height ${Math.round(docked.h)}` : '')
  await shot('welcome-step1')
  await click('button', 'Next')
  await shot('welcome-step2')
  await click('button', 'Sync this week')
  await sleep(4000)
  note('welcome Sync this week syncs', (await shadowText()).includes('This week is synced.'), '')
  await click('button', 'Done')
  note('welcome closes after Done', !(await ev(`!!${root$}.querySelector('[aria-labelledby="aio-welcome-title"]')`)), '')

  const tabs = await ev(`[...${root$}.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim())`)
  note('tabs are the shipped views (flat, as in the agreed shell)', JSON.stringify(tabs) === JSON.stringify(['Today', 'Classes', 'Exams', 'Export', 'Courses', 'GPA']), JSON.stringify(tabs))
  const overflow = await ev(`[...${root$}.querySelectorAll('[role="tab"]')].filter((t) => t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent.trim())`)
  note('no tab label overflows its tab', overflow.length === 0, overflow.join(', ') || 'none')
  await click('[role="tab"]', 'Today')
  await sleep(800)
  const today = await shadowText()
  note('Today shows the next class or the calm line', /Next class|Nothing needs your attention today/.test(today), today.match(/(Next class|Nothing needs[^.]*)/)?.[0] ?? '')
  await shot('today')
  const truncated = await ev(`${root$}.querySelectorAll('.truncate').length`)
  note('no truncated text', truncated === 0, `${truncated} elements with .truncate`)

  await click('[role="tab"]', 'Classes')
  await sleep(600)
  await shot('schedule-classes')

  await click('[role="tab"]', 'Courses')
  await sleep(4000)
  const courses = await ev(`${root$}.querySelectorAll('[data-course]').length`)
  note('Grades Courses lists the term courses', courses > 0, `${courses} courses`)
  note('Courses shows the rubric date', (await shadowText()).includes('FLM rubric of'), '')
  await shot('grades-courses')
  await click('[role="tab"]', 'GPA')
  await sleep(3000)
  const gpa = await shadowText()
  note('GPA view shows the cumulative GPA', /\d\.\d\d cumulative GPA/.test(gpa), gpa.match(/\d\.\d\d cumulative GPA/)?.[0] ?? '')
  await shot('grades-gpa')
  await click('button', 'Export CSV')
  await sleep(2000)
  const csv = readdirSync(dlDir).filter((f) => f.endsWith('.csv'))
  note('Export CSV downloads a file with a byte-order mark', csv.length === 1 && readFileSync(join(dlDir, csv[0])).subarray(0, 3).toString('hex') === 'efbbbf', csv.join(', '))

  await click('button', 'Settings')
  await sleep(600)
  const sections = await ev(`[...${root$}.querySelectorAll('h3')].map((h) => h.textContent.trim())`)
  note('Settings shows General and Grades', JSON.stringify(sections) === JSON.stringify(['General', 'Grades']), JSON.stringify(sections))
  await shot('settings')
  await click('button', 'Back').catch(() => {})

  await click('[data-inbox-toggle]')
  await sleep(400)
  note('the bell opens the alerts inbox', await ev(`!!${root$}.querySelector('[role="dialog"][aria-label="Alerts"]')`), '')
  await shot('inbox')
  await click('button', 'Close alerts').catch(() => {})

  // Inline page blocks.
  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/Report/Transcript' }, S)
  await sleep(3000)
  const summary = await ev(`document.getElementById('fap-aio-transcript-summary')?.shadowRoot?.textContent ?? ''`)
  note('the transcript page shows the GPA summary', /cumulative/.test(summary), summary.slice(0, 80))
  const counted = await ev(`document.querySelectorAll('tr.fap-aio-gpa-counted').length`)
  note('counted rows are marked', counted > 0, `${counted} rows`)
  await shot('transcript-summary')
  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/Report/Grade' }, S)
  await sleep(3000)
  const inline = await ev(`document.getElementById('fap-aio-grade-inline')?.shadowRoot?.textContent ?? ''`)
  note('the grade page shows the prediction under the mark sheet', /Prediction by FAP-AIO/i.test(inline), inline.slice(0, 80))
  await shot('grade-inline')

  note('no request left the fixture origin', true, `${blocked.length} other-host requests blocked: ${[...new Set(blocked.map((u) => new URL(u).host))].join(', ') || 'none'}`)
}

main()
  .catch((e) => note('run', false, e.stack ?? String(e)))
  .finally(async () => {
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
    await send('Browser.close').catch(() => {})
    setTimeout(() => { chrome.kill('SIGKILL'); process.exit(report.some((r) => !r.ok) ? 1 : 0) }, 500)
  })
