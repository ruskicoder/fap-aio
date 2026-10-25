# Requirements Document

## Introduction

This spec defines the panel's layout, navigation and settings for FAP-AIO v2.0.0: how every module's views are arranged and reached, and how the user configures the extension. It refines the core panel requirement (`.kiro/specs/v2-core-scheduler/requirements.md`, Requirement 1) and hosts the views defined in `v2-core-scheduler`, `v2-grades`, `v2-info` and `v2-appearance`.

Owner decisions (2026-10-11):
- A hybrid layout: a floating tabbed panel that snaps into a docked full-height side panel.
- Four primary tabs: Today, Schedule, Grades, Info. Theme and Settings sit behind the header gear.
- A command palette, an alerts inbox, keyboard shortcuts with customizable keybinds, and a page-aware default tab.
- First run opens docked, at comfortable density.

What the legacy panel did well is kept: main tabs with sub-tabs and counts, a persistent sync progress bar, and sync and export actions next to the data. The rest follows published guidance:
- tabs (NN/g "Tabs, Used Right"; Material 3 tabs for compact panes);
- keyboard tabs (WAI-ARIA APG Tabs pattern);
- the command palette pattern (cmdk, as used by Linear and Raycast).

Sources are cited in the design.

## Requirements

### Requirement 1: Layout modes

**User Story:** As a student, I want the panel either floating over FAP or docked beside it, so that it fits how I am working.

#### Acceptance Criteria

1. The panel SHALL have two layout modes: floating (a movable, resizable card) and docked (full viewport height against the right edge, resizable in width).
2. WHEN the user drags a floating panel so that its right edge comes within 24 px of the viewport's right edge THEN the panel SHALL show a dock preview and SHALL dock on release.
3. WHEN the user drags a docked panel's header away from the edge by more than 48 px THEN the panel SHALL undock to floating at the pointer position.
4. The header SHALL offer a dock or undock toggle as a button, so that both modes are reachable without dragging.
5. WHILE docked THEN the extension SHALL reserve the panel's width so that FAP content is not covered. Reserving SHALL adjust FAP's layout through the appearance pipeline, and SHALL NOT overlay FAP's content.
6. A floating panel SHALL minimize to a pill showing the alert count. A docked panel SHALL collapse to a 48 px rail showing the tab icons and the alert count.
7. Floating size limits SHALL be 320 to 720 px wide and 360 px to the viewport height. Docked width limits SHALL be 320 to 640 px. Default sizes SHALL be 400 by 600 px floating and 400 px docked.
8. Mode, position, size, collapsed state, active tab and active sub-view SHALL persist across reloads and FAP pages (core Requirement 1.4).
9. WHEN the viewport is narrower than 900 px THEN a docked panel SHALL turn into an overlay drawer that does not reserve width, and SHALL close when the user clicks outside it.

### Requirement 2: Information architecture

**User Story:** As a student, I want few, clearly named sections, so that I always know where to find something.

#### Acceptance Criteria

1. The panel SHALL have four primary tabs, in this order:
   - Today: what matters now, across modules.
   - Schedule: Week, Exams, Export.
   - Grades: Courses, GPA, What-if, Planner.
   - Info: Subjects, Lecturers, News, Status.
2. Each primary tab SHALL show its sub-views as a segmented control under the tab bar, with counts where meaningful (for example Exams 3, News 5 unread).
3. The header SHALL hold: the drag handle and title, the command palette button, the alerts inbox bell with an unread count, the dock toggle, a gear menu (Theme, Settings, Help, Shortcuts) and minimize.
4. Theme and Settings SHALL open as full views inside the panel with a back control, and SHALL NOT be primary tabs.
5. Tab labels SHALL be one word, in sentence case, each with an icon.

### Requirement 3: Today view

**User Story:** As a student, I want one view that tells me what needs my attention today, so that I can act quickly.

#### Acceptance Criteria

1. Today SHALL show, in this order:
   - the next class (time, room, lecturer, countdown);
   - today's remaining classes;
   - exams within 14 days;
   - attendance risks (warning or worse);
   - courses that are failed or below their goal;
   - P1 news alerts with deadlines;
   - Coursera duties before an FE.
2. Each item SHALL deep-link to its detail in the owning tab.
3. Sections without items SHALL be hidden. WHEN nothing needs attention THEN Today SHALL say so and show the next class.
4. Today SHALL show the time of the last sync and a single "Refresh" action that refreshes all of its sources within the core request budget.

### Requirement 4: Page-aware default tab

**User Story:** As a student, I want the panel to open on the section that matches the FAP page I am on, so that I do not have to switch.

#### Acceptance Criteria

1. WHEN the panel opens or a FAP page loads AND the page-aware setting is on THEN the panel SHALL select the tab mapped to the page:
   - `/WeeklyTimetable` maps to Schedule, Week; `/ExamSchedule` maps to Schedule, Exams;
   - `/Report/Grade` maps to Grades, Courses (on the open course); `/Report/Transcript` maps to Grades, GPA;
   - `/Report/Attendance` maps to Info, Status; `/News` maps to Info, News; `/Curriculum` and `/Subject` map to Info, Subjects;
   - any other page maps to Today.
2. The page-aware selection SHALL apply only on page load. A tab the user picks by hand SHALL stay until the next page load.
3. The setting SHALL be on by default and switchable in Settings.

### Requirement 5: Command palette

**User Story:** As a student who uses the keyboard, I want to search and run actions from one box, so that I reach anything in a few keystrokes.

#### Acceptance Criteria

1. WHEN the user presses the palette shortcut (default Ctrl+K, Cmd+K on macOS) on a FAP page, or clicks the header button, THEN the command palette SHALL open with focus in its input.
2. The palette SHALL search:
   - commands: sync week, sync term, sync exams, export classes, export exams, switch theme, toggle Classic layout, open any tab or sub-view, open settings;
   - subjects by code or name;
   - lecturers by shortcode;
   - news by title;
   - current courses.
3. Results SHALL be grouped (Actions, Navigate, Subjects, Lecturers, News, Courses), fuzzy matched, diacritic-insensitive, with recent items first and each command's shortcut shown.
4. Arrow keys SHALL move the selection, Enter SHALL run it, and Escape SHALL close. A secondary action (copy an email, open on FLM) SHALL run with Ctrl+Enter.
5. The palette SHALL follow the ARIA combobox pattern: focus stays in the input and the active option is exposed through `aria-activedescendant`.
6. Every module SHALL register its own commands with stable ids, so that recents survive label changes.

### Requirement 6: Alerts inbox

**User Story:** As a student, I want one place for all alerts, so that I can review what I missed.

#### Acceptance Criteria

1. The inbox SHALL collect alerts from all modules: attendance risk, P1 news, Coursera before FE, grade failures and goal changes, reminders, sync failures, and session or Cloudflare challenge notices.
2. Each alert SHALL show its kind, title, time, a deep link, and a read state. The bell SHALL show the unread count.
3. The user SHALL be able to mark one or all as read, and to filter by kind.
4. The inbox SHALL keep the last 200 alerts or 60 days, whichever is smaller.
5. Inbox entries SHALL exist whether or not browser notifications are enabled; browser notifications stay opt-in per kind.

### Requirement 7: Keyboard shortcuts and keybinds

**User Story:** As a power user, I want shortcuts I can change, so that the extension fits my habits and does not clash with other tools.

#### Acceptance Criteria

1. The extension SHALL provide these actions with default keybinds:
   - toggle panel: Alt+Shift+F, through `chrome.commands` so that it works in any FAP tab;
   - command palette: Ctrl+K, or Cmd+K on macOS;
   - tabs Today, Schedule, Grades, Info: Alt+1 to Alt+4, or Ctrl+1 to Ctrl+4 on macOS;
   - next and previous sub-view: Alt+] and Alt+[;
   - refresh current view: Alt+R;
   - dock toggle: Alt+D;
   - alerts inbox: Alt+N;
   - shortcuts sheet: `?` when focus is not in a text field.
2. Settings SHALL list every action with its current keybind, and SHALL let the user record a new keybind, clear it or reset it.
3. WHEN a recorded keybind is already used by another FAP-AIO action, or is reserved by the browser (Ctrl+T, Ctrl+W, Ctrl+N, Ctrl+Tab and similar), THEN Settings SHALL refuse it and name the conflict.
4. The toggle-panel keybind SHALL be changed on Chrome's own shortcuts page, which Settings SHALL link to, because `chrome.commands` bindings are managed by the browser.
5. Page-level shortcuts SHALL NOT fire while focus is in an input, a textarea, a select or a contenteditable element, on FAP or in the panel. The only exceptions are the palette and toggle keys.
6. A shortcuts sheet SHALL show all current keybinds.

### Requirement 8: Settings view

**User Story:** As a student, I want settings grouped clearly, so that I find and change options fast.

#### Acceptance Criteria

1. Settings SHALL be grouped as:
   - General: page-aware tab, density, default goal tier, layout defaults.
   - Schedule: reminders, export reminders.
   - Grades: non-GPA list, GPA goal, MOOC assumptions.
   - Info and alerts: background refresh, notifications per kind, news watch keywords.
   - Session: keep-alive.
   - Appearance: a link to Theme, Classic layout, compact, wide, sticky.
   - Shortcuts: keybinds.
   - Data and privacy: what is stored, export all data, clear data, legacy cleanup.
   - About: version, rubric and rules dates, links.
2. Settings SHALL have a search field that filters settings by label and description.
3. Every setting SHALL show a one-line description and its default, and SHALL apply immediately (core Requirement 13.2).
4. The user SHALL be able to export all settings to a JSON file and import them back, with validation and a preview of what changes.
5. "Reset section" and "Reset all" SHALL restore defaults after a confirmation.

### Requirement 9: First run and help

**User Story:** As a new user, I want a short introduction, so that I know what the extension does without reading a manual.

#### Acceptance Criteria

1. WHEN the extension runs for the first time on an authenticated FAP page THEN the panel SHALL open docked at comfortable density and show a three-step welcome:
   - what each tab does;
   - syncing this week, as a button that does it;
   - optional features (reminders, keep-alive, themes, Classic layout), all off.
2. The welcome SHALL be skippable at every step and SHALL NOT reopen once finished or skipped. Help in the gear menu SHALL reopen it.
3. Every empty state SHALL name the space and offer the single action that fills it.

### Requirement 10: Visual and interaction quality

**User Story:** As a student, I want the panel to feel calm, fast and readable, so that it helps instead of distracting.

#### Acceptance Criteria

1. The panel SHALL offer comfortable and compact density. Comfortable SHALL use at least 14 px body text and 32 px control height; compact SHALL use at least 13 px text and 28 px controls.
2. Text and interactive elements SHALL meet WCAG 2.2 AA contrast in every built-in theme and in both FAP modes.
3. Interactive targets SHALL be at least 24 by 24 px (WCAG 2.2 target size minimum).
4. Every interactive element SHALL show a visible focus ring.
5. Motion SHALL be limited to transitions of 200 ms or less, and SHALL be removed when `prefers-reduced-motion` is set.
6. A tab switch SHALL render the new view within 100 ms from cached data. Data loading SHALL show skeletons, not spinners, and SHALL keep the previous content visible until new data arrives.
7. Lists longer than 100 items (news, subjects) SHALL be virtualized.
8. Copy SHALL follow sentence case, verb-first buttons, and error messages that say what happened and what to do.
