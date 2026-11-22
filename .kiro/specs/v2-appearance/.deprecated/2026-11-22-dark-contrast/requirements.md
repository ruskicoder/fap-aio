# Requirements Document

## Introduction

This spec covers the appearance module of FAP-AIO v2.0.0. It has two parts:
- Custom themes for FAP: built-in presets, a colour picker with a colour-theory harmony helper, a full CSS editor, and import and export.
- A web layout enhancer: a "Classic FAP" layout that brings back the familiar old FAP structure, plus compact density, wide content and sticky table headers.

It builds on the core in `.kiro/specs/v2-core-scheduler/` and follows [decision 0002](../../../docs/60-decisions/0002-v2-module-scope.md) items 6 and 7.

FAP v2 facts used:
- Jidox template on Bootstrap 5. `html` carries `data-bs-theme` and layout attributes, and 144 `--ct-*` custom properties define the colours (`docs/70-work/investigations/2026-10-04-scheduler-comparison-and-v2-scope.md`).
- CSP `style-src 'self' https://fonts.googleapis.com`, `img-src 'self' data: https://cdn.fpt.edu.vn https://img.vietqr.io`, `font-src 'self' https://fonts.gstatic.com` (`docs/20-architecture/fap-v2/platform.md`).
- v1 to v2 route mapping (`docs/20-architecture/fap-v2/route-map.md`).

The Classic layout reference is screenshots of the old FAP look only. No code or assets are taken from any third-party extension.

Out of scope: a remote theme store or theme sharing service, themes for FLM or other sites, changing FAP's behaviour or data, and restoring v1 URLs.

## Requirements

### Requirement 1: Theme engine

**User Story:** As a student, I want to restyle FAP, so that it looks the way I like.

#### Acceptance Criteria

1. WHEN a theme is active THEN the extension SHALL apply it on every authenticated FAP page before first paint where possible, and no later than the content script start.
2. A theme SHALL consist of a mode (light or dark), values for FAP's `--ct-*` colour variables, style tokens (radius, shadow, blur, surface opacity, font family), an optional background image, and optional custom CSS.
3. WHEN a dark theme is active THEN the extension SHALL set FAP's `data-bs-theme` to `dark`, so that FAP's own dark rules apply underneath the theme.
4. WHEN the user selects "FAP default" THEN the extension SHALL remove every theme style and restore FAP's own mode.
5. Switching themes SHALL take effect without a page reload.
6. The extension SHALL NOT write theme state to the FAP origin's `localStorage` or `sessionStorage`.
7. The panel itself SHALL follow the active theme's mode and accent colour.

### Requirement 2: Preset themes

**User Story:** As a student, I want ready-made themes in popular styles, so that I can pick one without designing it.

#### Acceptance Criteria

1. The extension SHALL ship these light presets: Glassmorphism, Neumorphism, Minimalist White, Frutiger Aero Green, Frutiger Aero Blue, Liquid Glass, Claymorphism.
2. The extension SHALL ship these dark presets, each on a true black (AMOLED) base: Glassmorphism Dark, Minimalist Black, Liquid Glass Dark, Claymorphism Vibrant Dark.
3. Each preset SHALL realize its style's defining traits:
   - Glassmorphism: frosted translucent surfaces over a vivid backdrop, with a thin light edge.
   - Neumorphism: one continuous surface, with dual soft shadows and inset pressed states.
   - Minimalist: limited palette, generous whitespace, no decorative effects.
   - Frutiger Aero: glossy glass with sky-blue or grass-green, and soft gradients.
   - Liquid Glass: layered translucency with lensing highlights.
   - Claymorphism: puffy surfaces, large radii, two inner shadows and one outer shadow.
4. Every preset SHALL keep body text contrast of at least 4.5:1 and UI component contrast of at least 3:1 against its surfaces (WCAG 2.2 AA).
5. Each preset SHALL be previewable in the panel before it is applied.
6. The user SHALL be able to duplicate a preset into an editable custom theme.

### Requirement 3: Colour picker and harmony helper

**User Story:** As a student, I want an easy and smart way to pick colours, so that my theme looks good without colour expertise.

#### Acceptance Criteria

1. The colour editor SHALL offer curated swatch palettes from pastel to vibrant, and a free picker (hex, RGB, HSL, OKLCH input).
2. The harmony helper SHALL generate a palette from one base colour by the schemes complementary, analogous, triadic, split-complementary, tetradic and square, rotating hue in OKLCH while holding lightness and chroma.
3. WHEN a generated colour falls outside sRGB THEN the helper SHALL bring it into gamut by reducing chroma and SHALL mark it as adjusted.
4. The helper SHALL assign the generated colours to theme roles (primary, secondary, accent, surface, text) and SHALL derive text colours that meet 4.5:1 on their backgrounds.
5. WHEN a chosen pair falls below 4.5:1 for text or 3:1 for UI components THEN the editor SHALL show the measured ratio and offer a one-click lightness fix.
6. The editor SHALL map theme roles to the `--ct-*` variables, so that the user does not need to know them, and SHALL also allow editing any single `--ct-*` variable.

### Requirement 4: CSS editor

**User Story:** As a power user, I want to write my own CSS for FAP, so that I can style buttons, backgrounds and anything else.

#### Acceptance Criteria

1. The theme editor SHALL include a CSS editor with syntax highlighting, line numbers and live preview on the current page.
2. The CSS editor SHALL list the theme variables and the main FAP selectors (cards, buttons, tables, sidebar, top bar, forms) as insertable snippets.
3. WHEN the CSS fails to parse THEN the editor SHALL show the error position and keep the last valid CSS applied.
4. The editor SHALL let the user set a background image from a local file. The image SHALL be stored by the extension and applied as a `data:` URL, which FAP's `img-src` allows; remote image URLs SHALL be rejected with an explanation.
5. Custom CSS SHALL apply after preset and colour styles.
6. A "safe mode" action SHALL disable custom CSS at once. Holding Shift while the panel loads SHALL also start in safe mode, to recover from CSS that hides the panel.

### Requirement 5: Theme management

**User Story:** As a student, I want to save, switch, import and export themes, so that I can keep and share my designs.

#### Acceptance Criteria

1. The user SHALL be able to create, rename, duplicate and delete custom themes, and pick the active theme.
2. The extension SHALL export a theme as a JSON file containing a format version, the variables, tokens, custom CSS and the background image.
3. WHEN the user imports a theme file THEN the extension SHALL validate its format and show a preview with a warning that the CSS comes from outside, before saving it.
4. Imported CSS SHALL be checked for `url(` references to remote hosts and `@import`. These SHALL be removed with a notice, because they can leak page data or are not supported.
5. The extension SHALL offer an "auto" option that follows the operating system's light or dark preference, with one light and one dark theme chosen by the user.

### Requirement 6: Classic FAP layout

**User Story:** As a student used to the old FAP, I want an option to make FAP v2 look and navigate like the old FAP, so that I find things where I expect them.

#### Acceptance Criteria

1. Classic layout SHALL be an on or off setting, off by default, independent of the active theme.
2. WHEN Classic layout is on THEN the extension SHALL replace the left sidebar with a horizontal top navigation bar. The bar SHALL carry the FPT logo and "Academic Portal", dropdown menus grouped as the old FAP grouped them (Home, News, Procedures and applications, Lookup, Reports, Coursera, Information), the campus badge and the user menu.
3. Every Classic menu entry SHALL point to the corresponding FAP v2 route. Entries without a v2 route SHALL be omitted.
4. WHEN Classic layout is on THEN page content SHALL be centred in a fixed-width column.
5. WHEN Classic layout is on AND the user is on the FAP home page THEN the extension SHALL show a link directory in the old style. It SHALL group FAP v2 links under orange section headings (Registration/Application, Information Access, Reports, Regulations, Feedback, Others, Coursera), with a deadline table for application types beside it. FAP's own home content SHALL stay available below.
6. WHEN Classic layout is on AND the user is on the grade, attendance or other report pages with term and course selectors THEN the extension SHALL show the terms as a horizontal tab strip and the courses as a vertical card list. Each choice SHALL drive FAP's own selectors.
7. WHEN Classic layout is on AND the user is on the weekly timetable THEN the extension SHALL style sessions as cards in the slot-by-day grid, coloured by attendance status (present green, absent red, not yet neutral).
8. Classic layout SHALL NOT remove FAP elements that FAP's scripts depend on. It SHALL hide and re-arrange them, so that FAP keeps working. Turning Classic layout off SHALL restore FAP's layout without a reload.
9. Classic layout SHALL keep FAP's own language. Menu labels SHALL use FAP's link texts where available, and English otherwise.

### Requirement 7: Density, width and sticky headers

**User Story:** As a student, I want denser, wider pages with headers that stay visible, so that I see more data at once.

#### Acceptance Criteria

1. Compact density SHALL reduce table cell padding, card padding and line height, so that at least 25% more table rows fit in the viewport than with FAP's default on the transcript page.
2. Wide content SHALL remove FAP's content max-width so that content uses the full viewport width.
3. Sticky table headers SHALL keep the header row of FAP data tables (`table.fap-sheet`, `table.student-mark-sheet`) visible while the table scrolls.
4. Each option SHALL be a separate on or off setting, off by default, and SHALL combine with Classic layout and any theme.
5. Changes SHALL apply without a page reload and SHALL persist across pages.
