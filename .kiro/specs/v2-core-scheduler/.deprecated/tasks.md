# Implementation Plan

Spec prefix `CORE`. Phases are numbered `N.`, subtasks `N.M`; the global id is `CORE-N` or `CORE-N.M`. Dependencies, gates and status live in the orchestrator: [`.kiro/orchestrator.md`](../../orchestrator.md). Requirement references point to `requirements.md` in this folder unless prefixed with a spec (`platform R3.1`). The platform amendments apply: no `chrome.downloads`, budget grant before every FAP request, `storage.onChanged` instead of a settings broadcast.

- [ ] 1. [CORE-1] Content bootstrap and page guard
- [ ] 1.1 [CORE-1.1] Define the feature module contract
  - `src/content/modules.ts`: the `FeatureModule` interface (`id`, `registerSources`, `views`, `onPage`) and a module list the bootstrap iterates.
  - _Requirements: 4.1_
- [ ] 1.2 [CORE-1.2] Implement the bootstrap and page guard
  - `src/content/index.ts`: top-frame check, structural page guard (no `.content-page` in the Jidox wrapper, or the login form present, or a 404 page) that skips mounting, load settings, mount the panel host, register modules, resume a range sync job, then send `tab-ready`.
  - Tests on fixtures of the home page, the login page and a 404 page.
  - _Requirements: 1.1, 1.7; platform R2.4_

- [ ] 2. [CORE-2] Read-only FAP access layer
- [ ] 2.1 [CORE-2.1] Implement `fapGet` and its error mapping
  - `src/content/fap/access.ts`: GET only (no method parameter), `credentials: 'same-origin'`, `X-Requested-With` for partials, 12 s timeout.
  - Maps login redirect or login form to `session-expired`, `X-Feedback-Required: 1` to `feedback-required`, 404 to `unavailable`, 403 with `cf-mitigated: challenge` to `challenge`, other 403 to `forbidden`; one network retry after 1.5 s.
  - `fapGetJson` for JSON routes with the same mapping.
  - Tests with a mocked `fetch` for every mapping.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
- [ ] 2.2 [CORE-2.2] Add the per-tab queue and budget grant
  - One queue per tab; before each request `call({ type: 'budget.acquire' })` with `user` or `background` priority, waiting on `wait` replies; `budget.release` with the outcome after the response.
  - On `reads.stop` reject queued work with `challenge`; on `reads.resume` accept work again.
  - Expose the waiting state (remaining budget, wait time) for the status strip.
  - _Requirements: 3.8; platform R3.1, R3.4, R3.5, R3.9_

- [ ] 3. [CORE-3] Source registry, constants and scheduler parsers
- [ ] 3.1 [CORE-3.1] Implement the source registry
  - `src/content/fap/registry.ts`: `register`, `read` with `force`, cache in `cache:<sourceId>` keyed by params with `fetchedAt`, parser exceptions mapped to `layout-changed` naming the source, last good copy kept.
  - _Requirements: 4.1, 4.2, 4.3_
- [ ] 3.2 [CORE-3.2] Build the vi and en constant tables
  - `src/content/fap/parse/constants.ts`: normalized-text tables (lowercase, NFC, trimmed) for attendance and exam types, `verified: false` marks, unknown values kept raw and logged once.
  - One test per entry in each culture.
  - _Requirements: 2.2, 2.3, 2.4_
- [ ] 3.3 [CORE-3.3] Write the timetable parser
  - Week dates from column headers and `data-reference-date`; rejection when the requested Monday is missing; `.fap-empty-state` as an empty week; cells read by class; slot from the row index; cells without a readable time counted as unreadable.
  - Tests on the vi and en week fixtures and the empty week; both cultures give the same records.
  - _Requirements: 2.5, 6.4, 6.5, 6.8, 6.10_
- [ ] 3.4 [CORE-3.4] Write the exam parser and register both sources
  - `table.fap-sheet` on `/ExamSchedule` by column position; type mapping FE, PE, 2NDFE, 2NDPE, other; empty, `-` or `TBA` room as `null`.
  - Register `timetable.week` and `exam.list`.
  - _Requirements: 4.4, 7.1, 7.4, 7.5_

- [ ] 4. [CORE-4] Panel host
- [ ] 4.1 [CORE-4.1] Create the Shadow DOM host and stylesheet
  - `src/content/panel/host.ts`: `#fap-aio-root` on `document.body`, open shadow root, `all: initial`, z-index 2147483000, the compiled Tailwind CSS imported with `?inline` and adopted with `replaceSync`, React root.
  - A test checks that no style element is inserted into the page and FAP elements keep their computed styles.
  - _Requirements: 1.1, 1.6_
- [ ] 4.2 [CORE-4.2] Add drag, clamping and minimize primitives
  - Pointer-event drag on the header, viewport clamping on drag and on `resize`, a minimize handle restored by click or Enter; state written through the catalog with a 250 ms debounce (state schema from panel-ux).
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.8_

- [ ] 5. [CORE-5] Timetable and exam sync
- [ ] 5.1 [CORE-5.1] Implement `SyncEngine` week and range sync
  - `syncWeek(date)`, `syncRange(start, end)` with the `SyncJob` written before the first request, each week stored immediately, progress done out of total, term presets, final report (synced, failed, added, updated, unreadable).
  - Merge on `code|date|start`, updating room, lecturer, online flag and attendance.
  - Tests: resume after interruption, wrong week rejected, empty week, merge.
  - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 6.9_
- [ ] 5.2 [CORE-5.2] Implement `ExamSync`
  - Merge on `code|type|date`; exams missing from FAP are kept; `past` from the date.
  - _Requirements: 7.2, 7.3_

- [ ] 6. [CORE-6] Schedule views
- [ ] 6.1 [CORE-6.1] Build the Week view
  - Registered as Schedule, Week through the panel view registry: sessions grouped by day, range filters (today, this week, next two weeks, this month, all), sync week and sync term actions with progress, last-sync stamp, empty state with the sync action.
  - _Requirements: 8.1, 8.2, 8.5, 8.6; panel-ux R2.1, R9.3_
- [ ] 6.2 [CORE-6.2] Build the Exams view
  - Registered as Schedule, Exams with a count badge: upcoming and past, days left, type filter, last-sync stamp, empty state.
  - _Requirements: 8.3, 8.4, 8.5, 8.6; panel-ux R2.2_
- [ ] 6.3 [CORE-6.3] Register scheduler commands and Today providers
  - Commands `schedule.syncWeek`, `schedule.syncTerm`, `schedule.syncExams`, `schedule.exportClasses`, `schedule.exportExams`; Today providers `nextClass`, `todayClasses`, `examsSoon`.
  - _Requirements: panel-ux R3.1, R5.2, R5.6_

- [ ] 7. [CORE-7] Calendar export
- [ ] 7.1 [CORE-7.1] Implement the pure `IcsExporter`
  - `VTIMEZONE` for `Asia/Ho_Chi_Minh`, UID `sha1(code|date|start[|type])@fap-aio`, escaping, 75-octet folding on UTF-8 boundaries, optional `VALARM`s, session filters (all, offline, online), exams with an assigned room only.
  - Tests: escaping, folding of Vietnamese text, UID stability, TZID.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
- [ ] 7.2 [CORE-7.2] Build the Export view
  - Registered as Schedule, Export: range and filter choice, export reminders, download through an `a[download]` blob link inside the shadow root.
  - _Requirements: 9.1, 9.2, 9.6; platform amendment (no `downloads`)_

- [ ] 8. [CORE-8] Reminders
- [ ] 8.1 [CORE-8.1] Schedule reminder alarms in the service worker
  - On a `timetable` or `exams` store change and on a reminder setting change, clear `reminder:*` alarms and create one per class (15 or 30 minutes before) and per exam (1 day and 1 hour before) within 30 days, nearest first, below 500 alarms.
  - _Requirements: 10.2, 10.3_
- [ ] 8.2 [CORE-8.2] Fire notifications and handle clicks
  - Turning reminders on requests `notifications` through the platform grant flow; on fire, a notification and an inbox alert; a click focuses a FAP tab on `/WeeklyTimetable` or `/ExamSchedule` or opens one.
  - _Requirements: 10.1, 10.4; platform R1.3, R1.7_

- [ ] 9. [CORE-9] Session keep-alive
- [ ] 9.1 [CORE-9.1] Implement the keep-alive alarm
  - `src/background/keepalive.ts`: alarm `keepalive` at the configured period (default 7, minimum 1); `runOnFapTab('keepalive')`; the tab calls `fapGetJson('/Notification/UnreadCount')` as a background read; skipped when `now − lastFapRequestAt < period`; `session-expired` turns the setting off and pushes an alert; turning it off clears the alarm.
  - _Requirements: 11.1, 11.2, 11.3, 11.4; info R8.7_

- [ ] 10. [CORE-10] Legacy storage cleanup
- [ ] 10.1 [CORE-10.1] Detect and offer cleanup
  - `src/features/legacy/`: match FAP `localStorage` keys against the legacy list and patterns; a one-time banner in the panel; decline stores `legacy.dismissed`.
  - _Requirements: 12.1, 12.3, 12.4_
- [ ] 10.2 [CORE-10.2] Export then remove
  - Build the JSON export, start the blob-link download, then remove only the matched keys; reopen from Settings Data.
  - Tests: keys outside the list are never removed.
  - _Requirements: 12.2, 12.3_

- [ ] 11. [CORE-11] Settings and data controls
- [ ] 11.1 [CORE-11.1] Declare the core and scheduler settings
  - Through the panel-ux `SettingsRegistry`: reminders (enabled, class offset), export reminders, keep-alive (enabled, interval), legacy cleanup; every change applies through `storage.onChanged` without reload.
  - _Requirements: 13.1, 13.2_
- [ ] 11.2 [CORE-11.2] Implement "Clear data"
  - Removes every key except `settings` after a confirmation dialog, and asks the service worker to clear IndexedDB caches except packaged data.
  - _Requirements: 5.5_
