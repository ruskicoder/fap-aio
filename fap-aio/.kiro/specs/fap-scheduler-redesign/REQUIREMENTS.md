
---

## Scheduler UI Redesign Requirements

### Requirement 15: Bottom Taskbar UI Component

**User Story:** As a user, I want a consistent bottom taskbar that stays visible when navigating weeks, so that I have persistent access to scheduler controls without UI reloading.

#### Acceptance Criteria

1. WHEN the scheduler initializes THEN it SHALL replace the floating panel with a bottom-fixed taskbar
2. WHEN the taskbar is rendered THEN it SHALL have a maximum width of 98vw and be centered horizontally using `transform: translateX(-50%)`
3. WHEN the taskbar is rendered THEN it SHALL have a default height of 80px, expanding to 100px when the progress bar is active
4. WHEN the taskbar is positioned THEN it SHALL use `position: fixed; bottom: 0;` with z-index 999998
5. WHEN the taskbar layout is created THEN it SHALL use CSS Grid with three columns: 20% (left), 60% (center), 20% (right)
6. WHEN styling the taskbar THEN it SHALL follow the dark theme with #000000 background and #F36B16 accent color
7. WHEN the taskbar is displayed THEN it SHALL include elevation shadow: `box-shadow: 0 -4px 12px rgba(0,0,0,0.3);`
8. WHEN the user navigates between weeks THEN the taskbar SHALL persist without reloading or resetting state

---

### Requirement 16: Progress Bar Component

**User Story:** As a user, I want to see a progress bar when syncing an entire semester, so that I know how much of the sync operation has completed.

#### Acceptance Criteria

1. WHEN semester sync starts THEN the taskbar SHALL expand from 80px to 100px height to accommodate the progress bar
2. WHEN the progress bar is visible THEN it SHALL be positioned at the top of the taskbar with 20px height
3. WHEN displaying progress THEN the progress bar SHALL show an animated gradient fill from #F36B16 to #4CAF50
4. WHEN displaying progress text THEN it SHALL show: `[percentage]% - Syncing [semester] ([current]/[total] weeks)`
5. WHEN sync is in progress THEN the progress bar SHALL update on each week completion
6. WHEN the page reloads during sync THEN the progress bar SHALL restore from `localStorage['semesterSyncState']` and continue
7. WHEN sync completes or errors THEN the progress bar SHALL hide and taskbar SHALL return to 80px height
8. WHEN the progress bar is active THEN other taskbar controls SHALL remain functional

---

### Requirement 17: Page Navigation Section (Left 20%)

**User Story:** As a user, I want quick navigation buttons to switch between Weekly and Exam schedule pages, so that I can easily move between different scheduler views.

#### Acceptance Criteria

1. WHEN the left section renders THEN it SHALL display two buttons: "📚 Weekly" and "📝 Exam" stacked vertically
2. WHEN a navigation button is clicked THEN it SHALL use a simple `<a href>` tag to navigate to the respective page
3. WHEN detecting the current page THEN the active button SHALL be highlighted with #F36B16 background and bold font
4. WHEN on the Weekly page THEN the Weekly button SHALL have #F36B16 background and the Exam button SHALL have #1A1A1A background
5. WHEN on the Exam page THEN the Exam button SHALL have #F36B16 background and the Weekly button SHALL have #1A1A1A background
6. WHEN hovering over an inactive button THEN it SHALL show a glow effect: `box-shadow: 0 0 10px rgba(243,107,22,0.4);`
7. WHEN navigation occurs THEN state SHALL persist via localStorage (selections, drawer state, etc.)

---

### Requirement 18: Center Tile - Semester Selector (15%)

**User Story:** As a user, I want to select a semester for export purposes, so that I can generate ICS files for specific semesters.

#### Acceptance Criteria

1. WHEN the center-left section renders THEN it SHALL display a semester dropdown `<select id="kiro-semester-select">`
2. WHEN the dropdown is populated THEN it SHALL include options dynamically generated from `constants.ts` semester config
3. WHEN the dropdown is changed THEN the selected semester SHALL be saved to `localStorage['selectedSemester']`
4. WHEN the page loads THEN the dropdown SHALL restore the previously selected semester from localStorage
5. WHEN the semester is selected THEN it SHALL ONLY affect the export filename and semester filter
6. WHEN the semester is selected THEN it SHALL NOT automatically trigger a semester sync operation
7. WHEN styling the dropdown THEN it SHALL use dark background (#1A1A1A) with #F36B16 border on focus
8. WHEN the dropdown is rendered THEN it SHALL have 14px font size and 8px padding

---

### Requirement 19: Center Tile - Slot Counters (50%)

**User Story:** As a user, I want to see real-time counters for offline, online, total, and selected slots, so that I can track my selections and understand my schedule composition.

#### Acceptance Criteria

1. WHEN the center-middle section renders THEN it SHALL display four counters in two rows
2. WHEN displaying counters THEN row 1 SHALL show "Offline: [X] | Online: [Y]" and row 2 SHALL show "Total: [Z] | Selected: [W]"
3. WHEN a checkbox is toggled THEN all four counters SHALL update immediately to reflect the new state
4. WHEN calculating counters THEN Offline and Online SHALL count slots in the current view based on `isOnline` property
5. WHEN calculating Total THEN it SHALL be the sum of Offline + Online from current view
6. WHEN calculating Selected THEN it SHALL count slot IDs present in `localStorage['kiro-selected-slots']`
7. WHEN styling counter text THEN labels SHALL use #E0E0E0 color and numbers SHALL use #F36B16 color
8. WHEN rendering counters THEN the font size SHALL be 11px

---

### Requirement 20: Center Tile - Select All / Deselect All Button

**User Story:** As a user, I want a single button to select or deselect all slots in the current view, so that I can quickly manage large selections.

#### Acceptance Criteria

1. WHEN the button is rendered THEN it SHALL display below the slot counters
2. WHEN no slots are selected (Selected = 0) THEN the button text SHALL be "Select All"
3. WHEN any slots are selected (Selected > 0) THEN the button text SHALL be "Deselect All"
4. WHEN the "Select All" button is clicked THEN ALL slot IDs from the current view SHALL be added to `localStorage['kiro-selected-slots']`
5. WHEN the "Deselect All" button is clicked THEN `localStorage['kiro-selected-slots']` SHALL be cleared (empty array)
6. WHEN the button is clicked THEN ALL checkboxes in both the grid AND drawer SHALL update to reflect the new state
7. WHEN the button is clicked THEN the slot counters SHALL update immediately
8. WHEN styling the button THEN it SHALL have a small size, #F36B16 border, and transparent background

---

### Requirement 21: Center Tile - Sync Buttons (25%)

**User Story:** As a user, I want buttons to sync the current week or the entire semester, so that I can fetch schedule data efficiently.

#### Acceptance Criteria

1. WHEN the center-right section renders THEN it SHALL display two buttons stacked vertically: "🔄 This Week" and "📆 This Semester"
2. WHEN "This Week" is clicked THEN it SHALL call `extractWeeklySchedule()` to sync only the current week's data
3. WHEN "This Week" completes THEN it SHALL save the schedule to `localStorage['weeklySchedule']` and show a success toast
4. WHEN "This Semester" is clicked THEN it SHALL call `startSemesterSync()` to sync all weeks in the semester
5. WHEN semester sync starts THEN the progress bar SHALL appear and taskbar SHALL expand to 100px
6. WHEN semester sync is active THEN both sync buttons SHALL be disabled to prevent concurrent syncs
7. WHEN semester sync completes or errors THEN the buttons SHALL re-enable and progress bar SHALL hide
8. WHEN either button is clicked THEN the slot counters SHALL update after data is loaded

---

### Requirement 22: Export Section with Dropdown (Right 20%)

**User Story:** As a user, I want to export selected or all slots as ICS files with filtering options, so that I can import my schedule into calendar applications.

#### Acceptance Criteria

1. WHEN the right section renders THEN it SHALL display a large button: "📅 Export ▼"
2. WHEN the main button is clicked THEN it SHALL trigger export based on current selection and filter
3. WHEN the dropdown arrow (▼) is clicked THEN a menu SHALL appear with three options: "🏫 Offline", "💻 Online", "📦 All"
4. WHEN "Offline" is selected from dropdown THEN the export SHALL filter to include only slots where `isOnline = false`
5. WHEN "Online" is selected from dropdown THEN the export SHALL filter to include only slots where `isOnline = true`
6. WHEN "All" is selected from dropdown THEN the export SHALL include all slots (no online/offline filter)
7. WHEN exporting with NO custom selections THEN "All" SHALL export all slots in the current view
8. WHEN exporting with custom selections (Selected > 0) THEN "All" SHALL export only the selected slots
9. WHEN exporting with custom selections and Offline filter THEN it SHALL export only selected offline slots
10. WHEN generating the filename THEN it SHALL follow format: `[Custom-][Offline/Online/All]-[Semester].ics` where Custom prefix is added only when there are selections
11. WHEN exporting THEN it SHALL use the existing `generateICS()` function from `utils.ts`
12. WHEN the dropdown is styled THEN it SHALL use dark background (#1A1A1A), #F36B16 border, and hover effect

---

### Requirement 23: Enhanced Calendar Grid

**User Story:** As a user, I want a beautiful, responsive calendar grid that replaces the native FAP table, so that I can view my schedule in a more readable and interactive format.

#### Acceptance Criteria

1. WHEN the scheduler initializes THEN it SHALL find the native FAP table `#ctl00_mainContent_RadScheduler1_SchedulerContentDiv` and set `display: none`
2. WHEN hiding the native table THEN the scheduler SHALL NOT remove it from the DOM (preserve form data for week navigation)
3. WHEN rendering the custom grid THEN it SHALL use CSS Grid layout with `grid-template-columns: auto repeat(7, 1fr);`
4. WHEN rendering grid rows THEN it SHALL use `grid-template-rows: auto auto repeat(8, minmax(20vh, 40vh));` for responsive cell heights
5. WHEN rendering the grid structure THEN row 1 SHALL contain year dropdown and day headers (Mon-Sun with dates)
6. WHEN rendering the grid structure THEN rows 2-9 SHALL contain slot labels (Slot 1-8) and 7 columns of slot cells
7. WHEN rendering on desktop (>600px) THEN the grid SHALL display the full 7-day × 8-slot layout
8. WHEN rendering on mobile (<600px) THEN the grid SHALL switch to single-column flexbox with full-width cards in chronological order
9. WHEN calculating cell heights THEN min-height SHALL be 20vh and max-height SHALL be 40vh with automatic expansion for overflow content
10. WHEN rendering cells THEN equal column widths SHALL be enforced using `1fr` units
11. WHEN rendering cells THEN a 2px gap SHALL separate all cells

---

### Requirement 24: Slot Cell Component Design

**User Story:** As a user, I want each slot cell to display all relevant information clearly with visual indicators, so that I can quickly understand my schedule at a glance.

#### Acceptance Criteria

1. WHEN a slot cell is rendered THEN it SHALL include a checkbox in the top-left corner (16px × 16px)
2. WHEN a slot cell is rendered THEN it SHALL include an attendance status badge in the top-right corner
3. WHEN the attendance status is "Attended" THEN the badge SHALL be green (#4CAF50) with text "✓ Attended"
4. WHEN the attendance status is "Absent" THEN the badge SHALL be red (#F44336) with text "✗ Absent"
5. WHEN the attendance status is "Not yet" THEN the badge SHALL be gray (#999) with text "○ Not yet"
6. WHEN displaying the subject code THEN it SHALL be bold, 14px font, black text color
7. WHEN displaying room information THEN it SHALL show "at [room]" below the subject code
8. WHEN displaying time information THEN it SHALL show "(start-end)" in the format "(9:30-11:45)"
9. WHEN displaying links THEN it SHALL show "📎 View Materials | 📹 Meet URL" if available
10. WHEN applying cell background THEN it SHALL use the subject's semi-transparent color at 70% opacity from `getSubjectColor(subjectCode)`
11. WHEN the slot is selected THEN the cell SHALL have a 3px solid #F36B16 border
12. WHEN the slot is not selected THEN the cell SHALL have no special border (only grid gap)

---

### Requirement 25: Subject Color Coding System

**User Story:** As a user, I want each subject to have a consistent color across all slots, so that I can visually identify related classes quickly.

#### Acceptance Criteria

1. WHEN generating a color for a new subject THEN the system SHALL create a random HSL color with format `hsla([hue], 70%, 50%, 0.7)` where hue is 0-360
2. WHEN retrieving a color for a subject THEN the system SHALL first check `localStorage['kiro-subject-colors']` for an existing entry
3. WHEN a subject color exists in storage THEN the system SHALL return that color (ensuring consistency across page loads)
4. WHEN a subject has no color in storage THEN the system SHALL generate a new random color and save it to `localStorage['kiro-subject-colors']`
5. WHEN storing subject colors THEN the format SHALL be a JSON object: `{ "EXE101": "hsla(180, 70%, 50%, 0.7)", "DCD301": "hsla(45, 70%, 50%, 0.7)", ... }`
6. WHEN applying colors THEN ALL slots of the same subject (in grid and drawer) SHALL use the same color
7. WHEN a color is applied to a cell THEN it SHALL be set as the background-color with 70% opacity (built into the hsla format)
8. WHEN the page reloads THEN all subject colors SHALL be restored from localStorage without regeneration

---

### Requirement 26: Checkbox Selection System - Single Click

**User Story:** As a user, I want to select individual slots by clicking their checkboxes, so that I can choose specific classes for export.

#### Acceptance Criteria

1. WHEN a checkbox is clicked THEN the slot ID SHALL be toggled in `localStorage['kiro-selected-slots']` array
2. WHEN a slot ID is added to the array THEN the checkbox SHALL show a checkmark (☑) and the cell SHALL gain a 3px #F36B16 border
3. WHEN a slot ID is removed from the array THEN the checkbox SHALL show empty (☐) and the cell SHALL lose the selection border
4. WHEN toggling a checkbox in the grid THEN the corresponding drawer checkbox (if visible) SHALL update immediately
5. WHEN toggling a checkbox in the drawer THEN the corresponding grid checkbox SHALL update immediately
6. WHEN any checkbox is toggled THEN the slot counters (Selected count) SHALL update in real-time
7. WHEN the checkbox is clicked THEN the event SHALL be `stopPropagation()` to prevent parent cell click handlers
8. WHEN the page loads THEN all checkboxes SHALL be pre-checked if their slot IDs exist in `localStorage['kiro-selected-slots']`

---

### Requirement 27: Checkbox Selection System - Hold Click (1 Second)

**User Story:** As a user, I want to hold-click a checkbox for 1 second to select/deselect all slots of that subject, so that I can quickly manage subject-wide selections.

#### Acceptance Criteria

1. WHEN a checkbox is held down for 1 second THEN ALL slots of the same subject SHALL be selected or deselected
2. WHEN determining subject-wide selection action THEN IF all subject slots are selected, deselect all; IF any are unselected, select all
3. WHEN the hold timer is triggered THEN it SHALL extract the subject code from the slot ID (format: "Spring25-Mon-Slot1-EXE101" → "EXE101")
4. WHEN selecting all of a subject THEN ALL slot IDs matching that subject code SHALL be added to `localStorage['kiro-selected-slots']` (avoiding duplicates)
5. WHEN deselecting all of a subject THEN ALL slot IDs matching that subject code SHALL be removed from `localStorage['kiro-selected-slots']`
6. WHEN implementing the hold timer THEN `mousedown` SHALL start a 1000ms timer, and `mouseup` or `mouseleave` SHALL clear the timer
7. WHEN the hold action completes THEN ALL checkboxes for that subject (in grid and drawer) SHALL update to reflect the new state
8. WHEN the hold action completes THEN the grid SHALL re-render to update all cell borders
9. WHEN the hold action completes THEN the slot counters SHALL update to reflect the new selection count

---

### Requirement 28: Checkbox Selection System - Tooltips

**User Story:** As a user, I want to see tooltips when hovering over checkboxes, so that I understand the single-click vs hold-click behavior.

#### Acceptance Criteria

1. WHEN hovering over an unselected checkbox THEN the tooltip SHALL show: "Click to select, hold to select all [SUBJECT]"
2. WHEN hovering over a selected checkbox THEN the tooltip SHALL show: "Click to deselect, hold to deselect all [SUBJECT]"
3. WHEN extracting the subject code for the tooltip THEN it SHALL parse from the slot ID's last segment (after final hyphen)
4. WHEN displaying the tooltip THEN it SHALL appear above the checkbox with a 150ms delay
5. WHEN the mouse leaves the checkbox THEN the tooltip SHALL hide immediately
6. WHEN styling the tooltip THEN it SHALL use dark background (#1A1A1A), white text, small font (10px), rounded corners, and padding

---

### Requirement 29: Right Drawer Panel - Container and Animation

**User Story:** As a user, I want a collapsible right drawer that slides in from the right edge, so that I can access a comprehensive list of all schedule slots without cluttering the main view.

#### Acceptance Criteria

1. WHEN the drawer is rendered THEN it SHALL use fixed positioning: `position: fixed; right: 0; top: 0; height: 100vh;`
2. WHEN on desktop (>1024px) THEN the drawer width SHALL be 30vw
3. WHEN on tablet (600-1024px) THEN the drawer width SHALL be 50vw
4. WHEN on mobile (<600px) THEN the drawer width SHALL be 100vw
5. WHEN the drawer is closed THEN it SHALL have `transform: translateX(100%)` (completely off-screen to the right)
6. WHEN the drawer is opened THEN it SHALL have `transform: translateX(0)` (fully visible)
7. WHEN transitioning THEN the drawer SHALL use `transition: transform 0.3s ease-out` for smooth animation
8. WHEN positioning THEN the drawer SHALL have z-index 999999 (above the taskbar)
9. WHEN styling THEN the drawer SHALL use dark theme (#000000 background) with elevation shadow

---

### Requirement 30: Right Drawer Panel - Tab Puller

**User Story:** As a user, I want a small vertical tab on the right edge of the screen to open/close the drawer, so that I can easily toggle the drawer without needing a button in the main UI.

#### Acceptance Criteria

1. WHEN the tab puller is rendered THEN it SHALL use fixed positioning: `position: fixed; right: 0; top: 50%; transform: translateY(-50%);`
2. WHEN sizing the tab THEN it SHALL be 10px wide × 80px tall
3. WHEN styling the tab THEN it SHALL have #F36B16 background and border-radius: 4px 0 0 4px (rounded left edge)
4. WHEN the drawer is closed THEN the tab icon SHALL display "<" (arrow pointing left, meaning "open drawer")
5. WHEN the drawer is open THEN the tab icon SHALL display ">" (arrow pointing right, meaning "close drawer")
6. WHEN hovering over the tab THEN it SHALL show a glow effect: `box-shadow: 0 0 10px rgba(243,107,22,0.6);`
7. WHEN the tab is clicked THEN it SHALL toggle the drawer's transform between `translateX(100%)` and `translateX(0)`
8. WHEN the tab is clicked THEN it SHALL save the drawer state to `localStorage['kiro-drawer-open']` (true/false)
9. WHEN the page loads THEN the drawer SHALL restore its open/closed state from localStorage

---

### Requirement 31: Right Drawer Panel - Tabs (Offline / Online)

**User Story:** As a user, I want to filter drawer slots by offline or online status using tabs, so that I can focus on one type of class at a time.

#### Acceptance Criteria

1. WHEN the drawer header is rendered THEN it SHALL display two horizontal tabs: "🏫 Offline" and "💻 Online"
2. WHEN the active tab is Offline THEN the Offline tab SHALL have #F36B16 background and Online tab SHALL have #1A1A1A background
3. WHEN the active tab is Online THEN the Online tab SHALL have #F36B16 background and Offline tab SHALL have #1A1A1A background
4. WHEN the Offline tab is clicked THEN the drawer SHALL show only slots where `isOnline = false`
5. WHEN the Online tab is clicked THEN the drawer SHALL show only slots where `isOnline = true`
6. WHEN switching tabs THEN the active tab SHALL be saved to `localStorage['kiro-drawer-active-tab']` ('offline' or 'online')
7. WHEN the page loads THEN the drawer SHALL restore the active tab from localStorage (default to 'offline' if not set)
8. WHEN tab switching occurs THEN there SHALL be no page reload or data refetch

---

### Requirement 32: Right Drawer Panel - Slot Cards

**User Story:** As a user, I want to see all slots listed chronologically in the drawer with checkboxes, so that I can review my entire schedule and make selections from a comprehensive list.

#### Acceptance Criteria

1. WHEN rendering drawer cards THEN each card SHALL include: checkbox, subject code, date/slot, room, time, and attendance status
2. WHEN rendering drawer cards THEN they SHALL be sorted chronologically: earliest date first, then by slot number (1-8)
3. WHEN displaying a card THEN the checkbox SHALL be synced with the grid checkbox for the same slot ID
4. WHEN a drawer checkbox is changed THEN it SHALL call `toggleSlotSelection(slotId)` and update the grid checkbox immediately
5. WHEN a grid checkbox is changed THEN the corresponding drawer checkbox SHALL update immediately
6. WHEN a slot is visible in the current week grid AND selected THEN the drawer card SHALL be highlighted with a border or background color
7. WHEN a slot is NOT visible in the current week (from a different week) THEN the drawer card SHALL still be visible but without highlight
8. WHEN the drawer cards list becomes long (100+ cards) THEN virtual scrolling SHALL be implemented to render only visible cards + buffer
9. WHEN the user scrolls the drawer THEN new cards SHALL be rendered and off-screen cards SHALL be removed from DOM for performance

---

### Requirement 33: State Persistence Across Page Reloads

**User Story:** As a user, I want all my selections, drawer state, and semester settings to persist when I navigate weeks or reload the page, so that I don't lose my progress.

#### Acceptance Criteria

1. WHEN any slot is selected or deselected THEN the `localStorage['kiro-selected-slots']` array SHALL be updated immediately (with 300ms debounce)
2. WHEN the drawer is opened or closed THEN `localStorage['kiro-drawer-open']` SHALL be set to true/false
3. WHEN switching drawer tabs THEN `localStorage['kiro-drawer-active-tab']` SHALL be set to 'offline' or 'online'
4. WHEN a subject color is generated THEN it SHALL be saved to `localStorage['kiro-subject-colors']` and reused on subsequent renders
5. WHEN the semester dropdown is changed THEN `localStorage['selectedSemester']` SHALL be updated
6. WHEN semester sync is started THEN `localStorage['semesterSyncState']` SHALL track progress (current week, total weeks, in-progress flag)
7. WHEN the page loads (DOMContentLoaded) THEN ALL localStorage values SHALL be read and applied to restore the UI state
8. WHEN restoring state THEN the drawer SHALL open/close to match `localStorage['kiro-drawer-open']`
9. WHEN restoring state THEN the active drawer tab SHALL be set to match `localStorage['kiro-drawer-active-tab']`
10. WHEN restoring state THEN ALL checkboxes for slot IDs in `localStorage['kiro-selected-slots']` SHALL be pre-checked
11. WHEN restoring state THEN the slot counters SHALL be calculated and displayed correctly
12. WHEN semester sync was interrupted THEN the progress bar SHALL be restored and sync SHALL resume from the last completed week

---

### Requirement 34: Responsive Design and Breakpoints

**User Story:** As a user, I want the scheduler UI to adapt to different screen sizes, so that I can use it effectively on desktop, tablet, and mobile devices.

#### Acceptance Criteria

1. WHEN the viewport width is less than 600px THEN the UI SHALL apply mobile styles
2. WHEN in mobile mode THEN the taskbar layout SHALL switch from 3-column grid to single-column vertical stack
3. WHEN in mobile mode THEN the calendar grid SHALL switch from 7-day layout to single-column cards (one slot per card, full width)
4. WHEN in mobile mode THEN the drawer SHALL expand to 100vw when opened (full screen)
5. WHEN the viewport width is between 600px and 1024px THEN the UI SHALL apply tablet styles
6. WHEN in tablet mode THEN the taskbar center tile SHALL be compressed to 40% width instead of 60%
7. WHEN in tablet mode THEN the drawer width SHALL be 50vw
8. WHEN the viewport width is greater than 1024px THEN the UI SHALL apply desktop styles (default)
9. WHEN in desktop mode THEN the full 3-column taskbar layout (20%-60%-20%) SHALL be used
10. WHEN in desktop mode THEN the calendar grid SHALL display the full 7-day × 8-slot structure
11. WHEN in desktop mode THEN the drawer width SHALL be 30vw
12. WHEN on mobile THEN font sizes SHALL be reduced: 12px instead of 14px, 10px instead of 11px
13. WHEN on mobile THEN padding SHALL be reduced: 0.5rem instead of 1rem

---

### Requirement 35: Accessibility and Keyboard Navigation

**User Story:** As a user with accessibility needs, I want full keyboard navigation and screen reader support, so that I can use the scheduler without a mouse.

#### Acceptance Criteria

1. WHEN rendering the taskbar THEN it SHALL include `role="toolbar"` and `aria-label="FAP Scheduler Controls"`
2. WHEN rendering the progress bar THEN it SHALL include `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, and `aria-valuemax="100"`
3. WHEN rendering checkboxes THEN they SHALL include `role="checkbox"` and `aria-checked="true"` or `"false"`
4. WHEN rendering buttons THEN they SHALL include `aria-label` attributes describing their function
5. WHEN a button is disabled (during sync) THEN it SHALL include `aria-disabled="true"`
6. WHEN pressing Tab THEN focus SHALL move through controls in this order: Nav buttons → Semester selector → Select All → Sync buttons → Export → Grid checkboxes → Drawer tab → Drawer tabs → Drawer checkboxes
7. WHEN pressing Enter or Space on a button THEN it SHALL trigger the button's click action
8. WHEN using arrow keys in the semester dropdown THEN it SHALL navigate through options
9. WHEN any element receives keyboard focus THEN it SHALL display a clear focus indicator: `outline: 2px solid #F36B16; outline-offset: 2px;`
10. WHEN using a screen reader THEN all interactive elements SHALL announce their label, role, and state

---

### Requirement 36: Performance Optimization

**User Story:** As a user with a large schedule (100+ slots), I want the UI to remain responsive and fast, so that I don't experience lag or freezing.

#### Acceptance Criteria

1. WHEN rendering the drawer with 100+ slot cards THEN virtual scrolling SHALL be implemented to render only visible cards + 5-card buffer
2. WHEN the user scrolls the drawer THEN card rendering SHALL be debounced (100ms delay) to prevent excessive DOM updates
3. WHEN the window is resized THEN grid layout recalculation SHALL be debounced (250ms delay)
4. WHEN checkbox state changes THEN the save operation SHALL be debounced (300ms delay) to prevent excessive localStorage writes
5. WHEN rendering slot cards THEN DocumentFragment SHALL be used to batch insert multiple elements (single reflow)
6. WHEN querying the DOM THEN element references SHALL be cached and reused instead of re-querying
7. WHEN updating counters THEN only the counter text SHALL be updated, not the entire counter component
8. WHEN the grid or drawer is re-rendered THEN only changed elements SHALL be updated, not the entire list

---

### Requirement 37: Migration from Floating Panel

**User Story:** As a developer, I want to cleanly remove the old floating panel implementation and replace it with the new taskbar/drawer architecture, so that the codebase is maintainable and free of dead code.

#### Acceptance Criteria

1. WHEN migrating THEN the `createPanelHTML()` function in `ui.ts` SHALL be completely deleted
2. WHEN migrating THEN the `addPanelStyles()` function in `ui.ts` SHALL be completely deleted
3. WHEN migrating THEN all draggable panel logic (mouse drag handlers) SHALL be removed
4. WHEN migrating THEN panel z-index management code SHALL be removed
5. WHEN migrating THEN the new UI SHALL include: `createTaskbarHTML()`, `createDrawerHTML()`, `addTaskbarStyles()`, `addDrawerStyles()`, `renderCalendarGrid()`
6. WHEN migrating THEN the `initScheduler()` entry point SHALL call the new UI functions instead of the old panel functions
7. WHEN migrating THEN ALL existing semester sync logic (`startSemesterSync`, `processNextSemesterWeek`) SHALL be preserved unchanged
8. WHEN migrating THEN ALL existing ICS generation logic (`generateICS`, `formatTime`, `formatDate`) SHALL be preserved and reused
9. WHEN migrating THEN ALL existing extraction logic (`extractWeeklySchedule`, `extractExamSchedule`) SHALL be preserved and reused
10. WHEN migrating THEN the storage layer (`storage.get/set/remove`) SHALL be preserved and reused
11. WHEN migration is complete THEN NO floating panel code SHALL remain in the codebase
12. WHEN migration is complete THEN ALL features SHALL work identically to the old implementation (feature parity)

---

**End of Scheduler UI Redesign Requirements**
