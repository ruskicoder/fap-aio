# FPTU Move Out Class Tool - Codebase Specification

## 1. Project Overview

**Name:** FPTU Move Out Class Tool  
**Type:** Chromium Browser Extension  
**Target Platform:** Chrome Web Store  
**Target URL:** `https://fap.fpt.edu.vn/*`  
**Version:** 1.3.9  
**Author:** ruskicoder (github.com/ruskicoder)

### 1.1 Purpose
A browser extension to assist FPT University students with class scheduling and class transfer operations on the FAP (FPT Academic Portal) system.

### 1.2 Key Features
- View class schedules in a convenient timetable format
- Quick class transfer functionality
- View class list directly in browser tab
- View timetable easily on tab
- Search classes by lecturer
- View lecturer reviews (via external Google Sheet)
- View class student count (experimental)

---

## 2. Architecture

### 2.1 Technology Stack
- **Framework:** React 18.2.0
- **Language:** TypeScript 5.2.2
- **Build Tool:** Vite 5.2.0
- **Styling:** TailwindCSS 3.4.3
- **HTML Parser:** Cheerio 1.0.0-rc.12
- **Manifest Version:** 3 (Chrome Extension)

### 2.2 Project Structure

```
fap-moveout/
├── public/
│   └── manifest.json          # Chrome extension manifest
├── src/
│   ├── App.tsx                # Main move-out class component
│   ├── RegisterCourse.tsx     # Course registration component
│   ├── main.tsx               # Entry point
│   ├── index.css              # Global styles (TailwindCSS)
│   ├── utils.ts               # Utility functions
│   ├── tracking.ts            # Analytics tracking (to be removed)
│   ├── components/
│   │   ├── Header.tsx         # Header with actions
│   │   ├── Timetable.tsx      # Timetable display grid
│   │   ├── FilterSection.tsx  # Filter controls
│   │   ├── ClassListDetails.tsx  # Class list view
│   │   ├── TimetableDetails.tsx  # Timetable details
│   │   └── MultiSelect.tsx    # Multi-select component
│   └── constants/
│       ├── classData.ts       # Class data structures
│       ├── colorGenerator.ts  # Color utilities
│       └── formData.ts        # Form data helpers
├── dept.json                  # Department mapping data
├── noti.json                  # Notification configuration
└── images/                    # Extension icons and assets
```

### 2.3 Extension Manifest (manifest.json)
- **Manifest Version:** 3
- **Content Scripts:** Injected on `https://fap.fpt.edu.vn/*`
- **Permissions:** `storage` (for local storage)
- **Host Permissions:** `https://fap.fpt.edu.vn/*`

---

## 3. Core Components

### 3.1 App.tsx (Move Out Class)
- Main component for class transfer functionality
- Handles timetable crawling and caching
- Manages class selection and transfer operations
- Fetches notifications from remote JSON

### 3.2 RegisterCourse.tsx
- Component for course registration
- Similar structure to App.tsx but for registration flow
- Handles group selection and registration

### 3.3 Timetable.tsx
- Displays class schedule in a grid format
- Supports filtering by lecturer, class ID, student count
- Handles class click events for transfer

### 3.4 FilterSection.tsx
- Filter controls for lecturer, class, and slots
- Weekday exclusion filters
- Student count threshold filter

### 3.5 Header.tsx
- Action buttons (Refresh, Get Student Count)
- Links to lecturer review sheet
- Loading state indicators

### 3.6 Utils.ts
- `mapToObject` / `objectToMap`: Data structure conversions
- `textToColor`: Generate colors from text
- `getClassKey`: Extract class keys from DOM
- `send`: Form submission helper
- `getCurrentSubjects`: Fetch current subjects
- `getCurrentStatus`: Fetch class status/count
- `handleDownload`: Export class list to file
- `cleanTimetable`: DOM cleanup utilities

---

## 4. Data Flow

### 4.1 Initialization
1. Extension injects content script on FAP pages
2. React app mounts and reads current page data
3. Fetches notification JSON from GitHub Pages
4. Crawls class timetable data via POST requests
5. Caches data in localStorage (24-hour expiry)

### 4.2 Class Transfer Flow
1. User views timetable grid
2. User clicks on desired class
3. Confirmation dialog shown
4. POST request sent to FAP server
5. Response parsed for success/error
6. Page reloaded on success

### 4.3 Data Sources
- **Timetable Data:** Crawled from FAP server
- **Notifications:** `noti.json` (GitHub Pages hosted)
- **Department Mapping:** `dept.json` (GitHub Pages hosted)

---

## 5. External Dependencies

### 5.1 Remote Data URLs (to be updated)
- `https://ruskicoder.github.io/fap-moveout/noti.json`
- `https://ruskicoder.github.io/fap-moveout/dept.json`

### 5.2 External Links
- Lecturer Review: Google Sheets document
- Chrome Web Store: Extension page

---

## 6. Storage

### 6.1 LocalStorage
- `{subject}`: Cached timetable data per subject
- `expireAt`: Cache expiration timestamp (24 hours)

### 6.2 Chrome Storage
- `clientId`: Unique client identifier (analytics - to be removed)

---

## 7. Security Considerations

- Extension only operates on FAP domain
- No sensitive data transmitted externally
- Form submissions use same-origin requests
- LocalStorage for caching only

---

## 8. Removed Components

### 8.1 Tracking (Removed)
- Previously sent analytics to Cloudflare Workers endpoint
- `sendTrackingEvent()` function - now a no-op
- Client ID generation - no longer needed

### 8.2 Original Author Credits (Replaced)
- All references to original author replaced with ruskicoder
- Contact links updated to github.com/ruskicoder
