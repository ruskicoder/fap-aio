---
id: decisions.v2-module-scope
type: adr
status: approved
owner: unassigned
summary: "FAP-AIO v2.0.0 module scope and business rules decided 2026-10-10: grades and goals, info sources, background refresh and keep-alive timing, themes, classic layout, MoveOut planned."
superseded_by: none
---

# Decision 0002: v2.0.0 module scope and business rules

Date: 2026-10-10. Decided by the project owner in chat; recorded by the assistant. Builds on [decision 0001](0001-v2-extension-foundations.md).

## Context

The core and scheduler requirements were approved on 2026-10-10. The remaining modules needed business rules before requirements and design: grades (GPA, prediction, goals), the info getter, appearance (themes and layout), MoveOut and self-service. Data readiness: [flm-subject-list.md](../20-architecture/flm-subject-list.md), [fap-v2 section](../20-architecture/fap-v2/README.md), pass rules in [constraints.md](../10-context/constraints.md).

## Decision

1. Specs. v2.0.0 has four specs under `.kiro/specs/`: `v2-core-scheduler` (approved requirements), `v2-grades`, `v2-info`, `v2-appearance`.
2. Grades.
   - Pass and tier checks use the course average rounded to one decimal, half up, as FAP displays it (4.95 counts as 5.0).
   - Grade prediction and goals appear in three places: inline on `/Report/Grade`, a Grades view in the panel, and a GPA summary on `/Report/Transcript`.
   - Goals: a default tier (Pass 5, Fair 7, Good 8, Excellent 9) for all courses, overridable per course, plus an overall cumulative GPA goal from which per-course targets are derived.
   - GPA extras: what-if simulator, target GPA planner, export of transcript and GPA data.
3. Info getter sources: subjects with the FLM syllabus, lecturer contacts, academic status, exams overview, news and documents with a watch for important events (for example capstone registration).
4. Lecturer contacts. Lecturer logins on FAP are shortcodes: first name plus the initials of the last and middle names, plus a counter when the same shortcode already exists (`CuNV`, `DanhNT14`). Shortcodes are case-insensitive. The email is `<shortcode>@fe.edu.vn` (preferred by lecturers) and `<shortcode>@fpt.edu.vn`; both are shown.
5. Refresh and keep-alive.
   - Data refresh runs on demand with a cache, and also periodically in the background, with a period below 7 minutes.
   - Session keep-alive (opt-in, decision 0001) fires every 7 minutes, the interval FPTU Schedule 4.0.0 uses.
6. Themes.
   - Built-in presets. Light: Glassmorphism, Neumorphism, Minimalist White, Frutiger Aero Green, Frutiger Aero Blue, Liquid Glass, Claymorphism. Dark, all AMOLED (true black base): Glassmorphism Dark, Minimalist Black, Liquid Glass Dark, Claymorphism Vibrant Dark.
   - A colour picker with curated swatches from pastel to vibrant, and an automatic harmony picker based on colour theory.
   - A full CSS editor for styles beyond colour (buttons, background image).
   - Import and export of themes. No remote theme store.
7. Layout.
   - An option to switch FAP v2 back to the familiar old FAP layout: horizontal top navigation, centred content, link-directory home page, and term tabs with course lists on report pages. The reference is screenshots of the legacy look only; no code is taken from any third-party extension.
   - Also compact density, wide content and sticky table headers.
8. MoveOut: planned, not abandoned. Development waits for an account whose status is inside a class-transfer (moving) period, since the feature is locked during the ongoing term.
9. Self-service stays out of every spec ([decision 0001](0001-v2-extension-foundations.md) item 4).

## Alternatives

- Exact (unrounded) average for pass checks: rejected; it can disagree with FAP's displayed status.
- Target GPA only, or per-course goals only: rejected in favour of both.
- Presets only, or a raw CSS editor without presets: rejected.
- Background polling only, or manual refresh only: rejected in favour of both.

## Consequences

- FAP v2 serves grades and transcripts as server-rendered HTML, not JSON ([platform.md](../20-architecture/fap-v2/platform.md)). The extension fetches and parses those pages; a fast burst of about 110 grade GETs was followed by HTTP 403, so background refresh must be paced.
- The classic layout restyles and reorganizes FAP v2 pages in place. It cannot restore v1 routes; every classic link must point to a v2 route ([route-map.md](../20-architecture/fap-v2/route-map.md)).
- User CSS from the theme editor is applied as a constructable stylesheet, which page CSP does not block. User CSS can therefore restyle anything, and imported themes must be treated as untrusted.
