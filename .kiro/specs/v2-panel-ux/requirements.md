# Requirements Document

## Introduction

This spec defines the panel's layout, navigation and settings for FAP-AIO v2.0.0: how every module's views are arranged and reached, and how the user configures the extension. It refines the core panel requirement (`.kiro/specs/v2-core-scheduler/requirements.md`, Requirement 1) and hosts the views defined in `v2-core-scheduler`, `v2-grades`, `v2-info` and `v2-appearance`.

Owner decisions (2026-10-11):
- A hybrid layout: a floating tabbed panel that snaps into a docked full-height side panel.
- Four primary tabs: Today, Schedule, Grades, Info. Theme and Settings sit behind the header gear.
- A command palette, an alerts inbox, keyboard shortcuts with customizable keybinds, and a page-aware default tab.
- First run opens docked, at comfortable density.

Owner decisions (2026-10-26, shell audit, gate G-UI-SHELL; agreed visual in [`ui/shell.html`](ui/shell.html), rounds in [`ui/shell-audit.md`](ui/shell-audit.md)) replace parts of the above: no command palette and no search; the header holds Sync, Dock, Settings and Minimize; minimize leaves a draggable edge tab; tabs appear only for shipped views. Requirements 1, 2, 5 and 7 were revised; the earlier text is in [`.deprecated/2026-10-26-shell-audit/`](.deprecated/2026-10-26-shell-audit/requirements.md).

What the legacy panel did well is kept: main tabs with sub-tabs and counts, a persistent sync progress bar, and sync and export actions next to the data. The rest follows published guidance:
- tabs (NN/g "Tabs, Used Right"; Material 3 tabs for compact panes);
- keyboard tabs (WAI-ARIA APG Tabs pattern);
- the command palette pattern (cmdk, as used by Linear and Raycast).

Sources are cited in the design.

## Requirements

### Requirement 1: Layout modes

**User Story:** As a student, I want the panel either floating over FAP or docked beside it, so that it fits how I am working.

#### Acceptance Criteria

1. The panel SHALL have two layout modes: floating (a movable, resizable card) and docked (full viewport height against the right edge, resizable in width). The header's Dock button SHALL switch between them.
2. The whole header SHALL drag a floating panel, except its buttons. WHILE the user drags or resizes a floating panel THEN the panel SHALL stay fully inside the viewport, and SHALL snap to a viewport edge that comes within 10 px of it.
3. WHEN the user drags a docked panel's header more than 48 px to the left THEN the panel SHALL undock to floating at the pointer position.
4. A floating panel SHALL resize from all four edges and all four corners. A docked panel SHALL resize from its left edge. Every resize edge SHALL show a resize cursor.
5. WHILE docked THEN by default the FAP page SHALL narrow by the panel's width, so that no FAP content is covered. A setting SHALL let the user choose to cover the page instead.
6. WHEN the user minimizes the panel, in either mode, THEN a vertical tab labelled FAP-AIO SHALL remain on the right viewport edge. The user SHALL be able to drag the tab up and down the edge, and its position SHALL persist. A click on the tab SHALL reopen the panel: a floating panel at the bottom-right corner with its last size, a docked panel docked.
7. Floating size limits SHALL be 320 to 720 px wide and 400 px to the viewport height. Docked width limits SHALL be 320 to 640 px. Default sizes SHALL be 400 by 600 px floating and 400 px docked.
8. Mode, position, size, minimized state, the edge tab position and the active view SHALL persist across reloads and FAP pages (core Requirement 1.4).
9. WHEN the viewport is narrower than 900 px THEN a docked panel SHALL turn into an overlay drawer that does not narrow the page, and SHALL close when the user clicks outside it.

### Requirement 2: Information architecture

**User Story:** As a student, I want few, clearly named sections, so that I always know where to find something.

#### Acceptance Criteria

1. The panel SHALL group its views into four sections, in this order: Today, Schedule, Grades, Info. The section tabs SHALL show at the top, each with an icon, and the open section's views SHALL show below them in the sub-view bar of the agreed shell (Schedule: Classes, Exams, Export). A section SHALL appear only when one of its views ships; a row with a single item SHALL NOT be shown. No tab row SHALL scroll sideways or clip a label (F-18, 2026-11-17; in M1 only Schedule shipped, so the panel showed Classes, Exams and Export).
2. The panel SHALL NOT show any tab, button or menu item for a feature that is not shipped.
3. The header SHALL be one draggable bar holding, on the left, the title `FAP-AIO` with the extension version (from the manifest) as subtext, and on the right the buttons Sync, Dock, Settings and Minimize. Sync SHALL sync this week's classes and the exams in one action; the whole-term sync stays an action in Classes.
4. Settings SHALL open as a full view inside the panel with a back control, and SHALL NOT be a tab.
5. Tab labels SHALL be one word, in sentence case.
6. A status strip SHALL always show at the bottom of the panel: the last sync of the open view's data, the progress of a running sync, the request budget wait, and the Cloudflare challenge banner (platform R3.9).

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

Removed 2026-10-26 by the owner (decision D-3): no command palette, no search and no palette shortcut. Ctrl+K is Chrome's own search shortcut. The earlier criteria are in [`.deprecated/2026-10-26-shell-audit/requirements.md`](.deprecated/2026-10-26-shell-audit/requirements.md).

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
   - sections in order (Open Today, Open Schedule, Open Grades, Open Info; F-18): no default, recorded by the user (Alt+1 to Alt+9 are Chrome's tab keys on Linux, Ctrl+1 to Ctrl+9 switch macOS desktops; D-10, 2026-11-17);
   - next and previous sub-view within the open section: Alt+] and Alt+[;
   - refresh current view: Alt+R;
   - dock toggle: no default, recorded by the user (Alt+D is Chrome's address bar on Windows; D-10);
   - alerts inbox: Alt+N;
   - shortcuts sheet: `?` when focus is not in a text field.
2. Settings SHALL list every action with its current keybind, and SHALL let the user record a new keybind, clear it or reset it.
3. WHEN a recorded keybind is already used by another FAP-AIO action, or is reserved by the browser (Ctrl+T, Ctrl+W, Ctrl+N, Ctrl+Tab and similar), THEN Settings SHALL refuse it and name the conflict. No default keybind SHALL collide with a Chrome or operating system shortcut (D-10, following D-3).
4. The toggle-panel keybind SHALL be changed on Chrome's own shortcuts page, which Settings SHALL link to, because `chrome.commands` bindings are managed by the browser.
5. Page-level shortcuts SHALL NOT fire while focus is in an input, a textarea, a select or a contenteditable element, on FAP or in the panel. The only exception is the toggle key.
6. A shortcuts sheet SHALL show all current keybinds.

### Requirement 8: Settings view

**User Story:** As a student, I want settings grouped clearly, so that I find and change options fast.

#### Acceptance Criteria

1. Settings SHALL be grouped as:
   - General: page-aware tab, density, default goal tier, layout defaults.
   - Schedule: reminders. (Export reminders moved into the Export tab form on 2026-10-31, core R9.8; previous text in `.deprecated/2026-10-31-export-audit/`.)
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
