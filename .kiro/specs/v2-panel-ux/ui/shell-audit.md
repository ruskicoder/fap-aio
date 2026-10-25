# Shell UI audit (gate G-UI-SHELL)

Append-only record of the chat audit rounds. Each round lists the options shown and the owner's picks. The agreed result is folded into `requirements.md` and `design.md` when the gate passes.

## Round 1 (2026-10-25)

Shown: minimized state (A round button bottom-right, B edge tab on the right edge, C labelled pill bottom-right); mode and resize (A floating only with left and top edge handles, B docked only with a left edge handle, C both with a header toggle); header controls (A drag handle, title, dock, settings, minimize; B title, settings, minimize; C title, sync all, settings, minimize).

Owner picks:
- Minimized: B, edge tab on the right edge.
- Mode and resize: C, floating and docked, switched from the header.
- Header: A, with changes: the whole header is draggable (users will click and drag it); left side `FAP-AIO` with the version as subtext; right side Sync, Dock, Settings, Minimize.

## Round 2 (2026-10-25)

Shown: the round 1 header drawn in floating and docked modes (whole bar draggable, buttons excluded; `FAP-AIO` with `v2.0.0` from the manifest as subtext; Sync, Dock, Settings, Minimize). Questions: Sync button (A sync all, B sync current view, C menu of three); edge tab position (A fixed near the bottom, B fixed at the middle, C draggable along the edge); navigation for M1 (A Exams and Classes with an export button in each, B Classes, Exams, Export tabs, C a Schedule section tab with sub-tabs); sync status (A bottom strip always, B line at the top of each view, C bottom strip only while syncing).

Owner picks:
- Sync button: A, one click syncs this week's classes and the exams; the whole-term sync stays a button in Classes.
- Edge tab: C, draggable up and down the right edge, position remembered.
- Navigation: B, Classes, Exams, Export as tabs. Export gets a dedicated tab with many more export options; the owner details them in the Schedule audit.
- Sync status: A, bottom strip always, showing the open view's last sync and the term-sync progress.

## Round 3 (2026-10-25)

Shown: resize edges of the floating panel (A left and top edges plus the top-left corner, B all four edges and corners, C as A with an always-visible corner grip); docked panel and the page (A page narrows, overlay under 900 px, B panel covers the page, C a setting with A as default); sizes (A current spec: floating 400 x 600, min 320 x 400, max 720 wide; docked 400, 320 to 640; B roomier: 420 x 640, min 360 x 420, max 50% width; docked 420, 360 to 50%; C compact: 380 x 560, min 320 x 360, max 600; docked 380, 320 to 560); where the panel reopens from the edge tab (A last position and size, B bottom-right with the last size, C next to the edge tab); how Settings opens (A full view in the panel with a back arrow, B a tab like the others, C a separate options page in a new browser tab).

Owner picks:
- Resize edges: B, all four edges and corners.
- Docked: C, a setting to narrow or cover the page, narrow by default.
- Sizes: A, floating 400 x 600 default, min 320 x 400, max 720 wide and full viewport height; docked 400 wide, 320 to 640.
- Reopen: B, bottom-right corner with the last size.
- Settings: A, full view inside the panel with a back arrow.
- Note: the floating panel never leaves the viewport and stays contained by it while dragging and resizing, with weak edge snapping.

## Final shell prototype (2026-10-26)

Shown: an interactive prototype on a simulated 960 x 600 page combining rounds 1 to 3: the whole header drags the panel (buttons excluded), the panel stays inside the viewport and snaps to an edge within 10 px; resize from all four edges and corners within 320 to 720 wide and 400 px to full height; the dock toggle switches to a full-height right panel 320 to 640 wide, resized from its left edge, undocked by dragging the header 48 px left; the docked panel narrows the page or covers it according to a Settings choice (narrow by default); minimize leaves a vertical edge tab that drags along the right edge and, when clicked, reopens the floating panel at the bottom-right with its last size; Settings opens as a full view with a back arrow; tabs Classes, Exams and Export; the bottom strip shows the last sync and the progress while Sync runs (this week and the exams).

Owner verdict: approved 2026-10-26 ("Shell final: approved"). Saved as `shell.html`.
