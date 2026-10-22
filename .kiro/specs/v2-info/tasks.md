# Implementation Plan

Spec prefix `INF`. Phases are numbered `N.`, subtasks `N.M`; the global id is `INF-N` or `INF-N.M`. Dependencies, gates, milestones and status live in the orchestrator: [`.kiro/orchestrator.md`](../../orchestrator.md). Requirement references point to `requirements.md` in this folder unless prefixed with a spec. The platform amendments apply: the full syllabus and news rules come from the service worker, alerts go to the panel-ux inbox (replacing `info.alerted`).

Placement in the panel (panel-ux R2.1, R3.1): the Info tab has Subjects, Lecturers, News and Status; the Overview content (R1.2) is delivered as Today providers; the Exams section (R6) is delivered as extra columns and actions in Schedule, Exams. This placement covers R1.1.

Compacted on 2026-10-22 from 21 to 12 subtasks with no requirement dropped; the previous list is in [`.deprecated/tasks.md`](.deprecated/tasks.md).

- [ ] 1. [INF-1] Info sources and parsers
- [ ] 1.1 [INF-1.1] Notification and curriculum sources
  - `info.unread` through `fapGetJson` (2 min) and `info.bell` from `data-notification-*` attributes (10 min).
  - `info.curriculum` (24 h): term, code, name, credits, prerequisites column, subject detail link.
  - _Requirements: 5.4, 2.3, 2.4, 2.5_
- [ ] 1.2 [INF-1.2] News, document and attendance sources
  - `info.news` (10 min), `info.newsDetail` (7 days; campus, expiry, deadline, links, attachments) and `info.documents` (6 h), parsed by column position.
  - `info.attendanceCourses` from `#attendance-report-course` and `info.attendance` (partial, 30 min) with sessions, absences and not-yet sessions.
  - Selectors, news columns and the attendance partial with absences confirmed in gate G-SELECTORS.
  - _Requirements: 7.1, 7.2, 7.6, 4.1; Gate: G-SELECTORS_

- [ ] 2. [INF-2] Analyzers and lecturer directory
- [ ] 2.1 [INF-2.1] Implement `attendanceRisk` and `courseraDue`
  - `allowed = floor(total × (1 − minPercent/100))` with the FLM attendance requirement (80% default, 100% where stated); levels safe, warning, last chance, failed; figures exposed to the grades predictor.
  - A warning per current Coursera course whose item is unchecked and whose FE is synced, with days left.
  - Pure functions tested on synthetic records.
  - _Requirements: 4.2, 4.3, 4.5, 5.2, 5.3_
- [ ] 2.2 [INF-2.2] Port `newsClassifier`
  - Title normalization, tag, families, flags, priority, term tokens, title deadline, personalization (subject codes, Coursera, thesis, cohort, campus; other campus to P4; staff-only hidden), user watch keywords to P1, repost dedupe on the normalized title within 30 days, detail enrichment.
  - Parity test against `tools/news/analyze-news.py` output on a committed fixture of synthetic titles built from the rule families.
  - _Requirements: 7.4, 7.5, 7.6, 7.8, 7.9_
- [ ] 2.3 [INF-2.3] Build the lecturer directory
  - Collect from timetable sessions and attendance rows; case-insensitive key with the latest casing for display; pattern check; derived `@fe.edu.vn` (preferred) and `@fpt.edu.vn` addresses; local display names and notes.
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7_

- [ ] 3. [INF-3] Background refresh
- [ ] 3.1 [INF-3.1] Schedule and run the refresh cycle
  - Alarm `bg-refresh` at the configured period (default 6, range 1 to 6) routed with `runOnFapTab`; settings on by default.
  - Plan in the tab: `info.unread`, `info.news`, `exam.list`, then attendance courses round-robin with a persisted cursor and up to 3 P1 detail reads, at most 6 requests, all as background reads under the shared budget; `lastFapRequestAt`; 403 pauses 15 minutes; challenge and session expiry stop until the next `tab-ready`; analyzers run after the cycle.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7; platform R3.7_
- [ ] 3.2 [INF-3.2] On-demand reads per view
  - A shared `useSource(id)` hook with loading, error and data states, last-refreshed stamp and refresh action; stale caches read on open.
  - _Requirements: 1.4, 8.6_

- [ ] 4. [INF-4] Subjects and syllabus
- [ ] 4.1 [INF-4.1] Build Subjects search, subject detail and the learning path
  - Info, Subjects: search by code or name through `data.search`, merged with curriculum rows; virtualized list.
  - Detail from `data.subject` (names, credits, prerequisites, pass mark, assessments, attendance, Coursera, materials, outcomes, time allocation, approval date); FLM and FAP links; curriculum term and transcript status; prerequisite ancestors to depth 5 and direct dependents with a cycle guard; data-quality flags explained.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6; panel-ux R10.7_
- [ ] 4.2 [INF-4.2] Add "Refresh from FLM"
  - Per-subject button calling `flm.refresh`, live-data badge with fetch date, remove override, the sign-in prompt with link.
  - _Requirements: platform R6.1, R6.4, R6.5_

- [ ] 5. [INF-5] Info views and integrations
- [ ] 5.1 [INF-5.1] Build the Lecturers and News views and register providers
  - Info, Lecturers: shortcode, both addresses with copy and mail-to, subjects and groups, last session date, the shortcode explanation, notes and display names.
  - Info, News: news and documents lists, read marking and unread counts, filters by family group and priority, deadlines with days left, opening FAP detail pages; virtualized.
  - Today providers `attendanceRisk`, `newsP1`, `courseraDue`; search providers `subjects`, `lecturers` (secondary: copy email), `news`.
  - _Requirements: 3.3, 3.4, 3.5, 3.7, 7.1, 7.2, 7.3, 7.10, 1.2, 1.3; panel-ux R3.1, R5.2, R5.4_
- [ ] 5.2 [INF-5.2] Build the Status view and extend Schedule, Exams
  - Info, Status: current courses with the grades module's status, average and effective goal; attendance per course with risk; Coursera items with checkboxes and FE warnings; unread state and latest bell notifications with links.
  - Schedule, Exams: grade publication date, resit marking, a link to the course's grade status, and "Refresh mark sheet" once the publication date has passed.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 4.3, 6.1, 6.2, 6.3_

- [ ] 6. [INF-6] Alerts and settings
- [ ] 6.1 [INF-6.1] Emit alerts and declare the info settings
  - Attendance level changes, important P1 news (deadline within 14 days, exam eligibility, own subject code, or posted within 3 days) and Coursera before FE pushed to the inbox with dedupe key `${kind}|${itemId}|${level}`; clicks open the panel on the related section.
  - Settings: background refresh (enabled, period), notifications per kind (off by default; turning one on requests `notifications`), watch keywords with the diacritic-insensitive hint, Coursera checks and lecturer notes in `info.user`.
  - _Requirements: 4.4, 7.7, 7.8, 7.9, 8.1, 9.1, 9.2, 9.3; platform R1.3; panel-ux R8.1_
