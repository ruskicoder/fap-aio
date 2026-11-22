# Batch report: cloud/m3-settings (2026-11-22)

Branch `cloud/m3-settings` from `cloud/build` (0367de4). Every commit passed, in one chain with `set -o pipefail`: tsc, `eslint .`, vitest (exit 0), build, orchestrator check.

**Commits**
- `b6b4173` spec: appearance R8, panel-ux R11, info R10, with design sections, tasks, M3 registry rows, and fix rows F-23 and F-24. Old copies are under `.deprecated/2026-11-22-*`.
- `ddbaede` fix(F-24): the cause was in the panel. Under a dark theme, panel text turned near-white while backgrounds stayed light, so text inherited onto white. The panel now switches to a measured dark palette. Dark presets and Glassmorphism are retuned; Glassmorphism is now dark, dimmed glass over two muted hues. Frutiger Aero is unchanged.
- `3899d60` fix(F-23): Settings search and section buttons stay sticky and wrap, with nothing clipped at 320 px. Theme view and Info Subjects get sticky headers too.
- `7162cae` feat(INF-7.1): capstone card in Info, parsed by field icons, hidden without a topic or with "-".

**Checks:** 532 tests pass, 2 skipped. The m4 browser check passes 57/57. In each dark preset, every measured panel text on the welcome, Today and Settings is at 7:1 or more (minimum 8.2:1), with icons at 10.4:1. The check's Today step now also accepts "Courses at risk", which shows on days without classes.

**Vet list:** 11 new lines.
