---
id: work.investigations.10-04-fptu-schedule-extension
type: investigation
status: draft
owner: unassigned
summary: "Static analysis of the third-party 'FPTU Schedule' 4.0.0 extension and how it reads FAP v2, with live read-only checks of its assumptions."
---

# Third-party extension "FPTU Schedule" 4.0.0 (2026-10-04)

## Scope and rules

The owner supplied an unvetted copy at `/mnt/DATA/DATA/Github/fap-new-scheduler/4.0.0_0/` (outside this repository) with a README that allows reading only. The extension was not loaded or executed. Analysis is static (source read in full for `background.js`, `content.js`, `lib/fap-keepalive.js`, `lib/fap-feedback.js`, `lib/grades.js`; indexed for `popup.js` and the other `lib/` files). Its assumptions about FAP were then checked against the live site with GET requests from the owner's session (`chrome-devtools` MCP), the same rules as the other records in this folder.

## Identity and integrity

| Item | Value |
|---|---|
| Name, version | `FPTU Schedule`, `4.0.0`, Manifest V3 |
| Chrome Web Store item | `obiiippodjlfcmdipfbkneknbakjekfm` (from `_metadata/verified_contents.json`) |
| Author links | `github.com/yunkhngn/fptu-schedule`, `yunkhngn.github.io/fptu-schedule` (privacy page), a Facebook profile (popup only) |
| Permissions | `scripting`, `tabs`, `storage`, `alarms`, `notifications`; host `*://fap.fpt.edu.vn/*` |
| Content scripts | `lib/fap-keepalive.js`, `lib/fap-feedback.js`, `lib/grades.js`, `content.js` on every FAP page, `document_idle` |
| Size | 19 files, about 390 KB of JS, HTML and CSS; no minification, no remote code |

Integrity: the Web Store tree hashes in `verified_contents.json` were recomputed for all 19 files. All 15 code, HTML and CSS files match. `manifest.json` and the three `icon-*.png` files differ, which is consistent with Chrome rewriting the manifest (`key`, `update_url`) and re-encoding images at install time (inferred, not tested). The code on disk is the code the store signed for 4.0.0.

Network and data flow: every `fetch` targets `fap.fpt.edu.vn` (relative URLs from content scripts, absolute URLs from the popup). No other host is contacted; the external URLs are links only. No `eval`, `new Function` or remote script. Data stays in `chrome.storage.local` and the popup's `localStorage` (`classSchedule`, `examSchedule`, `studentGrades`, filters). The QR feature encodes an ICS text into a QR code locally (`lib/qrcode.js`) and can copy it to the clipboard.

## How it reads FAP v2

There is no hidden API. Every read uses routes already in [endpoints.md](../../20-architecture/fap-v2/endpoints.md), sent from a content script with the user's session cookie.

| Feature | Mechanism | FAP v2 route |
|---|---|---|
| Multi-week timetable sync | `content.js` `fetchAndExtractWeekSchedule`: for each ISO week of the year, GET `data-fetch-url` (falls back to `/WeeklyTimetable/WeekPartial`) with `?referenceDate=<ISO Monday>`, headers `X-Requested-With: XMLHttpRequest`, `Accept: text/html`. The background worker drives the loop one week at a time with a 120 ms pause. The response is accepted only if it contains a `dd/MM` token of the target week. | `/WeeklyTimetable/WeekPartial?referenceDate=` |
| Fallback guesses | If the first GET fails or returns another week: GET with `?week=YYYY-Www`, `?date=`, `dd/MM/yyyy` dates, then `/WeeklyTimetable?...`, then three blind POSTs to `WeekPartial` without a CSRF token, then setting `#weekly-timetable-week` and waiting 1.2 s for the DOM. Only the first candidate works (checked below); the POSTs would fail CSRF validation. | none needed |
| Cell parsing | `.weekly-timetable-cell-title` split at `-` into subject and group; time by regex `HHhMM-HHhMM`; room, lecturer, attendance by `title` attribute in both cultures (`Phòng`/`Room`, `Giảng viên`/`Lecturer`); year from `data-reference-date` with a December to January rollover. Defaults to `07:30-09:50` when no time is found. | |
| Exam schedule | Parses the open `/ExamSchedule` tab; reads `td[data-label=...]` (vi and en) or falls back to column index; tags `FE`, `PE`, `2NDFE`, `2NDPE`. | `/ExamSchedule` |
| Grades | Opens `/Report/Grade`, lists courses from `#grade-report-course` (option value and `data-fallback-href`), fetches each `/Report/Grade?courseId=` page, finds `table.student-mark-sheet`, reads the course from `.fap-result-card__code`, `__title`, `__meta`. Skips resit rows, collects bonus rows, reads `.grade-average`, `.grade-status`. Also auto-saves the grade of any grade page the user opens. | `/Report/Grade?courseId=` |
| Legacy FAP | Every function keeps the `.aspx` path (`ctl00_mainContent_*` selects, `__doPostBack` called in the page's MAIN world). Dead on FAP v2. | |

## Behaviors beyond reading

- Session keep-alive: on every FAP page except login and logout it starts a timer that GETs the current page path every 7 minutes (`lib/fap-keepalive.js`), keeping the FAP session alive as long as a tab is open. It stops on a redirect to a login page or 401/403. A storage flag `fapKeepSessionEnabled: false` turns it off. Default ping URL `/HomePage.aspx` is a legacy path; on v2 the current path is used.
- Feedback autofill: on any URL containing `Feedback` or `Survey` it injects a toolbar that ticks the highest-valued radio of every radio group and writes one of 12 canned Vietnamese praise comments into the first matching textarea. It does not submit; the user must press the site's button. On FAP v2 `/Feedback` it would act on whatever survey form FAP renders.
- Reminders: `chrome.alarms` before classes (15 or 30 minutes) and exams (1 day, 1 hour); clicking a notification focuses or opens the FAP tab.
- Session expiry: a redirect to a login page opens `https://fap.fpt.edu.vn/Default.aspx` (a legacy route that is 404 on v2).

## Live checks of its assumptions (GET only)

| Assumption | Result |
|---|---|
| `WeekPartial?referenceDate=<ISO date>` returns any week | Yes. A week without sessions returns a 244-byte partial: `.fap-empty-state` "You do not have any schedule participation in this week." with no grid. |
| How far back and forward weeks exist | For this account, sessions exist from the week of 2026-01-05 to the week of 2026-12-07 (biweekly sample over 2025-01 to 2027-01). Every week of 2025 returns the empty state, although the grade report lists Fall2025 courses. The attendance report agrees: its term selector lists only Spring2026 to Fall2026. Inferred: session data before Spring2026 was not migrated or is not exposed; unverified for other accounts. |
| `?week=YYYY-Www` | Ignored: returns the current week. The extension rejects it by its date-token check. |
| `referenceDate=dd/MM/yyyy` | Empty state (not parsed as a date). |
| `/WeeklyTimetable?referenceDate=` | Returns the shell without the grid. |
| Meet links or detail links in cells | None in the sampled weeks. The extension's `detailUrl` is therefore empty on v2 and its per-slot attendance re-fetch never runs. |
| `td[data-label]` on exam and grade tables | Absent from the server HTML. Inferred: added client-side by `fap-table-cards.js`; the extension's column-index fallback covers the server HTML. |
| `.fap-result-card` on `/Report/Grade` | Present, with `__title`, `__code`, `__meta`. Not recorded before this check; added to [pages.md](../../20-architecture/fap-v2/pages.md). |
| `#weekly-timetable-container`, `#weekly-timetable-week` | Present; the week input is `type="week" name="week"`. |

## Weaknesses seen in the code

- Attendance mapping in the v2 parser only knows `có mặt`/`attended` and `vắng`/`absent`. FAP v2 prints `Present` in `en` (see [pages.md](../../20-architecture/fap-v2/pages.md)), so English-culture sessions stay "not yet". `Not taken` and `Attendance exempt` are not mapped.
- The year of a week is taken from `data-reference-date` of the page the user has open, so a sync spanning a year boundary depends on the open week.
- The fallback POSTs send no CSRF token and would be rejected (inferred from [platform.md](../../20-architecture/fap-v2/platform.md#csrf)); they are noise, not a trick.
- The grade selector heuristics fall back to "any select that is not a term select", which can pick an unrelated select on a changed page.

## What it does not do

No class list, no other class's schedule, no class switching, no cross-class exchange, no application calls. It contains nothing that helps the MoveOut redesign.

## MoveOut follow-up done in the same pass

- `/Subject/Detail/{guid}`: the `Loading` heading is the shared `#addUpdateModal` placeholder from `base.js`, not a class list. The detail page has no `data-*` URLs and no page script.
- Application type `43 Xin chuyển lớp học` (class transfer request): no registration window (`registrationPeriodDisplay: null`), fixed fee 0, fields `subjectId` from `SubjectsPlacedNoPresentAttendance` then `courseId` from `OpenCoursesBySubjectExcludingStudentCourse`. `PlacedSubjectsNoPresentAttendance` returned the owner's 4 current subjects; `OpenCoursesBySubject`, `...ExcludingStudentCourse` and `OpenInternationalCoursesBySubject` returned `[]` for each of them. The list of target classes is therefore empty today even though the application type has no window.
- Other application types that involve classes or groups: `8` (foreign-university subject, `OpenInternationalCoursesBySubject`, window 2026-08-30 to 08-31), `14` campus transfer, `16` major change, `18` combo change (windows 2026-11-10 to 12-03). None exposes a class roster or another class's timetable.

## Outcome

- [pages.md](../../20-architecture/fap-v2/pages.md): `.fap-result-card`, timetable container ids, week coverage and empty state appended.
- [route-map.md](../../20-architecture/fap-v2/route-map.md): class transfer application note appended.
- Timetable ICS export over a whole term or year is feasible with `WeekPartial` alone, within the coverage window above.

Path note (2026-10-10): the owner renamed the folder to `/mnt/DATA/DATA/Github/unvetted-fap-new-scheduler/`; paths above use the old name.
