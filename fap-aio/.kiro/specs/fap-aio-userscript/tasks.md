# Implementation Tasks: FAP-AIO Tampermonkey Userscript Conversion

## Phase 0: Preparation and Cheerio Elimination (CRITICAL PREREQUISITE)

- [x] 0.1 Create DOM Parser Utilities
  - Create `src/userscript/utils/dom-parser.ts` with helper functions.
  - Implement `parseHTML(htmlString): Document` using DOMParser.
  - Implement `parseHTMLFragment(htmlString): Element | null` for single elements.
  - Implement `getText(element): string` for safe text extraction with trim.
  - Implement `getAttr(element, attr): string` for safe attribute access.
  - Implement `query(selector, context): Element | null` wrapper.
  - Implement `queryAll(selector, context): Element[]` returning array not NodeList.
  - Add TypeScript interfaces for all utility functions.
  - Write unit tests or manual test cases for each utility.
  - _Requirements: 3.1, 3.2, 3.3, 3.7_

- [x] 0.2 Refactor GPA Module to Remove Cheerio
  - Review all Cheerio usage in `src/contentScript/features/gpa/` (App.tsx, utils.ts, components).
  - Identify every `cheerio.load()`, `$()`, `.find()`, `.text()`, `.attr()` call.
  - Replace with DOM parser utilities from 0.1.
  - Update transcript table parsing logic to use native DOM traversal.
  - Update grade extraction to use `querySelector` and `textContent`.
  - Test GPA calculation with real transcript page data.
  - Verify semester grouping, GPA calculation, and edit functionality work identically.
  - Verify no Cheerio imports remain in GPA module.
  - _Requirements: 3.4, 3.6, 3.9, 12.3, 12.10_

- [x] 0.3 Refactor MoveOut Module to Remove Cheerio
  - Review all Cheerio usage in `src/contentScript/features/moveout/` (App.tsx, utils.ts, components).
  - Identify every HTML parsing operation for class data responses.
  - Replace with DOM parser utilities from 0.1.
  - Update timetable data extraction to parse HTML responses with DOMParser.
  - Update class slot parsing (lecturer, room, time) to use native DOM methods.
  - Test with real FAP Courses page responses.
  - Verify timetable display, filtering, and class switching work identically.
  - Verify no Cheerio imports remain in MoveOut module.
  - _Requirements: 3.5, 3.6, 3.9, 13.3, 13.10, 13.11_

- [x] 0.4 Remove Cheerio Dependency from Project
  - Run `npm uninstall cheerio` to remove package.
  - Verify package.json no longer lists cheerio in dependencies.
  - Run `npm run build` for extension to ensure no build errors.
  - Test all features in extension build to confirm functionality preserved.
  - Commit changes with message: "refactor: replace Cheerio with native DOM APIs".
  - _Requirements: 3.8, 3.9_

- [x] 0.5 Centralize Storage Operations
  - Review all `localStorage.getItem/setItem` calls across features.
  - Create shared storage utility if not exists: `src/contentScript/shared/storage.ts`.
  - Refactor GPA module to use shared storage utility.
  - Refactor MoveOut module to use shared storage utility.
  - Refactor Scheduler module to use shared storage utility.
  - Ensure storage operations use consistent key naming (fap-aio: prefix).
  - Test that all storage operations still work in extension.
  - _Requirements: 4.8 (preparation for adapter migration)_

## Phase 1: Project Setup and Adapter Layer

- [ ] 1. Create Userscript Directory Structure
  - Userscript implementation is located at `userscript/fap-aio/` in repository root.
  - Create `userscript/fap-aio/src/` directory with subdirectories for adapters and main entry point.
  - Create `userscript/fap-aio/scripts/` directory for build utilities.
  - Set up build configuration: `vite.userscript.config.ts` and `userscript.config.ts`.
  - Create `userscript/fap-aio/dist/` output directory for compiled userscript.
  - _Requirements: 2.1, 9.1, 9.2_

- [ ] 1.1 Implement Metadata Block Generator
  - Create `userscript/fap-aio/scripts/generate-metadata.ts` with metadata interface definition.
  - Implement `generateMetadataBlock()` function that formats all userscript directives.
  - Define default metadata configuration with @name, @namespace, @version, @match, @grant, @require, @connect, @run-at, @updateURL, @downloadURL.
  - Read version from package.json dynamically during build.
  - Ensure proper formatting with `// ==UserScript==` and `// ==/UserScript==` delimiters.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.8_

- [ ] 1.2 Implement Storage Adapter
  - Create `userscript/fap-aio/src/adapters/storage.adapter.ts` with StorageAdapter interface.
  - Implement GMStorageAdapter class that detects GM_setValue availability.
  - Implement `get()` method with GM_getValue and localStorage fallback.
  - Implement `set()` method with GM_setValue and localStorage fallback.
  - Implement `remove()` method with GM_deleteValue and localStorage.removeItem.
  - Implement `clear()` method to remove all prefixed keys.
  - Implement `isExpired()` method for cache expiration checks.
  - Add error handling and console warnings for storage failures.
  - Export singleton instance for use across features.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 1.3 Implement HTTP Adapter
  - Create `userscript/fap-aio/src/adapters/http.adapter.ts` with request interfaces.
  - Implement HTTPAdapter class that detects GM_xmlhttpRequest availability.
  - Implement `gmRequest()` private method for GM_xmlhttpRequest calls.
  - Implement `fetchRequest()` private method as fallback using standard fetch.
  - Implement `request()` method that routes to GM or fetch based on availability.
  - Implement `get()` and `post()` convenience methods.
  - Implement header parsing from GM response format.
  - Add error handling for network failures, timeouts, and parse errors.
  - Export singleton instance for use across features.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [ ] 1.4 Implement Style Adapter
  - Create `userscript/fap-aio/src/adapters/style.adapter.ts` with StyleAdapter class.
  - Implement detection for GM_addStyle availability.
  - Implement `inject()` method that uses GM_addStyle or creates <style> elements.
  - Implement duplicate injection prevention with Set tracking.
  - Implement `remove()` method for cleaning up injected styles.
  - Add console warnings when falling back to non-GM methods.
  - Export singleton instance for use across features.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

## Phase 2: Main Entry Point and Routing

- [ ] 2.1 Implement Main Entry Point
  - Create `userscript/fap-aio/src/main.ts` as the userscript entry file.
  - Wrap all code in IIFE (Immediately Invoked Function Expression) for scope isolation.
  - Implement duplicate initialization guard using window.__FAP_AIO_LOADED__.
  - Implement `waitForReact()` function to wait for React and ReactDOM from CDN.
  - Import userstyle.css and tailwind.css as inline strings.
  - Implement `init()` async function that orchestrates initialization.
  - Inject global styles immediately using styleAdapter.
  - Wait for React availability with 5-second timeout.
  - Call router after DOM ready or immediately if already loaded.
  - Add comprehensive error handling and logging.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.7, 8.8_

- [ ] 2.2 Implement Feature Router
  - Create `userscript/fap-aio/src/router.ts` with routeToFeature function.
  - Accept storage, http, and style adapters as parameters.
  - Check window.location.href for URL patterns.
  - Call dom.enhanceUI() for all FAP pages (back button, title link).
  - Route to initGPA() for StudentTranscript.aspx.
  - Route to initMoveOut() for Courses.aspx and MoveSubject.aspx.
  - Route to initScheduler() for ScheduleExams.aspx and ScheduleOfWeek.aspx.
  - Add logging for which feature is being loaded.
  - _Requirements: 8.4, 8.5, 8.6_

## Phase 3: Build System Configuration

- [ ] 3.1 Configure Vite for Userscript Build
  - Create `vite.userscript.config.ts` extending base Vite config.
  - Configure React plugin for JSX transformation.
  - Set build.lib with entry point `src/userscript/main.ts`.
  - Set output format to IIFE (Immediately Invoked Function Expression).
  - Set output filename to `fap-aio.user.js`.
  - Configure external dependencies: 'react' and 'react-dom'.
  - Map externals to globals: React and ReactDOM (loaded via @require).
  - Disable 'use strict' in banner (handled by userscript metadata).
  - Set minify to false for readability or 'terser' for production.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 3.2 Implement Vite Plugin for Metadata Injection
  - Create custom Vite plugin `userscript-metadata` in vite config.
  - Hook into `generateBundle` lifecycle.
  - Find the main entry chunk in the bundle.
  - Read version from package.json.
  - Call generateMetadataBlock() with configuration.
  - Prepend metadata block to the beginning of the chunk code.
  - Validate metadata block formatting.
  - _Requirements: 9.3, 9.8, 9.9_

- [ ] 3.3 Implement Vite Plugin for CSS to String Transformation
  - Create custom Vite plugin `css-to-string` in vite config.
  - Hook into `transform` lifecycle.
  - Detect CSS file imports with `?inline` or `.css` extension.
  - Transform CSS content into JavaScript string export.
  - Return transformed code with `export default ${JSON.stringify(code)}`.
  - _Requirements: 2.6, 9.9_

- [ ] 3.4 Create Build Scripts and NPM Commands
  - Add `build:userscript` script to userscript/fap-aio/package.json: `vite build --config vite.userscript.config.ts`.
  - Add `dev:userscript` script for development builds with watch mode.
  - Update .gitignore to include `dist/` output directory.
  - Create README section explaining userscript build process.
  - _Requirements: 9.7_

## Phase 4: Feature Module Adaptations

- [ ] 4.1 Update GPA Calculator for Userscript
  - Review `src/contentScript/features/gpa/` for extension-specific code.
  - Ensure storage operations use the storage adapter (already using shared storage from Phase 0.5).
  - Verify DOM parsing utilities work correctly (already migrated from Cheerio in Phase 0.2).
  - Test GPA calculation logic with real transcript data - verify identical results to extension.
  - Test transcript table parsing with various course structures and grade formats.
  - Ensure non-GPA exclusion list persists using storage adapter.
  - Verify UI injection into StudentTranscript page works without chrome APIs.
  - Test edit/save/reset functionality matches extension behavior.
  - Compare side-by-side: extension vs userscript for multiple transcripts.
  - _Requirements: 3.9, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [ ] 4.2 Update MoveOut Tool for Userscript
  - Review `src/contentScript/features/moveout/` for network requests.
  - Ensure DOM parsing utilities work correctly (already migrated from Cheerio in Phase 0.3).
  - Replace fetch calls with http adapter for class data fetching.
  - Replace fetch for GitHub Pages notifications with http adapter.
  - Update form submission logic to use http.post() with GM_xmlhttpRequest.
  - Ensure timetable caching uses storage adapter (already using shared storage from Phase 0.5).
  - Test HTML response parsing from FAP Courses page matches extension behavior.
  - Test class slot extraction (lecturer, room, time) produces identical output.
  - Verify React components for timetable grid work without chrome APIs.
  - Test filter functionality and class switching work identically to extension.
  - Ensure RegisterCourse component works on Courses.aspx.
  - _Requirements: 3.9, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [ ] 4.3 Update Scheduler for Userscript
  - Review `src/contentScript/features/scheduler/` for network requests.
  - Ensure storage operations use the storage adapter (already using shared storage from Phase 0.5).
  - Verify ICS generation logic remains unchanged (no network dependencies).
  - Test floating panel UI injection works without chrome APIs.
  - Verify panel dragging, minimizing, and closing functionality.
  - Test exam schedule parsing and rendering.
  - Test weekly schedule parsing with semester sync.
  - Ensure online/offline class categorization (ending with 'c') works.
  - Verify ICS file download triggers work in userscript context.
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [ ] 4.4 Verify Userstyle Injection
  - Ensure `src/styles/userstyle.css` is imported as inline string in main.ts.
  - Verify styleAdapter.inject() is called with userstyle CSS on init.
  - Test that dark theme applies immediately on page load (@run-at document-start).
  - Verify no flash of unstyled content (FOUC) occurs.
  - Ensure Tailwind CSS is also injected as inline string.
  - Test that all FAP pages receive the dark theme styling.
  - Verify CSS specificity ensures userscript styles override page styles.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

## Phase 5: Error Handling and Compatibility

- [ ] 5.1 Implement Error Boundaries for React Components
  - Create ErrorBoundary component in `src/userscript/components/ErrorBoundary.tsx`.
  - Implement getDerivedStateFromError lifecycle method.
  - Implement componentDidCatch to log errors to console.
  - Create fallback UI displaying error message.
  - Wrap GPA, MoveOut, and Scheduler React components with ErrorBoundary.
  - _Requirements: 15.6_

- [ ] 5.2 Add Graceful Degradation for Missing GM APIs
  - In each adapter, add console warnings when GM APIs unavailable.
  - Implement fallback logic: localStorage for storage, fetch for HTTP, createElement for styles.
  - Test functionality with GM APIs disabled (e.g., Greasemonkey without full support).
  - Add user-facing notifications when features are limited.
  - Document limited functionality scenarios in README.
  - _Requirements: 3.5, 7.3, 15.3, 16.3_

- [ ] 5.3 Implement Comprehensive Logging
  - Add console.info logs for initialization steps.
  - Add console.warn logs for fallback scenarios and missing dependencies.
  - Add console.error logs for critical failures with stack traces.
  - Implement debug mode flag (e.g., check localStorage for 'fap-aio:debug').
  - Add verbose logging when debug mode is enabled.
  - Log feature loading, storage operations, and network requests in debug mode.
  - _Requirements: 16.1, 16.2, 16.4, 16.5, 16.8_

- [ ] 5.4 Test Cross-Browser Userscript Manager Compatibility
  - Install and test in Tampermonkey on Chrome.
  - Install and test in Tampermonkey on Firefox.
  - Install and test in Violentmonkey on Chrome.
  - Install and test in Violentmonkey on Firefox.
  - Install and test in Greasemonkey on Firefox (with expected limitations).
  - Test on Edge and Safari if possible.
  - Verify @grant permissions work across all managers.
  - Document known compatibility issues in README.
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

## Phase 6: Deployment and Distribution

- [ ] 6.1 Set Up GitHub Pages Hosting
  - Create `gh-pages` branch or configure Pages to serve from main branch `/dist`.
  - Ensure `dist/fap-aio.user.js` is committed and pushed.
  - Verify raw file is accessible at `https://ruskicoder.github.io/fap-aio/fap-aio.user.js`.
  - Test that clicking the raw URL triggers Tampermonkey installation prompt.
  - _Requirements: 10.1, 10.6_

- [ ] 6.2 Create GitHub Actions Workflow for Auto-Deployment
  - Create `.github/workflows/deploy-userscript.yml`.
  - Configure workflow to trigger on push to main branch and version tags.
  - Set up Node.js environment (version 18 or latest LTS).
  - Install dependencies with `npm install`.
  - Build userscript with `npm run build:userscript`.
  - Deploy to GitHub Pages using `peaceiris/actions-gh-pages@v3`.
  - Configure `keep_files: true` to preserve other gh-pages content.
  - _Requirements: 10.6_

- [ ] 6.3 Implement Auto-Update Mechanism
  - Ensure @updateURL and @downloadURL point to GitHub Pages raw file.
  - Verify @version in metadata block is read from package.json.
  - Test version increment: bump version in package.json, rebuild, deploy.
  - Verify Tampermonkey detects new version and prompts for update.
  - Test that auto-update preserves user data (storage remains intact).
  - Document update process in README.
  - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.7, 10.8_

- [ ] 6.4 Create Installation and Usage Documentation
  - Write README section for userscript installation.
  - Include direct installation link to GitHub Pages raw file.
  - Document required userscript manager (Tampermonkey recommended).
  - List supported browsers and userscript managers.
  - Provide troubleshooting section for common issues.
  - Document how to enable debug mode for verbose logging.
  - Create FAQ for userscript-specific questions.
  - Add screenshots or GIFs demonstrating installation process.
  - _Requirements: NFR 3.2_

## Phase 7: Testing and Validation

- [ ] 7.1 Manual Testing on All FAP Pages
  - Test dark theme application on main FAP portal page.
  - Test GPA calculator on StudentTranscript.aspx (load, calculate, edit, reset).
  - Test MoveOut on Courses.aspx and MoveSubject.aspx (load timetable, filter, switch class).
  - Test Scheduler on ScheduleExams.aspx (sync, categorize, export ICS).
  - Test Scheduler on ScheduleOfWeek.aspx (sync current week, sync semester, export ICS).
  - Verify online/offline class separation (classes ending with 'c').
  - Test RegisterCourse component on RegisterCourse.aspx.
  - _Requirements: All feature requirements (12.*, 13.*, 14.*, 15.*)_

- [ ] 7.2 Validate Cheerio Replacement (Critical Feature Parity Test)
  - **GPA Module Validation**:
    - Compare GPA calculation results: extension vs userscript for same transcript.
    - Test with transcripts containing special characters, long course names, various grade types.
    - Verify semester grouping logic produces identical output.
    - Test course exclusion logic (non-GPA courses) matches extension behavior.
    - Verify edit/save/reset functionality works identically.
  - **MoveOut Module Validation**:
    - Compare timetable parsing: extension vs userscript for same Courses page response.
    - Verify class slot extraction (lecturer, room, time) produces identical data structures.
    - Test with various HTML response formats from FAP (different semesters).
    - Verify filter logic works identically after parsing.
    - Test class switching form submission produces same requests.
  - **Error Handling**:
    - Verify DOM parser utilities handle malformed HTML gracefully.
    - Test with missing table elements, unexpected HTML structure.
    - Ensure error messages match extension quality (user-friendly, actionable).
  - _Requirements: 3.9, 12.3, 12.4, 12.8, 12.10, 13.3, 13.10, 13.11_

- [ ] 7.3 Test Storage Persistence
  - Sync exam schedule, reload page, verify schedule persists.
  - Sync weekly schedule, reload page, verify schedule persists.
  - Update GPA exclusion list, reload page, verify list persists.
  - Cache MoveOut timetable, reload page, verify cache used.
  - Test storage clear (reset button), verify all data removed.
  - Test storage expiration (24-hour cache for MoveOut).
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 12.6, 12.7, 13.7_

- [ ] 7.4 Test Network Requests
  - Test MoveOut fetching class data (verify GM_xmlhttpRequest or fetch fallback).
  - Test MoveOut fetching GitHub Pages notifications.
  - Test class switching form submission.
  - Test error handling for failed requests (timeout, network error).
  - Verify @connect whitelist allows requests to fap.fpt.edu.vn and ruskicoder.github.io.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 13.2, 13.3, 13.5, 13.8_

- [ ] 7.5 Test File Downloads
  - Test exam schedule ICS download (verify file downloads correctly).
  - Test weekly schedule ICS download for offline classes.
  - Test weekly schedule ICS download for online classes.
  - Verify ICS files are RFC 5545 compliant (open in calendar app).
  - Verify alarms/reminders are included in ICS events.
  - Test MoveOut "Download list" functionality if implemented.
  - _Requirements: 14.6, 14.7_

- [ ] 7.6 Test Error Scenarios
  - Test with React not loaded from CDN (timeout scenario).
  - Test with GM APIs disabled (fallback to localStorage, fetch, createElement).
  - Test with network offline (verify error messages displayed).
  - Test with invalid FAP page structure (verify error boundaries catch failures).
  - Test with multiple userscripts installed (verify no conflicts).
  - Verify duplicate initialization guard works.
  - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.6, 16.7, 16.8_

## Phase 8: Migration and Documentation

- [ ] 8.1 Create Migration Guide for Extension Users
  - Document steps to uninstall browser extension.
  - Document steps to install userscript.
  - Explain data migration: userscript reads localStorage from extension, migrates to GM storage.
  - Provide comparison table: extension vs userscript features.
  - Address common questions: "Why switch?" "What are the differences?"
  - _Requirements: NFR 3.2_

- [ ] 8.2 Create Developer Documentation
  - Document build process: how to build userscript from source.
  - Document adapter layer: how to use storage, http, and style adapters.
  - Document how to add new features to the userscript.
  - Document testing procedures: manual testing checklist.
  - Document deployment process: GitHub Actions workflow.
  - Provide contributing guidelines for community PRs.
  - _Requirements: NFR 2.2, NFR 2.3, NFR 2.4_

- [ ] 8.3 Create Changelog and Version History
  - Initialize CHANGELOG.md with version 1.0.0 as first userscript release.
  - Follow Keep a Changelog format (Added, Changed, Deprecated, Removed, Fixed, Security).
  - Document what's different from extension version.
  - Set up semantic versioning strategy (MAJOR.MINOR.PATCH).
  - Document version bumping process for releases.
  - _Requirements: NFR 3.3_

- [ ] 8.4 Update Main README
  - Add prominent section about userscript version.
  - Add installation badges for extension and userscript.
  - Update feature list to note compatibility with both versions.
  - Add links to userscript-specific documentation.
  - Update screenshots to show both extension and userscript.
  - _Requirements: NFR 3.2_

## Phase 9: Optimization and Polish

- [ ] 9.1 Optimize Bundle Size
  - Analyze bundle size with Rollup visualizer plugin.
  - Identify large dependencies and consider alternatives.
  - Ensure tree shaking removes unused code.
  - Verify React and ReactDOM are external (loaded via CDN, not bundled).
  - Consider lazy loading non-critical features if bundle > 500KB.
  - Test gzipped size (target < 150KB).
  - _Requirements: NFR 1.3_

- [ ] 9.2 Optimize Runtime Performance
  - Profile page load time with and without userscript.
  - Ensure userscript initialization < 200ms.
  - Verify no significant CPU overhead (< 5%).
  - Optimize React component rendering (useMemo, useCallback where needed).
  - Debounce/throttle event handlers (scroll, resize) if any.
  - Cache DOM selectors to avoid repeated queries.
  - _Requirements: NFR 1.1, NFR 1.2, NFR 1.4_

- [ ] 9.3 Add User Notifications and Feedback
  - Implement toast notifications for success/error messages.
  - Add loading indicators for long operations (semester sync, class fetching).
  - Display progress bars for multi-step operations.
  - Show confirmation dialogs before destructive actions (reset, class switch).
  - Provide feedback when features are running in limited mode (GM APIs unavailable).
  - _Requirements: 16.2, 16.4_

- [ ] 9.4 Implement Debug Mode
  - Check for `fap-aio:debug` flag in localStorage on init.
  - Enable verbose logging when debug mode is active.
  - Log all storage operations, network requests, and feature initializations.
  - Add console command to enable/disable debug mode (e.g., `FAP_AIO.debug(true)`).
  - Document debug mode in troubleshooting section of README.
  - _Requirements: 16.4_

## Phase 10: Release and Maintenance

- [ ] 10.1 Prepare Initial Release (v1.0.0)
  - Complete all testing phases and fix critical bugs.
  - Finalize documentation (README, CHANGELOG, developer docs).
  - Tag release in Git: `git tag v1.0.0`.
  - Push tag to trigger GitHub Actions deployment: `git push origin v1.0.0`.
  - Verify userscript is deployed to GitHub Pages.
  - Test installation from production URL.
  - _Requirements: 10.8_

- [ ] 10.2 Monitor Initial Adoption
  - Monitor GitHub Issues for bug reports from early users.
  - Track installation count if possible (GitHub traffic stats).
  - Gather feedback on Discord/Reddit/community forums.
  - Create issue templates for bug reports and feature requests.
  - _Requirements: NFR 3.3_

- [ ] 10.3 Plan Future Enhancements
  - Create GitHub Projects board for planned features.
  - Consider implementing settings UI as in-page modal.
  - Evaluate multi-language support (i18n for English/Vietnamese).
  - Research possibility of cloud sync for settings (user's own storage).
  - Explore direct calendar integration (Google Calendar API with user auth).
  - Consider browser notification integration for exam reminders.
  - _Requirements: Future enhancements from design doc_

- [ ] 10.4 Set Up Continuous Maintenance
  - Schedule monthly reviews of open issues.
  - Monitor Tampermonkey/Violentmonkey updates for API changes.
  - Test against FAP portal updates (check if DOM structure changes).
  - Keep dependencies up to date (React, build tools).
  - Maintain compatibility with new browser versions.
  - _Requirements: NFR 2.4_

---

## Completion Checklist Summary

### Must-Have for v1.0.0 Release:
- [x] Phase 1: Adapter layer (storage, HTTP, style)
- [x] Phase 2: Main entry point and routing
- [x] Phase 3: Build system configuration
- [x] Phase 4: Feature module adaptations
- [x] Phase 5: Error handling and compatibility testing
- [x] Phase 6: Deployment to GitHub Pages
- [x] Phase 7: Comprehensive manual testing
- [x] Phase 8: Documentation (installation, migration, developer guide)

### Nice-to-Have for Post-v1.0.0:
- [ ] Phase 9: Performance optimization (can optimize in v1.1.0)
- [ ] Phase 10: Long-term maintenance and enhancements (ongoing)

### Success Criteria:
1. Single .user.js file installable via Tampermonkey
2. All four features (GPA, MoveOut, Scheduler, Userstyle) work identically to extension
3. Storage persists across page reloads
4. Auto-update mechanism works
5. Works on Tampermonkey and Violentmonkey (Chrome, Firefox, Edge)
6. Comprehensive documentation for users and developers
7. No critical bugs in manual testing
8. Bundle size < 500KB uncompressed, < 150KB gzipped
