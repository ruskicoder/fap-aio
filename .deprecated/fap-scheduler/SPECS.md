# FAP Scheduler - Technical Specifications

## Overview

FAP Scheduler is a Chrome extension for FPT University students to export schedules from the FAP (FPT Academic Portal) system to .ics calendar files compatible with Google Calendar, Apple Calendar, and other calendar applications.

## Current Version: v2.1.0

### Features

#### 1. Exam Schedule Export
- **URL**: `https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx`
- Extracts exam data from FAP exam schedule page
- Supports exam types: FE (Final Exam), PE (Practical Exam), 2NDFE, 2NDPE
- Filters by exam type
- Separates upcoming and completed exams
- Exports to .ics format with alarms (1 day and 1 hour before)

#### 2. Weekly Schedule Export (NEW)
- **URL**: `https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx`
- Extracts weekly class schedule from FAP
- Shows classes organized by "This Week" and "All"
- Displays attendance status (attended/absent/not-yet)
- Includes Google Meet URLs when available
- Exports to .ics format with 15-minute reminder

## Architecture

### Extension Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration, permissions, content script matches |
| `content.js` | Injected into FAP pages to extract schedule data |
| `popup.html` | Extension popup UI |
| `popup.js` | Popup logic, event handlers, rendering, ICS export |
| `popup.css` | Styling for the popup |
| `background.js` | Service worker (minimal) |
| `sanitize-utils.js` | XSS prevention utilities |

### Data Flow

1. User clicks extension icon on FAP page
2. `popup.js` detects FAP page and triggers sync
3. Content script (`content.js`) is injected
4. Content script extracts data from DOM and sends via message
5. `popup.js` receives data, stores in localStorage, renders UI
6. User can export to .ics file

---

## New Feature: Weekly Schedule Export

### Target URL
`https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx`

### Page Structure Analysis

#### Schedule Table Structure
The weekly schedule uses a table with:
- **Header Row 1**: Day names (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- **Header Row 2**: Dates (DD/MM format)
- **Body Rows**: Slots 1-8, each with 7 day columns

#### Slot Timing
| Slot | Time |
|------|------|
| Slot 1 | (Early morning - not specified in sample) |
| Slot 2 | 9:30 - 11:45 |
| Slot 3 | 12:30 - 14:45 |
| Slot 4 | 15:00 - 17:15 |
| Slot 5 | (Evening) |
| Slot 6 | (Evening) |
| Slot 7 | (Evening) |
| Slot 8 | (Evening) |

#### Activity Cell Structure
Each cell contains:
- `-` for empty slots
- `<p>` with activity details:
  - Subject code (e.g., `EXE101`, `DCD301`, `SWD392`, `MIP201`)
  - Link to activity detail: `../Schedule/ActivityDetail.aspx?id=XXXXXX`
  - Materials link
  - Room (e.g., `NVH 419`, `NVH 614`)
  - Room note (e.g., "Học tại nhà văn hóa Sinh viên")
  - Meet URL (optional)
  - Attendance status: `(Not yet)`, `(attended)`, `(absent)`
  - Time: `(9:30-11:45)`, `(15:00-17:15)`, etc.

#### Key DOM Selectors
- Year dropdown: `#ctl00_mainContent_drpYear`
- Week dropdown: `#ctl00_mainContent_drpSelectWeek`
- Day headers: `#ctl00_mainContent_divNameDay th`
- Date headers: `#ctl00_mainContent_divShowDate th`
- Schedule content: `#ctl00_mainContent_divContent tr`

### Data Extraction Pattern

```javascript
// Weekly schedule data structure
{
  title: "SWD392",           // Subject code
  location: "NVH 614",       // Room
  description: "Session X",  // Additional info
  start: Date,               // Calculated from date + slot time
  end: Date,
  meetUrl: "https://...",    // Optional Google Meet URL
  status: "not-yet" | "attended" | "absent",
  slot: 1-8,
  dayOfWeek: 0-6             // 0=Mon, 6=Sun
}
```

### Implementation Plan

#### Phase 1: Content Script Extension
1. Add message handler for `extractWeeklySchedule` action
2. Parse the weekly schedule table structure
3. Extract year and week from dropdowns
4. Calculate actual dates from DD/MM format + year
5. Map slot numbers to times
6. Return structured event data

#### Phase 2: Manifest Update
Add content script match for weekly schedule URL:
```json
"matches": [
  "https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx",
  "https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx"
]
```

#### Phase 3: Popup UI Extension
1. Add navigation tabs: "Exam Schedule" | "Weekly Schedule"
2. Separate storage keys: `examSchedule`, `weeklySchedule`
3. Different sync buttons for each schedule type
4. Weekly schedule display cards
5. Week selector in popup (optional)

#### Phase 4: Export Enhancement
1. Modify ICS export to handle weekly classes
2. Different alarm settings for classes vs exams
3. Include Meet URL in calendar event description/URL

---

## Technical Details

### Time Parsing (Existing)
```javascript
const fmtTime = t => {
  // Handles: 10h00, 10:00, 10.00, plain numbers
  // Returns: { hour: number, minute: number }
}
```

### Storage Keys
- `examSchedule` - Exam events array
- `weeklySchedule` - Weekly class events array
- `examFilter` - Exam type filter preferences

### Event Object Structure
```javascript
{
  title: string,
  location: string,
  description: string,
  start: Date | string,
  end: Date | string,
  tag?: string,       // For exams: FE, PE, 2NDFE, 2NDPE
  type?: string,      // "exam" | "class"
  meetUrl?: string    // For online classes
}
```

---

## Files to Modify

1. **manifest.json** - Add new URL match
2. **content.js** - Add weekly schedule extraction
3. **popup.html** - Add weekly schedule tab/section
4. **popup.js** - Handle weekly schedule data
5. **popup.css** - Style new elements

## Files to Create

None required - all functionality can be added to existing files.
