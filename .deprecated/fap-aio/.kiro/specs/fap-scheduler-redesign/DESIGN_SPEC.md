# FAP Scheduler UI/UX Redesign - Complete Design Specification

**Version**: 1.0  
**Date**: January 22, 2026  
**Target**: FAP Schedule Pages (Weekly & Exam)

---

## Overview

This specification defines the complete redesign of the FAP Scheduler UI from a floating panel to an embedded bottom taskbar with collapsible right drawer system. The new design prioritizes:

- **Persistent UI**: No reload when switching weeks/semesters
- **Enhanced Calendar**: Custom-rendered responsive grid with checkboxes
- **Flexible Selection**: Individual slots, by subject (hold-click), or select all
- **Integrated Export**: Smart export with offline/online/custom filtering
- **Better UX**: Consistent positioning, visual feedback, accessibility

---

## UI Layout Architecture

### 1. Bottom Taskbar (Fixed Position)

**Positioning & Dimensions**:
- `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);`
- `max-width: 98vw`
- `height: 80px` (default) → `100px` (when progress bar active)
- `z-index: 999998`
- Style: Dark theme (#000000), elevation shadow, #F36B16 accent

**Layout Structure** (when no progress bar):

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Weekly]  │     Semester:      │ Offline: X │ Online: Y │      │ Export▼│
│ [Exam]    │    [Dropdown]      │ Total: Z   │ Selected: W │[Week]│       │
│  (20%)    │  (L:15% | M:50% | R:25% of 60%)  │ [Sem]│  (20%) │
└────────────────────────────────────────────────────────────────────────┘
```

**Layout Structure** (with progress bar):

```
┌────────────────────────────────────────────────────────────────────────┐
│                    [███████████░░░░░░] 65% (13/20 weeks)              │ ← Progress (20px)
├────────────────────────────────────────────────────────────────────────┤
│ [Weekly]  │     Semester:      │ Offline: X │ Online: Y │      │ Export▼│
│ [Exam]    │    [Dropdown]      │ Total: Z   │ Selected: W │[Week]│       │
│  (20%)    │  (L:15% | M:50% | R:25% of 60%)  │ [Sem]│  (20%) │
└────────────────────────────────────────────────────────────────────────┘
```

#### 1.1 Left Section - Page Navigation (20%)

**Components**:
- Two buttons stacked vertically: `[📚 Weekly]` / `[📝 Exam]`
- Active page button highlighted with #F36B16 background
- Click behavior: Simple `<a href>` navigation to respective page

**Button States**:
- Active: `background: #F36B16; color: #000; font-weight: bold;`
- Inactive: `background: #1A1A1A; color: #E0E0E0;`
- Hover: Slight glow effect

**Navigation Links**:
- Weekly → `https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx`
- Exam → `https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx`

#### 1.2 Center Tile (60%)

##### 1.2.1 Left Sub-Section - Semester Selector (15%)

**Component**:
- Dropdown menu: `<select id="kiro-semester-select">`
- Options: Spring25, Summer25, Fall25, Spring26, etc.
- Retains all original semester selection logic
- **Purpose**: ONLY affects semester export; does NOT auto-sync

**Styling**:
- Dark background (#1A1A1A), #F36B16 border on focus
- 14px font, padding 8px

##### 1.2.2 Middle Sub-Section - Slot Counters (50%)

**Layout** (vertical stack, centered):
```
Offline: 15 | Online: 8
Total: 23 | Selected: 5
[Select All / Deselect All]
```

**Counter Display**:
- Font size: 11px
- Color: #E0E0E0 for labels, #F36B16 for numbers
- Live updates as slots are selected/deselected

**Select All Button**:
- Text toggles: "Select All" (default) ↔ "Deselect All" (when > 0 selected)
- Click: Selects/deselects ALL slots in current view
- Styling: Small button, #F36B16 border, transparent background

##### 1.2.3 Right Sub-Section - Sync Buttons (25%)

**Components** (stacked vertically):
- `[🔄 This Week]` - Syncs current week only
- `[📆 This Semester]` - Syncs entire semester

**Behavior**:
- Same as original implementation
- Semester sync shows progress bar at top
- Disabled state during active sync

#### 1.3 Right Section - Export (20%)

**Component**:
- Large button: `[📅 Export ▼]`
- Click main button: Exports based on current selection
- Click dropdown arrow (▼): Shows menu with options

**Export Dropdown Menu**:
```
┌─────────────┐
│ 🏫 Offline  │
│ 💻 Online   │
│ 📦 All      │ (only when custom selection active)
└─────────────┘
```

**Export Logic**:
- **No selection**: "All" exports all slots in current view
- **Custom selection**: "All" exports only selected slots
- Dropdown filters by online/offline

**Filename Format**:
- No selection + Offline: `Offline-Spring25.ics`
- No selection + Online: `Online-Spring25.ics`
- Custom + Offline: `Custom-Offline-Spring25.ics`
- Custom + Online: `Custom-Online-Spring25.ics`
- Custom + All: `Custom-Spring25.ics`

---

### 2. Progress Bar (Top of Taskbar)

**Activation**: Only during semester sync
**Positioning**: Above all taskbar elements, spans full width
**Height**: 20px (making total taskbar height 100px)

**Display**:
```
[███████████████░░░░░░░░░] 65% - Syncing Spring25 (13/20 weeks)
```

**Styling**:
- Background: #1A1A1A
- Fill: Linear gradient (#F36B16 → #4CAF50)
- Text: 11px, #E0E0E0, centered
- Animated progress fill

**Behavior**:
- Persists across page reloads during semester sync
- Restored from localStorage: `semesterSyncState`
- Controls remain active but user advised not to interact

---

### 3. Enhanced Calendar Grid

**Location**: Replaces native FAP schedule table on page
**Rendering**: Custom CSS Grid layout
**Responsiveness**: Adapts to screen width

#### 3.1 Desktop Layout (> 600px)

**Grid Structure**:
```
┌─────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Year:   │           MON   TUE   WED   THU   FRI   SAT   SUN │
│ [2026]  │         19/01 20/01 21/01 22/01 23/01 24/01 25/01 │
│ Week:   │                                                     │
│ [4]     │                                                     │
├─────────┼─────┬─────┬─────┬─────┬─────┬─────┬─────┤
│ Slot 1  │  -  │  -  │  -  │  -  │ [CELL] │  -  │  -  │
│ Slot 2  │  -  │  -  │ [CELL] │  -  │ [CELL] │  -  │  -  │
│ ...     │ ... │ ... │ ... │ ... │ ... │ ... │ ... │
└─────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

**Original Layout Preserved**:
- Year and Week dropdowns remain at top-left
- Day headers (Mon-Sun) + dates below
- Slot labels (Slot 1-8) in first column
- 7×8 grid for week view

#### 3.2 Mobile Layout (≤ 600px)

**Single Column Cards**:
- Each slot becomes a full-width card
- Chronological order (Monday Slot 1, Monday Slot 2, ...)
- Preserves all slot information

#### 3.3 Slot Cell Design

**Dimensions**:
- **Min height**: `20vh` (1/7 of 80vh for 8 slots)
- **Auto-expand**: Up to `40vh` if content overflows
- Word wrap enabled
- Equal width for all columns

**Cell Structure**:
```
┌─────────────────────────────────────┐
│ [☐] EXE101         [✓ Attended]    │ ← Top row
│ ─────────────────────────────────── │
│ at NVH 419                          │
│ (9:30-11:45)                        │
│ 📎 View Materials | 📹 Meet URL     │
│ (Not yet / Attended / Absent)       │
└─────────────────────────────────────┘
```

**Styling**:
- **Background**: Semi-transparent subject color (70% opacity)
- **Checkbox**: Top-left corner, 16px×16px
- **Subject Code**: Bold, 14px, black text
- **Attendance Status**: Top-right, colored badge
  - Attended: Green (#4CAF50)
  - Absent: Red (#F44336)
  - Not yet: Gray (#999)
- **Border** (selected): 3px solid #F36B16

#### 3.4 Color Coding System

**Subject Colors**:
- Randomly generated per subject code
- Consistent across all slots of same subject
- Stored in `localStorage`: `kiro-subject-colors`

**Generation**:
```javascript
function getSubjectColor(subjectCode) {
  const colors = JSON.parse(localStorage.getItem('kiro-subject-colors')) || {};
  if (!colors[subjectCode]) {
    colors[subjectCode] = generateRandomColor(); // HSL-based
    localStorage.setItem('kiro-subject-colors', JSON.stringify(colors));
  }
  return colors[subjectCode];
}
```

**Color Format**: `hsla(hue, 70%, 50%, 0.7)` - semi-transparent

---

### 4. Checkbox Selection System

#### 4.1 Checkbox Behavior

**Single Click**:
- Selects/deselects the clicked slot
- Visual feedback: Border highlight (#F36B16)
- Updates counter in taskbar
- Syncs with drawer list

**Hold Click (1 second)**:
- Selects/deselects ALL slots of that subject
- Tooltip during hover:
  - Unselected: "Click to select, hold to select all [SUBJECT]"
  - Selected: "Click to deselect, hold to deselect all [SUBJECT]"

**Visual States**:
- Unchecked: `☐` Empty checkbox
- Checked: `☑` Filled checkbox with checkmark
- Selected border: 3px solid #F36B16

#### 4.2 Select All / Deselect All

**Button Location**: Center tile, below counters
**Behavior**:
- Selects/deselects all slots in current view
- Text toggles based on state
- Syncs with all checkboxes (grid + drawer)

---

### 5. Right Drawer Panel

**Trigger**: Vertical tab on right screen edge
**Dimensions**:
- **Width**: 30% viewport width (desktop), 100% (mobile)
- **Height**: Full viewport height
- **Z-index**: 999999 (above taskbar)

#### 5.1 Drawer Tab Puller

**Positioning**:
- `position: fixed; right: 0; top: 50%; transform: translateY(-50%);`
- `width: 10px; height: 80px;`
- Background: #F36B16
- Border radius: 4px 0 0 4px (rounded left edge)

**Icon**:
- Closed: `<` (arrow pointing left = "open drawer")
- Open: `>` (arrow pointing right = "close drawer")
- Font size: 16px, white color

**Interaction**:
- Hover: Glow effect (`box-shadow: 0 0 10px rgba(243,107,22,0.6)`)
- Click: Toggles drawer open/close with slide animation

#### 5.2 Drawer Content

**Layout**:
```
┌────────────────────────────────┐
│ [🏫 Offline] [💻 Online]      │ ← Tabs
├────────────────────────────────┤
│                                │
│  ┌──────────────────────────┐ │
│  │ [☑] EXE101               │ │
│  │ Sat 25/01, Slot 2        │ │ ← Card
│  │ NVH 419 (9:30-11:45)     │ │
│  └──────────────────────────┘ │
│                                │
│  ┌──────────────────────────┐ │
│  │ [☐] DCD301               │ │
│  │ Wed 21/01, Slot 3        │ │
│  └──────────────────────────┘ │
│                                │
│  ... (scrollable)              │
└────────────────────────────────┘
```

**Tabs**:
- Two horizontal tabs: Offline | Online
- Active tab: #F36B16 background
- Filters slot cards by online/offline status

**Slot Cards**:
- Same format as current implementation
- **Checkbox**: Syncs with grid checkboxes
- **Highlight**: If slot is visible in current week grid AND selected
- **Order**: Chronological (sorted by date, then slot number)
- **Scrollable**: Vertical scroll for overflow

**Animation**:
- Slide in from right: `transform: translateX(100%)` → `translateX(0)`
- Duration: 300ms, ease-out easing

---

### 6. State Persistence (localStorage)

**Keys Used**:
```javascript
{
  // Selection state
  "kiro-selected-slots": ["slot-id-1", "slot-id-2", ...],
  
  // Drawer state
  "kiro-drawer-open": true/false,
  "kiro-drawer-active-tab": "offline" | "online",
  
  // Semester sync state
  "semesterSyncState": {...}, // existing
  "selectedSemester": "Spring25", // existing
  
  // Color mapping
  "kiro-subject-colors": {"EXE101": "#...", "DCD301": "#...", ...},
  
  // Weekly schedule data
  "weeklySchedule": [...], // existing
  
  // Exam schedule data
  "examSchedule": [...] // existing
}
```

**Persistence Behavior**:
- State saved on every change (selection, drawer toggle, etc.)
- Restored on page load (DOMContentLoaded)
- Survives page reloads, navigation between Weekly/Exam pages
- Semester sync state restored to resume interrupted scans

---

## Responsive Breakpoints

| Screen Width | Layout | Calendar Grid | Drawer Width |
|--------------|--------|---------------|--------------|
| < 600px      | Mobile | Single column cards | 100% width |
| 600-1024px   | Tablet | 7-day week grid | 50% width |
| > 1024px     | Desktop| 7-day week grid | 30% width |

---

## Accessibility

- All buttons have `aria-label` attributes
- Checkboxes have `role="checkbox"` and `aria-checked`
- Progress bar has `role="progressbar"` and `aria-valuenow`
- Keyboard navigation: Tab through controls
- Focus indicators: 2px solid #F36B16 outline

---

## Technical Notes

### Grid Rendering
- Hide native FAP table: `display: none`
- Parse table data, render custom grid
- Preserve year/week dropdowns functionality
- Maintain native form submission for week changes

### Hold-Click Implementation
```javascript
let holdTimer;
checkbox.addEventListener('mousedown', () => {
  holdTimer = setTimeout(() => {
    selectAllOfSubject(subjectCode);
  }, 1000);
});
checkbox.addEventListener('mouseup', () => clearTimeout(holdTimer));
```

### Export Logic
- Uses existing ICS generation (`utils.ts::generateICS`)
- Filters events by selection and online/offline status
- Generates filename dynamically based on selection

---

## UI Components Summary

1. ✅ Bottom Taskbar (fixed, 80-100px height, 98vw max-width)
2. ✅ Progress Bar (conditional, 20px, top of taskbar)
3. ✅ Page Navigation Buttons (Weekly/Exam, left 20%)
4. ✅ Semester Selector (center-left 15%)
5. ✅ Slot Counters (center-middle 50%, live updates)
6. ✅ Sync Buttons (center-right 25%, This Week/Semester)
7. ✅ Export Button with Dropdown (right 20%)
8. ✅ Enhanced Calendar Grid (custom CSS Grid, responsive)
9. ✅ Slot Checkboxes (single/hold-click, color-coded cells)
10. ✅ Right Drawer (collapsible, 30%vw, with tabs)
11. ✅ Drawer Slot Cards (synced checkboxes, chronological)
12. ✅ State Persistence (localStorage, survives reloads)

---

**End of Design Specification**
