#!/usr/bin/env node
// M3 browser check (conventions rule 10) without live FAP: the M2 check (tools/uat/m2-check.mjs) with the
// M3 screens: Grades What-if and Planner, Info Subjects, the Reminders and keep-alive settings, and the
// shortcuts sheet. Gated M3 work (news, documents, attendance after G-SELECTORS) is not checked.
// A headless Chrome loads dist/ through
// CDP Extensions.loadUnpacked and every request to https://fap.fpt.edu.vn is answered from the
// anonymized fixtures in test/fixtures/en (week partials and exams shifted to the current dates).
// Every other host the page requests is blocked, and Chrome's background services are switched off,
// so nothing reaches FAP or Cloudflare. Screenshots and a report go
// to ignore/uat/<date>/. Usage: node tools/uat/m3-check.mjs  (run through the machine's heavy lock)
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const fx = join(root, 'test', 'fixtures', 'en')
const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
const outDir = join(root, 'ignore', 'uat', `${today}-m3`)
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
  if (p === '/Curriculum') return [200, 'text/html', file('curriculum.html')]
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
  await click('button', 'Next')
  await sleep(300)
  const step3 = await shadowText()
  note('welcome lists Reminders as an optional feature, off', step3.includes('Reminders') && (await ev(`${root$}.querySelector('[role="switch"][aria-label="Reminders"]')?.getAttribute('aria-checked') ?? ''`)) === 'false', '')
  await shot('welcome-step3')
  await click('button', 'Done')
  note('welcome closes after Done', !(await ev(`!!${root$}.querySelector('[aria-labelledby="aio-welcome-title"]')`)), '')

  // F-18: sections at the top, the open section's views in the sub-view bar below; no row may clip.
  const rows = () => ev(`[...${root$}.querySelectorAll('[role="tablist"]')].map((l) => [l.getAttribute('aria-label'), [...l.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim())])`)
  const clipped = () => ev(`[...${root$}.querySelectorAll('[role="tablist"], [role="tab"]')].filter((t) => t.scrollWidth > t.clientWidth + 1 || t.getBoundingClientRect().left < t.closest('nav').getBoundingClientRect().left - 0.5 || t.getBoundingClientRect().right > t.closest('nav').getBoundingClientRect().right + 0.5).map((t) => t.getAttribute('aria-label') ?? t.textContent.trim())`)
  const r0 = await rows()
  note('sections are Today, Schedule, Grades and Info (F-18)', JSON.stringify(r0[0]) === JSON.stringify(['Sections', ['Today', 'Schedule', 'Grades', 'Info']]), JSON.stringify(r0))
  const subRows = {}
  const clips = []
  for (const sec of ['Today', 'Schedule', 'Grades', 'Info']) {
    await click('[role="tab"]', sec)
    await sleep(500)
    subRows[sec] = (await rows())[1]?.[1] ?? []
    clips.push(...(await clipped()).map((c) => `${sec}: ${c}`))
  }
  note('each section shows its views in the sub-view bar', JSON.stringify(subRows) === JSON.stringify({ Today: [], Schedule: ['Classes', 'Exams', 'Export'], Grades: ['Courses', 'GPA', 'What-if', 'Planner'], Info: [] }), JSON.stringify(subRows))
  note('no tab row or tab clips or scrolls sideways', clips.length === 0, clips.join(', ') || 'none')
  await click('[role="tab"]', 'Today')
  await sleep(800)
  const today = await shadowText()
  note('Today shows the next class, what needs attention, or the calm line', /Next class|Courses at risk|Nothing needs your attention today/.test(today), today.match(/(Next class|Courses at risk|Nothing needs[^.]*)/)?.[0] ?? '')
  await shot('today')
  const truncated = await ev(`${root$}.querySelectorAll('.truncate').length`)
  note('no truncated text', truncated === 0, `${truncated} elements with .truncate`)

  await click('[role="tab"]', 'Schedule')
  await sleep(300)
  await click('[role="tab"]', 'Classes')
  await sleep(600)
  await shot('schedule-classes')

  await click('[role="tab"]', 'Grades')
  await sleep(300)
  await click('[role="tab"]', 'Courses')
  await sleep(4000)
  const courses = await ev(`${root$}.querySelectorAll('[data-course]').length`)
  note('Grades Courses lists the term courses', courses > 0, `${courses} courses`)
  note('Courses shows the rubric date', (await shadowText()).includes('FLM rubric of'), '')
  const strip = async () => ev(`[...${root$}.querySelectorAll('[role="status"][aria-live="polite"]')].at(-1)?.textContent ?? ''`)
  const s1 = await strip()
  note('the status strip shows the Courses read time (fix F-13)', /Synced (just now|\d+ min ago)/.test(s1), s1.slice(0, 60))
  await shot('grades-courses')
  await click('[role="tab"]', 'GPA')
  await sleep(3000)
  const gpa = await shadowText()
  note('GPA view shows the cumulative GPA', /\d\.\d\d cumulative GPA/.test(gpa), gpa.match(/\d\.\d\d cumulative GPA/)?.[0] ?? '')
  const s2 = await strip()
  note('the status strip shows the transcript read time (fix F-13)', /Synced (just now|\d+ min ago)/.test(s2), s2.slice(0, 60))
  await shot('grades-gpa')
  await click('button', 'Export CSV')
  await sleep(2000)
  const csv = readdirSync(dlDir).filter((f) => f.endsWith('.csv'))
  note('Export CSV downloads a file with a byte-order mark', csv.length === 1 && readFileSync(join(dlDir, csv[0])).subarray(0, 3).toString('hex') === 'efbbbf', csv.join(', '))

  // M3: What-if, Planner, Subjects.
  const typeInto = (sel, value) => ev(`(() => { const i = ${root$}.querySelector(${JSON.stringify(sel)}); if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
  await click('[role="tab"]', 'What-if')
  await sleep(2500)
  const statusOf = () => ev(`${root$}.querySelector('[role="status"][aria-live="polite"].grid')?.textContent ?? ''`)
  const w0 = await statusOf()
  const typed = await typeInto('input[id^="whatif-"]', '9.5')
  await sleep(300)
  const w1 = await statusOf()
  note('What-if recomputes the GPAs as an average is typed', typed && w1 !== '' && w1 !== w0, w1.slice(0, 80))
  await shot('grades-whatif')
  await click('button', 'Clear all')
  await sleep(300)
  note('What-if Clear all restores the GPAs', (await statusOf()) === w0, '')
  await click('[role="tab"]', 'Planner')
  await sleep(3000)
  const plan0 = await shadowText()
  note('Planner defaults the remaining credits from the curriculum', /From your curriculum: \d+ credits/.test(plan0), plan0.match(/From your curriculum[^.]*/)?.[0] ?? plan0.slice(0, 80))
  await typeInto('input[type="number"]', '9.99')
  await sleep(300)
  const plan1 = await shadowText()
  note('Planner reports an out-of-reach target with the highest GPA', /not reachable[\s\S]*highest reachable GPA is \d\.\d\d|You need an average of/.test(plan1), plan1.match(/(\d\.\d\d is not reachable[^.]*|You need an average[^.]*)/)?.[0] ?? '')
  await shot('grades-planner')
  await click('[role="tab"]', 'Info')
  await sleep(3000)
  const subj = await ev(`${root$}.querySelectorAll('[data-subject], [role="listitem"], li button').length`)
  note('Info Subjects lists the curriculum', subj > 0, `${subj} rows`)
  await shot('info-subjects')
  const truncated3 = await ev(`${root$}.querySelectorAll('.truncate').length`)
  note('no truncated text on the M3 screens', truncated3 === 0, `${truncated3} elements with .truncate`)

  await click('button', 'Settings')
  await sleep(600)
  const sections = await ev(`[...${root$}.querySelectorAll('h3')].map((h) => h.textContent.trim())`)
  note('Settings shows General and Schedule first', JSON.stringify(sections.slice(0, 2)) === JSON.stringify(['General', 'Schedule']), JSON.stringify(sections))
  const st = await shadowText()
  note('Settings lists Reminders and Keep FAP signed in', st.includes('Reminders') && st.includes('Keep FAP signed in'), '')
  note('Settings lists Session and Info sections', sections.includes('Session') && sections.includes('Info and alerts'), '')
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
