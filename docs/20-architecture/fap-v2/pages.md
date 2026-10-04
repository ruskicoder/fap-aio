---
id: architecture.fap-v2.pages
type: interface
status: draft
owner: unassigned
summary: "DOM contracts of the FAP v2 pages FAP-AIO reads: tables, columns, selectors and data hooks."
---

# FAP v2 page contracts

Selectors observed 2026-10-04. Endpoint parameters live in [endpoints.md](endpoints.md); this file only records page structure.

## Shared layout

- Page body content sits in `.content-page`. Titles use `.fap-page-title` with breadcrumbs `.fap-page-title__crumb-*`.
- Data tables carry `table.fap-sheet` (Bootstrap `table-striped table-hover align-middle`). `fap-table-cards.js` turns them into cards on small screens.
- Paged lists use `fap-paged-list.js`: a GET filter form `#<name>-filter-form`, a hidden `pageIndex`, and a `select[name=pageSize]` outside the form (4 options).
- Status values render as `span.badge`; detail pages use `.fap-detail-grid > .fap-detail-field > .fap-detail-field__label | __value` and `.fap-status--ok|--muted`.
- Empty states: `.fap-empty-state`, `.fap-empty-card`.

## Weekly timetable

- `/WeeklyTimetable` renders a shell. The element with `data-fetch-url="/WeeklyTimetable/WeekPartial"` also carries `data-reference-date` (ISO date) and `data-culture`. Buttons: `#weekly-timetable-current`, previous and next; a week `<input>` holds the ISO week.
- The partial holds `.weekly-timetable-grid` with one `table` whose header is `Slot`, then `Mon (dd/MM)` to `Sun (dd/MM)`. The current day header has `.weekly-timetable-today-header`. A mobile copy uses `.weekly-timetable-mobile-card`.
- An occupied cell (`td`) contains:
  - `.weekly-timetable-cell-title`: `CODE - Group`, for example `HCM202 - Half1_GD1805`.
  - `.weekly-timetable-attendance-status`: status text; `Attendance exempt` was observed, other values were not recorded.
  - `[title="Start time - End time"] span.fw-bold`: explicit time `15h00-17h15`. Slot times are no longer fixed; read them from the cell.
  - `span[title="Online"]`: `Online` or `Offline`.
  - `[title="Room"]`: room, for example `NVH 308`.
  - `[title="Lecturer"]`: lecturer login.

## Exam schedule

`/ExamSchedule`, one `table.fap-sheet`. Columns: Date, Time (`10h50-12h20`), Room, Subject (`CODE - Name`), Exam type, Grade publication date, Attendance note, Note.

## Academic transcript

`/Report/Transcript`. Title: `Grade report for transcript <curriculum code>`.

- Table 1, `table.fap-sheet`: No., Term, Semester, Subject code, Prerequisites, Replaced subject, Subject name, Credits, Grade, Status. Status is a `span.badge`; `In progress` was observed, other values were not recorded.
- Table 2, `table.fap-sheet`: replaced or extra subjects. No., Semester, Subject code, Subject name, Credits, Grade, Status.

## Grade report

`/Report/Grade`. Selects `#grade-report-term` and `#grade-report-course` (outside any form). The report root has `data-report-url`, `data-report-term-param`, `data-report-course-param`, `data-report-term-id`; options carry `data-fallback-href`. `academic-report.js` swaps `.academic-report-content` with the partial.

Mark table: `table.student-mark-sheet`, columns Mark group, Mark name, Weight (%), Final mark, Comment. Summary: `.grade-average`, `.grade-status`, `.grade-status--studying`.

## Attendance report

`/Report/Attendance`. Selects `#attendance-report-term`, `#attendance-report-course`, same `data-report-*` hooks as the grade report.

Table `table.fap-sheet.attendance-session-sheet`: #, Study date, Study slot, Room, Lecturer, Course, Status, Comment. Summary `.attendance-summary` (`--ok` modifier); chips `.attendance-chip--date`, `.attendance-chip--slot`; status `.attendance-status--<state>` (observed `--exempt`).

## Curriculum

`/Curriculum`, `table.fap-sheet`: No., Subject code, Subject name, Term, Prerequisites, Replacement/equivalent subjects.

## Cross-class exchange

- `/CrossClassChange`: GET form with `select#termId` (28 terms); link to `/CrossClassChange/Create`; list of the student's requests (empty for this account).
- `/CrossClassChange/Create`: config element with `data-resolve-url`, `data-searching`, `data-found-template`, `data-required`, `data-resolve-failed`, `data-no-target-courses`, `data-select-to-course`, `data-confirm-create`. When the student has no eligible class the page shows `.fap-empty-card` instead of the form.

## Home partial

`/Home/StudentContentPartial`: `.fap-home-student-card` (avatar, name, roll, metrics, wallet amount `.fap-home-student-card__wallet-amount`), `.fap-home-news-card` with `.fap-home-news-item`, and the pinned-news modal `.fap-home-pinned`. Data hooks: `data-home-slot`, `data-load-payment`, `data-has-pinned`.
