# Requirements Document

## Introduction

This spec covers the first slice of FAP-AIO v2.0.0: the shared core that every later module builds on, and the scheduler (weekly timetable and exam schedule) on top of it. It targets the rewritten FAP portal (v2.0.0.0) described in `docs/20-architecture/fap-v2/` and follows decision `docs/60-decisions/0001-v2-extension-foundations.md`.

The core consists of the persistent in-page panel, a read-only FAP access layer, a registry of data sources that later modules extend, local storage, and settings. The scheduler syncs the student's sessions and exams, shows them in the panel, exports them to calendar files and optionally raises reminders. Its rules take the useful parts of the legacy FAP-AIO scheduler and the third-party FPTU Schedule 4.0.0, recorded in `docs/70-work/investigations/2026-10-04-scheduler-comparison-and-v2-scope.md`.

Out of scope for this spec: GPA calculator, the other info-getter modules (subjects, lecturers, status, news), self-service, layout enhancer, custom themes, MoveOut, attendance risk analytics, a "today" agenda, and any POST to FAP. Survey autofill is excluded permanently.

## Requirements

### Requirement 1: Persistent panel

**User Story:** As a student, I want one panel on every FAP page that I can move and minimize and that stays as I left it, so that I can use FAP-AIO without leaving the page I am on.

#### Acceptance Criteria

1. WHEN any authenticated FAP v2 page finishes loading THEN the extension SHALL render the panel on that page.
2. WHEN the user drags the panel header THEN the panel SHALL move with the pointer and SHALL stay fully inside the viewport.
3. WHEN the user minimizes the panel THEN the panel SHALL collapse to a compact handle that restores it on click.
4. WHEN the page reloads or the user navigates to another FAP page THEN the panel SHALL reappear with the same position, size, minimized state and open view it had before.
5. WHEN the viewport is resized so the saved position falls outside it THEN the panel SHALL move to the nearest position inside the viewport.
6. WHILE the panel is open THEN FAP's own page content SHALL remain usable, and the panel's styles SHALL NOT change the appearance of FAP elements.
7. IF FAP shows its login page or a 404 page THEN the extension SHALL NOT render the panel.
8. WHEN the panel is operated with the keyboard THEN every control SHALL be reachable with Tab, operable with Enter or Space, and labelled for screen readers.

### Requirement 2: English UI and locale-independent reading

**User Story:** As a student, I want the extension in English and working whichever language FAP is set to, so that a FAP language change never breaks it.

#### Acceptance Criteria

1. The extension SHALL present all of its own text in English.
2. WHEN the extension reads a FAP page THEN it SHALL locate data by structure (class names, ids, `data-*` attributes, icon classes, column positions) and SHALL NOT locate data by visible label text.
3. WHERE a value can only be read as text (for example an attendance status) THEN the extension SHALL map it through a defined constant table that covers both the `vi` and the `en` culture.
4. IF a text value is not found in the constant table THEN the extension SHALL keep the raw text, mark the value as unknown, and continue.
5. WHEN FAP's culture is switched between `vi` and `en` THEN a sync of the same week SHALL produce the same records.

### Requirement 3: Read-only FAP access layer

**User Story:** As a developer, I want one layer that all modules use to read FAP, so that session, gating and error rules are handled once.

#### Acceptance Criteria

1. WHEN a module requests a FAP resource THEN the access layer SHALL send a same-origin GET with the user's session cookie.
2. WHERE a source is declared as a partial THEN the access layer SHALL send `X-Requested-With: XMLHttpRequest`.
3. The access layer SHALL NOT send any method other than GET in this spec.
4. IF a response carries `X-Feedback-Required: 1` THEN the access layer SHALL stop the current operation and tell the user that FAP requires a survey first, with a link to `/Feedback?required=1`.
5. IF a response redirects to a login page THEN the access layer SHALL stop the current operation and report that the session expired.
6. IF a response is 404 THEN the access layer SHALL report the resource as unavailable to this account and SHALL NOT retry it.
7. IF a request fails for a network reason THEN the access layer SHALL report the failure and SHALL retry at most once.
8. WHILE a multi-request operation runs THEN the access layer SHALL send requests one at a time with a pause between them.

### Requirement 4: Data source registry

**User Story:** As a developer, I want each kind of FAP data declared once as a source, so that new modules can be added without changing the core.

#### Acceptance Criteria

1. The core SHALL let a module register a source with an identifier, the FAP route, whether the response is a page or a partial, a parser, and a cache lifetime.
2. WHEN a source is read THEN the core SHALL fetch through the access layer, run the registered parser, and return typed records or a typed error.
3. IF a parser cannot find its required structure THEN it SHALL return a typed "layout changed" error naming the source, and the panel SHALL show it to the user.
4. WHEN this spec is complete THEN the weekly timetable and the exam schedule SHALL be registered sources.

### Requirement 5: Local storage

**User Story:** As a student, I want my synced data kept by the extension, so that it is available after reloads without polluting FAP.

#### Acceptance Criteria

1. The extension SHALL store its data and settings in `chrome.storage.local` only.
2. The extension SHALL NOT write to the FAP origin's `localStorage` or `sessionStorage`.
3. Every stored record set SHALL carry a schema version.
4. WHEN the stored schema version is older than the current one THEN the extension SHALL migrate the data or discard it and ask for a new sync.
5. WHEN the user chooses "clear data" in settings THEN the extension SHALL remove all of its stored records after a confirmation.

### Requirement 6: Weekly timetable sync

**User Story:** As a student, I want to sync my classes for a week or a range of weeks, so that I have my whole schedule without visiting each week.

#### Acceptance Criteria

1. WHEN the user starts a sync for the current week THEN the extension SHALL read that week's timetable partial and store its sessions.
2. WHEN the user starts a sync for a range THEN the extension SHALL read every ISO week from the start date to the end date, one week at a time, and SHALL show progress as weeks done out of weeks total.
3. The extension SHALL offer term presets that fill the range: Spring January to April, Summer May to August, Fall September to December.
4. WHEN a week's response does not contain the dates of the requested week THEN the extension SHALL reject it and record that week as failed.
5. WHEN a week's response is FAP's empty state THEN the extension SHALL record the week as having no sessions, not as failed.
6. WHEN a range sync is interrupted by a reload or navigation THEN the extension SHALL resume from the next unfinished week.
7. WHEN a range sync finishes THEN the extension SHALL report weeks synced, weeks failed and sessions added or updated.
8. Each stored session SHALL hold: date, slot number, start and end time as shown in the cell, subject code, group, room, lecturer login, online flag, schedule type when present, and attendance status (present, absent, not yet, exempt, or unknown).
9. WHEN a synced session has the same subject code, date and start time as a stored one THEN the extension SHALL update the stored session's mutable fields (room, lecturer, online flag, attendance status) instead of adding a duplicate.
10. IF a cell has no readable time THEN the extension SHALL skip the session and count it as unreadable in the report, and SHALL NOT invent a time.

### Requirement 7: Exam schedule sync

**User Story:** As a student, I want my exams synced and kept after they pass, so that I can see and export them even though FAP lists only upcoming exams.

#### Acceptance Criteria

1. WHEN the user starts an exam sync THEN the extension SHALL read `/ExamSchedule` and store each exam with date, start and end time, room, subject code and name, exam type, grade publication date and notes.
2. WHEN an exam is no longer listed by FAP THEN the extension SHALL keep the stored exam and mark it as past once its date has passed.
3. WHEN a synced exam matches a stored one by subject code, exam type and date THEN the extension SHALL update it instead of adding a duplicate.
4. The extension SHALL classify the exam type as FE, PE, 2NDFE, 2NDPE or other from FAP's exam type value.
5. IF an exam's room is empty or a placeholder THEN the extension SHALL mark the room as not assigned.

### Requirement 8: Schedule views in the panel

**User Story:** As a student, I want to browse my synced classes and exams in the panel, so that I can check what is coming without opening FAP's pages.

Revised 2026-10-31 from the agreed Classes and Exams visual (gate G-UI-SCHEDULE, round S2 in `ui/schedule-audit.md`, saved as `ui/schedule.html`); the previous text is in `.deprecated/2026-10-31-schedule-audit/requirements.md`.

#### Acceptance Criteria

1. The Classes tab SHALL show "Sync this week" and "Sync <term>" (the current term by name) at the top, then the sub-views "This week (n)" and "All (n)" with their class counts.
2. The Classes tab SHALL list sessions under day headers (the date once per day, today marked) in date and time order. Each class is a card: the full title `CODE · name` (the code alone when no name is known), a slot tag and an attendance tag, and label-value lines for room (or Online), time, lecturer and group, and FAP's schedule type when present.
3. The Exams tab SHALL show "Sync exams" at the top, then the sub-views "Upcoming (n)" and "Past (n)" with their counts, and a row of type chips (FE, PE, 2NDFE, 2NDPE, Other), all on by default, that filter both lists. Upcoming exams are listed soonest first, past exams latest first.
4. Each exam is a card: the full title `CODE · name`, a type tag, a countdown tag (Today, Tomorrow, In n days, or Done for past exams), and label-value lines for format, room ("not assigned yet" when FAP has none), date, time and results date when present.
5. Tags SHALL use soft tints (pale fill, dark text): attendance present green, absent red, not yet amber, other neutral; exam type FE green, PE blue, 2NDFE amber, 2NDPE purple, other neutral; countdown red within three days, green later, neutral when past.
6. No text in a card SHALL be truncated; long titles and values wrap.
7. WHILE no data is stored THEN the tab SHALL show an empty state with the action to sync.
8. The panel SHALL show when each data set was last synced (in the status strip, panel-ux R2.6).

### Requirement 9: Calendar export

**User Story:** As a student, I want to export my classes and exams to a calendar file, so that they appear in Google Calendar, Outlook or Apple Calendar.

Revised 2026-10-31 from the agreed Export visual (gate G-UI-SCHEDULE, round S1 in `ui/schedule-audit.md`), and again the same day after the M1 UAT (round S3, fix F-7); earlier texts are in `.deprecated/2026-10-31-export-audit/` and `.deprecated/2026-10-31-export-s3/`.

#### Acceptance Criteria

1. The Export tab SHALL be one scrolling form with the download button pinned at the bottom, holding the option groups 2 to 13 below in this order.
2. WHEN the user exports THEN the extension SHALL write the classes, the exams or both, as the user picks, either into separate files, one each for offline classes, online classes and exams (the default, so each can be imported into its own calendar), or into one file.
3. The user SHALL pick the date range from this week, the next two weeks, this month, the current term (shown with its name and dates), or custom start and end dates; the range applies to classes and exams.
4. The user SHALL filter classes by mode (all, offline only, online only) and by subject, one toggle per subject code found in the synced classes.
5. The user SHALL filter exams by type (FE, PE, 2NDFE, 2NDPE, other), and SHALL choose whether exams without an assigned room and exams already past are included; both are excluded by default.
6. The user SHALL pick each kind's event title from presets or build a custom one from ordered pieces and a separator: for classes room, code, subject name, group, slot, lecturer and start time (default `Room - Code`, for example `BE-301 - PRF192`; an online class shows Online for the room); for exams room, exam type, code, subject name, exam format and start time (default `Room - Exam type - Code`). An empty piece is left out; WHEN every piece is empty THEN the title is the code. A subject name comes from the synced exam list.
7. The user SHALL pick which details the events carry and their order: room (the event location), lecturer, slot, group, attendance, exam format and results date; the description lines follow the chosen order. Room, lecturer, slot, exam format and results date are on by default. Each kind carries an editable event category (`CATEGORIES`, default Class, Online class, Exam; empty for none).
8. Each kind SHALL carry a list of reminder tiers the user edits: add a time from a list (5 minutes to 1 week) or typed in minutes, hours or days, and remove any. Defaults: classes 15 minutes, 2 hours and 1 day before; exams 30 minutes, 2 hours and 1 day before. An empty list means no alarms.
9. The form SHALL preview the first event of the selection as it will appear (title, date, time, location, details) and the counts of classes and exams; the download button SHALL show the number of events and SHALL be disabled when there are none.
10. WHERE the user ticks "Remember my choices" THEN the options SHALL be stored and restored on the next visit; unticking it SHALL delete the stored options.
11. Every event SHALL use the time zone `Asia/Ho_Chi_Minh` for its start and end.
12. Every event SHALL have a UID derived from its identity (subject code, date, start time, and exam type for exams), so that importing a newer export updates events instead of duplicating them; the title format and details do not change the UID.
13. The file SHALL escape text values and fold lines longer than 75 octets as RFC 5545 requires.

### Requirement 10: Reminders

**User Story:** As a student, I want optional browser reminders before classes and exams, so that I do not miss them.

#### Acceptance Criteria

1. Reminders SHALL be off by default and enabled in settings.
2. WHILE reminders are enabled THEN the extension SHALL schedule a browser notification before each stored class (15 or 30 minutes, user choice) and each stored exam (one day and one hour) that starts within the next 30 days.
3. WHEN a sync finishes or a reminder setting changes THEN the extension SHALL rebuild the scheduled reminders.
4. WHEN the user clicks a reminder THEN the extension SHALL focus an open FAP tab on the timetable or exam page, or open one.

### Requirement 11: Session keep-alive

**User Story:** As a student, I want to optionally keep my FAP session alive while a FAP tab is open, so that I am not logged out mid-task.

#### Acceptance Criteria

1. Keep-alive SHALL be off by default and enabled in settings.
2. WHILE keep-alive is enabled AND at least one FAP tab is open THEN the extension SHALL send one lightweight GET to FAP at the interval shown in settings.
3. IF a keep-alive request finds the session expired THEN the extension SHALL stop keep-alive and tell the user.
4. WHEN keep-alive is turned off THEN no further keep-alive request SHALL be sent.

### Requirement 12: Legacy page storage cleanup

**User Story:** As a user upgrading from a legacy FAP-AIO build, I want the old data it left in FAP's storage handled, so that FAP's origin is clean and I do not lose anything silently.

#### Acceptance Criteria

1. WHEN the extension runs on a FAP page AND legacy keys exist in the FAP origin's `localStorage` (`weeklySchedule`, `examSchedule`, `examFilter`, `semesterSyncState`, `pendingSemesterSync`, `selectedSemester`, `expireAt`, keys starting with `fap-aio:`, and MoveOut subject keys of the form `CODE - Name`) THEN the panel SHALL offer to export them to a JSON file and remove them.
2. WHEN the user accepts THEN the extension SHALL download the export first and remove only the listed keys after the download has started.
3. The extension SHALL NOT remove any key outside the legacy list.
4. WHEN the user declines THEN the extension SHALL not ask again until the user requests it from settings.

### Requirement 13: Settings

**User Story:** As a student, I want one settings view, so that I control optional behaviour in one place.

#### Acceptance Criteria

1. The panel SHALL provide settings for: reminders (on or off, class offset), export reminders, keep-alive (on or off, interval), legacy storage cleanup, and clear data.
2. WHEN a setting changes THEN it SHALL take effect without a page reload and SHALL persist across reloads.
