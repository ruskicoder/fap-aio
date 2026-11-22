#!/usr/bin/env node
// M4 browser check (conventions rule 10) without live FAP: the M3 check (tools/uat/m3-check.mjs) with the
// M4 screens: the Theme view (preview, apply, FAP default), the theme editor and the CSS editor window, the
// compact, wide and sticky switches, and the Classic layout on the home and grade pages. The Classic top
// navigation (APP-7.4) waits on G-SELECTORS and is not checked; the timetable cards need FAP's own partial
// loader, which the fixture server does not run, so the unit tests cover them.
// Added 2026-11-22: each dark preset (fix F-24) with screenshots and text contrast of the welcome, Today and
// Settings; the sticky Settings tabs at 320 px (fix F-23); the capstone card in Info (INF-7.1).
// A headless Chrome loads dist/ through
// CDP Extensions.loadUnpacked and every request to https://fap.fpt.edu.vn is answered from the
// anonymized fixtures in test/fixtures/en (week partials and exams shifted to the current dates).
// Every other host the page requests is blocked, and Chrome's background services are switched off,
// so nothing reaches FAP or Cloudflare. Screenshots and a report go
// to ignore/uat/<date>/. Usage: node tools/uat/m4-check.mjs  (run through the machine's heavy lock)
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '..')
const fx = join(root, 'test', 'fixtures', 'en')
const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
const outDir = join(root, 'ignore', 'uat', `${today}-m4`)
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
  // INF-7.1: the synthetic capstone card (values invented).
  if (p === '/Account') return [200, 'text/html', `<!doctype html><html><body>${file('account-capstone.partial.html')}</body></html>`]
  if (p === '/Application/Catalog') return [200, 'text/html', file('application-catalog.html')]
  if (p === '/Application/GetFormSchema') return [200, 'application/json', file('application-form-schema.json')]
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


  // ---- M4: themes ----
  const sheetsText = () => ev(`[...document.adoptedStyleSheets].map((s) => [...s.cssRules].map((r) => r.cssText).join(' ')).join(' ')`)
  const shadowSwitch = (label) => ev(`(() => { const r = ${root$}; const sw = [...r.querySelectorAll('[role="switch"]')].find((x) => (x.getAttribute('aria-labelledby') ?? '').split(' ').some((id) => r.getElementById(id)?.textContent?.trim() === ${JSON.stringify(label)})); sw?.click(); return !!sw })()`)
  await click('button', 'Settings')
  await sleep(600)
  await click('button', 'Choose a theme')
  await sleep(800)
  await shot('theme-view')
  const rowsClipped = await ev(`[...${root$}.querySelectorAll('button, p, li')].filter((e) => e.scrollWidth > e.clientWidth + 1 && !e.matches('[aria-label^="Alerts"]')).map((e) => e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30))`)
  note('nothing clipped in the Theme view', rowsClipped.length === 0, rowsClipped.join(' | ') || 'none')
  await click('button', 'Preview Glassmorphism Dark')
  await sleep(600)
  note('a preview themes this page without saving', (await ev('document.documentElement.getAttribute("data-bs-theme")')) === 'dark', '')
  // Glassmorphism is a dark theme since F-24; Liquid Glass checks a light theme with glass here.
  await click('button', 'Apply Liquid Glass')
  await sleep(800)
  const applied = await sheetsText()
  note('Apply puts the theme on the page', (await ev('document.documentElement.getAttribute("data-bs-theme")')) === 'light' && applied.includes('blur(20px)'), '')
  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/Report/Transcript' }, S)
  await sleep(3000)
  note('the applied theme stays on the next page', (await sheetsText()).includes('blur(20px)'), '')
  await shot('theme-on-transcript')
  await click('button', 'Settings')
  await sleep(600)
  await click('button', 'Choose a theme')
  await sleep(800)
  await click('button', 'Duplicate Frutiger Aero Blue')
  await sleep(500)
  await click('button', 'Edit Frutiger Aero Blue copy')
  await sleep(800)
  // F-21: the CSS editor is its own extension window; the panel only opens it.
  note('the panel holds no code editor', !(await ev(`!!${root$}.querySelector('.cm-editor')`)), '')
  await click('button', 'Open the CSS editor')
  let edTarget = null
  for (let i = 0; i < 20 && !edTarget; i++) {
    await sleep(250)
    edTarget = (await send('Target.getTargets')).targetInfos.find((t) => t.url.includes('/src/pages/theme-editor/editor.html'))
  }
  note('Open the CSS editor opens its own window', !!edTarget, edTarget?.url.replace(/^chrome-extension:\/\/[a-z]+/, '') ?? '')
  const { sessionId: E } = await send('Target.attachToTarget', { targetId: edTarget.targetId, flatten: true })
  const evE = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, E)).result.value
  await sleep(1200)
  note('the editor window shows the theme', (await evE(`document.querySelector('h1')?.textContent ?? ''`)) === 'Custom CSS for Frutiger Aero Blue copy', '')
  await evE(`(() => { const c = document.querySelector('.cm-content'); c.focus(); return !!c })()`)
  await send('Input.insertText', { text: '.card { outline: 3px solid red; }}' }, E)
  await sleep(1500)
  const cssStatus = await evE(`[...document.querySelectorAll('[role="status"]')].map((s) => s.textContent).find((t) => /Line \\d+, column \\d+/.test(t)) ?? ''`)
  note('a CSS error shows its line and column and keeps the last valid CSS', cssStatus.includes('last valid CSS stays applied'), cssStatus.slice(0, 100))
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }, E)
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }, E)
  await sleep(1500)
  note('valid CSS previews on the FAP page', /outline:[^;]*3px/.test(await sheetsText()), '')
  const shotE = await send('Page.captureScreenshot', { format: 'png' }, E)
  writeFileSync(join(outDir, `${String(++shotN).padStart(2, '0')}-css-editor-window.png`), Buffer.from(shotE.data, 'base64'))
  await evE(`[...document.querySelectorAll('button')].find((b) => b.textContent === 'Save and apply').click()`)
  await sleep(1000)
  note('Save and apply keeps the CSS for every page', /outline:[^;]*3px/.test(await sheetsText()) && (await shadowText()).includes('lines of custom CSS'), '')
  await evE('window.close()').catch(() => {})
  await sleep(500)
  await click('button', 'Save')
  await sleep(800)
  await click('button', 'Use FAP default')
  await sleep(600)
  note('FAP default removes every theme sheet', !/outline:[^;]*3px/.test(await sheetsText()) && !(await ev('document.documentElement.hasAttribute("data-bs-theme")')), '')
  await click('button', 'Back').catch(() => {})
  await sleep(400)

  // ---- M4: layout ----
  await click('button', 'Settings')
  await sleep(600)
  const sw = []
  for (const l of ['Compact FAP pages', 'Wide FAP pages', 'Sticky table headers', 'Classic FAP layout']) sw.push(await shadowSwitch(l))
  await sleep(500)
  note('Appearance lists compact, wide, sticky and Classic switches', sw.every(Boolean), JSON.stringify(sw))
  const cls = await ev(`document.documentElement.className`)
  note('the switches apply without reload', ['fap-aio-compact', 'fap-aio-wide', 'fap-aio-sticky', 'fap-aio-classic'].every((c) => cls.includes(c)), cls)
  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/' }, S)
  await sleep(3000)
  const dir = await ev(`document.querySelector('[data-fap-aio-classic="home-directory"]')?.shadowRoot?.textContent ?? ''`)
  note('Classic shows the link directory on the home page', dir.includes('Registration/Application') && dir.includes('Load deadlines'), '')
  await ev(`document.querySelector('[data-fap-aio-classic="home-directory"]').scrollIntoView()`)
  await shot('classic-home')
  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/Report/Grade' }, S)
  await sleep(3000)
  const rep = await ev(`(() => { const h = document.querySelector('[data-fap-aio-classic="grade-report-term-cards"]'); return h ? [h.shadowRoot.querySelectorAll('[role=tab]').length, h.shadowRoot.querySelectorAll('.card').length] : null })()`)
  note('Classic shows term tabs and course cards on the grade report', !!rep && rep[0] > 0 && rep[1] > 0, JSON.stringify(rep))
  await shot('classic-grade')
  await click('button', 'Settings')
  await sleep(600)
  await shadowSwitch('Classic FAP layout')
  await sleep(600)
  note('Classic off restores the page without reload', !(await ev(`!!document.querySelector('[data-fap-aio-classic]')`)), '')

  // ---- INF-7.1: the capstone card in Info. ----
  await click('button', 'Back').catch(() => {})
  await sleep(400)
  await click('[role="tab"]', 'Info')
  await sleep(2500)
  const cap = await ev(`(() => { const s = ${root$}.querySelector('section[aria-labelledby="aio-capstone"]'); return s ? { text: s.textContent, vi: s.querySelector('[lang="vi"]')?.textContent ?? '' } : null })()`)
  note('Info shows the capstone card with both titles and the update date', !!cap && cap.text.includes('Smart campus parking assistant using computer vision') && cap.vi.startsWith('Trợ lý đỗ xe') && cap.text.includes('Updated 15 Nov 2026'), cap ? cap.text.slice(0, 90) : 'no card')
  await shot('info-capstone')

  // ---- F-23: the Settings search and section buttons stay at the top, also at 320 px. ----
  await click('button', 'Settings')
  await sleep(800)
  const stick = (label) => ev(`(() => {
    const r = ${root$}
    const head = r.querySelector('input[aria-label="Search settings"]').closest('.sticky')
    let box = head.parentElement; while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
    const nav = head.querySelector('nav[aria-label="Settings sections"]')
    const nb = nav.getBoundingClientRect()
    const btns = [...nav.querySelectorAll('button')]
    const clipped = btns.filter((b) => { const x = b.getBoundingClientRect(); return x.left < nb.left - 0.5 || x.right > nb.right + 0.5 || b.scrollWidth > b.clientWidth + 1 }).map((b) => b.textContent)
    return { label: ${JSON.stringify(label)}, headTop: Math.round(head.getBoundingClientRect().top - box.getBoundingClientRect().top), scrolled: Math.round(box.scrollTop), tabs: btns.map((b) => b.textContent), current: btns.find((b) => b.getAttribute('aria-current') === 'true')?.textContent ?? null, clipped, navScroll: nav.scrollWidth > nav.clientWidth + 1, width: Math.round(r.querySelector('[aria-label="FAP-AIO"]').getBoundingClientRect().width) }
  })()`)
  await ev(`(() => { const r = ${root$}; let box = r.querySelector('input[aria-label="Search settings"]').closest('.sticky').parentElement; while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement; box.scrollTop = box.scrollHeight })()`)
  await sleep(500)
  const atEnd = await stick('end')
  note('Settings search and section buttons stay at the top while the page scrolls (F-23)', atEnd.scrolled > 200 && Math.abs(atEnd.headTop) <= 1 && atEnd.tabs.length >= 6, `scrolled ${atEnd.scrolled}px, header at ${atEnd.headTop}px, ${atEnd.tabs.length} buttons, active ${atEnd.current}`)
  await shot('settings-sticky-end')
  await click('button', 'General')
  await sleep(400)
  await click('button', 'About')
  await sleep(600)
  const atAbout = await stick('about')
  // The last section may not reach the header line at the end of the page; it must be in view below the header.
  const about = await ev(`(() => { const r = ${root$}; const h = r.getElementById('aio-set-about').getBoundingClientRect(); const head = r.querySelector('input[aria-label="Search settings"]').closest('.sticky'); let box = head.parentElement; while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement; return { below: Math.round(h.top - head.getBoundingClientRect().bottom), inView: h.bottom <= box.getBoundingClientRect().bottom } })()`)
  note('a section button scrolls to its section and becomes the active one', atAbout.current === 'About' && about.below >= 0 && about.inView, `About heading ${about.below}px below the header, in view ${about.inView}, active ${atAbout.current}`)
  await click('button', 'Schedule')
  await sleep(600)
  const sched = await stick('schedule')
  const schedBelow = await ev(`Math.round(${root$}.getElementById('aio-set-schedule').getBoundingClientRect().top - ${root$}.querySelector('input[aria-label="Search settings"]').closest('.sticky').getBoundingClientRect().bottom)`)
  note('a middle section lands just below the header', sched.current === 'Schedule' && schedBelow >= 0 && schedBelow <= 12, `Schedule heading ${schedBelow}px below the header, active ${sched.current}`)
  // 320 px: the narrowest panel. The row wraps, so every button stays whole.
  await ev(`(() => { const p = ${root$}.querySelector('[aria-label="FAP-AIO"]'); p.style.width = '320px'; p.style.minWidth = '320px'; p.style.maxWidth = '320px' })()`)
  await sleep(500)
  const narrow = await stick('320')
  note('at 320 px no section button is clipped and the row does not scroll sideways', narrow.width <= 322 && narrow.clipped.length === 0 && !narrow.navScroll && narrow.tabs.length === atEnd.tabs.length, `panel ${narrow.width}px, ${narrow.tabs.length} buttons, clipped ${narrow.clipped.join(', ') || 'none'}`)
  await shot('settings-sticky-320')
  await ev(`(() => { const p = ${root$}.querySelector('[aria-label="FAP-AIO"]'); p.style.width = ''; p.style.minWidth = ''; p.style.maxWidth = '' })()`)
  await click('button', 'Back').catch(() => {})
  await sleep(400)

  // ---- F-24: dark presets. Every visible text in the panel is measured against the background it sits on. ----
  const measure = () => ev(`(() => {
    const root = document.getElementById('fap-aio-root').shadowRoot
    const parse = (c) => { const m = c.match(/[\\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0] }
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const blend = (top, under) => { const a = top[3] ?? 1; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)) }
    const bgOf = (el) => {
      const layers = []
      for (let e = el; e; e = e.parentElement || (e.getRootNode() instanceof ShadowRoot ? e.getRootNode().host : null)) {
        const c = parse(getComputedStyle(e).backgroundColor); const a = c[3] ?? 1
        if (a > 0) { layers.push([c[0], c[1], c[2], a]); if (a >= 1) break }
      }
      return layers.reverse().reduce((under, top) => blend(top, under), [255, 255, 255])
    }
    const dimmed = (el) => { for (let e = el; e && e !== root.host; e = e.parentElement) { if (e.disabled || e.getAttribute?.('aria-disabled') === 'true' || Number(getComputedStyle(e).opacity) < 1) return true } return false }
    const out = []; const icons = []
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || dimmed(el)) continue
      if (el.tagName === 'svg') { const col = parse(getComputedStyle(el).color); icons.push(ratio(col, bgOf(el))); continue }
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      if (getComputedStyle(el).visibility === 'hidden') continue
      const col = parse(getComputedStyle(el).color)
      out.push({ t: el.textContent.trim().slice(0, 30), r: ratio(blend(col, bgOf(el)), bgOf(el)) })
    }
    const low = out.filter((o) => o.r < 4.5)
    return { n: out.length, min: Math.min(...out.map((o) => o.r)).toFixed(2), seven: Math.round(100 * out.filter((o) => o.r >= 7).length / Math.max(1, out.length)), low: low.slice(0, 4).map((o) => o.t + ' ' + o.r.toFixed(2)), lowCount: low.length, iconMin: icons.length ? Math.min(...icons).toFixed(2) : 'none' }
  })()`)
  for (const theme of ['Glassmorphism', 'Glassmorphism Dark', 'Minimalist Black', 'Liquid Glass Dark', 'Claymorphism Vibrant Dark']) {
    const slug = theme.toLowerCase().replace(/ /g, '-')
    await click('button', 'Settings')
    await sleep(600)
    await click('button', 'Choose a theme')
    await sleep(600)
    await click('button', `Apply ${theme}`)
    await sleep(800)
    const scheme = await ev(`document.getElementById('fap-aio-root').getAttribute('data-scheme')`)
    await click('button', 'Back')
    await sleep(600)
    await ev(`${root$}.querySelector('[aria-label="Search settings"]')?.closest('div')?.scrollIntoView()`)
    await shot(`dark-${slug}-settings`)
    const mSet = await measure()
    await click('button', 'Show the welcome')
    await sleep(800)
    await shot(`dark-${slug}-welcome`)
    const mWel = await measure()
    await click('button', 'Skip').catch(() => {})
    await sleep(400)
    await click('button', 'Back').catch(() => {})
    await sleep(400)
    await click('[role="tab"]', 'Today')
    await sleep(800)
    await shot(`dark-${slug}-today`)
    const mToday = await measure()
    const all = [mSet, mWel, mToday]
    note(`${theme}: dark panel, no text under 4.5:1, icons at 3:1 or more`, scheme === 'dark' && all.every((m) => m.lowCount === 0 && (m.iconMin === 'none' || Number(m.iconMin) >= 3)),
      all.map((m, i) => `${['settings', 'welcome', 'today'][i]} ${m.n} texts min ${m.min} (${m.seven}% at 7:1) icons min ${m.iconMin}${m.lowCount ? ' LOW ' + m.low.join(', ') : ''}`).join('; '))
  }
  await click('button', 'Settings')
  await sleep(600)
  await click('button', 'Choose a theme')
  await sleep(600)
  await click('button', 'Use FAP default')
  await sleep(600)
  await click('button', 'Back').catch(() => {})
  await sleep(400)
  await click('button', 'Back').catch(() => {})
  await sleep(400)
  note('no request left the fixture origin', true, `${blocked.length} other-host requests blocked: ${[...new Set(blocked.map((u) => new URL(u).host))].join(', ') || 'none'}`)
}

main()
  .catch((e) => note('run', false, e.stack ?? String(e)))
  .finally(async () => {
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
    await send('Browser.close').catch(() => {})
    setTimeout(() => { chrome.kill('SIGKILL'); process.exit(report.some((r) => !r.ok) ? 1 : 0) }, 500)
  })
