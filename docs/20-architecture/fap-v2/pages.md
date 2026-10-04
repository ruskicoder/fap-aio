---
id: architecture.fap-v2.pages
type: interface
status: draft
owner: unassigned
summary: "DOM contracts of the FAP v2 pages FAP-AIO reads: tables, columns, selectors and data hooks."
---

# FAP v2 page contracts

Selectors observed 2026-10-04. Endpoint parameters live in [endpoints.md](endpoints.md); this file only records page structure.

## Localization of page text

Every visible label, table header and `title` attribute follows the culture set by `POST /Language/SetLanguage`. Values observed in `vi`: transcript headers `STT | KỲ | HỌC KỲ | MÃ MÔN | TIÊN QUYẾT | MÔN THAY THẾ | TÊN MÔN | TÍN CHỈ | ĐIỂM | TRẠNG THÁI`; transcript statuses `Đạt` (Passed), `Đang học` (In progress), `Exempt` (not translated); exam headers `Ngày | Thời gian | Phòng | Môn thi | Loại thi | Ngày công bố điểm | Ghi chú điểm danh | Ghi chú`; weekday headers `Thứ 2 (dd/MM)` to `Chủ nhật (dd/MM)`. Parsers must locate columns by position or class, and map status text for both cultures (or use the badge colour: `bg-success`, `bg-info`).

## Shared layout

- Page body content sits in `.content-page`. Titles use `.fap-page-title` with breadcrumbs `.fap-page-title__crumb-*`.
- Data tables carry `table.fap-sheet` (Bootstrap `table-striped table-hover align-middle`). `fap-table-cards.js` turns them into cards on small screens.
- Paged lists use `fap-paged-list.js`: a GET filter form `#<name>-filter-form`, a hidden `pageIndex`, and a `select[name=pageSize]` outside the form (4 options).
- Status values render as `span.badge`; detail pages use `.fap-detail-grid > .fap-detail-field > .fap-detail-field__label | __value` and `.fap-status--ok|--muted`.
- Empty states: `.fap-empty-state`, `.fap-empty-card`.

## Weekly timetable

- `/WeeklyTimetable` renders a shell. The element with `data-fetch-url="/WeeklyTimetable/WeekPartial"` also carries `data-reference-date` (ISO date) and `data-culture`. Buttons: `#weekly-timetable-current`, previous and next; a week `<input>` holds the ISO week.
- The partial holds `.weekly-timetable-grid` with one `table` whose header is `Slot`, then `Mon (dd/MM)` to `Sun (dd/MM)`. The current day header has `.weekly-timetable-today-header`. A mobile copy uses `.weekly-timetable-mobile-card`.
- Row headers carry `title="Slot"` with the slot number. An occupied cell (`td`) contains the items below. The `title` attributes are localized (in `vi`: `Điểm danh`, `Học online`, `Loại lịch`, ...), so match on class or icon, not on `title`. Culture-independent hooks: icon `ri-book-open-line` (course), `ri-time-line` (time), `ri-wifi-off-line` (offline), `ri-map-pin-line` (room), `ri-user-line` (lecturer).
  - `.weekly-timetable-cell-title`: `CODE - Group`, for example `HCM202 - Half1_GD1805`.
  - `.weekly-timetable-attendance-status`: status text; `Attendance exempt` was observed, other values were not recorded.
  - `[title="Start time - End time"] span.fw-bold`: explicit time `15h00-17h15`. Slot times are no longer fixed; read them from the cell.
  - `span[title="Online"]`: `Online` or `Offline`.
  - `[title="Room"]`: room, for example `NVH 308`.
  - `[title="Lecturer"]`: lecturer login.
  - `[title="Schedule type"]` (only on some cells): for example `Project`.
- Attendance status texts observed in `en`: `Attendance exempt`, `Present`; in `vi`: `Miễn điểm danh`, `Có mặt`.

## Exam schedule

`/ExamSchedule`, one `table.fap-sheet`, no filters (a `termId` query is ignored; only upcoming exams are listed). Cells are plain text. Exam type is a code such as `FE`. Columns: Date, Time (`10h50-12h20`), Room, Subject (`CODE - Name`), Exam type, Grade publication date, Attendance note, Note.

## Academic transcript

`/Report/Transcript`. Title: `Grade report for transcript <curriculum code>`.

- Table 1, `table.fap-sheet`: No., Term, Semester, Subject code, Prerequisites, Replaced subject, Subject name, Credits, Grade, Status. Grade and Status are both `span.badge`: grade `badge bg-success` with the numeric mark, or a plain `<span>-</span>` when no grade; status `bg-success` for `Passed` and `Exempt`, `bg-info` for `In progress`. Missing prerequisite or replacement cells hold `-`.
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
- `/CrossClassChange/Create`: config element `#cross-class-config` with `data-resolve-url`, `data-searching`, `data-found-template`, `data-required`, `data-resolve-failed`, `data-no-target-courses`, `data-select-to-course`, `data-confirm-create`. When the student has no eligible class the page shows `.fap-empty-card` instead of the form.

## Paged lists

`/Subject` caps `pageSize` at 100 (requesting 1000 returns 100 rows). `/News`, `/Document`, `/Transaction` and `/Wishlist` offer `pageSize` 10, 20, 50 or 100.

## Home partial

`/Home/StudentContentPartial`: `.fap-home-student-card` (avatar, name, roll, metrics, wallet amount `.fap-home-student-card__wallet-amount`), `.fap-home-news-card` with `.fap-home-news-item`, and the pinned-news modal `.fap-home-pinned`. Data hooks: `data-home-slot`, `data-load-payment`, `data-has-pinned`.
