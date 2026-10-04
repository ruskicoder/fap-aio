---
id: architecture.fap-v2.route-map
type: interface
status: draft
owner: unassigned
summary: "Legacy FAP routes used by FAP-AIO v0.0.1 mapped to their FAP v2 replacements."
---

# Legacy to v2 route map

Legacy routes are the ones referenced by the old source (`grep` for `.aspx` over `.deprecated/fap-aio/src` and `.deprecated/userscript`). The legacy extension is preserved in `/.deprecated/` at the repository root. All legacy routes below now return 404.

| FAP-AIO feature | Legacy route | v2 route | Data source in v2 | Notes |
|---|---|---|---|---|
| Router entry, home tweaks | `/Student.aspx` | `/` | `/Home/StudentContentPartial` | Home content arrives after load as a partial; inject after it renders. |
| GPA calculator | `/Grade/StudentTranscript.aspx` | `/Report/Transcript` | page table 1 and 2 | 10 columns; Status in `span.badge`; `In progress` rows have no grade. |
| GPA table "subject fees" link | `/FrontOffice/SubjectFees.aspx` | `/Subject` | page table, `Fee VND` and `FeeIS` columns | Link target only. |
| Weekly schedule export (ICS) | `/Report/ScheduleOfWeek.aspx` | `/WeeklyTimetable` | `/WeeklyTimetable/WeekPartial?referenceDate=YYYY-MM-DD` | Times are explicit per cell; the legacy fixed `SLOT_TIMES` table is obsolete. |
| Exam schedule export (ICS) | `/Exam/ScheduleExams.aspx` | `/ExamSchedule` | page table | Time format `HHhMM-HHhMM`. |
| MoveOut (class switcher) | `/FrontOffice/Courses.aspx`, `/FrontOffice/MoveSubject.aspx` | `/CrossClassChange`, `/CrossClassChange/Create` | `/CrossClassChange/ResolveTargetStudent` (json) | v2 models a peer exchange with a target student, not a free move. Create form not yet observed. |
| MoveOut class schedule lookup | `/Course/Groups.aspx?group={id}` | none found | none found | No student-facing route lists another class's schedule or members (see [the roster investigation](../../70-work/investigations/2026-10-04-class-roster-and-rendering.md)). Open question for the MoveOut redesign. |
| MoveOut course list by department | `/Course/Courses.aspx` | none found | none found | Closest match: `/Application/GetFormSchemaOpenCoursesBySubject?subjectId=` and `...ExcludingStudentCourse` (json class list per subject, used by the "Xin chuyển lớp học" application). Both returned empty for all 130 subjects tried, which fits a closed registration period. |
| Dark theme, UI tweaks | all `.aspx` pages | all v2 pages | not applicable | New template (Jidox, Bootstrap 5); legacy CSS selectors (`ctl00_*`, `#ctl00_mainContent_*`) match nothing. |
