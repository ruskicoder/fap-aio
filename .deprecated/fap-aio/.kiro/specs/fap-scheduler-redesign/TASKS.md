# Scheduler UI Redesign Implementation Tasks

## Phase 11: Scheduler UI Redesign - Bottom Taskbar + Right Drawer

### Overview
Transform the floating panel scheduler UI (380px×580px) into an embedded bottom taskbar (80-100px height) with a collapsible right drawer (30vw width). This phase implements enhanced calendar grid, checkbox selection system, and state persistence.

---

### 11.1 Refactor UI Architecture

- [ ] 11.1.1 Create New UI Component Files
  - Create `src/contentScript/features/scheduler/components/taskbar.ts` for taskbar component
  - Create `src/contentScript/features/scheduler/components/drawer.ts` for right drawer panel
  - Create `src/contentScript/features/scheduler/components/grid.ts` for calendar grid rendering
  - Create `src/contentScript/features/scheduler/components/selection.ts` for checkbox logic
  - Create `src/contentScript/features/scheduler/components/colors.ts` for subject color system
  - _Requirements: Clean component separation, TypeScript interfaces for all components_

- [ ] 11.1.2 Update ui.ts - Remove Floating Panel
  - Delete `createPanelHTML()` function (old 380×580px panel generator)
  - Delete `addPanelStyles()` function (old panel CSS)
  - Remove all draggable panel logic and event listeners
  - Remove panel z-index management code
  - _Requirements: Complete removal of floating panel code_

- [ ] 11.1.3 Create Taskbar HTML Generator
  - Implement `createTaskbarHTML()` in `taskbar.ts`
  - Generate bottom-fixed container (max-width 98vw, centered with transform)
  - Create 3-section grid layout: left (20%), center (60%), right (20%)
  - Add progress bar overlay container (conditional display)
  - Include all ARIA labels for accessibility
  - _Requirements: Component returns HTML string, follows dark theme (#000000, #F36B16)_

- [ ] 11.1.4 Create Taskbar Styles
  - Implement `addTaskbarStyles()` in `taskbar.ts`
  - Fixed positioning: `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);`
  - CSS Grid for 3-column layout with percentages
  - Dark theme: #000000 background, #F36B16 accent
  - Elevation shadow: `box-shadow: 0 -4px 12px rgba(0,0,0,0.3);`
  - Responsive styles: <600px single column, 600-1024px compressed
  - _Requirements: CSS injected via GM_addStyle or <style> element_

---

### 11.2 Implement Progress Bar Component

- [ ] 11.2.1 Create Progress Bar HTML
  - Add progress bar div at top of taskbar (20px height)
  - Include progress fill bar with animated gradient (#F36B16 → #4CAF50)
  - Add text overlay for percentage and status
  - Implement conditional display logic (hidden by default)
  - _Requirements: Expands taskbar height from 80px to 100px when active_

- [ ] 11.2.2 Integrate with Semester Sync
  - Update `startSemesterSync()` in `scheduler.ts` to show progress bar
  - Call `showProgressBar(syncState)` on sync start
  - Update progress on each week completion
  - Hide progress bar on sync completion or error
  - _Requirements: Persists across page reloads via localStorage_

- [ ] 11.2.3 Restore Progress on Page Load
  - Check `localStorage['semesterSyncState']` on DOMContentLoaded
  - If `inProgress: true`, show progress bar with saved state
  - Resume sync from last completed week
  - _Requirements: Seamless resume after page reload during semester sync_

---

### 11.3 Implement Left Section - Page Navigation

- [ ] 11.3.1 Create Navigation Buttons
  - Add two buttons: Weekly (📚) and Exam (📝)
  - Style active button with #F36B16 background
  - Implement `<a href>` navigation to respective pages
  - Detect current page from `window.location.pathname`
  - _Requirements: Simple navigation, no JavaScript routing_

- [ ] 11.3.2 Add Navigation Styles
  - Button states: active (#F36B16 bg), inactive (#1A1A1A bg), hover (glow)
  - Vertical stack layout with flex
  - Padding: 0.75rem 1rem
  - Border radius: 8px
  - _Requirements: Accessible, keyboard-navigable_

---

### 11.4 Implement Center Tile

- [ ] 11.4.1 Create Semester Selector Dropdown
  - Add `<select id="kiro-semester-select">` with semester options
  - Populate from `constants.ts` semester config
  - Restore selected semester from localStorage on load
  - Save selection to `localStorage['selectedSemester']` on change
  - _Requirements: ONLY affects export filename/filtering, does NOT auto-sync_

- [ ] 11.4.2 Implement Slot Counters
  - Display 4 counters: Offline, Online, Total, Selected
  - Update counters on every checkbox change
  - Calculate from current view (week or exam page)
  - Format: "Offline: 15 | Online: 8" (horizontal)
  - _Requirements: Live updates, 11px font, #F36B16 for numbers_

- [ ] 11.4.3 Create Select All / Deselect All Button
  - Button text toggles based on selection count
  - "Select All" when selected = 0, "Deselect All" when selected > 0
  - Click selects/deselects ALL slots in current view
  - Update all checkboxes (grid + drawer)
  - _Requirements: Small button, #F36B16 border, transparent background_

- [ ] 11.4.4 Create Sync Buttons
  - Two buttons: "🔄 This Week" and "📆 This Semester"
  - This Week: calls `extractWeeklySchedule()` + saves to localStorage
  - This Semester: calls `startSemesterSync()` + shows progress bar
  - Disabled state during active sync
  - _Requirements: Vertical stack, same as existing logic_

- [ ] 11.4.5 Implement Center Tile Layout
  - CSS Grid: `grid-template-columns: 15% 50% 25%;` within 60% parent
  - Left: semester selector, Middle: counters + button, Right: sync buttons
  - Vertical centering with flexbox
  - _Requirements: Responsive, collapses to single column on mobile_

---

### 11.5 Implement Right Section - Export

- [ ] 11.5.1 Create Export Button with Dropdown
  - Main button: "📅 Export ▼"
  - Dropdown arrow triggers menu: [Offline] [Online] [All]
  - Click main button: exports based on current selection
  - Click arrow: shows dropdown menu
  - _Requirements: 20% width, large button, #F36B16 accent_

- [ ] 11.5.2 Implement Export Logic
  - Get selected slots from localStorage
  - If no selection: export all slots in current view
  - If has selection: export only selected slots
  - Filter by dropdown choice (offline/online/all)
  - _Requirements: Reuses existing `generateICS()` from utils.ts_

- [ ] 11.5.3 Implement Filename Generation
  - Format: `Custom-[Offline/Online/All]-[Semester].ics` (when has selection)
  - Format: `[Offline/Online]-[Semester].ics` (when no selection)
  - Semester from dropdown selector
  - _Requirements: Dynamic filename based on selection state_

- [ ] 11.5.4 Create Dropdown Menu Styles
  - Absolute positioning below button
  - Dark background (#1A1A1A), border #F36B16
  - Hover state: #F36B16 background for options
  - Emoji icons: 🏫 Offline, 💻 Online, 📦 All
  - _Requirements: Smooth fade-in animation, auto-close on selection_

---

### 11.6 Implement Enhanced Calendar Grid

- [ ] 11.6.1 Hide Native FAP Table
  - Find original table: `#ctl00_mainContent_RadScheduler1_SchedulerContentDiv`
  - Set `display: none` (don't remove, preserve form data)
  - Preserve year/week dropdowns functionality
  - _Requirements: Native table must remain for form submissions_

- [ ] 11.6.2 Create Grid Renderer
  - Implement `renderCalendarGrid()` in `grid.ts`
  - Parse original table data with `extractWeeklySchedule()`
  - Generate custom grid with CSS Grid layout
  - Grid structure: `grid-template-columns: auto repeat(7, 1fr);`
  - Grid rows: `minmax(20vh, 40vh)` for each slot row
  - _Requirements: Maintains 7-day × 8-slot structure, responsive_

- [ ] 11.6.3 Implement Desktop Layout (>600px)
  - 8 rows (slots 1-8) × 7 columns (Mon-Sun)
  - Row 1: Year dropdown + day headers (Mon-Sun with dates)
  - Row 2-9: Slot labels + slot cells
  - Equal column widths with `1fr`
  - Gap: 2px between cells
  - _Requirements: Preserves original layout structure_

- [ ] 11.6.4 Implement Mobile Layout (<600px)
  - Switch from grid to single-column flexbox
  - Each slot becomes a full-width card
  - Chronological order: Monday Slot 1, Monday Slot 2, etc.
  - Min-height: 20vh, max-height: 40vh
  - _Requirements: Responsive breakpoint at 600px_

- [ ] 11.6.5 Create Slot Cell Component
  - Cell structure: checkbox (top-left), subject code (bold), attendance badge (top-right)
  - Cell body: room info, time info, links (Materials, Meet)
  - Background: Semi-transparent subject color (70% opacity)
  - Border: 3px solid #F36B16 when selected
  - _Requirements: Follows design spec in DESIGN_SPEC.md section 6.3_

- [ ] 11.6.6 Apply Cell Styling
  - Get subject color from `getSubjectColor(subjectCode)`
  - Apply as background with 70% opacity
  - Add selected border if slot is in localStorage selection
  - Attendance badge colors: Green (#4CAF50) attended, Red (#F44336) absent, Gray (#999) not yet
  - _Requirements: Dynamic styling based on slot state_

---

### 11.7 Implement Color Coding System

- [ ] 11.7.1 Create Color Generation Utility
  - Implement `generateRandomColor()` in `colors.ts`
  - HSL-based: `hsla(hue, 70%, 50%, 0.7)` with random hue (0-360)
  - Returns semi-transparent color string
  - _Requirements: Generates vibrant, distinguishable colors_

- [ ] 11.7.2 Implement Color Storage
  - Create `getSubjectColor(subjectCode)` function
  - Check `localStorage['kiro-subject-colors']` for existing color
  - If not found, generate new color and save
  - Return color string
  - _Requirements: Colors persist across page reloads_

- [ ] 11.7.3 Apply Colors to Cells and Cards
  - Call `getSubjectColor()` when rendering each slot cell
  - Apply color to cell background in grid
  - Apply same color to drawer cards for consistency
  - _Requirements: Same subject = same color across all views_

---

### 11.8 Implement Checkbox Selection System

- [ ] 11.8.1 Add Checkboxes to Grid Cells
  - Insert `<input type="checkbox">` in each slot cell (top-left)
  - Set `data-slot-id` attribute with format: `Spring25-Mon-Slot1-EXE101`
  - Check checkbox if slot ID exists in `localStorage['kiro-selected-slots']`
  - _Requirements: 16px×16px, accessible with ARIA labels_

- [ ] 11.8.2 Implement Single Click Selection
  - Add event listener to checkbox: `click` event
  - Toggle slot ID in `localStorage['kiro-selected-slots']` array
  - Update cell border (3px #F36B16 if selected)
  - Call `updateCounters()` to refresh counter display
  - Call `syncDrawerCheckbox(slotId)` to update drawer
  - _Requirements: Immediate visual feedback, state saved to localStorage_

- [ ] 11.8.3 Implement Hold Click Selection (1 second)
  - Add `mousedown`, `mouseup`, `mouseleave` event listeners to checkbox
  - Set 1-second timer on mousedown
  - On timer expiry: select/deselect ALL slots of that subject
  - Clear timer on mouseup or mouseleave
  - _Requirements: 1000ms threshold, selects all instances of subject_

- [ ] 11.8.4 Implement Tooltips
  - Add `mouseenter` listener to checkbox
  - Show tooltip: "Click to select, hold to select all [SUBJECT]"
  - If already selected: "Click to deselect, hold to deselect all [SUBJECT]"
  - Position tooltip above checkbox
  - _Requirements: 150ms delay, auto-hide on mouseleave_

- [ ] 11.8.5 Implement Select All / Deselect All
  - Wire button to `selectAllSlots()` or `deselectAllSlots()` based on state
  - Select All: Add all slot IDs from current view to localStorage array
  - Deselect All: Clear localStorage array
  - Update all checkboxes (grid + drawer)
  - Call `updateCounters()`
  - _Requirements: Affects all slots in current week view_

---

### 11.9 Implement Right Drawer Panel

- [ ] 11.9.1 Create Drawer Container
  - Fixed positioning: `position: fixed; right: 0; top: 0; height: 100vh;`
  - Width: 30vw (desktop), 50vw (tablet), 100vw (mobile)
  - Z-index: 999999 (above taskbar)
  - Transform: `translateX(100%)` when closed, `translateX(0)` when open
  - Transition: `transform 0.3s ease-out`
  - _Requirements: Slide animation, dark theme, elevation shadow_

- [ ] 11.9.2 Create Drawer Tab Puller
  - Fixed positioning: `right: 0; top: 50%; transform: translateY(-50%);`
  - Dimensions: 10px × 80px
  - Background: #F36B16
  - Border radius: 4px 0 0 4px (rounded left edge)
  - Icon: `<` when closed, `>` when open
  - _Requirements: Hover glow effect, clickable to toggle drawer_

- [ ] 11.9.3 Implement Drawer Toggle Logic
  - Add click listener to drawer tab
  - Toggle `transform` between `translateX(100%)` and `translateX(0)`
  - Update icon: `<` ↔ `>`
  - Save state to `localStorage['kiro-drawer-open']`
  - _Requirements: Smooth animation, state persists across reloads_

- [ ] 11.9.4 Create Drawer Tabs (Offline / Online)
  - Two horizontal tabs: "🏫 Offline" and "💻 Online"
  - Active tab: #F36B16 background
  - Inactive tab: #1A1A1A background
  - Click to switch tabs, show/hide respective slot lists
  - Save active tab to `localStorage['kiro-drawer-active-tab']`
  - _Requirements: Tab switching without page reload_

- [ ] 11.9.5 Implement Drawer Slot Cards
  - Card structure: checkbox + subject code + date/time + room + attendance
  - Same format as existing floating panel cards
  - Checkbox synced with grid checkboxes
  - Highlight card if selected AND visible in current week
  - _Requirements: Follows design spec in DESIGN_SPEC.md section 8.4_

- [ ] 11.9.6 Implement Chronological Ordering
  - Sort slots by date, then by slot number
  - Render in drawer lists (offline and online separately)
  - Update order on sync completion or week navigation
  - _Requirements: Oldest date first, slot 1 before slot 2_

- [ ] 11.9.7 Implement Drawer Checkbox Sync
  - Add change listener to drawer checkboxes
  - Call `toggleSlotSelection(slotId)` on change
  - Update grid checkbox for same slot ID
  - Call `updateCounters()`
  - _Requirements: Bidirectional sync between grid and drawer_

---

### 11.10 Implement State Persistence

- [ ] 11.10.1 Define Storage Keys
  - `kiro-selected-slots`: string[] (slot IDs)
  - `kiro-drawer-open`: boolean
  - `kiro-drawer-active-tab`: 'offline' | 'online'
  - `kiro-subject-colors`: { [code: string]: string }
  - (Existing): `semesterSyncState`, `selectedSemester`, `weeklySchedule`, `examSchedule`
  - _Requirements: All keys prefixed with 'kiro-' to prevent collisions_

- [ ] 11.10.2 Implement State Restoration
  - Create `restoreUIState()` function
  - Call on DOMContentLoaded after rendering UI
  - Restore drawer state (open/closed, active tab)
  - Restore semester selector value
  - Restore slot selections (mark checkboxes, apply borders)
  - Restore sync progress if interrupted
  - _Requirements: Seamless state restoration, no flickering_

- [ ] 11.10.3 Implement Debounced State Saving
  - Create debounced `saveState()` function (300ms delay)
  - Call after every checkbox change
  - Saves selected slots array to localStorage
  - _Requirements: Prevents excessive localStorage writes_

---

### 11.11 Implement Responsive Design

- [ ] 11.11.1 Create Mobile Styles (<600px)
  - Taskbar: Single-column vertical stack, full-width buttons
  - Calendar grid: Single-column flexbox, full-width cards
  - Drawer: 100vw width when open, covers entire screen
  - Font sizes: 12px instead of 14px
  - Padding: 0.5rem instead of 1rem
  - _Requirements: Media query at 600px breakpoint_

- [ ] 11.11.2 Create Tablet Styles (600-1024px)
  - Taskbar: Maintain 3-column layout, compressed center tile (40%)
  - Calendar grid: Maintain 7-day grid, smaller cells
  - Drawer: 50vw width
  - Counter font: 10px instead of 11px
  - _Requirements: Media query at 1024px breakpoint_

- [ ] 11.11.3 Create Desktop Styles (>1024px)
  - Taskbar: Full 3-column layout (20%-60%-20%)
  - Calendar grid: Full 7-day × 8-slot grid
  - Drawer: 30vw width
  - Default font sizes and padding
  - _Requirements: No media query, default styles_

---

### 11.12 Implement Accessibility

- [ ] 11.12.1 Add ARIA Attributes
  - Taskbar: `role="toolbar"`, `aria-label="FAP Scheduler Controls"`
  - Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
  - Checkboxes: `role="checkbox"`, `aria-checked="true/false"`, `aria-label`
  - Buttons: `aria-label`, `aria-disabled` (during sync)
  - _Requirements: Full ARIA compliance for screen readers_

- [ ] 11.12.2 Implement Keyboard Navigation
  - Tab order: Nav buttons → Semester selector → Select All → Sync buttons → Export → Grid checkboxes → Drawer tab → Drawer tabs → Drawer checkboxes
  - Enter/Space on buttons triggers click
  - Arrow keys in dropdown navigation
  - _Requirements: Fully keyboard-accessible, no mouse required_

- [ ] 11.12.3 Add Focus Indicators
  - All interactive elements: `outline: 2px solid #F36B16; outline-offset: 2px;` on focus
  - Visible on keyboard navigation, hidden on mouse click (optional)
  - _Requirements: Clear focus indicators for keyboard users_

---

### 11.13 Performance Optimizations

- [ ] 11.13.1 Implement Virtual Scrolling (Drawer)
  - Calculate visible cards based on scroll position
  - Render only visible cards + 5-card buffer above/below
  - Update rendered cards on scroll (debounced)
  - _Requirements: Handles 100+ slot cards without lag_

- [ ] 11.13.2 Debounce Event Handlers
  - Resize event: 250ms debounce before recalculating grid layout
  - Scroll event (drawer): 100ms debounce before virtual scroll update
  - Checkbox state save: 300ms debounce before localStorage write
  - _Requirements: Prevents excessive function calls_

- [ ] 11.13.3 Optimize DOM Updates
  - Use DocumentFragment for batch insertions
  - Single reflow per grid render (append fragment at end)
  - Cache DOM element references (don't re-query)
  - _Requirements: Minimize reflows and repaints_

---

### 11.14 Migration and Cleanup

- [ ] 11.14.1 Update scheduler/index.ts
  - Update `initScheduler()` to call new UI functions
  - Replace `createPanelHTML()` with `createTaskbarHTML()` + `createDrawerHTML()`
  - Replace `addPanelStyles()` with `addTaskbarStyles()` + `addDrawerStyles()`
  - Call `renderCalendarGrid()` after taskbar injection
  - Call `restoreUIState()` after rendering
  - _Requirements: Maintain initialization guard, prevent multiple injections_

- [ ] 11.14.2 Update scheduler/scheduler.ts
  - Keep `startSemesterSync()` and `processNextSemesterWeek()` unchanged
  - Update progress bar integration (expand taskbar height)
  - Remove panel-specific code (dragging, positioning)
  - _Requirements: Preserve semester sync logic, update only UI integration_

- [ ] 11.14.3 Clean Up Old Files
  - Review `ui.ts` for unused functions
  - Remove panel-specific constants
  - Update comments and documentation
  - _Requirements: No dead code, clean codebase_

---

### 11.15 Testing

- [ ] 11.15.1 Unit Test Selection Logic
  - Test `toggleSlotSelection()` adds/removes slot IDs correctly
  - Test `selectAllOfSubject()` selects all instances
  - Test `selectAllSlots()` and `deselectAllSlots()`
  - Test hold-click timer logic (1-second threshold)
  - _Requirements: Cover all selection edge cases_

- [ ] 11.15.2 Integration Test Grid ↔ Drawer Sync
  - Select slot in grid, verify drawer checkbox updates
  - Select slot in drawer, verify grid checkbox updates
  - Select all, verify both grid and drawer update
  - Deselect in drawer, verify grid updates
  - _Requirements: Bidirectional sync works correctly_

- [ ] 11.15.3 Test State Persistence
  - Select slots, reload page, verify selections restored
  - Open drawer, reload page, verify drawer opens
  - Switch tab, reload page, verify tab remains active
  - Start semester sync, reload page, verify progress bar shows
  - _Requirements: All state survives page reload_

- [ ] 11.15.4 Test Export Workflow
  - Select 5 slots, export Offline, verify ICS contains only offline selected slots
  - No selection, export Online, verify ICS contains all online slots
  - Custom selection, export All, verify filename includes "Custom"
  - Verify filename format matches spec
  - _Requirements: Export logic works for all combinations_

- [ ] 11.15.5 Test Responsive Layouts
  - Resize to <600px, verify single-column layout
  - Resize to 600-1024px, verify compressed layout
  - Resize to >1024px, verify full layout
  - Verify drawer width changes at breakpoints
  - _Requirements: No layout breaks at any screen size_

- [ ] 11.15.6 Visual Regression Testing
  - Verify color consistency across reloads (same subject = same color)
  - Verify taskbar doesn't overlap page content
  - Verify drawer doesn't block taskbar
  - Verify progress bar expands taskbar correctly
  - _Requirements: No visual glitches, consistent styling_

- [ ] 11.15.7 Accessibility Testing
  - Test keyboard navigation (Tab through all controls)
  - Test screen reader announcements (NVDA/JAWS)
  - Verify focus indicators visible
  - Test with keyboard only (no mouse)
  - _Requirements: Fully accessible to all users_

---

### 11.16 Documentation

- [ ] 11.16.1 Update User Documentation
  - Add section to README: "Scheduler UI Redesign"
  - Document taskbar controls (nav, selector, counters, sync, export)
  - Document checkbox selection (single-click, hold-click)
  - Document drawer panel (tabs, cards, sync)
  - Include screenshots of new UI
  - _Requirements: Clear, concise user guide_

- [ ] 11.16.2 Update Developer Documentation
  - Document new component architecture (taskbar, drawer, grid, selection, colors)
  - Document state management (localStorage keys, restore logic)
  - Document responsive breakpoints and layouts
  - Document color coding system
  - Include code examples and API references
  - _Requirements: Helps future contributors understand codebase_

---

## Implementation Order

**Priority 1 (Core UI)**:
1. 11.1 - Refactor UI Architecture
2. 11.3 - Page Navigation
3. 11.4 - Center Tile
4. 11.5 - Export Section
5. 11.6 - Enhanced Calendar Grid

**Priority 2 (Interactivity)**:
6. 11.7 - Color Coding System
7. 11.8 - Checkbox Selection
8. 11.9 - Right Drawer Panel
9. 11.10 - State Persistence

**Priority 3 (Polish)**:
10. 11.2 - Progress Bar Component
11. 11.11 - Responsive Design
12. 11.12 - Accessibility
13. 11.13 - Performance Optimizations

**Priority 4 (Finalization)**:
14. 11.14 - Migration and Cleanup
15. 11.15 - Testing
16. 11.16 - Documentation

---

## Success Criteria

- ✅ Taskbar fixed at bottom of viewport, 80-100px height
- ✅ Right drawer slides in/out from right edge, 30vw width
- ✅ Calendar grid replaces native FAP table, maintains 7×8 structure
- ✅ Checkboxes functional in grid and drawer, synced bidirectionally
- ✅ Hold-click (1s) selects all slots of subject
- ✅ Subject colors consistent across reloads (localStorage persistence)
- ✅ Export with offline/online/custom filtering works
- ✅ Filename format: `[Custom-][Offline/Online]-[Semester].ics`
- ✅ State persists across page reloads (selections, drawer, semester)
- ✅ Responsive layouts at <600px, 600-1024px, >1024px
- ✅ Accessible (ARIA, keyboard nav, focus indicators)
- ✅ No performance issues with 100+ slots
- ✅ Semester sync progress bar works, survives reloads
- ✅ All manual tests pass (grid↔drawer sync, export, state persistence)

