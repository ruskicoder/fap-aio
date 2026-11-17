# Vet list for the final UAT

Choices made without an audit (owner instruction D-9, 2026-11-17). One line each: screen or area, choice made, alternative.

- GRD-1.2 mark sheet summary: rows told apart by shape (`%` value, status class), not label; live check owed on a real vi and en mark sheet with a penalty and a bonus | alternative: match vi and en labels from a constant table.
- PLT-8.1 grant window header: FAP-AIO mark (24 px logo) with "Permission" as the small second line, in the shell header colours | alternative: the version number, as in the panel header.
- PLT-8.1 grant window buttons: coral primary button for the ask state, a grey outline Close button for refused and expired | alternative: coral for Close too.
- PLT-8.1 dependent setting keys: `schedule.reminders.enabled`, `alerts.notify.<kind>` and `info.flmRefresh.enabled` are what the service worker turns off | alternative: names chosen by the settings registry (PNL-8.1), mapped here.
- PLT-8.1 removal alert kinds: notifications removed is a `reminder` alert, FLM access removed is a `sync` alert | alternative: a new `permission` alert kind.
- PLT-8.1 refusal: a refused grant also turns the dependent settings off in the service worker, besides the panel reverting its toggle | alternative: leave it to the panel only.
- PNL-3.1 colour tokens: `--aio-*` neutral values equal the current light look; existing M1 components keep their Tailwind gray and orange classes (no visible change), new views use the `aio-*` token classes | alternative: migrate every M1 component to the tokens now.
- PNL-3.1 targets: every button is at least 24 by 24 px, which widens the small move and remove buttons inside the Export chips | alternative: keep them small and rely on chip spacing.
- PNL-3.1 focus: controls without their own ring get a 2 px coral outline on keyboard focus | alternative: a ring (box-shadow) like the existing controls.
- PNL-3.1 density: compact changes text, small text, control height (where `h-control` is used), row padding and gaps; header icon buttons stay 36 px | alternative: also shrink the header buttons.
- PNL-3.2 screen reader labels in Export: the move and remove buttons now read "Move room left", "Remove classes reminder 2 hours" (item names in lower case inside the sentence) | alternative: keep the capitalised item names.
- PNL-6.1 bell: a header button between Sync and Dock, with a coral count badge; the agreed shell had no bell because no inbox shipped in M1 | alternative: the bell after Settings, or the count in the status strip.
- PNL-6.1 inbox popover: 340 px wide, under the header at the right edge, heading "Alerts", "Mark all read" and a close button; kind filter chips only when two or more kinds are present | alternative: a full panel view with the tabs hidden, like Settings.
- PNL-6.1 inbox rows: a coral dot and bold title for unread, the detail line, then kind and time ("2 min ago"); a click marks read and follows the deep link | alternative: a separate "Mark read" button per row.
- PNL-6.1 empty inbox copy: "No alerts yet. Sync failures, grade warnings and reminders show up here." | alternative: "No alerts".
- PNL-6.1 kind labels: Attendance, News, Coursera, Grades, Reminders, Sync, Session, Challenge | alternative: wording from the en and vi copy pass.
- PNL-6.1 minimized tab: the unread count as a coral badge under the FAP-AIO label | alternative: a dot without a number.
- PNL-8.1 Settings in M2 shows only the General section (page-aware tab, density, when docked); other sections appear as their features ship | alternative: list all nine sections with "coming later" notes (against conventions rule 10).
- PNL-8.1 setting row: label, one-line description, "Default: X" in small grey, a coral dot for a changed value; toggles sit on the right, choices of up to three are radio buttons under the text, longer lists a select | alternative: every choice as a select.
- PNL-8.1 section headings: small grey upper-case labels ("GENERAL") | alternative: sentence-case headings at body size.
- PNL-8.1 section index: hidden while only one section exists; with two or more, a sticky list on the left while docked and a "Go to section" select while floating | alternative: always show it.
- PNL-8.1 General copy: "Open the tab for the page", "Density" ("Compact fits more rows; comfortable is easier to read."), "When docked" ("Narrow the FAP page so nothing is hidden, or let the panel cover its right side.") | alternative: wording from the en and vi copy pass.
- PNL-8.1 the default goal tier listed under General in R8.1 is left to GRD-3.1, whose task places it in the Grades section | alternative: move it to General.
