# FAP-GPA Chrome Extension - Design Document

## Architecture Overview

```
fap-gpa/
├── src/
│   ├── manifest.ts          # Chrome Extension Manifest V3 configuration
│   ├── background/          # Service Worker (background script)
│   ├── contentScript/       # Main extension logic (injected into FAP)
│   │   ├── App.tsx          # Root React component
│   │   ├── index.ts         # Entry point, DOM injection
│   │   ├── components/      # UI components
│   │   │   ├── Header.tsx       # Non-GPA subject editor
│   │   │   ├── GradeTable.tsx   # Semester GPA display
│   │   │   └── CalculateTable.tsx # Grade simulation table
│   │   ├── lib/             # Core logic modules
│   │   │   ├── const.ts     # Constants and DOM selectors
│   │   │   ├── define.ts    # Class definitions (Subject, Semester, GPATable)
│   │   │   ├── logic.ts     # Main GPA calculation orchestration
│   │   │   ├── nonGPA.ts    # Non-GPA list management
│   │   │   └── util.ts      # Utility functions
│   │   └── utils.ts         # Helper functions for components
│   ├── popup/               # Extension popup (not actively used)
│   ├── options/             # Options page (not actively used)
│   ├── sidepanel/           # Side panel (not actively used)
│   ├── newtab/              # New tab page (not actively used)
│   └── devtools/            # DevTools panel (not actively used)
├── public/                  # Static assets
└── temp/                    # Legacy code reference (original extension)
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Build Tool | Vite |
| Extension Plugin | @crxjs/vite-plugin |
| UI Framework | React 18 |
| HTML Parsing | Cheerio |
| Styling | Tailwind CSS + Bootstrap (FAP native) |
| Language | TypeScript |
| Package Manager | Bun |

## Component Responsibilities

### 1. Content Script Entry (`index.ts`)
- Creates container element `#gpa-panel-new`
- Injects React app into FAP transcript page
- Mounts after `document_end`

### 2. App Component (`App.tsx`)
**State Management:**
- `nonGPAKey`: Array of subject codes to exclude
- `data`: Processed semester data with subjects
- `rawData`: Raw subject data from transcript
- `showGPA`: Toggle for GPA table visibility
- `showEdit`: Toggle for edit mode visibility

**Lifecycle:**
- On mount: Inject toggle buttons into header
- On mount: Parse transcript table, group by semester

### 3. GradeTable Component
**Displays:**
- Semester rows with year, subjects, and GPA
- Color-coded subject badges based on grade/status
- Total average GPA footer

**Calculations:**
- Filters out non-GPA subjects
- Sums (credit × grade) / total credits

### 4. CalculateTable Component
**Features:**
- Editable credit and grade fields
- Real-time GPA recalculation
- Subject search link

### 5. Header Component
**Features:**
- Non-GPA subject list display
- Add/remove subjects from exclusion list
- Default/Save buttons (UI only, functionality in nonGPA.ts)

### 6. Core Logic (`lib/`)

#### `const.ts`
```typescript
// DOM Selectors
MainContentID: "ctl00_mainContent_divGrade"
HeaderID: "ctl00_mainContent_lblRollNumber"
GridID: "ctl00_mainContent_divGrade"

// Default excluded subjects
DefaultNonGPA: ["OJS", "VOV", "GDQP", "LAB", "ENT", "SSS", "TMI"]
```

#### `define.ts`
```typescript
class Subject {
  semester, code, credit, grade, status, name
  includeInGPA(): boolean  // Checks against nonGPAList
  pointLabel(): string     // Returns CSS class for badge
}

class Semester {
  name, subjects[]
  getGPA(): number
  DOM(): HTMLElement
}

class GPATable {
  semesters[]
  DOM(): HTMLElement
}
```

#### `util.ts`
- `parseGrade(dom)`: Extracts subjects from transcript table
- `getGPAInfo(subjects)`: Calculates sum/total for GPA
- `createMapSemester(subjects)`: Groups subjects by semester
- `buildGPATable()`: Constructs the full GPA table

#### `nonGPA.ts`
- `getNonGPAList()`: Retrieves from chrome.storage.sync
- `setNonGPAList()`: Persists to chrome.storage.sync
- `renderNonGPAEditor()`: Builds the editor UI

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FAP Transcript Page                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  #ctl00_mainContent_divGrade (Grade Table)              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Content Script Injection)
┌─────────────────────────────────────────────────────────────┐
│                     index.ts                                 │
│  1. Create #gpa-panel-new container                         │
│  2. Mount React App                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      App.tsx                                 │
│  1. Query transcript table rows                              │
│  2. Parse: semester, code, name, credit, grade, status      │
│  3. Group by semester                                        │
│  4. Calculate GPA per semester                               │
│  5. Render GradeTable / CalculateTable                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Chrome Storage                             │
│  - NonGPAKey: string[] (excluded subject codes)             │
│  - clientId: REMOVED (was for tracking)                     │
└─────────────────────────────────────────────────────────────┘
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Persist non-GPA subject list |
| `tabs` | (Currently unused, can be removed) |
| `host_permissions: <all_urls>` | (Overly broad, should be restricted) |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| FAP DOM structure changes | Use resilient selectors, test regularly |
| Manifest V3 service worker lifecycle | Keep background script minimal |
| Performance on large transcripts | Use React memo, batch DOM updates |
