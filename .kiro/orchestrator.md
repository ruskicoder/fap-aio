# Task orchestrator: FAP-AIO v2.0.0

The single place that says what is done, what is next, what is blocked and what needs fixing across the six specs in `.kiro/specs/`. Each spec's `tasks.md` holds the work (phases and subtasks with requirement references). This file holds the order (dependencies), the human checkpoints (gates), the fix queue and the loop rules.

Checker (read-only, Node standard library): `node tools/orchestrator/orchestrator.mjs check | next | waves | status`. It validates this file against every `tasks.md` (ids, milestones, dependencies, cycles, gates, status against checkboxes) and computes the next ready subtasks in milestone order, so the order does not depend on the agent's judgment.

Status as of 2026-10-22: specs approved (requirements and design for all six). Task lists compacted from 140 to 91 subtasks (same 50 phases, no requirement dropped) and grouped into five milestones; the previous task lists and this file's previous version are kept in `.kiro/specs/*/.deprecated/tasks.md` and `.kiro/.deprecated/orchestrator.md` for rollback. Owner approved the compacted lists on 2026-10-23 (G-APPROVE passed); the loop stays paused until the next session starts M1. No code exists yet.

## Loop control

Owner-set switches. The agent reads them at the start of every iteration and never changes them.

```text
mode: phase         # step: stop after each subtask | phase: stop after each phase | auto: run until a gate, a fix cap or an error
autocommit: true    # true: commit after each verified subtask (message names the task id) | false: leave changes for the owner
max_attempts: 2     # failed attempts per subtask before it moves to the fix queue as blocking
context_stop: 65    # percent of the context window; after a finished subtask at or above this, close the session (target about 75% at most)
paused: false       # owner set false on 2026-10-23 to run M1, M2 and M3
```

## Loop protocol

One iteration handles one subtask. The protocol follows the Kiro task execution rules (read all three spec documents, one task at a time, verify against requirements) and the long-running agent guidance in [Anthropic's harness article](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): pick the highest-priority unfinished item, work on one feature at a time, verify end to end, record progress, and only flip status fields in the tracking file.

1. Orient. Read this file. Run `check`; if it fails, the only work this iteration is fixing the orchestrator or task file it names. Stop if `paused: true`.
2. Pick. Open fixes with severity `blocking` come first. Otherwise take the first line of `next` (milestone first, then wave, spec and number). Never pick a subtask whose gate is open or whose dependencies are not done.
3. Load context. Read `requirements.md`, `design.md` and `tasks.md` of the subtask's spec, the requirement ids it cites (including cross-spec ones), `docs/10-context/constraints.md` for grade work, and `docs/20-architecture/fap-v2/` for FAP facts. Read every file the subtask will change.
4. Mark. Set the phase row to `doing` here.
5. Implement only that subtask, at the minimum that meets its criteria. No FAP POST; FAP and FLM reads only inside gates or through the extension's own paced access layer.
6. Verify. Run typecheck, lint and the tests the subtask names. A subtask is done only when its tests pass and each cited acceptance criterion is checked against the code.
7. Record.
   - Tick the subtask checkbox in its `tasks.md`; when all subtasks of a phase are ticked, tick the phase and set its row to `done`.
   - Append one line to the log below.
   - Append a docs-scaffold session journal entry.
   - Commit only if `autocommit: true`, on the current local branch, with a message that starts with the task id (`feat(PLT-1.1): ...`). Never push.
8. On failure: undo only this subtask's change and add a fix row with what was tried. With `autocommit: true` every earlier subtask is committed, so `git checkout` and `git clean` of the touched paths return to the last commit. With `autocommit: false`, save `git diff` to `ignore/orchestrator/pre-<task>.patch` before step 5 and restore from it instead. After `max_attempts` failures, mark it `blocking`, set the phase `blocked`, and stop.
9. Continue or stop:
   - `step` stops after each subtask;
   - `phase` stops after the last subtask of a phase;
   - `auto` continues until `next` shows nothing ready (all remaining work waits on gates, fixes or dependencies), or until a decision is needed.
   - In every mode, stop when a milestone is complete (`status` shows it complete): run `npm run build`, report how to load `dist/` unpacked and what the owner can now use and check.
   - After any finished subtask, read the context usage (`get_usage`). At or above `context_stop`, close the session: record step 7, then write the continuity summary with a start prompt for the next session. Never stop in the middle of a subtask.
   - At every stop, report: done this iteration, test output, what `next` shows, open gates and fixes.

Edit rules for this file:
- The agent changes only the `Status` column, the `Status` of gates it was told passed, fix rows, decision rows and the log.
- Adding, removing or reordering tasks or dependencies needs the owner, and the matching `tasks.md` change in the same edit.
- The log is append-only.

## Gates

A gate is a checkpoint that needs the owner or a live check in the owner's browser. The loop never passes a gate by itself; the owner sets `passed` or `waived`.

| Gate | Kind | Needs | Unblocks | Status |
|---|---|---|---|---|
| G-APPROVE | owner | Owner approves the six task lists and this file, then sets `paused: false` | every task | passed |
| G-CAPTURE | owner, live | Raw FAP pages saved under `ignore/fixtures-raw/` and `ignore/fixture-denylist.txt` written (page list below); read-only GETs, paced at least 2.5 s, under 30 per 5 minutes | PLT-5.1 | passed |
| G-SELECTORS | live | STATUS item 14 confirmed on live FAP: Jidox top bar, footer, sidebar and wrapper selectors; `/Report/Attendance` partial with absences; `/News` list columns; transcript `bg-danger` status | PNL-4.2, APP-7.4, INF-1.2 (and through INF-1: INF-3, INF-5) | open |
| G-EXT-KEY | owner | Owner runs `tools/release/extension-key.mjs`, keeps the private key offline, commits `src/manifest-key.txt` (public key) so the unpacked id stays stable | G-RELEASE | open |
| G-FLM-COOKIE | live | Owner runs the PLT-9.1 probe with FLM signed in and records the result in the decision queue | PLT-9.2 | open |
| G-DATA-KEYS | owner | Two recovery phrases created and stored offline; public keys in `src/shared/keyring.ts`; `data/live` and the first `data/<date>` snapshot published | G-RELEASE | open |
| G-RELEASE | owner | Every phase done; manual verification lists from all six designs run and recorded as a test-run document; tag `v2.0.0`; publish the draft release | end | open |

Pages for G-CAPTURE: home, weekly timetable page and week partial (vi and en, one week with sessions, one empty), exam schedule, transcript (vi and en), grade page and three mark-sheet partials (regular, resit, summary rows only), attendance page and partial with absences, news list, one news detail, bell list, curriculum, documents, a 404 page and the login page. The deny list holds the owner's name, roll number, email and the lecturer shortcodes seen.

## Milestones

Each milestone ends in a build the owner can load unpacked and use. The loop works through milestones in order and stops at the end of each one (loop protocol step 9).

| Milestone | Usable deliverable | Subtasks |
|---|---|---|
| M1 Schedule | Panel on FAP pages: sync this week or the term, Week and Exams views, `.ics` calendar export, status strip with the request budget | 25 |
| M2 Grades | GPA summary on the transcript, pass prediction and required scores under each mark sheet, Courses and GPA views, Today view and first run, command palette, alerts inbox, Settings | 25 |
| M3 Info and background | Subjects and syllabus with the learning path, lecturers, Status, background refresh, reminders, keep-alive, docked mode, keybinds, what-if and planner, legacy cleanup, diagnostics; news, documents and attendance after G-SELECTORS | 20 |
| M4 Appearance | Eleven themes, colour editor, CSS editor, background images, layout tweaks, Classic FAP layout (top navigation after G-SELECTORS), visual regression checks | 13 |
| M5 Release | Signed data updates, live FLM refresh, Data and privacy and About sections, release workflow; then G-EXT-KEY, G-DATA-KEYS, G-FLM-COOKIE and G-RELEASE for v2.0.0 | 8 |

## Task registry

One row per phase, plus a row for any subtask with extra dependencies, gates or a different milestone. `Depends on` lists ids that must be done first (a phase id means the whole phase, a subtask id only that subtask). A subtask row inherits its phase's dependencies. `Milestone` on a subtask row overrides the phase's. Wave numbers come from `waves`.

| ID | Title | Spec | Milestone | Depends on | Gates | Status |
|---|---|---|---|---|---|---|
| PLT-1 | Repository scaffold, manifest and CI | v2-platform | M1 | - | G-APPROVE | done |
| PLT-2 | Message contract and service worker router | v2-platform | M1 | PLT-1 | - | done |
| PLT-3 | Storage catalog, migrations and pruning | v2-platform | M1 | PLT-1 | - | done |
| PLT-4 | Shared request budget | v2-platform | M1 | PLT-2, PLT-3 | - | done |
| PLT-5 | Test fixture pipeline | v2-platform | M1 | PLT-1 | - | done |
| PLT-5.1 | Anonymizer, deny-list check and committed fixtures | v2-platform | M1 | - | G-CAPTURE | todo |
| PLT-6 | Packaged data and IndexedDB data service | v2-platform | M2 | PLT-2, PLT-3 | - | todo |
| PLT-7 | Signed data channel | v2-platform | M5 | PLT-6 | - | todo |
| PLT-8 | Optional permissions | v2-platform | M2 | PLT-2 | - | todo |
| PLT-9 | Live FLM read | v2-platform | M5 | PLT-6, PLT-8 | - | todo |
| PLT-9.2 | Implement flm.refresh | v2-platform | M5 | PLT-9.1 | G-FLM-COOKIE | todo |
| PLT-10 | Privacy, diagnostics and release | v2-platform | M3 | PLT-2, PLT-3 | - | todo |
| PLT-10.2 | Release workflow | v2-platform | M5 | - | - | todo |
| CORE-1 | Content bootstrap and page guard | v2-core-scheduler | M1 | PLT-2, PLT-5.1 | - | done |
| CORE-2 | Read-only FAP access layer | v2-core-scheduler | M1 | CORE-1, PLT-4 | - | done |
| CORE-3 | Source registry, constants and scheduler parsers | v2-core-scheduler | M1 | CORE-2, PLT-5.1 | - | doing |
| CORE-4 | Panel host | v2-core-scheduler | M1 | CORE-1, PLT-3 | - | done |
| CORE-5 | Timetable and exam sync | v2-core-scheduler | M1 | CORE-3 | - | todo |
| CORE-6 | Schedule views | v2-core-scheduler | M1 | CORE-5, PNL-2 | - | todo |
| CORE-6.2 | Scheduler commands and Today providers | v2-core-scheduler | M2 | PNL-5, PNL-9 | - | todo |
| CORE-7 | Calendar export | v2-core-scheduler | M1 | CORE-6.1 | - | todo |
| CORE-8 | Reminders | v2-core-scheduler | M3 | CORE-5, PLT-8, PNL-6, CORE-11 | - | todo |
| CORE-9 | Session keep-alive | v2-core-scheduler | M3 | CORE-2, PLT-4, PNL-6, CORE-11 | - | todo |
| CORE-10 | Legacy storage cleanup | v2-core-scheduler | M3 | CORE-4, PNL-8.1 | - | todo |
| CORE-11 | Settings and data controls | v2-core-scheduler | M3 | PNL-8.1, PLT-6 | - | todo |
| PNL-1 | Panel state and shell | v2-panel-ux | M1 | CORE-4 | - | todo |
| PNL-1.2 | Status strip | v2-panel-ux | M1 | CORE-2 | - | todo |
| PNL-2 | Navigation: router, tabs, sub-views and view registry | v2-panel-ux | M1 | PNL-1 | - | todo |
| PNL-3 | Visual system and accessibility | v2-panel-ux | M2 | PNL-2, APP-1 | - | todo |
| PNL-4 | Docked mode | v2-panel-ux | M3 | PNL-1, APP-1 | - | todo |
| PNL-4.2 | Reserve the width through the appearance pipeline | v2-panel-ux | M3 | PNL-4.1 | G-SELECTORS | todo |
| PNL-5 | Command palette | v2-panel-ux | M2 | PNL-2 | - | todo |
| PNL-6 | Alerts inbox | v2-panel-ux | M2 | PNL-2, PLT-8 | - | todo |
| PNL-7 | Keyboard shortcuts and keybinds | v2-panel-ux | M3 | PNL-5, PNL-6, PNL-8.1 | - | todo |
| PNL-8 | Settings registry and Settings view | v2-panel-ux | M2 | PNL-2 | - | todo |
| PNL-8.3 | Data and privacy and About sections | v2-panel-ux | M5 | PLT-3.1, PLT-7.3, PLT-10.1 | - | todo |
| PNL-9 | Today view and first run | v2-panel-ux | M2 | PNL-2, CORE-5 | - | todo |
| GRD-1 | Grade sources and parsers | v2-grades | M2 | CORE-3 | - | todo |
| GRD-2 | Calculation engines | v2-grades | M2 | GRD-1, PLT-6 | - | todo |
| GRD-2.3 | Implement Predictor | v2-grades | M2 | PLT-5.2 | - | todo |
| GRD-3 | Grade settings | v2-grades | M2 | PNL-8.1 | - | todo |
| GRD-4 | Inline page enhancements | v2-grades | M2 | GRD-2, GRD-3, CORE-4 | - | todo |
| GRD-5 | Panel views | v2-grades | M2 | GRD-2, GRD-3, PNL-5, PNL-6, PNL-9 | - | todo |
| GRD-5.3 | What-if and Planner views | v2-grades | M3 | INF-1.1 | - | todo |
| GRD-6 | Export and rubric guard | v2-grades | M2 | GRD-2 | - | todo |
| INF-1 | Info sources and parsers | v2-info | M3 | CORE-3 | - | todo |
| INF-1.2 | News, document and attendance sources | v2-info | M3 | - | G-SELECTORS | todo |
| INF-2 | Analyzers and lecturer directory | v2-info | M3 | INF-1.1, CORE-5, PLT-6 | - | todo |
| INF-3 | Background refresh | v2-info | M3 | INF-1, INF-2, PLT-4 | - | todo |
| INF-4 | Subjects and syllabus | v2-info | M3 | INF-1.1, GRD-1, PNL-3, PLT-6 | - | todo |
| INF-4.2 | Refresh from FLM | v2-info | M5 | PLT-9 | - | todo |
| INF-5 | Info views and integrations | v2-info | M3 | INF-1, INF-2, INF-3, CORE-6, GRD-2, PNL-5, PNL-9 | - | todo |
| INF-6 | Alerts and settings | v2-info | M3 | INF-2, PNL-6, PNL-8.1, PLT-8 | - | todo |
| APP-1 | Style pipeline and early application | v2-appearance | M2 | PLT-3 | - | todo |
| APP-2 | Colour engine | v2-appearance | M4 | PLT-1 | - | todo |
| APP-3 | Theme model and presets | v2-appearance | M4 | APP-2 | - | todo |
| APP-4 | Theme view and editors | v2-appearance | M4 | APP-1, APP-3, PNL-2 | - | todo |
| APP-5 | Theme management and import or export | v2-appearance | M4 | APP-4 | - | todo |
| APP-6 | Layout tweaks | v2-appearance | M4 | APP-1, PNL-8.1 | - | todo |
| APP-7 | Classic FAP layout | v2-appearance | M4 | APP-1, PNL-5, PNL-8.1, CORE-2, PLT-5.1 | - | todo |
| APP-7.4 | Classic top navigation and centred column | v2-appearance | M4 | - | G-SELECTORS | todo |
| APP-8 | Visual regression checks | v2-appearance | M4 | APP-3, APP-7 | - | todo |

## Waves

Output of `waves`: phases in the same wave have no dependency on each other and can run in parallel (Kiro's wave model, [Kiro specs](https://kiro.dev/docs/specs/)). Subtask rows above can hold a phase back inside its wave.

| Wave | Phases |
|---|---|
| 0 | PLT-1 |
| 1 | PLT-2, PLT-3, PLT-5, APP-2 |
| 2 | PLT-4, PLT-6, PLT-8, PLT-10, CORE-1, APP-1, APP-3 |
| 3 | PLT-7, PLT-9, CORE-2, CORE-4 |
| 4 | CORE-3, PNL-1 |
| 5 | CORE-5, PNL-2, PNL-4, GRD-1, INF-1 |
| 6 | PNL-3, PNL-5, PNL-6, PNL-8, PNL-9, GRD-2, INF-2, APP-4 |
| 7 | CORE-6, CORE-10, CORE-11, PNL-7, GRD-3, GRD-6, INF-3, INF-4, INF-6, APP-5, APP-6, APP-7 |
| 8 | CORE-7, CORE-8, CORE-9, GRD-4, GRD-5, INF-5, APP-8 |

Waves show which phases could run in parallel; the loop runs one subtask at a time in milestone order, so a later-wave phase of M1 (CORE-7) runs before an earlier-wave phase of M2.

## Fix queue

Bugs, failed verifications and regressions found during the loop. Severity `blocking` stops dependent work; `normal` is picked before new work in the same phase; `minor` waits for the phase end.

| Fix | Task | Found | Symptom | Severity | Status |
|---|---|---|---|---|---|

## Decision queue

Questions the loop cannot answer from the specs. A decision row stops the affected task until the owner answers; the answer is recorded here and, when it changes a spec, in that spec and a decision record.

| Decision | Question | Raised by | Blocks | Status |
|---|---|---|---|---|
| D-1 | FLM cookie result from G-FLM-COOKIE: service worker fetch or content-script fallback (adds `scripting`)? | PLT-9.1 | PLT-9.2 | open |

## Log

Append-only. One line per iteration: date, task id, result, verification, commit or "uncommitted".

- 2026-10-11 | setup | task lists for six specs and this orchestrator written | `orchestrator.mjs check` passes | uncommitted
- 2026-10-13 | G-CAPTURE | 63 en and 25 vi raw pages in `ignore/fixtures-raw/`, deny list (16 entries) in `ignore/fixture-denylist.txt`, catalog `tools/fixtures/catalog.json`; missing: login page, attendance with an absence, transcript `bg-danger` row | split-capture lists all 200 except the intended 404 | uncommitted; gate left `open` for the owner to mark
- 2026-10-13 | G-CAPTURE | login page captured signed out; owner marked G-CAPTURE passed (attendance absence and transcript `bg-danger` remain unobserved, tracked under G-SELECTORS) | catalog updated | committed
- 2026-10-22 | correction | the deny list written for G-CAPTURE has 15 entries, not 16 as logged on 2026-10-13 | `wc -l ignore/fixture-denylist.txt` | uncommitted
- 2026-10-22 | plan | owner-approved compaction: 140 to 91 subtasks (50 phases kept, no requirement dropped), milestones M1 to M5, dependency fixes (CORE-1 on fixtures, CORE-8 and CORE-9 on alerts and settings, CORE-6 split so M1 does not wait on the palette and Today view), panel state schema moved to CORE-4.1, manifest key from a file, GetFormSchema reads user-triggered, network check scoped to request targets, gated subtasks last in their phase; mode phase, autocommit true; previous files in `.deprecated/` | `orchestrator.mjs check` passes; milestone order tested on a copy | committed with the approval below
- 2026-10-23 | G-APPROVE | owner approved the compacted task lists, milestones and this file; G-APPROVE passed; `paused` stays true until the next session, which runs M1, M2 and M3 | `orchestrator.mjs check` passes | committed
- 2026-10-23 | PLT-1.1 | toolchain (Vite 5.4.21, CRXJS 2.7.1 with standalone IIFE content scripts so no web_accessible_resources, React 18.3.1, TS 5.9.3 strict, Tailwind 3.4.19, ESLint 9, Vitest 2.1.9, zod 3.25.76, linkedom), manifest from src/manifest.ts with optional key file, empty entries, grant page, extension-key, zip, check-version and deny-list tools | typecheck, lint, 3 tests, build, check:version, check:fixtures, zip pass | committed
- 2026-10-23 | PLT-1.2 | ci.yml (npm ci, typecheck, lint, test, deny-list check from secret FIXTURE_DENYLIST, build, report-only audit); ESLint no-eval, no-implied-eval, no-new-func, FAP localStorage and sessionStorage restricted outside src/features/legacy | lint rejects a probe file with all three; lint clean | committed
- 2026-10-23 | PLT-2.1 | src/shared/messages.ts (zod discriminated union, protocol 1, strict shapes, timeout table; adds data.clearCaches for core R5.5), src/shared/call.ts (call with timeout, typed onMessage), test/helpers/fake-chrome.ts | typecheck, lint, 11 tests pass | committed
- 2026-10-23 | PLT-2.2 | src/background/router.ts (sender id, FAP origin, frameId 0, grant.html only for perm.result, zod validation, typed errors), diag counters, wired in the service worker entry | 16 tests pass incl. forged origin, sub-frame, other extension, lookalike host | committed
- 2026-10-23 | PLT-2.3 | background/tabs.ts (known tabs and focused tab in storage.session, targetTab, broadcast, toolbar action, toggle-panel command, commands.list), content/tab.ts (tab-ready, tab-focus) | 19 tests pass | committed
- 2026-10-23 | PLT-3.1 | src/shared/storage/catalog.ts (catalog of every key with owner, version, size, retention; Versioned; read, write with pruning, serialized update, subscribe on storage.onChanged, usage), diag counters moved onto it, data.status handler with getBytesInUse and navigator.storage.estimate | 30 tests incl. src scan for uncatalogued keys and one per pruning rule | committed
- 2026-10-23 | PLT-3.2 | src/shared/storage/migrations.ts (ordered steps per key and for cache:*, runMigrations on onInstalled update, discard on missing or throwing step with storage.discarded flag, readMigrated waits for the rewrite) | 35 tests pass | committed
- 2026-10-23 | PLT-5.1 | tools/fixtures/anonymize.mjs and fields.json (linkedom, seeded and consistent per value, dates shifted by whole weeks, codes, rooms, logins and long numbers remapped per character, synthetic marks, same-length filler, vi and en labels kept, inline scripts and comments dropped), .githooks/pre-commit, 89 fixtures in test/fixtures | 40 tests incl. determinism and per-page element, class and attribute sets on all raw pages; deny-list check 89 files, 15 entries, no match | committed; owner enables the hook with git config core.hooksPath .githooks
- 2026-10-23 | PLT-4.1 | src/background/budget.ts (ledger in storage.session, six-step acquire: challenge, 15 s lease, 400 ms or 1.5 s gap, 30 per rolling 5 min, background cap 12 and 5 s user priority; release, clearChallenge) | 8 fake-clock tests incl. restart | committed
- 2026-10-23 | PLT-4.2 | budget-handlers.ts: budget.acquire and budget.release handlers, reads.stop broadcast on challenge, reads.resume on the next tab-ready, runOnFapTab to the focused or latest tab, skipped without a FAP tab | 50 tests pass | committed
- 2026-10-23 | PLT-5.2 | tools/fixtures/grade-cases.mjs: 9 synthetic mark sheets (pass, fail with average 5 or more, bonus, resit, unscored, in progress with attendance, zero progress, uneven groups, summary rows only) as rows and FAP HTML, checked to round-trip through rowsFromTable, expected courseModel and predict output in test/fixtures/grades/golden.json | 52 tests pass | committed
- 2026-10-23 | CORE-1.1 | src/content/modules.ts (FeatureModule, addModule, mount and resume boot hooks), guard.ts (Jidox .wrapper .content-page, login form), bootstrap.ts (top frame, guard, settings via readMigrated, mount, module sources, views and page hooks, resume, tab-ready) | 56 tests incl. home, vi timetable, login and 404 fixtures | committed
- 2026-10-23 | CORE-2.1 | src/content/fap/access.ts: fapGet and fapGetJson, GET only with no method parameter, site-relative paths only, same-origin credentials, partial header, 12 s timeout, mapping to session-expired, feedback-required, unavailable, challenge, forbidden, network with one retry after 1.5 s | 11 mocked-fetch tests, 67 total | committed
- 2026-10-23 | CORE-2.2 | src/content/fap/queue.ts: per-tab FapQueue (one at a time, budget.acquire with user or background priority, waits on wait replies, budget.release with outcome, local stop on challenge, reads.stop and reads.resume wired at bootstrap, observable waiting state), queuedGet and queuedGetJson | 72 tests pass | committed
- 2026-10-23 | CORE-4.1 | panel host: #fap-aio-root, open shadow root, Tailwind compiled with ?inline and adopted with replaceSync, :host all: initial and z-index 2147483000, host positioned through CSSOM, React root registered as the mount hook; header drag with clamping, resize clamping, minimize to a 40 px handle; PanelState v2 zod schema and Route in src/shared/panel-state.ts, 250 ms debounced writes; build now defines NODE_ENV so React ships its production build (content bundle 548 to 218 kB) | 76 tests incl. happy-dom: no style element in the page, computed style unchanged, clamping after resize | committed
- 2026-10-23 | CORE-3.1 | src/content/fap/registry.ts (register, read with force and priority, cache:<id> keyed by params with fetchedAt, peek, LayoutChangedError to layout-changed naming the source, last good copy kept), parse/constants.ts (normalized vi and en attendance table with verified marks, unknown kept raw and logged once) | 93 tests incl. one per constant entry per culture | committed
