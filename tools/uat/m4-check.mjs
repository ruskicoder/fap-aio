#!/usr/bin/env node
// M4 browser check (conventions rule 10) without live FAP: the M3 check (tools/uat/m3-check.mjs) with the
// M4 screens: the Theme view (preview, apply, FAP default), the theme editor and the CSS editor window, the
// compact, wide and sticky switches, and the Classic layout on the home and grade pages. The Classic top
// navigation (APP-7.4) waits on G-SELECTORS and is not checked; the timetable cards need FAP's own partial
// loader, which the fixture server does not run, so the unit tests cover them. GRD-7 (2026-11-22) adds the
// GPA scale switch, the Record view with its paced read job (progress, partial results, Cancel and Resume),
// the printable grade list window (content, options, print media, an A4 PDF), the Attendance view and the
// absence chip on the Courses cards.
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
// Grade pages per term (GRD-7.2): the four saved term pages, an empty course list for the other terms.
const selectedIn = (html, id) => html.slice(html.indexOf(`id="${id}"`)).match(/<option value="([^"]+)"[^>]*selected/)?.[1]
const GRADE_TERMS = Object.fromEntries(['grade-term-fa24.html', 'grade-term-sp26.html', 'grade-term-su24.html', 'grade-term-su25.html'].map((f) => [selectedIn(file(f), 'grade-report-term'), f]))
const emptyTerm = (id) => `<div class="content-page"><select id="grade-report-term"><option value="${id}" selected>Term</option></select><select id="grade-report-course"></select></div>`
// Attendance (GRD-7.4): one course of the current term has three absences of 15 sessions (last chance).
const LMO352 = file('attendance.html').match(/<option value="([^"]+)"[^>]*>\s*LMO Vidvpdnr/)?.[1]
let absences = 0
const withAbsences = file('attendance-set490.partial.html').replace(/attendance-status--present/g, (m) => (++absences <= 3 ? 'attendance-status--absent' : m))
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
  if (p === '/Application/Catalog') return [200, 'text/html', file('application-catalog.html')]
  if (p === '/Application/GetFormSchema') return [200, 'application/json', file('application-form-schema.json')]
  if (p === '/Curriculum') return [200, 'text/html', file('curriculum.html')]
  // A course in the query is the mark sheet partial; without one, the grade page with its selectors.
  if (p === '/Report/Grade') {
    const termId = u.searchParams.get('termId')
    if (u.searchParams.get('courseId')) return [200, 'text/html', file('grade-default.partial.html')]
    if (!termId) return [200, 'text/html', file('grade.html')]
    return [200, 'text/html', GRADE_TERMS[termId] ? file(GRADE_TERMS[termId]) : emptyTerm(termId)]
  }
  if (p === '/Report/Attendance') {
    const courseId = u.searchParams.get('courseId')
    if (courseId) return [200, 'text/html', courseId === LMO352 ? withAbsences : file('attendance-set490.partial.html')]
    return [200, 'text/html', u.searchParams.get('termId') ? file('attendance-term-su26.html') : file('attendance.html')]
  }
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
  note('each section shows its views in the sub-view bar', JSON.stringify(subRows) === JSON.stringify({ Today: [], Schedule: ['Classes', 'Exams', 'Export'], Grades: ['Courses', 'GPA', 'What-if', 'Planner', 'Record', 'Attendance'], Info: [] }), JSON.stringify(subRows))
  note('no tab row or tab clips or scrolls sideways', clips.length === 0, clips.join(', ') || 'none')
  await click('[role="tab"]', 'Today')
  await sleep(800)
  const today = await shadowText()
  note('Today shows the next class or the calm line', /Next class|Nothing needs your attention today/.test(today), today.match(/(Next class|Nothing needs[^.]*)/)?.[0] ?? '')
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

  // ---- GRD-7.1: the GPA scale switch ----
  const bigGpa = () => ev(`${root$}.querySelector('.text-2xl')?.textContent ?? ''`)
  const ten = await bigGpa()
  await click('button[aria-pressed]', '4-point (global)')
  await sleep(600)
  const four = await bigGpa()
  const gpaText4 = await shadowText()
  note('the 4-point scale converts the GPA (GRD-7.1)', /^\d\.\d\d$/.test(four) && Number(four) <= 4 && four !== ten && gpaText4.includes('cumulative GPA (4-point)') && gpaText4.includes('A 8.5 to 10 is 4'), `${ten} on 10, ${four} on 4`)
  await shot('grades-gpa-4-point')
  await click('[role="tab"]', 'Courses')
  await sleep(800)
  await click('[role="tab"]', 'GPA')
  await sleep(1500)
  note('the scale choice persists', (await bigGpa()) === four && (await ev(`${root$}.querySelector('[role="group"][aria-label="GPA scale"] button[aria-pressed="true"]')?.textContent ?? ''`)) === '4-point (global)', '')
  await click('button[aria-pressed]', '10-point (Vietnam)')
  await sleep(600)
  note('the 10-point scale is back', (await bigGpa()) === ten, ten)

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

  // ---- GRD-7.2: the Record view and its paced, resumable read ----
  // The bell's count badge overflows its button on purpose; the Theme view check leaves it out too.
  const clippedNow = () => ev(`[...${root$}.querySelectorAll('button, p, li, h3, td')].filter((e) => e.scrollWidth > e.clientWidth + 1 && !e.matches('[aria-label^="Alerts"]')).map((e) => e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30))`)
  // Term sections of the Record view (the panel itself is a section named FAP-AIO).
  const sectionsNow = () => ev(`[...${root$}.querySelectorAll('section[aria-label]')].filter((s) => s.querySelector(':scope > div > h3')).map((s) => s.getAttribute('aria-label'))`)
  await click('[role="tab"]', 'Record')
  await sleep(1500)
  note('Record offers to read the record (GRD-7.2)', (await shadowText()).includes('No record read yet'), '')
  await click('button', 'Read my record')
  await sleep(2500)
  const prog = await ev(`${root$}.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? null`)
  const progText = await ev(`${root$}.querySelector('[role="progressbar"]')?.parentElement?.textContent ?? ''`)
  note('Record shows progress while reading', prog !== null && /Reading \d+ of \d+/.test(progText), progText.slice(0, 90))
  note('Record shows partial results while it reads', (await sectionsNow()).length > 0, JSON.stringify(await sectionsNow()))
  await shot('record-reading')
  await click('button', 'Cancel')
  let stopped = ''
  for (let i = 0; i < 40 && !stopped.includes('Reading stopped at'); i++) { await sleep(500); stopped = await shadowText() }
  note('Cancel stops the read and offers Resume', stopped.includes('Reading stopped at') && !!(await box('button', 'Resume')), stopped.match(/Reading stopped at[^.]*/)?.[0] ?? '')
  await click('button', 'Resume')
  const t0 = Date.now()
  let finished = false
  while (!finished && Date.now() - t0 < 9 * 60_000) {
    await sleep(5000)
    finished = !(await ev(`!!${root$}.querySelector('[role="progressbar"]')`)) && (await shadowText()).includes('Record updated')
  }
  note('Resume finishes the read within the request budget', finished, `${Math.round((Date.now() - t0) / 1000)} s after Resume`)
  const recSections = await sectionsNow()
  note('Record lists every term newest first', recSections[0] === 'Fall2026' && recSections.at(-1) === 'Fall2023' && recSections.length === 10, JSON.stringify(recSections))
  await click('button', 'Details for LMO352')
  await sleep(400)
  note('a course expands to its mark sheet components', (await ev(`[...${root$}.querySelectorAll('caption')].some((c) => c.textContent === 'Mark sheet of LMO352')`)), '')
  const recText = await shadowText()
  note('Record shows grades with letters and the absence chip', /Grade: \d+\.\d \([A-F]\)/.test(recText) && /Absent \d+(\.\d)?%/.test(recText), recText.match(/Absent \d+(\.\d)?%/)?.[0] ?? '')
  const recClip = await clippedNow()
  note('nothing clipped in Record', recClip.length === 0, recClip.join(' | ') || 'none')
  note('no truncated text in Record', (await ev(`${root$}.querySelectorAll('.truncate').length`)) === 0, '')
  await shot('record')
  await click('button', 'Export CSV')
  await sleep(2000)
  const recCsv = readdirSync(dlDir).filter((f) => /^fap-aio-record-.*\.csv$/.test(f))
  note('Record exports CSV with a byte-order mark', recCsv.length === 1 && readFileSync(join(dlDir, recCsv[0])).subarray(0, 3).toString('hex') === 'efbbbf', recCsv.join(', '))
  await click('button', 'Export JSON')
  await sleep(2000)
  const recJson = readdirSync(dlDir).filter((f) => /^fap-aio-record-.*\.json$/.test(f))
  note('Record exports JSON', recJson.length === 1 && JSON.parse(readFileSync(join(dlDir, recJson[0]), 'utf8')).formatVersion === 1, recJson.join(', '))

  // ---- GRD-7.3: the printable grade list ----
  await click('button', 'Print or save as PDF')
  let prTarget = null
  for (let i = 0; i < 20 && !prTarget; i++) {
    await sleep(250)
    prTarget = (await send('Target.getTargets')).targetInfos.find((t) => t.url.includes('/src/pages/print/print.html'))
  }
  note('Print or save as PDF opens the print window (GRD-7.3)', !!prTarget, prTarget?.url.replace(/^chrome-extension:\/\/[a-z]+/, '') ?? '')
  const { sessionId: P } = await send('Target.attachToTarget', { targetId: prTarget.targetId, flatten: true })
  const evP = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, P)).result.value
  await send('Page.enable', {}, P)
  await sleep(1500)
  const pText = await evP(`document.querySelector('main')?.textContent ?? ''`)
  note('the grade list shows student, roll number, curriculum and the not-official note', ['Academic grade list', 'So Sriv Aamk', 'IR821902', 'OUV_BV_GN_21A', 'Generated by FAP-AIO from FAP data; not an official transcript'].every((x) => pText.includes(x)), '')
  const pSections = await evP(`[...document.querySelectorAll('main section[aria-label]')].map((s) => s.getAttribute('aria-label'))`)
  note('the grade list has the terms oldest first, then attendance', pSections[0] === 'Fall2023' && pSections.at(-1) === 'Attendance', JSON.stringify(pSections))
  note('the grade list shows term and cumulative GPAs', /Term GPA: \d\.\d\d[\s\S]*Cumulative GPA: \d\.\d\d/.test(pText), '')
  const comps = () => evP(`document.querySelectorAll('tr.component').length`)
  const c1 = await comps()
  await evP(`[...document.querySelectorAll('label')].find((l) => l.textContent.includes('Include components')).querySelector('input').click()`)
  await sleep(300)
  const c2 = await comps()
  note('Include components switches the component rows', c1 > 0 && c2 === 0, `${c1} then ${c2}`)
  await evP(`[...document.querySelectorAll('label')].find((l) => l.textContent.includes('Include components')).querySelector('input').click()`)
  await evP(`(() => { const s = document.querySelector('select'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await sleep(300)
  note('the print scale switch shows the 4-point GPA', (await evP(`document.querySelector('main').textContent`)).includes('4-point (global)'), '')
  const pClip = await evP(`[...document.querySelectorAll('main td, main th, main p, main h2')].filter((e) => e.scrollWidth > e.clientWidth + 1).length`)
  note('nothing clipped on the grade list', pClip === 0, `${pClip} clipped cells`)
  const shotP = await send('Page.captureScreenshot', { format: 'png' }, P)
  writeFileSync(join(outDir, `${String(++shotN).padStart(2, '0')}-print-window.png`), Buffer.from(shotP.data, 'base64'))
  await send('Emulation.setEmulatedMedia', { media: 'print' }, P)
  note('print media hides the controls', (await evP(`getComputedStyle(document.querySelector('[role="toolbar"]')).display`)) === 'none', '')
  await send('Emulation.setEmulatedMedia', { media: '' }, P)
  const pdf = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true }, P)
  const pdfBytes = Buffer.from(pdf.data, 'base64')
  writeFileSync(join(outDir, 'grade-list.pdf'), pdfBytes)
  const box0 = pdfBytes.toString('latin1').match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/)
  const pages = (pdfBytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  note('saving as PDF gives A4 pages', !!box0 && Math.abs(Number(box0[1]) - 595.3) < 2 && Math.abs(Number(box0[2]) - 841.9) < 2 && pages > 0, `${box0 ? `${box0[1]} x ${box0[2]} pt` : 'no MediaBox'}, ${pages} pages, grade-list.pdf`)
  await evP('window.close()').catch(() => {})
  await sleep(500)

  // ---- GRD-7.4: attendance ----
  await click('[role="tab"]', 'Attendance')
  let attCards = 0
  for (let i = 0; i < 30 && attCards < 4; i++) { await sleep(500); attCards = await ev(`${root$}.querySelectorAll('[data-attendance]').length`) }
  const attText = await shadowText()
  note('Attendance lists the current term\'s courses (GRD-7.4)', attCards === 4 && attText.includes('Attended:') && attText.includes('Exempt:'), `${attCards} courses`)
  note('a course at the limit is marked Last chance', attText.includes('Last chance') && attText.includes('Absent 20% of 20% allowed'), '')
  await shot('attendance')
  await ev(`(() => { const s = ${root$}.querySelector('select'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  let attCards2 = 0
  for (let i = 0; i < 30 && attCards2 !== 5; i++) { await sleep(500); attCards2 = await ev(`${root$}.querySelectorAll('[data-attendance]').length`) }
  note('a past term is selectable', attCards2 === 5 && (await ev(`${root$}.querySelector('select').selectedOptions[0].textContent`)) === 'Summer2026', `${attCards2} courses`)
  const attClip = await clippedNow()
  note('nothing clipped in Attendance', attClip.length === 0, attClip.join(' | ') || 'none')
  await click('button', 'Export CSV')
  await sleep(2000)
  const attCsv = readdirSync(dlDir).filter((f) => /^fap-aio-attendance-.*\.csv$/.test(f))
  note('Attendance exports CSV with a byte-order mark', attCsv.length === 1 && readFileSync(join(dlDir, attCsv[0])).subarray(0, 3).toString('hex') === 'efbbbf', attCsv.join(', '))
  await click('[role="tab"]', 'Courses')
  await sleep(2500)
  const chip = await ev(`[...${root$}.querySelectorAll('[data-course]')].map((c) => c.textContent.match(/Absent \\d+(\\.\\d)?%/)?.[0]).filter(Boolean)`)
  note('Courses cards show the absence chip', chip.length > 0 && chip.includes('Absent 20%'), JSON.stringify(chip))
  await shot('courses-attendance')
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
  await click('button', 'Apply Glassmorphism')
  await sleep(800)
  const applied = await sheetsText()
  note('Apply puts the theme on the page', (await ev('document.documentElement.getAttribute("data-bs-theme")')) === 'light' && applied.includes('blur(14px)'), '')
  await send('Page.navigate', { url: 'https://fap.fpt.edu.vn/Report/Transcript' }, S)
  await sleep(3000)
  note('the applied theme stays on the next page', (await sheetsText()).includes('blur(14px)'), '')
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
  note('no request left the fixture origin', true, `${blocked.length} other-host requests blocked: ${[...new Set(blocked.map((u) => new URL(u).host))].join(', ') || 'none'}`)
}

main()
  .catch((e) => note('run', false, e.stack ?? String(e)))
  .finally(async () => {
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
    await send('Browser.close').catch(() => {})
    setTimeout(() => { chrome.kill('SIGKILL'); process.exit(report.some((r) => !r.ok) ? 1 : 0) }, 500)
  })
