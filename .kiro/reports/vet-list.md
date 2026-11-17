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
