# Implementation Plan

Spec prefix `GRD`. Phases are numbered `N.`, subtasks `N.M`; the global id is `GRD-N` or `GRD-N.M`. Dependencies, gates, milestones and status live in the orchestrator: [`.kiro/orchestrator.md`](../../orchestrator.md). Requirement references point to `requirements.md` in this folder unless prefixed with a spec. The platform amendments apply: rubric entries come from the service worker (`data.rules`), exports use blob links, golden cases use synthetic marks.

Compacted on 2026-10-22 from 16 to 13 subtasks with no requirement dropped; the four calculation engines stay separate. The previous list is in [`.deprecated/tasks.md`](.deprecated/tasks.md).

- [x] 1. [GRD-1] Grade sources and parsers
- [x] 1.1 [GRD-1.1] Write the transcript and term list parsers and sources
  - `src/features/grades/parse/transcript.ts`: the 10-column main table and the 7-column replaced table by position; status from badge class plus constants (`bg-danger` marked unverified); `-` grade as `null`; unknown status kept raw. Register `grades.transcript` (6 h).
  - `grades.termCourses` from `#grade-report-term` and `#grade-report-course` options (6 h).
  - Tests on the vi and en transcript fixtures and the grade page fixture.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2_
- [x] 1.2 [GRD-1.2] Port the mark sheet reader and source
  - TypeScript port of `rowsFromTable` from `tools/flm-scraper/marksheet.mjs` and the `.fap-result-card__*` header; register `grades.markSheet` as a partial (30 min).
  - Tests on the regular, resit and summary-only mark sheet fixtures.
  - _Requirements: 4.1, 4.5_

- [x] 2. [GRD-2] Calculation engines
- [x] 2.1 [GRD-2.1] Implement `GpaEngine`
  - `src/features/grades/engine/gpa.ts`: counted rows (passed, numeric grade, credits above 0, not excluded), case-insensitive prefix exclusion, per-semester order `year * 10 + term`, cumulative GPA, two decimals with credits.
  - Tests: prefix exclusion, Exempt and In progress not counted, the replaced table ignored.
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 1.2_
- [x] 2.2 [GRD-2.2] Implement `CourseModeler`
  - Port of `courseModel`: token-overlap mapping with aliases and confidence, even and uneven groups, resit replacement, summary rows, FLM plan without items, `unscored` and `none` results, rubric lookup through `dataClient` with the trailing lowercase fallback, flags.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 12.2_
- [x] 2.3 [GRD-2.3] Implement `Predictor`
  - Port of `predict` with `displayed = round1(min(10, Σ w·score + bonus))`, component criteria (FE never below 4, guarded as `Math.max(4, finalExamMin)`, progress above 0, group criterion on the weighted average), pass mark from FLM or 5, tier bisection with the 0.05 allowance in 0.1 steps (MAE101 in progress needs 4.1; the reference `predict.mjs` and `golden.json` follow the same rule, D-8 and F-12, 2026-11-17), attendance allowance, Coursera warning, assumed MOOC bonus.
  - Golden tests: every case in `test/fixtures/grades/golden.json` matches; 4.95 passes and 4.94 fails.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
- [x] 2.4 [GRD-2.4] Implement `GoalEngine`
  - Effective course goal (override or default tier); needed average for a GPA goal; water-filling distribution by bisection with caps; unreachable result with the highest reachable GPA; effective target as the higher of tier and derived target.
  - Tests: reachable, capped and unreachable cases; derived targets reproduce the goal.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 3. [GRD-3] Grade settings
- [x] 3.1 [GRD-3.1] Declare the grade settings and store
  - In the `SettingsRegistry` Grades section: default tier (Good), non-GPA list with a reset to default, GPA goal, MOOC completion per course; per-course goals in `grades.settings`; every change recomputes at once.
  - _Requirements: 2.3, 7.1, 7.2, 7.7; panel-ux R8.1_

- [x] 4. [GRD-4] Inline page enhancements
- [x] 4.1 [GRD-4.1] Build `TranscriptSummary`
  - Shadow-rooted block before the transcript card with cumulative GPA, counted credits and per-semester GPA; `fap-aio-gpa-counted` row class styled through a page-level constructable sheet; links to the Grades view, the what-if simulator and the non-GPA setting; a layout-changed notice instead of a summary on parse failure.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [x] 4.2 [GRD-4.2] Build `GradeInline`
  - Shadow-rooted block after the mark sheet card with pass status, current average, required scores for the selected tier and warnings; tier selector saving the course goal; `MutationObserver` on `#grade-report` with a 150 ms debounce; FAP cells untouched.
  - Integration test reacting to a partial swap.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 4.9, 4.10_

- [x] 5. [GRD-5] Panel views
- [x] 5.1 [GRD-5.1] Build the Courses and GPA views
  - Grades, Courses: current-term courses with code, name, average, status, effective goal and required scores; failed first; refresh one course at a time when the cache is stale; course detail with components, marks, criteria, warnings and the FLM link; rubric date.
  - Grades, GPA: cumulative and per-semester GPA, GPA goal and reachability, the replaced-subjects table as information only.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 12.1, 2.4, 1.2_
- [x] 5.2 [GRD-5.2] Register the grade Today provider and alerts
  - The `gradeRisk` Today provider (failed or below goal), inbox alerts for grade failures and goal changes.
  - _Requirements: panel-ux R3.1, R6.1_
- [x] 5.3 [GRD-5.3] Build the What-if and Planner views
  - What-if: expected averages or component marks per in-progress course, hypothetical future courses, instant term and cumulative GPA, clear in one action, nothing persisted.
  - Planner: target GPA and remaining credits (default from `info.curriculum` not passed, minus the non-GPA list), needed average, unreachable handling.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3_

- [x] 6. [GRD-6] Export and rubric guard
- [x] 6.1 [GRD-6.1] Implement the exporter and the rubric schema guard
  - CSV (UTF-8 with BOM) and JSON with transcript rows, per-semester and cumulative GPA, the non-GPA list used and the export date, downloaded through a blob link.
  - Reject a `subject-rules` file whose schema major is not 1 unless a migration exists; show the rubric scrape date and the active data version.
  - _Requirements: 11.1, 11.2, 11.3, 12.1, 12.3; platform R5.4; platform amendment (no `downloads`)_

- [ ] 7. [GRD-7] Scale switch, full record, printable list and attendance (owner request 2026-11-22; previous copy of this file in `.deprecated/2026-11-22-tasks.md`)
- [ ] 7.1 [GRD-7.1] GPA scale switch
  - `engine/scale.ts` with the one letter-grade table and its source, `computeGpaOn(scale)` over `GpaEngine`; setting `grades.gpaScale` (default 10-point); the chips in the GPA view; letters next to final averages in Courses.
  - Tests: bands and their edges, the 4-point GPA counts the same rows, the switch persists and recomputes.
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
- [ ] 7.2 [GRD-7.2] Full academic record
  - `grades.record` and `grades.record.job` stores; the resumable plan (transcript, term list, term course lists, mark sheets) through the registry, one request at a time, with lease, Cancel, Resume and the stop-on-fatal rule; the Record view with terms newest first, expandable courses, progress and partial results, update, read everything again, per-term and per-course reads.
  - Tests: the plan on the fixture record, skip of unchanged terms, resume after a reload, cancel, fatal stop, partial results in the view.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_
- [ ] 7.3 [GRD-7.3] Printable grade list and record export
  - `src/pages/print/` Vite input opened by the service worker (`print.open`, `chrome.windows.create`); the A4 print stylesheet; Record CSV (with BOM) and JSON through a blob link.
  - Tests: the message and window, the page content (identity, terms, GPAs, note, options), the CSV and JSON.
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 13.6_
- [ ] 7.4 [GRD-7.4] Attendance in Grades
  - `parse/attendance.ts` by the documented classes with the raw fallback; sources `grades.attendanceTerm` and `grades.attendance`; the Attendance view with the term select, counts, percentage and risk colour (INF-2.1); the percentage on Courses and Record cards; attendance steps in the record job; attendance CSV; the optional print section.
  - Tests: the fixtures (exempt, present and not yet), a synthetic sheet with absences and an unknown status, the summary fallback, the view and the export.
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7; live selectors after G-SELECTORS (vet list)_
