# Implementation Plan

Spec prefix `APP`. Phases are numbered `N.`, subtasks `N.M`; the global id is `APP-N` or `APP-N.M`. Dependencies, gates, milestones and status live in the orchestrator: [`.kiro/orchestrator.md`](../../orchestrator.md). Requirement references point to `requirements.md` in this folder unless prefixed with a spec. The platform amendments apply: theme export uses a blob link; `unlimitedStorage` is granted at install.

Compacted on 2026-10-22 from 20 to 14 subtasks with no requirement dropped; the gated Classic top navigation moved to the end of its phase. The previous list is in [`.deprecated/tasks.md`](.deprecated/tasks.md).

- [x] 1. [APP-1] Style pipeline and early application
- [x] 1.1 [APP-1.1] Implement `StylePipeline`, the `document_start` entry and the panel theme
  - `src/features/appearance/pipeline.ts`: persistent sheets per layer (`base`, `vars`, `effects`, `classic`, `dock`, `user`) applied after FAP's adopted sheets in a stable order; `vars` scoped to `html[data-bs-theme=...]`; "FAP default" clears the theme layers (`vars`, `effects`, `user`) and restores the saved `data-bs-theme`; `classic` and `dock` stay (D-6, 2026-11-17; R6.1, panel-ux R1.5).
  - `src/content/appearance.ts`: read `appearance.active`, adopt sheets before first paint where possible, set `data-bs-theme`, detect Shift for safe mode, re-apply on `storage.onChanged` without reload; never write FAP storage.
  - A derived `panel-theme` sheet (mode, accent, roles) adopted by the panel's shadow root.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.5, 4.6; panel-ux R1.5, R10.2_

- [x] 2. [APP-2] Colour engine
- [x] 2.1 [APP-2.1] Implement conversions, harmony, contrast and role assignment
  - `color/`: sRGB, linear, OKLab, OKLCH, hex, rgb, hsl; `harmony(base, scheme)` for the six schemes; `toGamut` by chroma bisection with an adjusted flag.
  - WCAG `contrast`, `fixLightness`, `assignRoles(palette, mode)` with AMOLED surfaces in dark mode; curated swatches (8 families, 12 hues) as constants.
  - Tests: round-trip conversions, gamut mapping, contrast against known pairs.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. [APP-3] Theme model and presets
- [ ] 3.1 [APP-3.1] Define the theme model and role map
  - `Theme` with zod schema, `role-map.ts` from roles to `--ct-*` groups, explicit variable overrides.
  - _Requirements: 1.2, 3.6_
- [ ] 3.2 [APP-3.2] Build the eleven presets
  - Light: Glassmorphism, Neumorphism, Minimalist White, Frutiger Aero Green, Frutiger Aero Blue, Liquid Glass, Claymorphism. Dark (true black base): Glassmorphism Dark, Minimalist Black, Liquid Glass Dark, Claymorphism Vibrant Dark. Each with its `effects` block on FAP selectors.
  - A test checks 4.5:1 text and 3:1 component contrast for every preset.
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 4. [APP-4] Theme view and editors
- [ ] 4.1 [APP-4.1] Build the Theme view
  - Gear, Theme overlay: preset gallery with live preview before apply, "FAP default", duplicate a preset into a custom theme, auto mode with a light and a dark choice following `prefers-color-scheme`.
  - _Requirements: 2.5, 2.6, 1.4, 5.5_
- [ ] 4.2 [APP-4.2] Build the colour editor and background images
  - Swatches, free picker (hex, RGB, HSL, OKLCH), harmony helper, role assignment, measured ratios with a one-click fix, editing of any single `--ct-*` variable.
  - Local file input, downscale to at most 2560 px, WebP or JPEG under 1.5 MB, stored as a `data:` URL in the theme; remote URLs rejected with an explanation.
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 4.4_
- [ ] 4.3 [APP-4.3] Build the CSS editor
  - CodeMirror 6 in the shadow root; 300 ms debounced preview through a scratch sheet; `csstree` validation in a worker for error positions while the last valid CSS stays applied; snippets for variables and main FAP selectors; safe mode toggle.
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

- [ ] 5. [APP-5] Theme management and import or export
- [ ] 5.1 [APP-5.1] Implement custom theme management, import and export
  - Create, rename, duplicate, delete (up to 20 custom themes), pick active.
  - Export JSON through a blob link; import with zod validation, CSS sanitizing (drop `@import` and non-`data:` `url()`, 200 KB cap) listing what was removed, preview with the outside-CSS warning before saving.
  - Tests for the sanitizer.
  - _Requirements: 5.1, 5.2, 5.3, 5.4; platform R7.4_

- [ ] 6. [APP-6] Layout tweaks
- [ ] 6.1 [APP-6.1] Implement compact, wide and sticky
  - `layout/tweaks.ts`: fragments toggled by `fap-aio-compact`, `fap-aio-wide` and `fap-aio-sticky` classes on `html`; measured sticky offset updated on resize; settings off by default in the Appearance section.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. [APP-7] Classic FAP layout
- [ ] 7.1 [APP-7.1] Build the patch framework and wire the Classic setting
  - Reversible `Patch` (`hide`, `move`, `insert`) with a log reverted in reverse order; a `MutationObserver` re-applies patches after partial swaps.
  - The Classic setting turns on or off without reload, independent of the theme.
  - Tests: apply then revert restores the DOM byte-identically on the layout, home, grade and timetable fixtures.
  - _Requirements: 6.1, 6.8_
- [ ] 7.2 [APP-7.2] Build the home link directory
  - Orange section headings with v2 links; FAP home content kept below.
  - The application deadline table from `/Application/GetFormSchema` (GET, one call per application type, 46 types) is filled only when the user presses "Load deadlines": one type per request at user priority under the shared budget, results cached for 24 hours, no background reads; hidden when the type list cannot be read.
  - _Requirements: 6.5; platform R3.1, R3.2_
- [ ] 7.3 [APP-7.3] Build classic report pages and timetable cards
  - Term tab strip and course card list driving FAP's own selects (`change` with `bubbles: true`); selects hidden visually but focusable; timetable cells styled as cards by attendance status.
  - _Requirements: 6.6, 6.7_
- [ ] 7.4 [APP-7.4] Build the classic top navigation and centred column
  - `classic-menu.ts` from `route-map.md` joined with FAP sidebar links (labels from FAP, missing routes dropped), shadow-rooted top bar with logo, "Academic Portal", dropdown groups, campus badge and user menu; sidebar hidden by class; centred fixed-width column.
  - _Requirements: 6.2, 6.3, 6.4, 6.9; Gate: G-SELECTORS_

- [ ] 8. [APP-8] Visual regression checks
- [ ] 8.1 [APP-8.1] Add Playwright screenshot tests
  - Serve the anonymized page fixtures locally with FAP's stylesheets, copied for the test run into the git-ignored `ignore/fap-styles/` and never committed; screenshot each preset and the Classic layout; skip with a notice when the stylesheets are absent; a review step in the release checklist.
  - _Requirements: 2.3, 2.4, 6.2; platform R7.6_
