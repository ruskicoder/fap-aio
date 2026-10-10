# Requirements Document

## Introduction

This spec covers the info getter of FAP-AIO v2.0.0. It gathers information a student otherwise collects from several FAP pages and from FLM into one Info area of the panel:
- subjects with their FLM syllabus and learning path;
- lecturer contacts;
- academic status (attendance risk, grade status, Coursera duties, notifications);
- an exams overview;
- news and documents, with a watch for important events.

It also adds periodic background refresh, which the owner chose alongside on-demand reads ([decision 0002](../../../docs/60-decisions/0002-v2-module-scope.md) items 3 to 5). It builds on the core in `.kiro/specs/v2-core-scheduler/` and reads data from the grades module where noted.

Not possible for a student on FAP v2 and out of scope: other classes' schedules, class rosters, a lecturer directory (`docs/70-work/investigations/2026-10-04-scheduler-comparison-and-v2-scope.md`). Also out of scope: any POST to FAP (marking notifications read stays on FAP's own bell), self-service, and MoveOut (planned, decision 0002 item 8).

## Requirements

### Requirement 1: Info area

**User Story:** As a student, I want one Info area in the panel, so that I find subjects, people, status, exams and news in one place.

#### Acceptance Criteria

1. The panel SHALL provide an Info view with sections: Overview, Subjects, Lecturers, Status, Exams, News.
2. The Overview SHALL show, at a glance, the attendance risks, failed or at-risk courses, upcoming exams within 14 days, unread watched news, and the unread notification state.
3. WHEN the user selects an Overview item THEN the panel SHALL open the matching section on that item.
4. Every section SHALL show when its data was last refreshed and offer a manual refresh.

### Requirement 2: Subjects and FLM syllabus

**User Story:** As a student, I want to look up any subject's requirements and materials, so that I know what a subject demands before and while I take it.

#### Acceptance Criteria

1. The Subjects section SHALL search subjects by code or name across the bundled FLM rubric (1,020 subjects on 2026-10-10) and the student's curriculum.
2. WHEN the user opens a subject THEN the section SHALL show from FLM: name (English and Vietnamese), credits, prerequisites, pass mark, assessments with weights and completion criteria, attendance requirement, Coursera requirement and bonus, materials, learning outcomes, time allocation, and the syllabus approval date.
3. The subject detail SHALL link to the live FLM syllabus page (`https://flm.fpt.edu.vn/gui/role/student/SyllabusDetails?sylID=<id>`) and, when the subject is in the curriculum, to FAP's `/Subject/Detail/{guid}`.
4. WHEN the subject is in the student's curriculum THEN the detail SHALL show its curriculum term and its status from the transcript (passed, in progress, not started).
5. The subject detail SHALL show the learning path: the subject's prerequisites, recursively, and the subjects that list it as a prerequisite, from FLM prerequisite codes and the curriculum's prerequisite column.
6. IF a subject carries an FLM data-quality flag THEN the detail SHALL show the flag with its meaning.

### Requirement 3: Lecturer contacts

**User Story:** As a student, I want my lecturers' email addresses, so that I can contact them without searching.

#### Acceptance Criteria

1. The module SHALL collect lecturer shortcodes from synced timetable sessions and from attendance records.
2. The module SHALL treat shortcodes case-insensitively: `AnhND3`, `anhnd3` and `ANHND3` are one lecturer.
3. For each lecturer the section SHALL show the shortcode, the email addresses `<shortcode>@fe.edu.vn` (marked preferred) and `<shortcode>@fpt.edu.vn`, the subjects and groups they teach the student, and the last session date.
4. The section SHALL provide copy and mail-to actions for each address.
5. The section SHALL explain the shortcode pattern (first name plus initials of last and middle names, plus a counter for repeats) and that addresses are derived, not looked up.
6. IF a lecturer value does not match the shortcode pattern THEN the section SHALL list it without derived addresses.
7. The section SHALL let the user add a note and a display name to a lecturer, stored locally.

### Requirement 4: Attendance status

**User Story:** As a student, I want to see how many absences I have left per course, so that I never fail on attendance.

#### Acceptance Criteria

1. The module SHALL read the attendance of each current-term course from `/Report/Attendance`: sessions, absences and not-yet-taken sessions.
2. For each course the module SHALL compute the allowed absences as floor(total sessions × (1 − minimum attendance %)), using the subject's FLM attendance requirement (80% by default, 100% where FLM says so).
3. The module SHALL show for each course: absences used, absences left, and a risk level. The levels SHALL be safe (2 or more left), warning (1 left), last chance (0 left, limit not exceeded) and failed (limit exceeded).
4. WHEN a course reaches warning, last chance or failed THEN the Overview SHALL show it, and, if notifications are enabled, the extension SHALL notify once per level change.
5. The grades module SHALL use these figures for its attendance checks.

### Requirement 5: Course and Coursera status

**User Story:** As a student, I want my course standing and Coursera duties in one place, so that I catch problems early.

#### Acceptance Criteria

1. The Status section SHALL list current-term courses with the grades module's pass status, current average and effective goal.
2. WHERE a current course requires Coursera THEN the section SHALL show a Coursera item with a user-set "completed" checkbox and the rule that completion must precede the FE.
3. WHEN an FE for a Coursera course is synced AND its Coursera item is not completed THEN the section SHALL show a warning with the days left before the FE.
4. The section SHALL show whether there are unread FAP notifications (`/Notification/UnreadCount`) and the latest notifications from `/Notification/BellList`, each linking to its FAP target.

### Requirement 6: Exams overview

**User Story:** As a student, I want an exams overview tied to my courses, so that I see countdowns and results timing together.

#### Acceptance Criteria

1. The Exams section SHALL list upcoming exams from the scheduler's exam store with days left, type, room, and grade publication date.
2. The section SHALL mark resit exams (2NDFE, 2NDPE) and link each exam to its course's grade status.
3. WHEN an exam's grade publication date has passed THEN the section SHALL offer to refresh that course's mark sheet.

### Requirement 7: News, documents and important-event watch

**User Story:** As a student, I want FAP news and documents in the panel and an alert for important events such as capstone registration, so that I do not miss deadlines.

#### Acceptance Criteria

1. The News section SHALL list FAP news from `/News` (newest first, 20 per page) with title, type, created date, expiry date and pinned state, and SHALL open the FAP detail page on selection.
2. The section SHALL list FAP documents from `/Document` with name, type and date, opening the FAP detail page on selection.
3. The module SHALL mark news items as read once the user opens them from the panel, and SHALL show unread counts.
4. The module SHALL classify each news item by the rules in `data/news/news-rules.json` (convention: `docs/20-architecture/fap-v2/news.md`): department tag, event families, priority P1 to P4, flags, term tokens and deadline.
5. The module SHALL personalize the priority with the student's context: subject codes in progress or not passed, Coursera subjects, thesis or capstone enrolment, cohort and campus. Items for another campus SHALL drop to P4, and staff-only items SHALL be hidden.
6. WHEN an item is P1 after personalization THEN the module SHALL read its detail page (at most 3 per background cycle) and extract the expiry and the body deadline.
7. WHEN a new item is P1 after personalization AND it has a deadline within 14 days, OR is an exam-eligibility item, OR names one of the student's subject codes, OR was posted within the last 3 days, THEN the module SHALL show it as important in the Overview and, if news notifications are enabled, notify once.
8. The module SHALL treat the same normalized title within 30 days as one item, mark it as reposted, and SHALL NOT alert twice for it.
9. The user SHALL be able to add watch keywords, case-insensitive and diacritic-insensitive; a match SHALL raise the item to P1 for that user. The default user list SHALL be empty, because the rules already cover the common events.
10. The News section SHALL filter by family group (Action needed, Exams, Results, Schedule, Opportunities, Other) and by priority, and SHALL show each item's deadline and days left.

### Requirement 8: Background refresh

**User Story:** As a student, I want important data kept fresh while FAP is open, so that alerts reach me without clicking refresh.

#### Acceptance Criteria

1. Background refresh SHALL be on by default and switchable in settings.
2. WHILE background refresh is enabled AND a FAP tab is open THEN the extension SHALL refresh, every 6 minutes by default (adjustable from 1 to 6), these sources: unread notifications, the first page of news, the exam schedule, and the attendance of current-term courses.
3. Each background cycle SHALL make at most 6 FAP requests, one at a time, with the core's pause between requests.
4. IF a background request returns 403 THEN the extension SHALL pause background refresh for 15 minutes; IF the 403 is a Cloudflare challenge THEN it SHALL stop background refresh until the user reloads a FAP page.
5. IF a background request finds the session expired THEN the extension SHALL stop background refresh until the next FAP page load.
6. Opening a section SHALL read its sources on demand when their cache is older than their lifetime, independent of background refresh.
7. Background refresh SHALL NOT replace keep-alive. Keep-alive stays an opt-in setting firing every 7 minutes (decision 0002 item 5). WHEN both are enabled THEN a background request made within the last 7 minutes SHALL count as the keep-alive request.

### Requirement 9: Notifications from the info module

**User Story:** As a student, I want to choose which info alerts reach me, so that I am not flooded.

#### Acceptance Criteria

1. Info notifications SHALL be off by default and enabled per kind in settings: attendance risk, watched news, Coursera before FE.
2. WHEN the user clicks an info notification THEN the extension SHALL focus or open a FAP tab and open the panel on the related section.
3. The extension SHALL NOT notify twice for the same item and level.
