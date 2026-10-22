# Task orchestrator: FAP-AIO v2.0.0

The single place that says what is done, what is next, what is blocked and what needs fixing across the six specs in `.kiro/specs/`. Each spec's `tasks.md` holds the work (phases and subtasks with requirement references). This file holds the order (dependencies), the human checkpoints (gates), the fix queue and the loop rules.

Checker (read-only, Node standard library): `node tools/orchestrator/orchestrator.mjs check | next | waves | status`. It validates this file against every `tasks.md` (ids, dependencies, cycles, gates, status against checkboxes) and computes the next ready subtasks, so the order does not depend on the agent's judgment.

Status as of 2026-10-11: specs approved (requirements and design for all six); task lists written, awaiting owner evaluation. No code exists yet.

## Loop control

Owner-set switches. The agent reads them at the start of every iteration and never changes them.

```text
mode: step          # step: stop after each subtask | phase: stop after each phase | auto: run until a gate, a fix cap or an error
autocommit: false   # true: commit after each verified subtask (message names the task id) | false: leave changes for the owner
max_attempts: 2     # failed attempts per subtask before it moves to the fix queue as blocking
paused: true        # true until the owner approves the task lists
```

## Loop protocol

One iteration handles one subtask. The protocol follows the Kiro task execution rules (read all three spec documents, one task at a time, verify against requirements) and the long-running agent guidance in [Anthropic's harness article](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): pick the highest-priority unfinished item, work on one feature at a time, verify end to end, record progress, and only flip status fields in the tracking file.

1. Orient. Read this file. Run `check`; if it fails, the only work this iteration is fixing the orchestrator or task file it names. Stop if `paused: true`.
2. Pick. Open fixes with severity `blocking` come first. Otherwise take the first line of `next`. Never pick a subtask whose gate is open or whose dependencies are not done.
3. Load context. Read `requirements.md`, `design.md` and `tasks.md` of the subtask's spec, the requirement ids it cites (including cross-spec ones), `docs/10-context/constraints.md` for grade work, and `docs/20-architecture/fap-v2/` for FAP facts. Read every file the subtask will change.
4. Mark. Set the phase row to `doing` here.
5. Implement only that subtask, at the minimum that meets its criteria. No FAP POST; FAP and FLM reads only inside gates or through the extension's own paced access layer.
6. Verify. Run typecheck, lint and the tests the subtask names. A subtask is done only when its tests pass and each cited acceptance criterion is checked against the code.
7. Record.
   - Tick the subtask checkbox in its `tasks.md`; when all subtasks of a phase are ticked, tick the phase and set its row to `done`.
   - Append one line to the log below.
   - Append a docs-scaffold session journal entry.
   - Commit only if `autocommit: true`.
8. On failure: undo the partial change (`git checkout` of the touched files) and add a fix row with what was tried. After `max_attempts` failures, mark it `blocking`, set the phase `blocked`, and stop.
9. Continue or stop:
   - `step` stops after each subtask;
   - `phase` stops after the last subtask of a phase;
   - `auto` continues until `next` shows nothing ready (all remaining work waits on gates, fixes or dependencies), or until a decision is needed.
   - At every stop, report: done this iteration, test output, what `next` shows, open gates and fixes.

Edit rules for this file:
- The agent changes only the `Status` column, the `Status` of gates it was told passed, fix rows, decision rows and the log.
- Adding, removing or reordering tasks or dependencies needs the owner, and the matching `tasks.md` change in the same edit.
- The log is append-only.

## Gates

A gate is a checkpoint that needs the owner or a live check in the owner's browser. The loop never passes a gate by itself; the owner sets `passed` or `waived`.

| Gate | Kind | Needs | Unblocks | Status |
|---|---|---|---|---|
| G-APPROVE | owner | Owner approves the six task lists and this file, then sets `paused: false` | every task | open |
| G-CAPTURE | owner, live | Raw FAP pages saved under `ignore/fixtures-raw/` and `ignore/fixture-denylist.txt` written (page list below); read-only GETs, paced at least 2.5 s, under 30 per 5 minutes | PLT-5.4 | passed |
| G-SELECTORS | live | STATUS item 14 confirmed on live FAP: Jidox top bar, footer, sidebar and wrapper selectors; `/Report/Attendance` partial with absences; `/News` list columns; transcript `bg-danger` status | PNL-4.2, APP-7.2, INF-1.3, INF-1.4 | open |
| G-EXT-KEY | owner | Owner runs `tools/release/extension-key.mjs`, keeps the private key offline, confirms the public key in the manifest | G-RELEASE | open |
| G-FLM-COOKIE | live | Owner runs the PLT-9.1 probe with FLM signed in and records the result in the decision queue | PLT-9.2 | open |
| G-DATA-KEYS | owner | Two recovery phrases created and stored offline; public keys in `src/shared/keyring.ts`; `data/live` and the first `data/<date>` snapshot published | G-RELEASE | open |
| G-RELEASE | owner | Every phase done; manual verification lists from all six designs run and recorded as a test-run document; tag `v2.0.0`; publish the draft release | end | open |

Pages for G-CAPTURE: home, weekly timetable page and week partial (vi and en, one week with sessions, one empty), exam schedule, transcript (vi and en), grade page and three mark-sheet partials (regular, resit, summary rows only), attendance page and partial with absences, news list, one news detail, bell list, curriculum, documents, a 404 page and the login page. The deny list holds the owner's name, roll number, email and the lecturer shortcodes seen.

## Task registry

One row per phase, plus a row for any subtask with extra dependencies or gates. `Depends on` lists ids that must be done first (a phase id means the whole phase). Wave numbers come from `waves`.

| ID | Title | Spec | Depends on | Gates | Status |
|---|---|---|---|---|---|
| PLT-1 | Repository scaffold, manifest and CI | v2-platform | - | G-APPROVE | todo |
| PLT-2 | Message contract and service worker router | v2-platform | PLT-1 | - | todo |
| PLT-3 | Storage catalog, migrations and pruning | v2-platform | PLT-1 | - | todo |
| PLT-4 | Shared request budget | v2-platform | PLT-2, PLT-3 | - | todo |
| PLT-5 | Test fixture pipeline | v2-platform | PLT-1 | - | todo |
| PLT-5.4 | Generate the committed fixtures | v2-platform | PLT-5.3 | G-CAPTURE | todo |
| PLT-6 | Packaged data and IndexedDB data service | v2-platform | PLT-2, PLT-3 | - | todo |
| PLT-7 | Signed data channel | v2-platform | PLT-6 | - | todo |
| PLT-8 | Optional permissions | v2-platform | PLT-2 | - | todo |
| PLT-9 | Live FLM read | v2-platform | PLT-6, PLT-8 | - | todo |
| PLT-9.2 | Implement flm.refresh | v2-platform | PLT-9.1 | G-FLM-COOKIE | todo |
| PLT-10 | Privacy, diagnostics and release | v2-platform | PLT-2, PLT-3 | - | todo |
| CORE-1 | Content bootstrap and page guard | v2-core-scheduler | PLT-2 | - | todo |
| CORE-2 | Read-only FAP access layer | v2-core-scheduler | CORE-1, PLT-4 | - | todo |
| CORE-3 | Source registry, constants and scheduler parsers | v2-core-scheduler | CORE-2, PLT-5.4 | - | todo |
| CORE-4 | Panel host | v2-core-scheduler | CORE-1, PLT-3 | - | todo |
| CORE-5 | Timetable and exam sync | v2-core-scheduler | CORE-3 | - | todo |
| CORE-6 | Schedule views | v2-core-scheduler | CORE-5, PNL-2, PNL-5, PNL-9 | - | todo |
| CORE-7 | Calendar export | v2-core-scheduler | CORE-6 | - | todo |
| CORE-8 | Reminders | v2-core-scheduler | CORE-5, PLT-8, PNL-6 | - | todo |
| CORE-9 | Session keep-alive | v2-core-scheduler | CORE-2, PLT-4 | - | todo |
| CORE-10 | Legacy storage cleanup | v2-core-scheduler | CORE-4, PNL-8.2 | - | todo |
| CORE-11 | Settings and data controls | v2-core-scheduler | PNL-8.2, PLT-6 | - | todo |
| PNL-1 | Panel state and shell | v2-panel-ux | CORE-4 | - | todo |
| PNL-1.3 | Add the status strip | v2-panel-ux | CORE-2 | - | todo |
| PNL-2 | Navigation: router, tabs, sub-views and view registry | v2-panel-ux | PNL-1 | - | todo |
| PNL-3 | Visual system and accessibility | v2-panel-ux | PNL-2 | - | todo |
| PNL-3.1 | Add density tokens and theme variables | v2-panel-ux | APP-1 | - | todo |
| PNL-4 | Docked mode | v2-panel-ux | PNL-1, APP-1 | - | todo |
| PNL-4.2 | Reserve the width through the appearance pipeline | v2-panel-ux | PNL-4.1 | G-SELECTORS | todo |
| PNL-5 | Command palette | v2-panel-ux | PNL-2 | - | todo |
| PNL-6 | Alerts inbox | v2-panel-ux | PNL-2, PLT-8 | - | todo |
| PNL-7 | Keyboard shortcuts and keybinds | v2-panel-ux | PNL-5, PNL-6, PNL-8.2 | - | todo |
| PNL-8 | Settings registry and Settings view | v2-panel-ux | PNL-2 | - | todo |
| PNL-8.4 | Build the Data and privacy and About sections | v2-panel-ux | PLT-3.4, PLT-7.3, PLT-10.1 | - | todo |
| PNL-9 | Today view and first run | v2-panel-ux | PNL-2, CORE-5 | - | todo |
| GRD-1 | Grade sources and parsers | v2-grades | CORE-3 | - | todo |
| GRD-2 | Calculation engines | v2-grades | GRD-1, PLT-6 | - | todo |
| GRD-2.3 | Implement Predictor | v2-grades | PLT-5.3 | - | todo |
| GRD-3 | Grade settings | v2-grades | PNL-8.2 | - | todo |
| GRD-4 | Inline page enhancements | v2-grades | GRD-2, GRD-3, CORE-4 | - | todo |
| GRD-5 | Panel views | v2-grades | GRD-2, GRD-3, PNL-5, PNL-6, PNL-9 | - | todo |
| GRD-5.3 | Build the What-if and Planner views | v2-grades | INF-1.2 | - | todo |
| GRD-6 | Export | v2-grades | GRD-2 | - | todo |
| INF-1 | Info sources and parsers | v2-info | CORE-3 | - | todo |
| INF-1.3 | News and document sources | v2-info | - | G-SELECTORS | todo |
| INF-1.4 | Attendance sources | v2-info | - | G-SELECTORS | todo |
| INF-2 | Analyzers and lecturer directory | v2-info | INF-1, CORE-5, PLT-6 | - | todo |
| INF-3 | Background refresh | v2-info | INF-2, PLT-4 | - | todo |
| INF-4 | Subjects and syllabus | v2-info | INF-1, GRD-1, PNL-3, PLT-6 | - | todo |
| INF-4.3 | Add "Refresh from FLM" | v2-info | PLT-9 | - | todo |
| INF-5 | Info views and integrations | v2-info | INF-2, INF-3, CORE-6, GRD-2, PNL-5, PNL-9 | - | todo |
| INF-6 | Alerts and settings | v2-info | INF-2, PNL-6, PNL-8.2, PLT-8 | - | todo |
| APP-1 | Style pipeline and early application | v2-appearance | PLT-3 | - | todo |
| APP-2 | Colour engine | v2-appearance | PLT-1 | - | todo |
| APP-3 | Theme model and presets | v2-appearance | APP-2 | - | todo |
| APP-4 | Theme view and editors | v2-appearance | APP-1, APP-3, PNL-2 | - | todo |
| APP-5 | Theme management and import or export | v2-appearance | APP-4 | - | todo |
| APP-6 | Layout tweaks | v2-appearance | APP-1, PNL-8.2 | - | todo |
| APP-7 | Classic FAP layout | v2-appearance | APP-1, PNL-8.2, CORE-2, PLT-5.4 | - | todo |
| APP-7.2 | Build the classic top navigation and centred column | v2-appearance | APP-7.1 | G-SELECTORS | todo |
| APP-8 | Visual regression checks | v2-appearance | APP-3, APP-7 | - | todo |

## Waves

Output of `waves`: phases in the same wave have no dependency on each other and can run in parallel (Kiro's wave model, [Kiro specs](https://kiro.dev/docs/specs/)). Subtask rows above can hold a phase back inside its wave.

| Wave | Phases |
|---|---|
| 0 | PLT-1 |
| 1 | PLT-2, PLT-3, PLT-5, APP-2 |
| 2 | PLT-4, PLT-6, PLT-8, PLT-10, CORE-1, APP-1, APP-3 |
| 3 | PLT-7, PLT-9, CORE-2, CORE-4 |
| 4 | CORE-3, CORE-9, PNL-1 |
| 5 | CORE-5, PNL-2, PNL-4, GRD-1, INF-1 |
| 6 | PNL-3, PNL-5, PNL-6, PNL-8, PNL-9, GRD-2, INF-2, APP-4 |
| 7 | CORE-6, CORE-8, CORE-10, CORE-11, PNL-7, GRD-3, GRD-6, INF-3, INF-4, INF-6, APP-5, APP-6, APP-7 |
| 8 | CORE-7, GRD-4, GRD-5, INF-5, APP-8 |

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
