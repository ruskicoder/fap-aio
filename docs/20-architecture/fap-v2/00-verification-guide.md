---
id: architecture.fap-v2.verification-guide
type: guide
status: draft
owner: unassigned
summary: "How to re-scrape FAP v2 read-only and re-check this section."
---

# Re-verifying the FAP v2 section

FAP can change without notice. Re-check this section before starting a feature that depends on it, and whenever a FAP-AIO feature breaks on a page that used to work.

## Rules

- Read-only. Use GET only. Never submit a form, never call a POST endpoint, never click a payment, cancel, register or create button.
- Use your own logged-in session. Raw dumps contain personal data (name, roll number, grades, transactions); keep them in the git-ignored `ignore/scrape/` folder and never commit them.
- Record structure (routes, parameters, columns, selectors), never values.

## Procedure

1. Log in to `https://fap.fpt.edu.vn` in Chrome and open DevTools on any page.
2. Paste the crawler from `ignore/scripts/fap-crawl.js` into the console (see `ignore/scripts/README.md`). It fetches every sidebar route and the known detail and partial pages, parses them with `DOMParser`, mines the page scripts for call sites, and prints one JSON object.
3. Save the output to `ignore/scrape/YYYY-MM-DD.json`.
4. Diff against the previous dump. For each change, update [endpoints.md](endpoints.md), [pages.md](pages.md), [platform.md](platform.md) or [route-map.md](route-map.md). A changed endpoint or column is substantive: run `docs_scaffold.py deprecate <file> --reason "..." --keep` before editing.
5. Update `verified` in this section's README by hand (`sources` is empty, so `verify` has nothing to compare) and add a dated record under `70-work/investigations/`.

## Spot checks

| Check | Expect |
|---|---|
| Footer text on any page | `Version: 2.0.0.0` (a different version means re-scrape everything) |
| `GET /Report/Transcript`, count of `table.fap-sheet` | 2, first header row has 10 cells |
| `GET /WeeklyTimetable/WeekPartial?referenceDate=<today>` | 200, contains `.weekly-timetable-grid` |
| `GET /ExamSchedule`, header row | 8 cells starting with `Date`, `Time`, `Room`, `Subject` |
| Response header `content-security-policy` on `/` | `connect-src 'self'` plus Google hosts only |
