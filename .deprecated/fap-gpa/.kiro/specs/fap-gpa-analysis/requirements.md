# FAP-GPA Chrome Extension - Requirements Specification

## Overview

**FAP-GPA** (FPT Academic Portal GPA Calculator) is a Chrome/Chromium extension designed to help FPT University students calculate their Grade Point Average (GPA) directly from the FPT Academic Portal (FAP) transcript page.

## Project Information

- **Name**: NEW FPT GPA
- **Version**: 1.0.1
- **Author**: ruskicoder (github.com/ruskicoder)
- **License**: MIT
- **Target Platform**: Chromium-based browsers (Chrome, Edge, Brave, etc.)
- **Manifest Version**: 3

## Stakeholder Goals

| ID | Stakeholder | Goal |
|----|-------------|------|
| SG-1 | FPT Students | Calculate semester and total GPA easily |
| SG-2 | FPT Students | Customize which subjects are excluded from GPA calculation |
| SG-3 | FPT Students | Simulate/edit grades to project future GPA |
| SG-4 | Developer | Maintain clean, privacy-respecting codebase |

## Functional Requirements

### FR-1: GPA Calculation Display
**Trigger**: User visits `https://fap.fpt.edu.vn/Grade/StudentTranscript.aspx`

The extension SHALL:
- Inject a GPA panel into the transcript page
- Display a "Show GPA" toggle button in the header
- Display an "Edit GPA" toggle button for grade simulation

### FR-2: Semester GPA Display
The extension SHALL:
- Parse the transcript table to extract subject data
- Group subjects by semester (Spring, Summer, Fall + Year)
- Calculate and display GPA for each semester
- Display subject blocks with grade labels (color-coded)

### FR-3: Total GPA Calculation
The extension SHALL:
- Calculate cumulative GPA across all passed subjects
- Exclude specified non-GPA subjects from calculation
- Display total average GPA prominently

### FR-4: Non-GPA Subject Management
The extension SHALL:
- Maintain a configurable list of subjects excluded from GPA
- Default exclusions: OJS, VOV, GDQP, LAB, ENT, SSS, TMI
- Allow users to add/remove subjects from the exclusion list
- Persist exclusion list using Chrome storage sync API

### FR-5: Grade Editing/Simulation
The extension SHALL:
- Provide an editable table for simulating grade changes
- Allow editing of credits and grades per subject
- Recalculate GPA in real-time based on edits
- Provide link to subject fees page for credit reference

## Non-Functional Requirements

### NFR-1: Privacy
- NO user tracking or analytics
- NO external data transmission
- NO personal data collection beyond local storage

### NFR-2: Performance
- Minimal impact on page load time
- Efficient DOM manipulation

### NFR-3: Compatibility
- Support for Chrome/Edge/Brave (Manifest V3)
- Support for both HTTP and HTTPS FAP URLs

## Acceptance Criteria

| ID | Requirement | Criteria |
|----|-------------|----------|
| AC-1 | FR-1 | GPA panel appears on transcript page within 1 second |
| AC-2 | FR-2 | Semester GPAs match manual calculation |
| AC-3 | FR-3 | Total GPA updates when exclusion list changes |
| AC-4 | FR-4 | Exclusion list persists across browser sessions |
| AC-5 | FR-5 | Edited grades reflect in simulated GPA immediately |
| AC-6 | NFR-1 | No network requests to tracking endpoints |
