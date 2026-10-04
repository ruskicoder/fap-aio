---
id: work.investigations.10-04-class-roster-and-rendering
type: investigation
status: draft
owner: unassigned
summary: "Where FAP v2 exposes per-class student lists, how each module renders, and the remaining POST endpoints."
---

# Class roster, rendering modes and POST discovery (2026-10-04)

Follow-up to [the first scrape](2026-10-04-fap-v2-scrape.md). Same rules: GET only, no form submitted, no POST called.

## Goal

1. Find a per-class student list (the legacy `/Course/Groups.aspx?group={id}` that MoveOut used).
2. Establish which modules are server-rendered only and which expose partials or JSON.
3. Find POST endpoints that the first pass missed, without calling them.

## Method

- Parsed `GetFormSchema` for all 46 application types and collected every option field's `apiUrl`, `apiMethod` and dependency chain from `app-type-runtime-form.js`.
- Called the read-only JSON option sources for this account: subject lists (130 distinct subjects), then `OpenCoursesBySubject` and `OpenCoursesBySubjectExcludingStudentCourse` for each subject.
- Probed 78 guessed GET routes for course, group, class, student, lecturer, admin, API and Swagger paths.
- Requested 26 routes three ways (plain, `X-Requested-With`, `Accept: application/json`) and compared status, content type, length and presence of the layout.
- Extracted every `/Controller/Action` string from the raw HTML of 32 pages and from 26 site scripts, and diffed the set against the [endpoint catalog](../../20-architecture/fap-v2/endpoints.md).

## Findings

### Per-class student list

- No student-facing route returns the members of a class. The weekly timetable, attendance report, grade report and exam schedule show only the student's own sessions, with no links to a class page.
- All 78 guessed routes returned 404. FAP answers 404 for unauthorized routes too (`/Academic/ApplicationTypes/OptionsProxy` is referenced by every schema yet returns 404), so a staff-only roster may exist but cannot be reached or confirmed from a student session.
- The nearest data sources:
  - `GET /Application/GetFormSchemaOpenCoursesBySubject?subjectId=` and `...ExcludingStudentCourse?subjectId=` return the open classes of a subject as `[{value, label, ...}]`. This is a class list without members. Both returned `[]` for all 130 subjects. That is consistent with a closed registration period, but this was not confirmed.
  - `GET /CrossClassChange/ResolveTargetStudent?fromCourseId=&rollNumber=` returns another student's courses for an exchange. This is a per-student lookup, not a roster. It was not called, because it reads another student's data.
- Consequence: the legacy MoveOut flow (browse classes, view their schedule and members, move) has no v2 equivalent. Any redesign must start from the cross-class exchange (peer swap with a known roll number) or from the class-transfer application ("Xin chuyển lớp học", which chains `PlacedSubjectsNoPresentAttendance` into `OpenCoursesBySubjectExcludingStudentCourse`).

### Rendering modes

Recorded in [platform.md](../../20-architecture/fap-v2/platform.md#rendering-modes-per-module). In short: only the grade and attendance reports return a partial on `X-Requested-With`. No route negotiates JSON. The transcript, exam schedule and curriculum exist only as full server-rendered pages. The exam schedule has no filter and ignores `termId`. `/Subject` caps `pageSize` at 100.

### POST and other endpoints added to the catalog

- `GET /FyeMentorFeedback/SearchAssignments?keyword=`.
- The shopping-cart payment form fields (`amount`, `typeDng`, `useBalance`, `payableIds`, `isPayable`, `externalId`, `isDormitory`). The action URL is rendered per cart item and was absent for this account.
- The cross-class create form element ids. The form markup is not rendered for a student without an eligible class, so field `name`s are still unknown.
- The application option-source mechanism: 38 `apiKey`s, their query parameters and their dependency chains.
- `/Home/Index`, `/Account/Index`, `/Feedback/Index` aliases; `/Home/Privacy` returns 500.

## Gaps

- Open-course lists need to be re-checked during a registration window.
- POST field names for cross-class create, notification mark-read, web device sync and fee preview still need either an eligible account or a captured browser interaction (DevTools network log while a user performs the action).

## Outcome

Facts merged into [endpoints.md](../../20-architecture/fap-v2/endpoints.md), [pages.md](../../20-architecture/fap-v2/pages.md), [platform.md](../../20-architecture/fap-v2/platform.md) and [route-map.md](../../20-architecture/fap-v2/route-map.md).
