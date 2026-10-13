# Implementation Plan

Spec prefix `INF`. Phases are numbered `N.`, subtasks `N.M`; the global id is `INF-N` or `INF-N.M`. Dependencies, gates and status live in the orchestrator: [`.kiro/orchestrator.md`](../../orchestrator.md). Requirement references point to `requirements.md` in this folder unless prefixed with a spec. The platform amendments apply: the full syllabus and news rules come from the service worker, alerts go to the panel-ux inbox (replacing `info.alerted`).

Placement in the panel (panel-ux R2.1, R3.1): the Info tab has Subjects, Lecturers, News and Status; the Overview content (R1.2) is delivered as Today providers; the Exams section (R6) is delivered as extra columns and actions in Schedule, Exams.

- [ ] 1. [INF-1] Info sources and parsers
- [ ] 1.1 [INF-1.1] Notification sources
  - `info.unread` through `fapGetJson` (2 min) and `info.bell` from `data-notification-*` attributes (10 min).
  - _Requirements: 5.4_
- [ ] 1.2 [INF-1.2] Curriculum source
  - `info.curriculum` (24 h): term, code, name, credits, prerequisites column, subject detail link.
  - _Requirements: 2.3, 2.4, 2.5_
- [ ] 1.3 [INF-1.3] News and document sources
  - `info.news` (10 min), `info.newsDetail` (7 days; campus, expiry, deadline, links, attachments) and `info.documents` (6 h), parsed by column position; selectors and columns confirmed in gate G-SELECTORS.
  - _Requirements: 7.1, 7.2, 7.6; Gate: G-SELECTORS_
- [ ] 1.4 [INF-1.4] Attendance sources
  - `info.attendanceCourses` from `#attendance-report-course` and `info.attendance` (partial, 30 min) with sessions, absences and not-yet sessions; the partial with absences confirmed in gate G-SELECTORS.
  - _Requirements: 4.1; Gate: G-SELECTORS_

- [ ] 2. [INF-2] Analyzers and lecturer directory
- [ ] 2.1 [INF-2.1] Implement `attendanceRisk`
  - `allowed = floor(total × (1 − minPercent/100))` with the FLM attendance requirement (80% default, 100% where stated); levels safe, warning, last chance, failed; figures exposed to the grades predictor.
  - _Requirements: 4.2, 4.3, 4.5_
- [ ] 2.2 [INF-2.2] Port `newsClassifier`
  - Title normalization, tag, families, flags, priority, term tokens, title deadline, personalization (subject codes, Coursera, thesis, cohort, campus; other campus to P4; staff-only hidden), user watch keywords to P1, repost dedupe on the normalized title within 30 days, detail enrichment.
  - Parity test against `tools/news/analyze-news.py` output on a committed fixture of synthetic titles built from the rule families.
  - _Requirements: 7.4, 7.5, 7.6, 7.8, 7.9_
- [ ] 2.3 [INF-2.3] Implement `courseraDue`
  - A warning per current Coursera course whose item is unchecked and whose FE is synced, with days left.
  - _Requirements: 5.2, 5.3_
- [ ] 2.4 [INF-2.4] Build the lecturer directory
  - Collect from timetable sessions and attendance rows; case-insensitive key with the latest casing for display; pattern check; derived `@fe.edu.vn` (preferred) and `@fpt.edu.vn` addresses; local display names and notes.
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7_

- [ ] 3. [INF-3] Background refresh
- [ ] 3.1 [INF-3.1] Schedule the cycle in the service worker
  - Alarm `bg-refresh` at the configured period (default 6, range 1 to 6) routed with `runOnFapTab`; settings on by default.
  - _Requirements: 8.1, 8.2_
- [ ] 3.2 [INF-3.2] Run the cycle in the tab
  - Plan: `info.unread`, `info.news`, `exam.list`, then attendance courses round-robin with a persisted cursor and up to 3 P1 detail reads, at most 6 requests, all as background reads under the shared budget; `lastFapRequestAt`; 403 pauses 15 minutes; challenge and session expiry stop until the next `tab-ready`; analyzers run after the cycle.
  - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.7; platform R3.7_
- [ ] 3.3 [INF-3.3] On-demand reads per view
  - A shared `useSource(id)` hook with loading, error and data states, last-refreshed stamp and refresh action; stale caches read on open.
  - _Requirements: 1.4, 8.6_

- [ ] 4. [INF-4] Subjects and syllabus
- [ ] 4.1 [INF-4.1] Build Subjects search
  - Info, Subjects: search by code or name through `data.search`, merged with curriculum rows; virtualized list.
  - _Requirements: 2.1; panel-ux R10.7_
- [ ] 4.2 [INF-4.2] Build the subject detail and learning path
  - Detail from `data.subject` (names, credits, prerequisites, pass mark, assessments, attendance, Coursera, materials, outcomes, time allocation, approval date); FLM and FAP links; curriculum term and transcript status; prerequisite ancestors to depth 5 and direct dependents with a cycle guard; data-quality flags explained.
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_
- [ ] 4.3 [INF-4.3] Add "Refresh from FLM"
  - Per-subject button calling `flm.refresh`, live-data badge with fetch date, remove override, the sign-in prompt with link.
  - _Requirements: platform R6.1, R6.4, R6.5_

- [ ] 5. [INF-5] Info views and integrations
- [ ] 5.1 [INF-5.1] Build the Lecturers view
  - Info, Lecturers: shortcode, both addresses with copy and mail-to, subjects and groups, last session date, the shortcode explanation, notes and display names.
  - _Requirements: 3.3, 3.4, 3.5, 3.7_
- [ ] 5.2 [INF-5.2] Build the News view
  - Info, News: news and documents lists, read marking and unread counts, filters by family group and priority, deadlines with days left, opening FAP detail pages; virtualized.
  - _Requirements: 7.1, 7.2, 7.3, 7.10_
- [ ] 5.3 [INF-5.3] Build the Status view
  - Info, Status: current courses with the grades module's status, average and effective goal; attendance per course with risk; Coursera items with checkboxes and FE warnings; unread state and latest bell notifications with links.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 4.3_
- [ ] 5.4 [INF-5.4] Extend Schedule, Exams with the exams overview
  - Grade publication date, resit marking, a link to the course's grade status, and "Refresh mark sheet" once the publication date has passed.
  - _Requirements: 6.1, 6.2, 6.3_
- [ ] 5.5 [INF-5.5] Register Today providers, palette search and commands
  - Today providers `attendanceRisk`, `newsP1`, `courseraDue`; search providers `subjects`, `lecturers` (secondary: copy email), `news`.
  - _Requirements: 1.2, 1.3; panel-ux R3.1, R5.2, R5.4_

- [ ] 6. [INF-6] Alerts and settings
- [ ] 6.1 [INF-6.1] Emit alerts
  - Attendance level changes, important P1 news (deadline within 14 days, exam eligibility, own subject code, or posted within 3 days) and Coursera before FE pushed to the inbox with dedupe key `${kind}|${itemId}|${level}`; clicks open the panel on the related section.
  - _Requirements: 4.4, 7.7, 7.8, 9.2, 9.3_
- [ ] 6.2 [INF-6.2] Declare the info settings
  - Background refresh (enabled, period), notifications per kind (off by default; turning one on requests `notifications`), watch keywords with the diacritic-insensitive hint, Coursera checks and lecturer notes in `info.user`.
  - _Requirements: 8.1, 9.1, 7.9; platform R1.3; panel-ux R8.1_
