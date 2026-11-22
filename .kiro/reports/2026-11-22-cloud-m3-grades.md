# Cloud run 2026-11-22: M3 grades (GRD-7)

Branch `cloud/m3-grades` from `cloud/build`. Every subtask passed tsc, `eslint .`, vitest (exit 0), build and the orchestrator check.

| Commit | Task | Files | Tests |
|---|---|---|---|
| d78499f | spec | requirements R13 to R16, design, tasks, registry row; `.gitnexus/` ignored by ESLint | - |
| 2d58959 | GRD-7.1 | engine/scale.ts, scale-setting.ts, GpaView, CoursesView | 85 files, 526 passed, 2 skipped |
| c8710c7 | GRD-7.2 | record.ts, record-model.ts, RecordView, transcript meta, catalog | 86, 536 |
| 263ff23 | GRD-7.3 | pages/print/, print-window.ts, record-export.ts | 87, 544 |
| 2d8c975 | GRD-7.4 | parse/attendance.ts, attendance.ts, AttendanceView, record job steps | 88, 554 |
| 07e7998 | F-23, M4 | nav.tsx, m4-check.mjs | 88, 554 |

M4 browser check: 76 of 77. The failing check (Today line) fails on untouched `cloud/build` too; logged as F-24.

## Conversion table

A 8.5 to 10 = 4, B 7.0 to 8.4 = 3, C 5.5 to 6.9 = 2, D 4.0 to 5.4 = 1, F below 4.0 = 0; grades rounded to one decimal first. Attributed to Circular 08/2021/TT-BGDĐT, but the official text could not be opened here (vbpl.vn, moet.gov.vn and thuvienphapluat.vn unreachable). This is the common five-band table, as secondary legal summaries give it. A check is owed (vet list).

## Not done

- Live attendance selectors: no fixture has an absent session. Built from pages.md with a raw fallback; the live check waits on G-SELECTORS.
- Courses predictions do not use attendance yet (R5.6 unchanged).
- `readGradeSettings` and `computeGpa` are GitNexus CRITICAL, so both were left unchanged and wrapped instead.

## Vet list

29 lines added: GRD-7.1 (5), GRD-7.2 (8), GRD-7.3 (7), GRD-7.4 (8), F-23 (1).
