# Requirements Document

## Introduction

This spec covers the grades module of FAP-AIO v2.0.0: GPA from the transcript, pass checks and score prediction per course, goal tiers, an overall GPA goal, a what-if simulator, a target GPA planner and export. It builds on the core in `.kiro/specs/v2-core-scheduler/` (panel, access layer, source registry, storage, settings).

Business rules: the FPTU pass rules and GPA decisions in `docs/10-context/constraints.md`, and [decision 0002](../../../docs/60-decisions/0002-v2-module-scope.md) item 2. Data:
- FAP mark sheets and transcript (`docs/20-architecture/fap-v2/pages.md`, `data-model.md`).
- The FLM rubric `data/flm/subject-rules.json` (`docs/20-architecture/flm-subject-list.md`).
- The reference implementations `tools/flm-scraper/predict.mjs` and `marksheet.mjs`, validated on 2026-10-10 against 43 graded courses with no mismatch.

Out of scope: any POST to FAP, grade appeals or retake registration, bonus points other than FAP's `Mark bonus`, lecturer-computed attendance scores, and per-subject free-text conditions beyond what FLM states as criteria (shown as text only).

Glossary:
- Course average: FAP's course total, min(10, weighted average + mark bonus), rounded to one decimal half up.
- Counted subject: a transcript row whose status is Passed, whose grade is numeric, and whose code is not excluded.
- Tier: Pass 5, Fair 7, Good 8, Excellent 9 (course average at least the value).

## Requirements

### Requirement 1: Transcript reading

**User Story:** As a student, I want my transcript read correctly, so that GPA figures match my record.

#### Acceptance Criteria

1. WHEN the grades module needs the transcript THEN it SHALL read `/Report/Transcript` through the access layer and parse the main table (No., Term, Semester, Subject code, Prerequisites, Replaced subject, Subject name, Credits, Grade, Status).
2. The module SHALL NOT count rows of the replaced or extra subjects table toward any GPA; it SHALL show them as information only, marking that they supersede an older subject.
3. The module SHALL map the status by badge class and the constant table (Passed, Exempt, In progress, Not passed), covering `vi` and `en`.
4. IF a status is not in the constant table THEN the module SHALL keep the row, show the raw status, and exclude it from GPA.
5. WHEN a grade cell holds `-` or no number THEN the module SHALL treat the row as ungraded.

### Requirement 2: GPA calculation

**User Story:** As a student, I want my cumulative and per-semester GPA, so that I know where I stand.

#### Acceptance Criteria

1. The module SHALL compute GPA as the credit-weighted mean of counted subjects.
2. The module SHALL exclude subjects whose code starts with an entry of the non-GPA list, compared case-insensitively. The default list SHALL be `GDQP, ENT, VOV, TRS, ÐSA, ĐSA, TMI, LAB, OJS, OJT, SYB301`.
3. WHEN the user edits the non-GPA list THEN the module SHALL store it in extension storage, recompute at once, and offer a reset to the default.
4. The module SHALL compute a GPA per semester, ordered by year and then Spring, Summer, Fall, and a cumulative GPA.
5. The module SHALL show GPA with two decimals, together with the counted credits.
6. Exempt and In progress subjects SHALL NOT count toward GPA.

### Requirement 3: Transcript page summary

**User Story:** As a student, I want my GPA shown on the transcript page, so that I see it where I read my grades.

#### Acceptance Criteria

1. WHEN `/Report/Transcript` is open THEN the module SHALL insert a summary above the main table with cumulative GPA, counted credits and per-semester GPA.
2. The summary SHALL mark each row that counts toward GPA, without changing FAP's own cell values.
3. The summary SHALL link to the panel's Grades view, the what-if simulator and the non-GPA list setting.
4. IF the transcript layout cannot be parsed THEN the module SHALL show a layout-changed notice instead of a summary.

### Requirement 4: Course model from FAP and FLM

**User Story:** As a student, I want each course modelled from its real mark sheet, so that predictions follow how my class is actually graded.

#### Acceptance Criteria

1. WHEN the module models a course THEN it SHALL take mark groups, items and weights from the FAP mark sheet, and completion criteria and exam kind from the matching FLM syllabus row.
2. IF a mark group has no FLM match THEN the module SHALL apply the owner rules: finals at least 4, every other component above 0.
3. WHEN a FAP group has items of unequal weight THEN the module SHALL apply the group's criterion to the weighted average of its items and each item's own criterion to that item.
4. WHEN a `(Resit)` item has a mark THEN the module SHALL use it in place of the original item of the same name.
5. The module SHALL read the summary rows: late penalty (%), mark bonus and course total.
6. IF the mark sheet has no items yet THEN the module SHALL model the course from the FLM syllabus with no marks.
7. IF the FLM syllabus marks the subject as not scored THEN the module SHALL show FAP's status only and SHALL NOT predict.
8. IF there is neither an FLM syllabus nor any item THEN the module SHALL show that no prediction is possible.
9. WHEN a mark-group match has confidence below 0.75, or the FLM subject carries a data-quality flag, THEN the module SHALL show a warning next to the prediction.
10. IF a late penalty other than 0% is present THEN the module SHALL show it and state that its effect is not modelled.

### Requirement 5: Pass check and tier prediction

**User Story:** As a student, I want to know whether I am failing and what I need on the remaining components for each tier, so that I can plan my effort.

#### Acceptance Criteria

1. The module SHALL compute the course average as min(10, weighted average + mark bonus) and SHALL compare it to the pass mark and the tiers after rounding to one decimal, half up.
2. WHEN a graded component fails its criterion THEN the module SHALL report the course as failed and name the component and the criterion.
3. The pass mark SHALL be the FLM `MinAvgMarkToPass` of the subject, or 5 when FLM has none.
4. WHEN components remain ungraded THEN, for each tier, the module SHALL report the smallest score per remaining component, in steps of 0.1, that reaches the tier. Each score SHALL be at least the component's own minimum, and the result SHALL be "not reachable" when 10 on every remaining component is not enough.
5. WHEN all components are graded THEN the module SHALL report the course average and the highest tier reached.
6. WHEN attendance data for the course is available THEN the module SHALL report absences used and absences left before the subject's attendance limit (80% by default, 100% where the syllabus says so), and SHALL report a fail when the limit is exceeded.
7. WHERE the subject requires Coursera THEN the module SHALL warn that the FE score is not validated unless the designated courses are completed before the FE.
8. WHERE the subject grants a MOOC bonus AND the user marks the course's MOOCs as completed on time THEN the module SHALL include a bonus of 1 in predictions before FAP shows it, and SHALL label the prediction as assuming the bonus.

### Requirement 6: Inline prediction on the grade page

**User Story:** As a student, I want the prediction under FAP's own mark sheet, so that I do not have to switch views.

#### Acceptance Criteria

1. WHEN `/Report/Grade` shows a course's mark sheet THEN the module SHALL insert below it the pass status, the current weighted average and the required scores for the selected tier.
2. The inline block SHALL let the user switch the tier for this course and SHALL save the choice as the course goal.
3. WHEN FAP replaces the mark sheet (course or term switch) THEN the module SHALL update the inline block for the new course.
4. The inline block SHALL NOT change FAP's own table cells.

### Requirement 7: Goals

**User Story:** As a student, I want a default goal tier, per-course overrides and an overall GPA goal, so that my targets fit my ambition.

#### Acceptance Criteria

1. The module SHALL store a default tier (initially Good) that applies to every course without an override.
2. WHEN the user sets a tier for a course THEN that tier SHALL override the default for that course only.
3. WHEN the user sets an overall cumulative GPA goal THEN the module SHALL compute the average needed over the GPA-counting credits of in-progress courses to reach it.
4. WHEN it derives per-course targets from the GPA goal THEN the module SHALL give every in-progress course the same target average where reachable. It SHALL cap a course at its highest reachable average and spread the shortfall over the remaining courses, weighted by credits.
5. IF the GPA goal cannot be reached even with the highest reachable average in every in-progress course THEN the module SHALL say so and show the highest reachable cumulative GPA.
6. WHERE a course has both a tier goal and a GPA-derived target THEN the module SHALL show both and highlight the higher one as the effective target.
7. Goals SHALL persist in extension storage and survive reloads.

### Requirement 8: Grades view in the panel

**User Story:** As a student, I want one view of all my current courses with their status and goals, so that I can see the whole term at once.

#### Acceptance Criteria

1. The panel SHALL list the current term's courses with code, name, current weighted average, pass status, effective goal and the required scores for that goal.
2. WHEN the view opens AND cached course data is older than its cache lifetime THEN the module SHALL refresh the courses one at a time through the access layer.
3. The view SHALL show cumulative GPA, the GPA goal, and whether the goal is reachable.
4. The view SHALL let the user open any course's detail: components, marks, criteria, warnings and the FLM syllabus link.
5. WHEN a course fails a criterion THEN the view SHALL mark it as failed at the top of the list.

### Requirement 9: What-if simulator

**User Story:** As a student, I want to enter expected grades and see the resulting GPA, so that I can test scenarios.

#### Acceptance Criteria

1. The simulator SHALL let the user enter an expected course average for each in-progress course, or expected marks for its remaining components.
2. WHEN inputs change THEN the simulator SHALL recompute the term GPA and cumulative GPA at once.
3. The simulator SHALL let the user add hypothetical future courses with credits and an expected average.
4. Simulator inputs SHALL NOT change stored goals or real data, and SHALL be clearable in one action.

### Requirement 10: Target GPA planner

**User Story:** As a student, I want to know the average I need in my remaining credits to reach a target cumulative GPA, so that I can plan beyond this term.

#### Acceptance Criteria

1. WHEN the user enters a target cumulative GPA and the number of remaining credits THEN the planner SHALL show the average needed over those credits.
2. The planner SHALL default the remaining credits to the curriculum credits not yet passed, when the curriculum can be read.
3. IF the needed average is above 10 THEN the planner SHALL report the target as unreachable and show the highest reachable cumulative GPA.

### Requirement 11: Export

**User Story:** As a student, I want to export my transcript and GPA, so that I can keep or share them.

#### Acceptance Criteria

1. The module SHALL export the transcript rows, the GPA per semester and the cumulative GPA as CSV and as JSON.
2. The CSV SHALL be UTF-8 with a byte-order mark, so that Vietnamese subject names open correctly in spreadsheet software.
3. The export SHALL include the non-GPA list used and the export date.

### Requirement 12: FLM rubric data

**User Story:** As a developer, I want the FLM rubric bundled and versioned, so that predictions work offline and can be refreshed.

#### Acceptance Criteria

1. The extension SHALL bundle `subject-rules.json` and SHALL show its scrape date in the Grades view.
2. WHEN a subject code is not in the bundled rubric THEN the module SHALL also try the code without its last lowercase letter (for example `IOT102t` to `IOT102`) before falling back to the owner rules.
3. A rebuilt rubric SHALL keep schema version 1, or ship with a migration in the module.

## Requirements added 2026-11-22 (owner request after the M2 build, phase GRD-7)

The owner tested the M2 build and asked for four additions. They extend the requirements above and change none of them. The previous copy of this file is `.deprecated/2026-11-22-requirements.md`.

### Requirement 13: GPA scale switch

**User Story:** As a student, I want my GPA on the 10-point Vietnamese scale or on the 4-point global scale, so that I can quote it for local or international applications.

#### Acceptance Criteria

1. The GPA view SHALL offer a switch between "10-point (Vietnam)" and "4-point (global)", with "10-point (Vietnam)" as the default.
2. WHEN the 4-point scale is chosen THEN the module SHALL convert each counted course grade to a letter and its points with one letter-grade table, and SHALL compute the cumulative and per-semester GPA as the credit-weighted mean of those points.
3. The 4-point GPA SHALL count exactly the rows the 10-point GPA counts (R2.1, R2.2, R2.6).
4. The letter-grade table SHALL be one constant that cites its source; WHERE the official text could not be checked, the design SHALL say so.
5. WHEN the user changes the scale THEN the module SHALL store the choice in settings and SHALL apply it in every view at once.
6. WHERE grades are listed per course (Courses, Record, the printable list and the record export) the module SHALL show the letter of each graded course.

### Requirement 14: Full academic record

**User Story:** As a student, I want every term and every course with its mark sheet in one place, so that I can review my whole record, not only the current term.

#### Acceptance Criteria

1. The Grades section SHALL have a "Record" view listing every term, newest first, and every course in it.
2. WHEN the user expands a course THEN the view SHALL show its mark sheet components (category, item, weight, value), its average and its status.
3. The module SHALL build the course list from the transcript and SHALL read the term course lists and the mark sheets from `/Report/Grade` with the term and course parameters, through the paced access layer and the shared request budget, one request at a time, GET only.
4. The read SHALL run as a resumable job: the plan and progress SHALL be stored after every step, so a reload resumes from the next unfinished step.
5. WHILE the job runs the view SHALL show progress (done and total steps) and the results read so far, and SHALL offer Cancel; WHEN a stored job is not running THEN the view SHALL offer Resume.
6. The module SHALL cache what it reads and, on an ordinary update, SHALL read again only terms whose transcript rows changed, terms with courses in progress and courses with no stored mark sheet; the user SHALL be able to read everything again, one term again or one course again.
7. IF a step fails with an error that stops reads (challenge, expired session, required feedback, forbidden) THEN the job SHALL stop and stay resumable; any other failure SHALL fail only that step and be listed.
8. A transcript course with no mark sheet on FAP SHALL be listed with its transcript grade and status.

### Requirement 15: Printable grade list

**User Story:** As a student, I want a clean grade list I can print or save as PDF, and my record as files, so that I can keep or share it.

#### Acceptance Criteria

1. WHEN the user chooses "Print or save as PDF" in Record THEN the service worker SHALL open an extension page in a popup window, with no web-accessible resource, no `downloads` permission and no new dependency.
2. The page SHALL show the student name and roll number read from FAP, the curriculum, and per term the courses with credits, grade, letter and status, the term GPA and the cumulative GPA on the chosen scale, and optionally each course's components.
3. The page SHALL show the date generated and the note "Generated by FAP-AIO from FAP data; not an official transcript".
4. A print stylesheet SHALL lay the page out on A4 and hide the page's own controls, so that Chrome's print dialog saves it as PDF.
5. Record SHALL export the whole record as CSV (UTF-8 with a byte-order mark) and as JSON through a blob link.

### Requirement 16: Attendance in Grades

**User Story:** As a student, I want my attendance next to my grades, so that I see how close each course is to the attendance limit.

#### Acceptance Criteria

1. The Grades section SHALL have an "Attendance" view listing each course of a chosen term with sessions attended, absent, not yet taken and exempt, and the absence percentage against the limit (20 % by default, from the 80 % attendance rule; the FLM value where the syllabus states one).
2. The view SHALL colour each course by the attendance risk levels of info R4.2 (INF-2.1): safe, warning, last chance, failed.
3. The view SHALL let the user choose a past term.
4. The module SHALL read `/Report/Attendance` with the term and course parameters through the paced access layer and the budget, GET only, one request at a time, and SHALL cache the results.
5. The parser SHALL read sessions by the documented classes (`attendance-session-sheet`, `attendance-status--<state>`) and SHALL keep a raw fallback: an unknown status is kept with its text, and the summary line gives the counts when the table cannot be read.
6. The Courses and Record views SHALL show the same absence percentage on each course card when the course's attendance has been read.
7. The module SHALL export a term's attendance as CSV, and the printable list SHALL include attendance as an optional section.
