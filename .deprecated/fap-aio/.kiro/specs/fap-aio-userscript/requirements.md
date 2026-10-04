# Requirements Document: FAP-AIO Tampermonkey Userscript Conversion

## Introduction

This specification defines the requirements for converting the FAP-AIO browser extension into a Tampermonkey userscript. The conversion maintains all existing functionality (GPA Calculator, MoveOut tool, Scheduler, and Userstyle) while adapting the architecture to work within the constraints and capabilities of the Tampermonkey/Greasemonkey environment.

Tampermonkey userscripts differ fundamentally from browser extensions:
- Single-file or multi-file JavaScript execution in page context
- No manifest.json; configuration via metadata block (@grant, @match, etc.)
- No background service workers or popup/options pages
- Limited to GM_* APIs and standard Web APIs
- Must bundle or externally load all dependencies (React, Cheerio, etc.)
- All UI must be injected into the page DOM

The conversion prioritizes:
- **Feature Parity**: All existing features work identically
- **Single Installation**: One userscript file or a main file with @require dependencies
- **Cross-Browser Userscript Managers**: Compatible with Tampermonkey, Violentmonkey, and Greasemonkey
- **Maintainability**: Shared codebase architecture where possible
- **User Experience**: Seamless installation and auto-updates via hosting

## Requirements

### Requirement 1: Userscript Metadata Block Configuration

**User Story:** As a userscript developer, I want to define all permissions, URLs, and dependencies in the metadata block, so that the userscript manager can configure the script correctly.

#### Acceptance Criteria

1. WHEN the userscript is loaded THEN it SHALL include a complete metadata block with @name, @namespace, @version, @description, @author
2. WHEN defining URL matching THEN the userscript SHALL use @match `https://fap.fpt.edu.vn/*` to inject on all FAP pages
3. WHEN using GM APIs THEN the userscript SHALL declare all required @grant permissions (GM_setValue, GM_getValue, GM_deleteValue, GM_addStyle, GM_xmlhttpRequest)
4. WHEN the script needs updates THEN it SHALL include @updateURL and @downloadURL pointing to the hosted raw file (https://ruskicoder.github.io/fap-aio/fap-aio.user.js)
5. WHEN dependencies are needed THEN the userscript SHALL use @require to load React@18 and ReactDOM@18 from CDN with major version lock
6. WHEN defining execution timing THEN the userscript SHALL use @run-at document-start to inject styles early and prevent FOUC
7. WHEN defining the icon THEN the userscript SHALL use @icon with base64-encoded favicon embedded directly in metadata (from image.txt)
8. WHEN connecting to external services THEN the userscript SHALL use @connect to whitelist domains (fap.fpt.edu.vn, ruskicoder.github.io)

---

### Requirement 2: Single-File Bundle with Dependency Management

**User Story:** As a user, I want to install a single userscript file that includes all necessary code, so that installation is simple and straightforward.

#### Acceptance Criteria

1. WHEN building the userscript THEN the build process SHALL produce a single .user.js file containing all application code
2. WHEN bundling dependencies THEN the build SHALL inline all TypeScript/React code compiled to JavaScript
3. IF dependencies are too large to inline THEN the userscript SHALL load them via @require from trusted CDNs (unpkg, jsdelivr, cdnjs)
4. WHEN loading external libraries THEN the userscript SHALL verify React and ReactDOM are available before execution
5. WHEN defining CSS THEN all styles SHALL be inlined within the .user.js file as strings
6. WHEN the file is saved with .user.js extension THEN Tampermonkey SHALL recognize it as installable
7. WHEN versioning THEN the userscript SHALL use semantic versioning starting at 0.0.1 for initial development, incrementing to 1.0.0 for first stable release
8. WHEN bundling THEN the build SHALL optimize file size while prioritizing functionality (file size not critical, but should be minimized where practical)

---

### Requirement 3: Replace Cheerio with Native Browser APIs

**User Story:** As a developer, I want to replace server-side Cheerio dependency with browser-native DOM parsing, so that the userscript works without Node.js polyfills and has a smaller bundle size.

#### Acceptance Criteria

1. WHEN parsing HTML responses THEN the userscript SHALL use native DOMParser instead of Cheerio
2. WHEN querying parsed HTML THEN the userscript SHALL use standard DOM methods (querySelector, querySelectorAll)
3. WHEN extracting text content THEN the userscript SHALL use textContent or innerText properties
4. WHEN the GPA module parses transcript tables THEN it SHALL use native DOM traversal methods
5. WHEN the MoveOut module parses class data THEN it SHALL use DOMParser for HTML string parsing
6. WHEN replacing Cheerio THEN all existing functionality SHALL be preserved exactly
7. IF complex HTML parsing is required THEN the code SHALL create temporary DOM elements for manipulation
8. WHEN the conversion is complete THEN Cheerio SHALL be removed from package.json dependencies
9. WHEN testing THEN all features that previously used Cheerio SHALL work identically with native APIs

---

### Requirement 4: Storage Migration from chrome.storage to GM Storage

**User Story:** As a user, I want my synced schedules and settings to persist across sessions, so that I don't lose my data when the page reloads.

#### Acceptance Criteria

1. WHEN storing data THEN the userscript SHALL use GM_setValue instead of chrome.storage or localStorage
2. WHEN retrieving data THEN the userscript SHALL use GM_getValue instead of chrome.storage or localStorage
3. WHEN deleting data THEN the userscript SHALL use GM_deleteValue to remove stored values
4. WHEN migrating existing extension users THEN the userscript SHALL attempt to read from localStorage as fallback and migrate to GM storage
5. IF GM storage APIs are not available (Greasemonkey) THEN the userscript SHALL fallback to localStorage with appropriate error handling
6. WHEN storing complex data THEN the userscript SHALL serialize to JSON before storing and deserialize when retrieving
7. WHEN storage operations fail THEN the userscript SHALL handle errors gracefully and notify the user
8. WHEN using namespaced keys THEN the storage adapter SHALL automatically add 'fap-aio:' prefix to all keys for maximum compatibility
9. WHEN features access storage THEN they SHALL pass simple key names (e.g., 'gpaConfig') and the adapter SHALL handle prefixing

---

### Requirement 5: CSS Injection via GM_addStyle

**User Story:** As a user, I want the dark mode theme applied to all FAP pages, so that I have a consistent browsing experience.

#### Acceptance Criteria

1. WHEN the userscript initializes THEN it SHALL inject the userstyle CSS using GM_addStyle
2. WHEN CSS is injected THEN it SHALL be applied before page render to prevent flash of unstyled content
3. WHEN feature-specific styles are needed THEN the userscript SHALL inject them using GM_addStyle in the appropriate feature module
4. IF GM_addStyle is not available THEN the userscript SHALL fallback to creating <style> elements in document.head
5. WHEN styles conflict with page styles THEN feature styles SHALL take precedence using appropriate specificity
6. WHEN Tailwind utility classes are needed THEN the compiled Tailwind CSS SHALL be inlined and injected
7. WHEN multiple style injections occur THEN the userscript SHALL ensure no duplicate style blocks are created
8. WHEN styles need updating dynamically THEN the userscript SHALL be able to inject additional styles at runtime

---

### Requirement 6: React and ReactDOM Integration

**User Story:** As a developer, I want to use React components for feature UIs, so that I can maintain the same component architecture as the extension.

#### Acceptance Criteria

1. WHEN the userscript loads THEN it SHALL load React and ReactDOM from CDN via @require or bundle them inline
2. WHEN React is loaded THEN the userscript SHALL verify window.React and window.ReactDOM are available
3. WHEN mounting React components THEN the userscript SHALL use ReactDOM.createRoot (React 18+) for concurrent features
4. WHEN creating React elements THEN the userscript SHALL use React.createElement or JSX transformed to createElement
5. IF the build includes JSX THEN the build process SHALL transpile JSX to React.createElement calls
6. WHEN unmounting components THEN the userscript SHALL properly cleanup to prevent memory leaks
7. WHEN React components need state THEN they SHALL use standard React hooks (useState, useEffect, etc.)
8. WHEN components are rendered THEN they SHALL inject into existing FAP page DOM without breaking page functionality

---

### Requirement 7: Removal of Extension-Specific Features

**User Story:** As a developer, I want to remove extension-only features that cannot work in userscripts, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. WHEN converting the codebase THEN the userscript SHALL NOT include background service worker code
2. WHEN converting the codebase THEN the userscript SHALL NOT include popup.html/popup.tsx functionality
3. WHEN converting the codebase THEN the userscript SHALL NOT include options.html/options.tsx functionality
4. WHEN converting the codebase THEN the userscript SHALL NOT include sidepanel, newtab, or devtools functionality
5. WHEN converting the codebase THEN the userscript SHALL NOT use chrome.* APIs
6. WHEN converting the codebase THEN the manifest.ts file SHALL be replaced with a metadata block
7. IF popup/options functionality is essential THEN it SHALL be reimplemented as in-page modals or settings panels
8. WHEN removing features THEN the core functionality (GPA, MoveOut, Scheduler, Userstyle) SHALL remain intact

---

### Requirement 8: Network Requests via GM_xmlhttpRequest

**User Story:** As a developer, I want to make cross-origin network requests for fetching class data and notifications, so that features like MoveOut can function properly.

#### Acceptance Criteria

1. WHEN making HTTP requests THEN the userscript SHALL use GM_xmlhttpRequest instead of fetch or XMLHttpRequest
2. WHEN requesting external resources THEN the userscript SHALL declare @connect with the target domains
3. WHEN GM_xmlhttpRequest is not available THEN the userscript SHALL fallback to standard fetch with CORS limitations
4. WHEN fetch operations fail THEN the userscript SHALL display appropriate error messages to the user
5. WHEN fetching GitHub Pages resources THEN the userscript SHALL whitelist ruskicoder.github.io via @connect
6. WHEN making requests THEN the userscript SHALL handle promise-based and callback-based patterns appropriately
7. WHEN requests timeout THEN the userscript SHALL implement retry logic or fail gracefully
8. WHEN handling responses THEN the userscript SHALL parse JSON and handle errors consistently

---

### Requirement 9: Content Script to Direct Execution Conversion

**User Story:** As a developer, I want all content script code to execute directly in the page context, so that the userscript can interact with page elements and variables.

#### Acceptance Criteria

1. WHEN the userscript executes THEN all code SHALL run in the page context without an isolated world
2. WHEN accessing page DOM THEN the userscript SHALL query and modify elements directly
3. WHEN defining global variables THEN the userscript SHALL avoid conflicts by using an IIFE or module pattern
4. WHEN feature modules initialize THEN they SHALL be called directly without message passing
5. WHEN routing to features THEN the routing logic SHALL check window.location.href directly
6. WHEN listening to page events THEN the userscript SHALL use standard addEventListener without chrome.runtime
7. WHEN the page loads THEN the userscript SHALL wait for DOM ready or use appropriate @run-at timing
8. WHEN multiple userscripts may be installed THEN the code SHALL check for duplicate initialization

---

### Requirement 10: Build System Configuration for Userscript Output

**User Story:** As a developer, I want a build process that compiles the TypeScript/React codebase into a single userscript file, so that distribution is automated.

#### Acceptance Criteria

1. WHEN building THEN the build process SHALL compile all TypeScript to ES5 or ES2015 JavaScript
2. WHEN bundling THEN the build SHALL use a module bundler (Vite, Rollup, or Webpack) to create a single output file
3. WHEN generating output THEN the build SHALL prepend the userscript metadata block at the top of the file
4. WHEN minifying THEN the build MAY minify code but SHALL preserve the metadata block formatting
5. WHEN building THEN the output file SHALL have .user.js extension for automatic Tampermonkey detection
6. WHEN development builds are created THEN source maps MAY be generated for debugging
7. WHEN production builds are created THEN the file SHALL be optimized and tree-shaken
8. WHEN building THEN the process SHALL validate the metadata block for required fields
9. WHEN CSS is bundled THEN it SHALL be converted to a JavaScript string for GM_addStyle injection

---

### Requirement 11: Auto-Update Mechanism via Hosted File

**User Story:** As a user, I want the userscript to automatically update when new versions are released, so that I always have the latest features and fixes.

#### Acceptance Criteria

1. WHEN the userscript is hosted THEN it SHALL be served as a raw .user.js file from GitHub Pages or raw GitHub URL
2. WHEN @updateURL is defined THEN it SHALL point to the hosted raw file location
3. WHEN @downloadURL is defined THEN it SHALL point to the same location as @updateURL
4. WHEN @version is incremented THEN Tampermonkey SHALL detect the update and prompt the user
5. WHEN auto-update is enabled THEN Tampermonkey SHALL automatically fetch and install new versions
6. WHEN hosting on GitHub THEN the repository SHALL use GitHub Actions to build and deploy to gh-pages
7. WHEN the update check occurs THEN Tampermonkey SHALL compare version numbers (semver)
8. WHEN updates are installed THEN existing user data SHALL be preserved

---

### Requirement 12: GPA Calculator Feature Preservation

**User Story:** As a student, I want the GPA calculator to work exactly as in the extension, so that I can calculate my academic performance.

#### Acceptance Criteria

1. WHEN on StudentTranscript.aspx THEN the userscript SHALL inject the GPA calculator UI
2. WHEN the UI is injected THEN it SHALL use React components for rendering
3. WHEN parsing transcript table THEN it SHALL use native DOM methods instead of Cheerio
4. WHEN calculating GPA THEN the logic SHALL match the extension's implementation exactly
5. WHEN displaying results THEN the UI SHALL show semester and cumulative GPA
6. WHEN editing grades THEN the simulation SHALL update in real-time
7. WHEN storing settings THEN the userscript SHALL use GM_setValue for non-GPA exclusion list
8. WHEN the page loads THEN cached settings SHALL be restored using GM_getValue
9. WHEN resetting THEN the userscript SHALL clear stored data and restore defaults
10. WHEN any GPA feature is used THEN it SHALL work identically to the extension with zero functional differences

---

### Requirement 13: MoveOut Tool Feature Preservation

**User Story:** As a student, I want the class switching tool to work exactly as in the extension, so that I can optimize my schedule.

#### Acceptance Criteria

1. WHEN on Courses.aspx or MoveSubject.aspx THEN the userscript SHALL inject the MoveOut UI
2. WHEN fetching class data THEN the userscript SHALL use GM_xmlhttpRequest for cross-origin requests
3. WHEN parsing HTML responses THEN the userscript SHALL use DOMParser instead of Cheerio
4. WHEN displaying timetable THEN the UI SHALL render the grid with React components
5. WHEN applying filters THEN the filtering logic SHALL match the extension exactly
6. WHEN switching classes THEN the userscript SHALL submit forms via GM_xmlhttpRequest
7. WHEN caching data THEN the userscript SHALL use GM_setValue with 24-hour expiration
8. WHEN fetching notifications THEN the userscript SHALL connect to GitHub Pages via @connect
9. WHEN downloading lists THEN the userscript SHALL generate and trigger downloads client-side
10. WHEN any MoveOut feature is used THEN it SHALL work identically to the extension with zero functional differences
11. WHEN parsing class slot information THEN native DOM methods SHALL extract all data correctly (lecturer, room, time)

---

### Requirement 14: Scheduler Feature Preservation

**User Story:** As a student, I want the exam and weekly schedule export to work exactly as in the extension, so that I can sync my calendar.

#### Acceptance Criteria

1. WHEN on ScheduleExams.aspx or ScheduleOfWeek.aspx THEN the userscript SHALL inject the scheduler panel
2. WHEN syncing schedules THEN the parsing logic SHALL match the extension exactly
3. WHEN generating ICS files THEN the output SHALL be RFC 5545 compliant
4. WHEN storing synced data THEN the userscript SHALL use GM_setValue
5. WHEN displaying the panel THEN it SHALL be draggable and minimizable
6. WHEN exporting calendars THEN the userscript SHALL trigger file downloads
7. WHEN syncing semester schedules THEN the progress tracking SHALL work correctly with page reloads
8. WHEN categorizing classes THEN online detection (ending with 'c') SHALL work
9. WHEN semester sync involves year changes THEN the year dropdown SHALL be updated and page reload handled correctly
10. WHEN resuming semester sync after page reload THEN state SHALL be restored from GM storage and sync SHALL continue
11. WHEN any Scheduler feature is used THEN it SHALL work identically to the extension with zero functional differences

---

### Requirement 15: Userstyle Dark Theme Preservation

**User Story:** As a user, I want the dark mode theme applied to all FAP pages, so that I have a consistent experience.

#### Acceptance Criteria

1. WHEN on any fap.fpt.edu.vn page THEN the userscript SHALL inject the userstyle CSS
2. WHEN CSS is injected THEN it SHALL be applied using GM_addStyle
3. WHEN the theme is applied THEN colors, spacing, and visual design SHALL match the extension
4. WHEN page elements load THEN there SHALL be no flash of unstyled content
5. WHEN feature-specific styles are needed THEN they SHALL be injected separately
6. WHEN styles conflict THEN the userscript's styles SHALL take precedence
7. WHEN Tailwind classes are used THEN the compiled CSS SHALL be included
8. WHEN the back button and title enhancements are rendered THEN they SHALL match the extension

---

### Requirement 16: Error Handling and Debugging

**User Story:** As a developer, I want comprehensive error handling and logging, so that issues can be diagnosed and fixed quickly.

#### Acceptance Criteria

1. WHEN errors occur THEN the userscript SHALL log them to console with descriptive messages
2. WHEN critical features fail THEN the userscript SHALL display user-friendly error notifications
3. WHEN GM APIs are unavailable THEN the userscript SHALL fallback gracefully and log warnings
4. WHEN debugging THEN the userscript SHALL include a debug mode flag that enables verbose logging
5. WHEN network requests fail THEN error messages SHALL indicate the specific operation that failed

---

### Requirement 17: Build-Time Module Substitution for Platform Abstraction

**User Story:** As a developer, I want the userscript to reuse extension features without code modifications, so that I maintain a unified codebase with minimal cross-affection.

#### Acceptance Criteria

1. WHEN extension features import shared modules THEN the userscript build SHALL redirect those imports to platform-specific implementations via Vite aliases
2. WHEN extension features import storage module THEN the userscript build SHALL substitute with a facade that matches the extension interface exactly
3. WHEN the storage facade is used THEN it SHALL support all extension methods: set<T>(key, value, ttlInMinutes?), get<T>(key), getRaw, setRaw, remove, removeRaw, clear, isExpired, setExpiry, getExpiry
4. WHEN the storage facade stores data THEN it SHALL use the StorageItem<T> wrapper format: { value: T, expiry?: number }
5. WHEN TTL is provided THEN the storage facade SHALL calculate expiry timestamp and store it in the wrapper
6. WHEN retrieving data THEN the storage facade SHALL check expiry, remove expired items, and unwrap the value
7. WHEN extension features use fetch() THEN the userscript SHALL inject a fetch polyfill at runtime that uses GM_xmlhttpRequest
8. WHEN the fetch polyfill is called THEN it SHALL return a Response-compatible object matching the native fetch API
9. WHEN extension features use ReactDOM.createRoot() THEN they SHALL continue using it directly (no mount utility requirement)
10. WHEN the userscript is built THEN Vite aliases SHALL redirect @/contentScript/shared/storage to the facade implementation
11. WHEN extension code is modified THEN the userscript build SHALL use the updated code without breaking (extension is source of truth)
12. WHEN userscript adapters break THEN the extension SHALL continue to build and function without issues (isolated failures)
13. WHEN the facade interface changes THEN it SHALL match the extension's storage interface to maintain compatibility
14. WHEN building THEN the output SHALL bundle the facade (not the extension's storage module)
15. WHEN features are executed THEN they SHALL use GM_setValue/GM_getValue via the facade (not localStorage)
16. WHEN fetch polyfill is injected THEN it SHALL be installed globally before any features load
6. WHEN React errors occur THEN error boundaries SHALL catch and display them appropriately
7. WHEN storage operations fail THEN the userscript SHALL retry or fallback to in-memory storage
8. WHEN initialization fails THEN the userscript SHALL prevent duplicate retries and log the failure

---

### Requirement 17: Cross-Browser Userscript Manager Compatibility

**User Story:** As a user, I want the userscript to work on different browsers and userscript managers, so that I have flexibility in my choice of tools.

#### Acceptance Criteria

1. WHEN installing in Tampermonkey THEN all features SHALL work without modifications
2. WHEN installing in Violentmonkey THEN all features SHALL work with same functionality
3. IF installing in Greasemonkey THEN core features SHALL work with appropriate fallbacks for missing GM APIs
4. WHEN using different browsers THEN the userscript SHALL work on Chrome, Firefox, Edge, and Safari
5. WHEN GM APIs differ between managers THEN the userscript SHALL detect and adapt accordingly
6. IF unsandboxed mode is needed THEN the metadata SHALL include @grant unsafeWindow appropriately
7. WHEN checking API availability THEN the userscript SHALL verify typeof GM_setValue !== 'undefined'
8. WHEN functionality is limited THEN the userscript SHALL inform the user of reduced capabilities

---

## Non-Functional Requirements

### NFR 1: Performance

1. The userscript SHALL load and execute within 300ms to avoid blocking page render
2. The userscript SHALL not significantly impact page performance (< 5% CPU overhead)
3. The bundled file size SHALL be optimized (target < 400KB uncompressed, < 100KB gzipped)
4. React components SHALL use efficient rendering patterns to minimize reflows
5. Cheerio replacement with native DOM SHALL reduce bundle size by at least 30KB

### NFR 2: Maintainability

1. The build configuration SHALL support both extension and userscript builds from shared code
2. Feature modules SHALL be architecture-agnostic where possible
3. Platform-specific code (extension vs userscript) SHALL be isolated in adapter layers
4. The codebase SHALL maintain clear separation between core logic and platform APIs

### NFR 3: Distribution

1. The userscript SHALL be hosted on GitHub Pages for automatic updates
2. A README SHALL provide installation instructions and feature documentation
3. The repository SHALL use semantic versioning and maintain a changelog
4. GitHub Actions SHALL automate the build and deployment process

### NFR 4: Security

1. The userscript SHALL only connect to trusted domains (@connect whitelist)
2. External dependencies SHALL be loaded from reputable CDNs with SRI if supported
3. User data SHALL be stored securely using GM storage APIs
4. The userscript SHALL not execute arbitrary code from external sources

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
