---
id: work.investigations.10-04-scheduler-comparison-and-v2-scope
type: investigation
status: draft
owner: unassigned
summary: "Business-rule comparison of the legacy FAP-AIO scheduler and the third-party FPTU Schedule 4.0.0, practices worth adopting, and feasibility of the v2.0.0 module list against FAP v2."
---

# Scheduler comparison and v2.0.0 scope (2026-10-04)

## Sources

- Legacy: `.deprecated/fap-aio/src/contentScript/features/scheduler/` (`constants.ts`, `types.ts`, `utils.ts`, `storage.ts`, `extraction.ts`, `scheduler.ts`), the standalone `.deprecated/fap-scheduler/` (README v2.5.0, `SPECS.md` v2.1.0), the GPA feature (`features/gpa/`), the MoveOut feature (`features/moveout/utils.ts`) and the router (`contentScript/index.ts`). Read in full where cited.
- Third party: FPTU Schedule 4.0.0, see [its analysis](2026-10-04-fptu-schedule-extension.md); rules read from `lib/schedule.js`, `lib/ics.js`, `lib/grades.js`, `lib/notifications.js`, `lib/agenda.js`, `lib/theme.js`, `popup.html`, `popup.css` and the export code in `popup.js`.
- FAP v2 facts from [the fap-v2 section](../../20-architecture/fap-v2/README.md); two new live checks on 2026-10-04 (theme mechanism, page storage), recorded below.

FAP v2 endpoints are left out of the comparison: both tools target the legacy `.aspx` pages for most of their logic.

## Business-rule comparison

| Rule | Legacy FAP-AIO scheduler | FPTU Schedule 4.0.0 |
|---|---|---|
| Where it runs | Floating, draggable panel injected into the FAP page, only on the two schedule pages | Toolbar popup (600 px wide); content scripts on every FAP page; background worker drives multi-week sync |
| Sync scope | "This week" or "whole semester" | "This week", or a user-chosen start and end week of an ISO year |
| Semester definition | Fixed calendar months: Spring Jan to Apr, Summer May to Aug, Fall Sep to Dec; labels `Spring25` from 2022 to next year; week included on any overlap; year-boundary week handled | None; ISO weeks 1 to 52 or 53 of the year of the open page |
| Week navigation | Change the FAP week select, let the page reload, resume from state saved in `localStorage` | Fetch each week's partial in the background (v2); `__doPostBack` in the MAIN world (legacy) |
| Slot times | Fixed table, slots 1 to 8 (`7:00-9:15` ... `20:00-22:15`; 7 and 8 repeat 1 and 2); overridden by the cell's time label | Time read from the cell; fallback table of 6 slots with different times (`7:30-9:50` ... `20:20-22:40`) and a default of `07:30-09:50` |
| Online class | Subject code ends in `c` (for example `PMG201c`) | Cell has a Google Meet link or an element titled "online" |
| Attendance states | `attended`, `absent`, `not-yet` | `attended`, `absent`, `not yet` (plus colour); `Present`, `Not taken` and `Exempt` not mapped on v2 |
| Duplicate rule | Key `title + start timestamp`; new events appended, existing ones never updated | Key `title + day/month + start hour:minute`; existing events get their attendance and Meet link refreshed |
| Exam types | `FE`, `PE`, `2NDFE`, `2NDPE` from the exam column, else inferred from the form text | Same tags and inference; user filter per tag |
| Exam export | Only exams from today on with a room that is not "chưa..." | Same, plus "tba" and "to be announced"; tag appended to the title |
| Exam countdown | Today, tomorrow, urgent, N days, done | Upcoming and completed tabs; countdown in the agenda |
| Class export | Two files: offline `lich-hoc.ics` and online `lich-hoc-online.ics`; Meet link in the description | One file `lich-hoc.ics` |
| ICS times | UTC (`toISOString`) | Exams in UTC; classes as floating local time (no TZID) |
| ICS reminders | One alarm 1 day before every event, classes included | Exams 1 day and 1 hour; classes only on the first slot of the day, 30 minutes |
| ICS correctness | No text escaping, no line folding, random UID per export | RFC 5545 escaping and 75-octet folding; random UID per export |
| Browser notifications | None | `chrome.alarms` for classes (15 or 30 min) and exams (1 day, 1 hour), only for events within 30 days |
| Attendance analytics | None | Absence rate per course over graded sessions; warning at 15 %, danger at 20 % (the code cites the 20 % exam-ban rule; not verified against FPT regulations) |
| Today view | None | Agenda: in progress, next class, free today, today's exams, minutes left |
| Grades | GPA from the transcript: credit-weighted mean of `Passed` subjects with grade and credit above 0, excluding code prefixes `OJS, VOV, GDQP, LAB, ENT, SSS, TMI, TRS, OTP` (user-editable); per-semester and cumulative | Per-course mark sheet: category weights and values, bonus rows added, resit rows skipped; predictor for the final exam score needed to reach a target (default 5.0) with an exam floor of 4.0 (not verified); no cumulative GPA |
| Storage | Page `localStorage` of `fap.fpt.edu.vn` (shared with FAP's own scripts) | `chrome.storage.local` plus the popup's own `localStorage` |
| Language | Vietnamese UI | Vietnamese UI; parsers accept both `vi` and `en` labels |
| Extra behaviours | None | Session keep-alive every 7 min; feedback survey autofill (5 stars and canned praise); QR code of the ICS; theme auto, light, dark |
| Tests | None | Rule libraries are UMD modules written to be `require`d by tests (tests not shipped) |

Live check: the owner's FAP origin `localStorage` currently holds `weeklySchedule`, `examSchedule`, `semesterSyncState`, `pendingSemesterSync`, `selectedSemester`, `expireAt` and subject-named keys. The scheduler keys match `features/scheduler/scheduler.ts`; `expireAt` matches `features/moveout/App.tsx` (subject-named keys are likely the MoveOut cache, not confirmed). They come from a legacy FAP-AIO build, not from FAP. FAP's own scripts can read them, and FAP can clear them.

## Practices worth adopting

1. Keep business rules in pure modules, separate from DOM and Chrome APIs, so the popup, the content script and the service worker share one implementation and tests can load it directly (`lib/schedule.js` pattern).
2. Merge by a stable key and refresh mutable fields (attendance, Meet link) on re-sync instead of append-only.
3. Validate that a fetched partial belongs to the requested week before accepting it (date-token check), since FAP falls back to the current week on bad parameters.
4. Write RFC 5545 correctly: escape TEXT, fold at 75 octets. Go further than both tools: stable UIDs derived from the event key (so a re-import updates instead of duplicating) and `TZID=Asia/Ho_Chi_Minh` instead of UTC or floating time.
5. Schedule reminders with `chrome.alarms` and bound them to a horizon (30 days), rebuilt after each sync.
6. Attendance risk per course, computed over graded sessions only, with thresholds held as named constants. FAP v2 already prints `Absent N%` in `.attendance-summary`; prefer FAP's figure when present.
7. A "today" agenda (current class, next class, today's exams) as the default view.
8. A grade predictor (score needed on the remaining weight) on top of the parsed mark sheet.
9. Design tokens as CSS variables with a `data-theme` switch (auto, light, dark), and accessible modals (`role="dialog"`, `aria-label` on icon buttons, `role="status"` for progress).
10. Store in `chrome.storage.local`, never in the FAP page's `localStorage`.

## Practices to avoid

- Guessing endpoints and sending POSTs without a CSRF token as fallbacks.
- Text-heuristic table and select detection when FAP v2 offers stable classes (`table.student-mark-sheet`, `#grade-report-course`, `.fap-result-card`).
- Hard-coded slot-time fallbacks; FAP v2 prints the time in every cell.
- A single 133 KB popup script; legacy `.aspx` code paths kept alive next to v2 code.
- Silent session keep-alive. If offered at all, it must be opt-in with the interval shown.
- Feedback autofill with fixed maximum ratings and canned praise. It falsifies a university survey on the user's behalf; FAP-AIO should not ship it.

## Design reading of FPTU Schedule

Layout: header with icon buttons (theme, notifications); three tabs (schedule, exams, grades) with an action row per tab (secondary sync, primary export, ghost filter, danger clear); six modals (schedule filter, confirm, week range, exam filter, notifications, QR); footer with author links. Theme: about 20 tokens (`--bg-app`, `--bg-elevated`, `--text`, `--text-muted`, `--accent`, `--danger`, radii 8, 12 and pill, two shadows, system font stack) redefined under `[data-theme="dark"]`; slate and blue palette; one breakpoint at 560 px. Philosophy: a self-contained companion app outside the FAP page. FAP is a data source, the popup is the product, and it works offline from cached data. Its cost: every view needs a sync step and the popup duplicates what the FAP page already shows. The legacy FAP-AIO took the opposite stance (enhance the FAP page in place).

## FAP v2 theme mechanism (live check)

- `html` carries `data-bs-theme` (`dark` observed), `data-layout-mode`, `data-menu-color`, `data-topbar-color`, `data-layout-position`, `data-sidenav-size`, `data-sidenav-user`. The toggle is `#light-dark-mode`. The Jidox layout state is kept in `sessionStorage.__CONFIG__`; FAP adds `localStorage` keys `fap:outside:sidenav-size:v1` and `fap:outside:sidebar-collapse-state:v1`.
- Stylesheets: `/assets/vendor/jidox/css/app.min.css`, `icons.min.css`, flatpickr, jquery-toast, `/css/style.css`. The root and dark rules define 144 custom properties prefixed `--ct-` (no `--bs-` at those selectors).

## v2.0.0 module feasibility

| Module | Feasible | FAP v2 basis | Limits |
|---|---|---|---|
| Weekly scheduler | Yes | `WeekPartial?referenceDate=` per week; explicit times, room, lecturer, online flag, schedule type, 4 attendance states in each cell | Data only from 2026-01-05 for the owner's account; no Meet or detail links seen |
| Exam scheduler | Yes | `/ExamSchedule` table, 8 columns | Upcoming exams only; history must be cached by the extension |
| Info getter: subjects | Yes | `/Subject` (paged, up to 100), `/Subject/Detail/{guid}`, `/Curriculum` | HTML only |
| Info getter: lecturer contact | Partial | Lecturer login in timetable cells and attendance rows | No lecturer directory or email found; deriving an email from the login is a guess (unverified) |
| Info getter: status | Yes | Account academic status, attendance summary, grade status, wishlist, application, cross-class lists, notifications | Application list shape unverified (empty) |
| Info getter: news | Yes | `/News`, `/News/Detail/{guid}`, `/Document` | Attachments open as navigations (CSP) |
| Info getter: all class schedules | No | No student route | Only the student's own sessions |
| Info getter: class roster | No | No student route; unauthorized routes return 404 | Re-check during add/drop |
| GPA auto calculator | Yes | `/Report/Transcript` (credits, grade, status); `/Report/Grade` per course for in-progress prediction | Non-GPA prefix list must be revalidated against v2 subject codes |
| Self-service | Partial, with consent | `GetFormSchema` gives a runtime schema for all 46 application types; option sources are GETs | Every submit is a POST with fees or side effects; must prefill and let the user submit on FAP's own form, CSRF from a live form |
| Web layout enhancer | Yes | Jidox `data-*` layout attributes, `MutationObserver` for partial swaps | Extension CSS through the manifest or `chrome.scripting.insertCSS` (CSP `style-src 'self'`) |
| Custom themes | Yes | Override the `--ct-*` variables under `html[data-bs-theme=...]` | A theme must be CSS only; remote themes need review, since CSS `url()` can leak page state (page CSP `img-src` narrows but does not remove this; inferred) |
| MoveOut | Redesign only | Class transfer application type 43; cross-class exchange | Open-class lists empty on 2026-10-04 |
