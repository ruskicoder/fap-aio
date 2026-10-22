# Implementation Plan

Spec prefix `PNL`. Phases are numbered `N.`, subtasks `N.M`; the global id is `PNL-N` or `PNL-N.M`. Dependencies, gates and status live in the orchestrator: [`.kiro/orchestrator.md`](../../orchestrator.md). Requirement references point to `requirements.md` in this folder unless prefixed with a spec (`core R1.4`). The platform amendments apply: the shortcuts list comes from `commands.list`, settings changes travel through `storage.onChanged`, and the Data section gains the data channel controls.

- [ ] 1. [PNL-1] Panel state and shell
- [ ] 1.1 [PNL-1.1] Implement `PanelState` v2 and its migration
  - Schema v2 from the design (mode, floating rectangle, docked width, collapsed, route, density) and `PanelPrefs`; migration from v1 (x, y, width, height, minimized, view).
  - _Requirements: 1.7, 1.8; core R1.4_
- [ ] 1.2 [PNL-1.2] Build `PanelShell` and the header
  - Header with drag handle and title, palette button, bell with unread count, dock toggle, gear menu (Theme, Settings, Help, Shortcuts) and minimize; floating resize with the size limits; pill (floating) and 48 px rail (docked) collapsed states.
  - _Requirements: 1.1, 1.4, 1.6, 1.7, 2.3_
- [ ] 1.3 [PNL-1.3] Add the status strip
  - Last sync of the current tab's main source, running job progress, the budget wait state from the access layer, the "Syncing data" and data version state from `data.progress`, and the challenge reload banner.
  - _Requirements: 3.4; platform R3.9, R5.5; core error table_

- [ ] 2. [PNL-2] Navigation: router, tabs, sub-views and view registry
- [ ] 2.1 [PNL-2.1] Implement `PanelRouter`
  - The `Route` type, `go`, `back`, persistence in `panel.state.route`, overlay routes for Theme, Settings, Help and Shortcuts with a back control.
  - _Requirements: 2.4, 1.8_
- [ ] 2.2 [PNL-2.2] Implement the view registry and `ViewOutlet`
  - `ViewDef` with lazy components and count callbacks; the previous view stays mounted until the next is ready; skeletons, not spinners; an inline "Try again" when a chunk fails.
  - _Requirements: 10.6_
- [ ] 2.3 [PNL-2.3] Build the tab bar and segmented sub-views
  - Four tabs with icons and one-word labels in sentence case; APG manual activation (arrows, Home, End, Enter, Space; click activates); segmented sub-view control with counts.
  - _Requirements: 2.1, 2.2, 2.5; core R1.8_
- [ ] 2.4 [PNL-2.4] Add the page-aware map
  - Pathname table to routes, the course from `#grade-report-course`, applied once per page load when the setting is on; a manual pick wins until the next load.
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 3. [PNL-3] Visual system and accessibility
- [ ] 3.1 [PNL-3.1] Add density tokens and theme variables
  - Comfortable and compact tokens from the design; `--aio-*` variables derived from the active theme's `panel-theme` sheet with a neutral fallback before appearance loads; system UI font.
  - _Requirements: 10.1, 10.2_
- [ ] 3.2 [PNL-3.2] Add icons, focus, targets and motion rules
  - Tabler outline icons as an SVG sprite inside the shadow root; a visible focus ring on every control; 24 px minimum targets; transitions of 200 ms or less, removed under `prefers-reduced-motion`.
  - _Requirements: 10.3, 10.4, 10.5_
- [ ] 3.3 [PNL-3.3] Add a virtualized list component
  - Used by lists over 100 items (news, subjects).
  - _Requirements: 10.7_
- [ ] 3.4 [PNL-3.4] Add accessibility tests
  - axe-core on the shell and each registered view in both densities; a target size audit; copy checks for sentence case in labels.
  - _Requirements: 10.2, 10.3, 10.8_

- [ ] 4. [PNL-4] Docked mode
- [ ] 4.1 [PNL-4.1] Implement snap, undock and the dock toggle
  - Snap preview within 24 px of the right edge during header drag, dock on release; undock after a 48 px drag at the pointer; the header toggle; 6 px width grip with docked limits 320 to 640 px.
  - _Requirements: 1.2, 1.3, 1.4, 1.7_
- [ ] 4.2 [PNL-4.2] Reserve the width through the appearance pipeline
  - The `dock` layer (`html.fap-aio-docked body { margin-right }`, top bar and footer `right`) with the selectors confirmed in gate G-SELECTORS; `--fap-aio-dock-w` updated with `requestAnimationFrame`; fallback to overlay with a notice when selectors are missing.
  - _Requirements: 1.5; Gate: G-SELECTORS_
- [ ] 4.3 [PNL-4.3] Add the narrow-viewport drawer
  - Below 900 px: overlay drawer, 40% scrim, closes on Escape or a click outside, no width reserved.
  - _Requirements: 1.9_

- [ ] 5. [PNL-5] Command palette
- [ ] 5.1 [PNL-5.1] Implement `CommandRegistry` and search providers
  - Stable command ids, groups Actions and Navigate, secondary actions, `SearchProvider` interface; navigation commands for every tab and sub-view and for Settings.
  - _Requirements: 5.2, 5.6_
- [ ] 5.2 [PNL-5.2] Build the palette UI with `cmdk`
  - Modal overlay in the shadow root; grouped, diacritic-insensitive fuzzy results; recents (10) first; shortcuts shown; Enter runs, Ctrl+Enter runs the secondary action, Escape closes; ARIA combobox semantics verified in tests.
  - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [ ] 6. [PNL-6] Alerts inbox
- [ ] 6.1 [PNL-6.1] Implement `AlertStore`
  - `alerts.push()` with `dedupeKey`, retention 200 items or 60 days, read state, `notify` to the service worker for enabled kinds.
  - _Requirements: 6.1, 6.4, 6.5_
- [ ] 6.2 [PNL-6.2] Build the inbox popover
  - Under the bell: list with kind filters, mark one or all read, deep links; unread count on the bell, pill and rail.
  - _Requirements: 6.2, 6.3, 1.6_

- [ ] 7. [PNL-7] Keyboard shortcuts and keybinds
- [ ] 7.1 [PNL-7.1] Implement `KeybindEngine`
  - One capture-phase `keydown` listener; the input, IME and contenteditable guard with the palette and toggle exceptions; platform defaults for macOS; actions from R7.1 wired to router, overlays and shell.
  - _Requirements: 7.1, 7.5_
- [ ] 7.2 [PNL-7.2] Add keybind recording and the shortcuts sheet
  - Settings rows that record, clear and reset; refusal with the conflicting action or the reserved browser chord named; overrides only in `panel.prefs`; the toggle-panel row shows `commands.list` output and links to `chrome://extensions/shortcuts`; the `?` sheet lists all current keybinds.
  - _Requirements: 7.2, 7.3, 7.4, 7.6_

- [ ] 8. [PNL-8] Settings registry and Settings view
- [ ] 8.1 [PNL-8.1] Implement `SettingsRegistry`
  - `SettingDef` with sections, types, defaults, validation and custom rows; values stored in `settings`; the General section's own settings (page-aware tab, density, layout defaults).
  - _Requirements: 8.1, 8.3, 4.3_
- [ ] 8.2 [PNL-8.2] Build the Settings view
  - Sections in the R8.1 order, sticky index when docked and a select when floating, search over label, description and key, default and "modified" marker per row.
  - _Requirements: 8.1, 8.2, 8.3_
- [ ] 8.3 [PNL-8.3] Add export, import and reset
  - JSON `{ formatVersion: 1, settings }`; import validates each key and shows a diff before applying; reset section and reset all with confirmation.
  - _Requirements: 8.4, 8.5_
- [ ] 8.4 [PNL-8.4] Build the Data and privacy and About sections
  - Usage per store and IndexedDB total (`data.status`), export all data, clear data, legacy cleanup, data version and source, "Check for data updates", "Use packaged data", last skip reason, optional permission states, "Copy diagnostics"; About shows version, rubric and rules dates and links.
  - _Requirements: 8.1; platform R4.6, R5.7, R7.3; core R5.5, R12.4_

- [ ] 9. [PNL-9] Today view and first run
- [ ] 9.1 [PNL-9.1] Implement the Today view
  - `TodayProvider` registry in the R3.1 order, hidden empty sections, a calm state with the next class, last sync time and one "Refresh" that refreshes all provider sources within the budget; deep links.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [ ] 9.2 [PNL-9.2] Build the first-run welcome
  - `panel.prefs.firstRun`; opens docked at comfortable density; three skippable steps (tabs tour, "Sync this week" button with live progress, optional features all off); Help reopens it.
  - _Requirements: 9.1, 9.2, 9.3_
