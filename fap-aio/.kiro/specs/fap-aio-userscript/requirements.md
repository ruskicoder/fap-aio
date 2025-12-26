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
4. WHEN the script needs updates THEN it SHALL include @updateURL and @downloadURL pointing to the hosted raw file
5. WHEN dependencies are needed THEN the userscript SHALL use @require to load React, ReactDOM, and other libraries from CDN
6. WHEN defining execution timing THEN the userscript SHALL use @run-at document-start to inject styles early and prevent FOUC
7. IF external resources are required THEN the userscript SHALL use @resource to define external files
8. WHEN connecting to external services THEN the userscript SHALL use @connect to whitelist domains (e.g., ruskicoder.github.io for notifications)

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
7. WHEN versioning THEN the userscript SHALL use semantic versioning (e.g., 1.0.0, 1.1.0, 2.0.0)
8. WHEN bundling THEN the target size SHALL be optimized (< 400KB uncompressed, < 100KB gzipped) for reasonable load times

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
8. WHEN using namespaced keys THEN the userscript SHALL maintain the same key naming convention as the extension (fap-aio:*)

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
