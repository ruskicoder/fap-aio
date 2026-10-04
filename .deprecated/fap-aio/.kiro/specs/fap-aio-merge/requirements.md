# Requirements Document: FAP-AIO Extension

## Introduction

FAP-AIO (FPT Academic Portal - All In One) is a unified browser extension that merges multiple standalone extensions designed for FPT University's Academic Portal (FAP). The goal is to consolidate the following extensions into a single, cohesive extension:

1. **FAP-GPA**: GPA calculation and grade visualization on the Student Transcript page
2. **FAP-MoveOut**: Class switching/moving tool with timetable visualization on the Courses page
3. **FAP-Scheduler**: Exam and weekly schedule export to .ics calendar files
4. **FAP-Userstyle**: Dark mode UI enhancement (AMOLED black theme) for all FAP pages

The merged extension maintains each feature's original behavior and UI approach while sharing a common codebase, styling framework (Tailwind CSS), and storage mechanism (localStorage). The extension is designed to be cross-browser compatible and future-proofed for potential conversion to a Tampermonkey userscript.

## Requirements

### Requirement 1: Userstyle CSS Injection

**User Story:** As a FAP user, I want a dark mode theme applied to all FAP pages, so that I have a consistent, eye-friendly browsing experience.

#### Acceptance Criteria

1. WHEN a user navigates to any page under `https://fap.fpt.edu.vn/` THEN the extension SHALL inject the userstyle CSS to apply the dark theme
2. WHILE the user is on any FAP page THEN the extension SHALL maintain the dark theme styling without flickering or delays
3. IF the userstyle CSS conflicts with page-specific feature styles THEN the feature styles SHALL take precedence
4. WHEN the page loads THEN the userstyle CSS SHALL be injected before the page renders to prevent flash of unstyled content (FOUC)

---

### Requirement 2: GPA Calculator (Student Transcript Page)

**User Story:** As a student, I want to calculate my semester and cumulative GPA from my transcript, so that I can track my academic performance.

#### Acceptance Criteria

1. WHEN the user navigates to `/Grade/StudentTranscript.aspx` THEN the extension SHALL inject the GPA calculator UI into the page
2. WHEN the page loads THEN the extension SHALL parse the grade table and extract subject codes, credits, grades, and status
3. WHEN the user clicks "Show GPA" THEN the extension SHALL display a table showing GPA per semester and cumulative GPA
4. WHEN the user clicks "Edit GPA" THEN the extension SHALL display an editable table to simulate grade changes
5. IF a subject code starts with a non-GPA prefix (OJS, VOV, GDQP, LAB, ENT, SSS, TMI, TRS, OTP) THEN the extension SHALL exclude it from GPA calculations
6. WHEN the user modifies a grade in the edit table THEN the extension SHALL recalculate and display the updated GPA in real-time
7. WHEN the user clicks "Reset" in the edit table THEN the extension SHALL restore the original grades from the transcript
8. WHEN the user modifies the non-GPA exclusion list THEN the extension SHALL persist the changes to localStorage
9. WHEN the page loads THEN the extension SHALL load any saved non-GPA exclusion list from localStorage
10. WHEN the edit GPA table is displayed THEN the extension SHALL provide a link to the SubjectFees page for credit lookup

---

### Requirement 3: Class Move-Out Tool (Courses Page)

**User Story:** As a student, I want to view and switch between available class slots, so that I can optimize my schedule.

#### Acceptance Criteria

1. WHEN the user navigates to `/FrontOffice/Courses.aspx` or `/FrontOffice/MoveSubject.aspx` with a subject ID THEN the extension SHALL inject the Move-Out UI
2. WHEN the page loads THEN the extension SHALL fetch and display a timetable grid showing all available class slots
3. WHILE fetching class data THEN the extension SHALL display loading progress (total/fetched count)
4. WHEN the user clicks on a class slot in the timetable THEN the extension SHALL prompt for confirmation before initiating the class switch
5. IF the class switch is successful THEN the extension SHALL display a success message and redirect to the new class
6. IF the class switch fails THEN the extension SHALL display the error message from FAP
7. WHEN the user clicks "Làm mới" (Refresh) THEN the extension SHALL clear cached data and re-fetch all class slots
8. WHEN the user applies filters (lecturer, class ID, slot, weekday) THEN the extension SHALL show/hide classes matching the filter criteria
9. WHEN the user fetches student count THEN the extension SHALL display the number of students per class
10. IF cached data exists and is not expired THEN the extension SHALL use cached data instead of re-fetching
11. WHEN the user selects a different subject from the move list THEN the extension SHALL navigate to that subject's move page
12. WHEN the MoveOut UI loads THEN the extension SHALL fetch notification/version data from GitHub Pages (`ruskicoder.github.io/fap-moveout/noti.json`)
13. IF the GitHub Pages fetch fails THEN the extension SHALL use fallback defaults and continue normally
14. WHEN cached timetable data is older than 24 hours THEN the extension SHALL treat it as expired and re-fetch
15. WHEN the user clicks on the lecturer review link THEN the extension SHALL open the external Google Sheet in a new tab
16. WHEN the user is on the course registration page (`/FrontOffice/RegisterCourse.aspx`) THEN the extension SHALL provide similar timetable visualization for group selection
17. WHEN the user applies the student count filter THEN the extension SHALL hide classes with more students than the specified maximum
18. WHEN the user clicks "Tải danh sách" (Download list) THEN the extension SHALL export the filtered class list to a downloadable format

---

### Requirement 4: Exam Schedule Sync & Export (Schedule Exams Page)

**User Story:** As a student, I want to sync and export my exam schedule to a calendar file, so that I can add exams to my personal calendar.

#### Acceptance Criteria

1. WHEN the user navigates to `/Exam/ScheduleExams.aspx` THEN the extension SHALL display a floating panel with the exam schedule UI
2. WHEN the user clicks "Đồng bộ lịch thi" (Sync exam schedule) THEN the extension SHALL parse the exam table and extract exam data
3. WHEN exams are synced THEN the extension SHALL categorize exams as "Upcoming" (future) or "Completed" (past)
4. WHEN exams are displayed THEN the extension SHALL show countdown badges (Today, Tomorrow, Urgent, X days)
5. WHEN exams are displayed THEN the extension SHALL show exam type tags (FE, PE, 2NDFE, 2NDPE)
6. WHEN the user clicks "Tải xuống lịch thi (.ics)" THEN the extension SHALL generate and download an RFC 5545 compliant .ics file
7. WHEN generating exam .ics files THEN the extension SHALL include a 1-day reminder alarm for each event
8. IF no exams are synced THEN the download button SHALL be disabled or show appropriate message
9. WHEN the user is already on the exam schedule page THEN the extension SHALL auto-sync the exam schedule on page load

---

### Requirement 5: Weekly Schedule Sync & Export (Schedule of Week Page)

**User Story:** As a student, I want to sync and export my weekly class schedule to calendar files, so that I can add classes to my personal calendar.

#### Acceptance Criteria

1. WHEN the user navigates to `/Report/ScheduleOfWeek.aspx` THEN the extension SHALL display a floating panel with the weekly schedule UI
2. WHEN the user clicks "Tuần này" (This week) THEN the extension SHALL parse the current week's schedule table
3. WHEN the user selects a semester and clicks "Cả học kỳ" (Entire semester) THEN the extension SHALL iterate through all weeks in the semester and sync each week's schedule
4. WHILE syncing entire semester THEN the extension SHALL display a progress bar showing weeks synced/total
5. WHEN classes are synced THEN the extension SHALL separate them into "Offline" and "Online" categories
6. IF a subject code ends with 'c' (e.g., PMG201c) THEN the extension SHALL classify it as an online class
7. WHEN the user clicks "Xuất Offline (.ics)" THEN the extension SHALL generate and download an .ics file for offline classes
8. WHEN the user clicks "Xuất Online (.ics)" THEN the extension SHALL generate and download an .ics file for online classes with Google Meet links
9. WHEN classes are displayed THEN the extension SHALL show attendance status (Attended, Absent, Not Yet)
10. WHEN synced data exists THEN the extension SHALL persist it in localStorage and reload on next visit
11. WHEN generating weekly schedule .ics files THEN the extension SHALL include a 15-minute reminder alarm for each class event
12. WHEN parsing the schedule THEN the extension SHALL use slot timing mappings (Slot 1-8) to determine class start/end times
13. WHEN the user is already on the weekly schedule page THEN the extension SHALL auto-sync the current week on page load
14. WHEN syncing semester THEN the extension SHALL change year dropdown if needed to match the selected semester

---

### Requirement 6: Floating Panel UI

**User Story:** As a user, I want a floating panel that provides access to scheduler features, so that I can interact with the extension without disrupting the page layout.

#### Acceptance Criteria

1. WHEN the user is on a scheduler-enabled page (exam or weekly schedule) THEN the extension SHALL display a floating panel on the right side
2. WHEN the panel is displayed THEN the user SHALL be able to drag it to a different position
3. WHEN the user clicks the minimize button THEN the panel SHALL collapse to show only the header
4. WHEN the user clicks the close button THEN the panel SHALL be hidden and a toggle button SHALL appear in the bottom-right corner
5. WHEN the user clicks the toggle button THEN the panel SHALL reappear
6. WHEN the user clicks the reset button THEN the extension SHALL clear all synced data from localStorage
7. WHILE the panel is open THEN the extension SHALL persist through FAP page navigation (SPA-like behavior)

---

### Requirement 7: Cross-Browser Compatibility

**User Story:** As a developer, I want the extension to work across multiple browsers, so that users can use it regardless of their browser choice.

#### Acceptance Criteria

1. WHEN developing features THEN the extension SHALL NOT use Chrome-exclusive APIs (e.g., chrome.sidePanel)
2. WHEN storing data THEN the extension SHALL use localStorage instead of chrome.storage.sync
3. WHEN the extension is built THEN it SHALL produce a Manifest V3 compatible package
4. WHEN DOM manipulation is required THEN the extension SHALL use standard Web APIs
5. IF browser-specific APIs are unavoidable THEN the extension SHALL implement graceful fallbacks

---

### Requirement 8: Data Storage & Caching

**User Story:** As a user, I want my synced schedules and settings to persist, so that I don't have to re-sync data on every visit.

#### Acceptance Criteria

1. WHEN schedule data is synced THEN the extension SHALL store it in localStorage with the domain context
2. WHEN cached data is loaded THEN the extension SHALL validate its expiration before using it
3. IF cached data is expired THEN the extension SHALL prompt or automatically re-fetch
4. WHEN the user clicks reset/clear THEN the extension SHALL remove all extension-related data from localStorage
5. WHEN storing data THEN the extension SHALL use namespaced keys to avoid conflicts with FAP's own localStorage usage

---

### Requirement 9: Styling Consistency

**User Story:** As a user, I want the extension's UI to match the dark theme, so that it feels integrated with the styled FAP pages.

#### Acceptance Criteria

1. WHEN extension UI components are rendered THEN they SHALL use Tailwind CSS for styling
2. WHEN extension UI is displayed THEN it SHALL follow the userstyle's color scheme (accent: #F36B16, dark backgrounds)
3. WHEN extension UI overlays FAP content THEN it SHALL have appropriate z-index to stay on top
4. WHEN Tailwind CSS is used THEN it SHALL be scoped/prefixed to avoid conflicts with FAP's existing styles

---

### Requirement 10: Error Handling & User Feedback

**User Story:** As a user, I want clear feedback when actions succeed or fail, so that I know the current state of my operations.

#### Acceptance Criteria

1. WHEN an operation succeeds THEN the extension SHALL display a success message or visual indicator
2. WHEN an operation fails THEN the extension SHALL display a user-friendly error message
3. WHEN network requests fail THEN the extension SHALL show appropriate error state and retry option
4. WHILE a long operation is running THEN the extension SHALL display loading indicators
5. IF FAP returns an error response THEN the extension SHALL parse and display the error message

---

## Non-Functional Requirements

### NFR 1: Performance

1. The extension SHALL inject content scripts only on relevant FAP pages (not all URLs)
2. The extension SHALL not significantly impact page load time (< 100ms overhead)
3. The extension SHALL use efficient DOM queries and minimize reflows

### NFR 2: Maintainability

1. The codebase SHALL be organized by feature modules
2. Shared utilities SHALL be extracted to common modules
3. TypeScript SHALL be used for type safety
4. The architecture SHALL facilitate future conversion to Tampermonkey userscript

### NFR 3: Security

1. The extension SHALL not collect or transmit user data externally (except optional notifications fetch)
2. The extension SHALL sanitize any content before injecting into the DOM
3. The extension SHALL only request necessary permissions in manifest

