# Design Document

## Overview

This design gives the panel its layout and interaction model:
- a floating and docked hybrid;
- four primary tabs with segmented sub-views;
- the Today view, page-aware selection, a command palette and an alerts inbox;
- customizable keybinds and a registry-driven Settings view.

It replaces the panel section of `v2-core-scheduler/design.md` for layout, which keeps the host mechanics: Shadow DOM, constructable stylesheet, persistence and clamping. All feature views plug in through registries, so modules stay independent.

Research used:

| Topic | Guidance applied | Source |
|---|---|---|
| Tabs | Few tabs, 1 to 2 word labels, no all caps, clear selected state; tabs for sibling views at one level | [NN/g, Tabs Used Right](https://www.nngroup.com/articles/tabs-used-right/), [Material 3 tabs](https://m3.material.io/components/tabs/guidelines) |
| Navigation in a compact pane | Tabs or a bar in compact widths; a rail for 3 to 7 destinations in wider panes | [Material 3 navigation rail](https://m3.material.io/components/navigation-rail/guidelines) |
| Keyboard tabs | Arrow keys move, Home and End jump, Space or Enter activates; manual activation when panels fetch data | [WAI-ARIA APG Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) |
| Command palette | Ctrl or Cmd+K; grouped, fuzzy results; recents; actions, not only navigation; combobox with `aria-activedescendant`; stable command ids; modules register commands | [Setproduct command palette guide](https://www.setproduct.com/blog/command-palette-ui-design-guide), [Command palette UX patterns](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1) |
| Target size | At least 24 by 24 CSS px (WCAG 2.2 SC 2.5.8) | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) |
| Legacy lessons | Main tabs with sub-tabs and counts, persistent progress bar, actions next to data (legacy `fptu-panel`); a drawer for long lists (legacy redesign) | `.deprecated/fap-aio/src/contentScript/features/scheduler/ui.ts`, `.deprecated/SCHEDULER_REDESIGN_SUMMARY.md` |

## Architecture

```mermaid
flowchart TB
  Host[PanelHost\nshadow root, stylesheet] --> Shell[PanelShell\nlayout mode, size, collapse]
  Shell --> Header[Header\nhandle, palette, bell, dock, gear, minimize]
  Shell --> Tabs[TabBar\nToday Schedule Grades Info]
  Shell --> Sub[SubViewBar\nsegmented, counts]
  Shell --> Body[ViewOutlet\nlazy views, skeletons]
  Shell --> Status[StatusStrip\nsync progress, last sync, budget]
  Shell --> Overlays[Overlays\npalette, inbox, sheets, dialogs]
  Router[PanelRouter\ntab, subview, params] --> Body
  PageMap[PageAwareMap] --> Router
  Keys[KeybindEngine] --> Router & Overlays & Shell
  Cmd[CommandRegistry] --> Overlays
  Inbox[AlertStore] --> Header & Overlays
  SetReg[SettingsRegistry] --> SettingsView
```

## Layout

Floating mode (default 400 × 600):

```text
+--------------------------------------------------+
| ::  FAP-AIO        [Ctrl K]  bell(3)  dock  gear - |  header 40 px, drag handle on the left
| Today | Schedule | Grades | Info                  |  tab bar 36 px, icon + label
| ( Week | Exams 3 | Export )                       |  segmented sub-views 32 px, counts
|--------------------------------------------------|
|                                                  |
|  view content (scrolls)                          |
|                                                  |
|--------------------------------------------------|
| Synced 2 min ago        [=====>    ] 6/17 weeks  |  status strip 28 px, progress when syncing
+--------------------------------------------------+
```

Docked mode: the same stack at full viewport height against the right edge, with a 6 px resize grip on its left border. Collapsed states:
- Floating minimizes to a 40 px pill (logo plus alert count) at the panel's last corner.
- Docked collapses to a 48 px rail with the four tab icons, the bell and an expand button. A click on a rail icon expands the panel to that tab.

Docking mechanics (R1.2 to R1.5, R1.9):
- Snap: during the header drag, `pointermove` checks `viewportWidth − (x + width) <= 24`. If so, a translucent dock preview fills the right edge; release docks.
- Undock: in docked mode, a header drag of more than 48 px to the left undocks at the pointer, keeping the floating size from storage.
- Reserving width: the appearance `StylePipeline` gets a `dock` layer with `html.fap-aio-docked body { margin-right: var(--fap-aio-dock-w) !important }`. Jidox's fixed top bar and footer get `right: var(--fap-aio-dock-w)`. The selectors must be confirmed on live FAP (verification list in STATUS). The variable is updated on resize with `requestAnimationFrame`. The panel host itself is `position: fixed; right: 0; top: 0; height: 100vh`.
- Below 900 px of viewport width, docked becomes an overlay drawer: the `dock` layer is removed, a 40% scrim is added, and Escape or a click outside closes it.

Density tokens:

| Token | Comfortable | Compact |
|---|---|---|
| Body text | 14 px / 1.5 | 13 px / 1.4 |
| Small text | 12 px | 11.5 px |
| Control height | 32 px | 28 px |
| Row padding | 8 × 12 px | 4 × 8 px |
| Section gap | 16 px | 10 px |
| Hit area minimum | 24 × 24 px | 24 × 24 px |

Colour and type come from the active theme through panel variables. The panel derives `--aio-surface`, `--aio-surface-alt`, `--aio-text`, `--aio-text-muted`, `--aio-border`, `--aio-accent`, `--aio-success`, `--aio-warning` and `--aio-danger` from the theme roles (`v2-appearance`). Its own contrast is checked against the same WCAG thresholds. The font is the system UI stack, with Vietnamese diacritics verified. Icons are Tabler outline, bundled as an SVG sprite inside the shadow root, so no font load runs against the page CSP.

## Components and Interfaces

### PanelRouter (`src/content/panel/router.ts`)

```ts
type TabId = 'today' | 'schedule' | 'grades' | 'info';
type Route =
  | { tab: 'today' }
  | { tab: 'schedule'; sub: 'week' | 'exams' | 'export'; params?: { date?: string } }
  | { tab: 'grades'; sub: 'courses' | 'gpa' | 'whatif' | 'planner'; params?: { courseId?: string } }
  | { tab: 'info'; sub: 'subjects' | 'lecturers' | 'news' | 'status'; params?: { id?: string } }
  | { overlay: 'theme' | 'settings' | 'help' | 'shortcuts'; section?: string };
interface PanelRouter { current(): Route; go(r: Route, opts?: { source: 'user' | 'page' | 'deeplink' }): void; back(): void }
```

The route persists in `panel.state.route`. Deep links from Today, the inbox and the palette call `go(..., { source: 'deeplink' })` (R3.2).

### View registry

```ts
interface ViewDef {
  tab: TabId; sub?: string; label: string; icon: string;
  component: () => Promise<React.ComponentType>;   // lazy chunk
  count?: () => number | null;                     // segmented-control badge (R2.2)
}
```

Modules register views:
- Scheduler: Schedule Week, Exams, Export.
- Grades: Courses, GPA, What-if, Planner.
- Info: Subjects, Lecturers, News, Status.
- Today: composed from `TodayProvider`s.

Views load lazily. The previous view stays mounted until the next one is ready, so the switch stays under 100 ms with cached data (R10.6).

Tabs follow the APG manual-activation model: arrows move focus, and Enter or Space activates, because views may trigger reads. Mouse click activates directly (R2.5, R10.4).

### Today (`src/content/panel/today/`)

```ts
interface TodayProvider { id: string; order: number; items(ctx): TodayItem[] }
interface TodayItem { id: string; title: string; detail?: string; tone: 'neutral' | 'warning' | 'danger' | 'success'; when?: string; link: Route }
```

Providers in R3.1 order: `nextClass` (scheduler), `todayClasses` (scheduler), `examsSoon` (scheduler), `attendanceRisk` (info), `gradeRisk` (grades), `newsP1` (info), `courseraDue` (info). Empty providers are omitted (R3.3). Refresh triggers each provider's sources through the core registry, which applies the request budget (R3.4).

### PageAwareMap (`src/content/panel/page-aware.ts`)

A table of `pathname` regexes to `Route`, as in R4.1. It runs once per page load if the setting is on, and gets the course from `#grade-report-course` on the grade page. A user selection made afterwards wins until the next load (R4.2).

### CommandRegistry and palette (`src/content/panel/commands/`)

```ts
interface Command {
  id: string;                         // 'schedule.syncWeek' - stable (R5.6)
  title: string; group: 'Actions' | 'Navigate';
  keywords?: string[]; shortcut?: string;
  run(): void | Promise<void>;
  secondary?: { title: string; run(): void };
}
interface SearchProvider { id: 'subjects' | 'lecturers' | 'news' | 'courses'; search(q: string, limit: number): PaletteResult[] }
```

- UI: `cmdk` (MIT, React). It is rendered in the shadow root as a modal overlay positioned 15% from the panel top. When docked or floating the palette spans the panel width; it is opened with the key or the header button (R5.1).
- Matching: `cmdk`'s built-in fuzzy scorer, run on normalized strings (NFD, diacritics removed, `đ` to `d`) (R5.3).
- Recents: the last 10 command ids in `panel.recents` (R5.3).
- Ctrl+Enter runs `secondary` (R5.4). The ARIA combobox semantics come from `cmdk` and are verified in tests (R5.5).

### KeybindEngine (`src/content/panel/keys.ts`)

```ts
interface ActionDef { id: string; title: string; default: { win: string; mac: string }; scope: 'page' | 'global'; run(): void }
type Keybind = string;   // normalized 'Ctrl+K', 'Alt+Shift+F', '?'
```

- One `keydown` listener on `window` in capture phase. It is ignored when `event.isComposing`, or when the target or the shadow root's active element is an input, textarea, select or contenteditable. The exception is the palette and toggle actions (R7.5).
- Platform comes from `navigator.userAgentData?.platform ?? navigator.platform`; macOS defaults use Cmd and Ctrl as listed in R7.1.
- Recording: the settings row enters capture mode and builds the chord from `event.key`/`code` and the modifiers. It validates against the reserved browser list (Ctrl or Cmd plus T, W, N, Shift+N, Tab, Shift+Tab, L, D, F4 and similar; kept as a table) and against the other actions (R7.3).
- The global toggle uses `chrome.commands` (`toggle-panel`, suggested `Alt+Shift+F`). Settings shows `chrome.commands.getAll()` output and links to `chrome://extensions/shortcuts` (R7.4).
- Storage: `panel.keybinds` holds overrides only; defaults come from code, so new actions get defaults (R7.2).

### AlertStore and inbox (`src/content/panel/inbox/`)

```ts
interface Alert { id: string; kind: 'attendance' | 'news' | 'coursera' | 'grade' | 'reminder' | 'sync' | 'session' | 'challenge'; title: string; detail?: string; at: number; link?: Route; read: boolean; dedupeKey: string }
```

- Producers are the existing analyzers and engines; they call `alerts.push()`. The service worker mirrors new alerts to `chrome.notifications` only for kinds enabled in settings (R6.5).
- Retention: at most 200 alerts and 60 days, pruned on write (R6.4). Dedupe uses `dedupeKey`, which replaces `info.alerted` (v2-info design).
- Inbox UI: a popover under the bell; a list with kind filters; "Mark all read"; each row deep-links (R6.2, R6.3).

### SettingsRegistry and Settings view (`src/content/panel/settings/`)

```ts
interface SettingDef<T> {
  key: string;                         // 'schedule.reminders.enabled'
  section: 'general' | 'schedule' | 'grades' | 'info' | 'session' | 'appearance' | 'shortcuts' | 'data' | 'about';
  label: string; description: string;  // one line, sentence case (R8.3)
  type: 'toggle' | 'select' | 'number' | 'list' | 'text' | 'custom';
  default: T; options?: { value: T; label: string }[]; min?: number; max?: number;
  validate?(v: T): string | null;
  component?: () => Promise<React.ComponentType>; // custom rows: keybinds, non-GPA list, data export
}
```

- Every module declares its settings here, which removes the scattered settings lists in the other designs. The view renders sections in R8.1 order, with a sticky section index on the left (docked) or a select on top (floating).
- Search filters on label, description and key (R8.2).
- Each row shows its default and a "modified" dot; changes save at once and broadcast `settings-changed` (R8.3).
- Export and import: JSON `{ formatVersion: 1, settings: { key: value } }`. Import validates with each `SettingDef.validate`, then shows a diff (key, old value, new value) before applying (R8.4).
- Reset: section or all, with a confirmation dialog (R8.5).
- Data and privacy section: a storage usage meter (`chrome.storage.local.getBytesInUse`), a list of stores with sizes, "Export all data", "Clear data" (core R5.5) and legacy cleanup (core R12).

### First run (`src/content/panel/welcome/`)

The `panel.firstRun` flag. Three steps in a dialog inside the docked panel:
1. A tour of the four tabs, with one sentence each.
2. "Sync this week" as a primary button, running the scheduler sync with live progress.
3. Optional features listed with toggles, all off.

"Skip" is available on every step; finishing or skipping sets the flag. Help reopens the welcome (R9).

### StatusStrip

It shows the last sync time of the current tab's main source and the progress of any running sync job (from the legacy progress bar). After a `challenge` it shows the reload banner, and while a background pause is active it shows the remaining budget.

## Data Models

```ts
interface PanelState {
  schemaVersion: 2;                     // v1 was { x, y, width, height, minimized, view }
  mode: 'floating' | 'docked';
  floating: { x: number; y: number; width: number; height: number };
  dockedWidth: number;
  collapsed: boolean;                   // pill or rail
  route: Route;
  density: 'comfortable' | 'compact';
}
interface PanelPrefs { pageAware: boolean; keybinds: Record<string, string>; recents: string[]; firstRun: 'pending' | 'done' }
```

Migration from core `panel.state` v1: keep x, y, width, height and minimized; map `view` to `route`; mode is `floating`.

## Error Handling

- A view chunk that fails to load shows an inline error with "Try again"; the rest of the panel works.
- A keybind conflict or reserved chord is refused with the conflicting action named (R7.3).
- A settings import with invalid values lists each rejected key and applies nothing until confirmed.
- If the dock layer's target selectors are missing (FAP layout changed), docking falls back to overlay mode with a notice. FAP content is never covered without the user knowing.
- A Cloudflare challenge or an expired session shows in the status strip and the inbox, and Today stops refreshing.

## Testing Strategy

- Unit tests:
  - router persistence and migration from v1;
  - page-aware mapping table;
  - keybind normalization, conflict detection and the input-focus guard;
  - palette scoring with diacritics (`dang ky` finds `Đăng ký`);
  - alert dedupe and retention;
  - settings registry validation and import diff.
- Component tests (Testing Library):
  - tab keyboard model (arrows, Home, End, Enter);
  - palette combobox semantics;
  - dock snap thresholds with simulated pointer events;
  - collapsed pill and rail;
  - skeleton to content without layout shift.
- Accessibility: axe-core on every view in both densities; focus visible on every control; 24 px target audit; `prefers-reduced-motion` disables transitions.
- Manual verification on FAP:
  - dock and undock on the timetable, grade and home pages, with FAP content not covered;
  - overlay mode below 900 px;
  - keybinds in Chrome on Linux, Windows and macOS;
  - first-run flow.

## Platform amendments

Added 2026-10-11: `.kiro/specs/v2-platform/design.md`, section "Amendments to approved designs", changes parts of this design (exports, data access, settings broadcast, permissions). Where they differ, the platform design applies; the text above is kept as approved.
