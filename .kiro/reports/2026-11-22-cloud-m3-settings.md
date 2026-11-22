# Batch report: cloud/m3-settings (2026-11-22)

Branch `cloud/m3-settings` from `cloud/build` (0367de4). Every commit passed one `pipefail` chain: tsc, `eslint .`, vitest (exit 0), build, orchestrator check.

**Commits**
- `b6b4173` spec: appearance R8, panel-ux R11, info R10, with design, tasks, M3 registry rows and fixes F-23, F-24. Old copies are under `.deprecated/2026-11-22-*`.
- `ddbaede` fix(F-24): under a dark theme the panel turned its text near-white but kept light backgrounds. It now switches to a measured dark palette. Dark presets and Glassmorphism are retuned; Glassmorphism becomes dimmed dark glass over two muted hues. Frutiger Aero is unchanged.
- `3899d60` fix(F-23): sticky Settings search and wrapping section buttons, none clipped at 320 px. Theme view and Info Subjects also get sticky headers.
- `7162cae` feat(INF-7.1): capstone card in Info, parsed by field icons, hidden without a topic.

**Checks:** 532 tests pass, 2 skipped; m4 browser check 57/57. In every dark preset, all measured panel text on the welcome, Today and Settings is at 7:1 or more (minimum 8.2:1). The check's Today step now accepts "Courses at risk", which shows on days without classes.

**Vet list:** 11 new lines.
