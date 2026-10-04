# Implementation Tasks: FAP-AIO Extension

## Phase 1: Project Setup & Core Infrastructure

- [x] 1.1 Initialize Project Structure and Configuration
  - Create a new Vite project using the React and TypeScript template.
  - Configure the build system to support Chrome Extension Manifest V3, ensuring proper output directory structure.
  - Set up TypeScript configuration with strict type checking and path aliases for cleaner imports.
  - Establish the directory structure as defined in the design document, creating folders for background scripts, content scripts, features, and shared utilities.
  - Install and configure Tailwind CSS with a specific prefix to prevent style conflicts with the host page.
  - Create the necessary PostCSS and Tailwind configuration files.
  - _Requirements: N/A (Infrastructure)_

- [x] 1.2 Implement Extension Manifest and Shared Utilities
  - Create the manifest configuration file defining permissions, host permissions for FAP domains, and content script registration.
  - Configure the manifest to inject styles at the start of document loading.
  - Implement a storage utility wrapper for localStorage that handles data persistence, retrieval, removal, and expiration with a namespace prefix.
  - Define shared TypeScript interfaces for common data structures used across modules.
  - Create a constants file containing global values such as slot times, alarm settings, and default configuration keys.
  - Implement DOM utility functions for common page manipulation tasks.
  - _Requirements: N/A (Infrastructure)_

## Phase 2: Userstyle & Content Script Router

- [x] 2.1 Implement Userstyle Injection
  - Migrate the existing dark theme CSS into the project.
  - Ensure all CSS variables for colors and themes are correctly defined.
  - Configure the extension to inject this CSS file into all FAP pages.
  - Implement logic to prevent multiple injections of the same style file.
  - Verify that the dark theme applies correctly to the FAP interface.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.2 Implement Content Script Routing Logic
  - Create the main entry point for the content script.
  - Implement a routing mechanism that detects the current URL.
  - Define logic to conditionally load specific feature modules (GPA, MoveOut, Scheduler) based on the detected URL pattern.
  - Ensure the userstyle is injected regardless of the specific feature module loaded.
  - Create placeholder initialization functions for each feature module to be implemented in later phases.
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

## Phase 3: GPA Calculator Module

- [x] 3.1 Implement GPA Data Parsing and Logic
  - Create the directory structure for the GPA feature.
  - Define data types for subjects, semester data, and configuration.
  - Implement utility functions for mapping grades and semester labels to colors.
  - Develop the logic to parse the student transcript table from the DOM, extracting subject codes, names, credits, grades, and status.
  - Implement logic to group subjects by semester and handle different subject statuses.
  - Implement the calculation engine to compute GPA per semester and cumulative GPA, accounting for credit weights.
  - Add logic to exclude specific subjects from calculation based on a configurable list of prefixes.
  - _Requirements: 2.2, 2.5, 2.8, 2.9_

- [x] 3.2 Implement GPA User Interface Components
  - Create the main React entry point for the GPA feature and inject it into the transcript page.
  - Implement a header component that allows users to manage the list of non-GPA subject prefixes.
  - Create a component to display the grade table with semester breakdowns and GPA summaries.
  - Implement a calculation table component that allows users to edit grades temporarily to simulate GPA changes.
  - Add functionality to reset simulated grades to their original values.
  - Ensure the UI updates real-time when grades are modified in the simulation mode.
  - Add a link to the subject fees page for credit information.
  - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 2.10_

## Phase 4: MoveOut Module

- [x] 4.1 Implement MoveOut Utilities and Data Fetching
  - Create the directory structure for the MoveOut feature.
  - Define interfaces for class slots, timetables, and filter criteria.
  - Create constant definitions for weekdays, class slots, and form field names.
  - Implement utility functions for color mapping and form data extraction.
  - Implement logic to fetch external configuration data (notifications, department lists) with fallback mechanisms.
  - Implement a caching mechanism for timetable data with a 24-hour expiration policy.
  - _Requirements: 3.12, 3.13, 3.14_

- [x] 4.2 Implement Timetable Data Processing
  - Implement the logic to fetch all available class slots for a selected subject.
  - Parse the HTML response to extract slot information, including weekday, lecturer, and room.
  - Organize the parsed data into a structured format suitable for the UI (e.g., grouped by weekday and slot).
  - Implement a progress tracking mechanism to report the status of data fetching.
  - Implement logic to validate and use cached data to reduce network requests.
  - Add functionality to force a refresh of the data, clearing the cache.
  - _Requirements: 3.2, 3.3, 3.7, 3.10_

- [x] 4.3 Implement MoveOut User Interface
  - Create the main React entry point for the MoveOut feature and inject it into the course page.
  - Implement a header component with controls for refreshing data and viewing student counts.
  - Create a timetable grid component that visualizes class slots interactively.
  - Implement filtering functionality to allow users to filter classes by lecturer, slot, or other criteria.
  - Add logic to handle class switching actions, including confirmation prompts and error handling.
  - Implement a detailed view for selected class lists.
  - Add a link to view lecturer reviews.
  - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.8, 3.9, 3.11, 3.15, 3.17, 3.18_

## Phase 5: Scheduler Module

- [x] 5.1 Implement ICS Generation Utility
  - Create a utility to generate RFC 5545 compliant ICS calendar files.
  - Implement logic to format dates and times correctly for calendar events.
  - Add functionality to include alarms/reminders in the generated events.
  - Ensure special characters in event details are properly escaped.
  - _Requirements: 4.6, 4.7, 5.6, 5.7_

- [x] 5.2 Implement Exam Schedule Feature
  - Create the logic to parse the exam schedule table from the page.
  - Extract exam details including subject, time, room, and type.
  - Categorize exams into upcoming and completed lists.
  - Create a floating panel UI to display the exam schedule.
  - Add visual indicators for exam timing (e.g., "Today", "Tomorrow").
  - Implement the export functionality to download the exam schedule as an ICS file.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9_

- [x] 5.3 Implement Weekly Schedule Feature
  - Create the logic to parse the weekly schedule table from the page.
  - Extract class details including subject, slot, room, and lecturer.
  - Create a floating panel UI to display the weekly schedule controls.
  - Implement functionality to parse schedules for the current week, next week, or a selected range of weeks.
  - Implement the export functionality to download the weekly schedule as an ICS file.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
