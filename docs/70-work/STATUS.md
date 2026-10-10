---
id: work.status
type: status
status: draft
owner: unassigned
summary: "Single living progress ledger."
---

# Status

## Current focus

FAP-AIO v2.0.0 upgrade for the rewritten FAP portal. Legacy code is preserved in `/.deprecated/` on the local branch `version2/scaffold`; `main` and `dev` are untouched. FAP v2 inventory recorded in [20-architecture/fap-v2](../20-architecture/fap-v2/README.md).

## Next steps

1. Capture remaining POST bodies with `ignore/scripts/fap-mitm.sh` (mitmproxy HAR, isolated Chrome profile) or the `chrome-devtools` MCP, for owner-approved flows only.
2. Review `version2/scaffold` before any merge or push; branch structure fix needs owner approval.
3. Re-check open-course lists, `ResolveTargetStudent` success path and the per-slot `data-edunext-url` when registration opens or a slot exposes it.
4. Re-check the shapes marked unverified in [data-model.md](../20-architecture/fap-v2/data-model.md) (application rows, payable items, feedback form, failed transcript status) when the account has such data.
5. Start the v2.0.0 extension design from [data-model.md](../20-architecture/fap-v2/data-model.md), [scripts.md](../20-architecture/fap-v2/scripts.md) and [pages.md](../20-architecture/fap-v2/pages.md).
6. Fix the branch structure: `main`, `dev` and their remotes all point at `b10f788`; set up `features/Design_<Story>` and `features/Implementation_<Story>` per story (awaiting user approval).
7. Fill `10-context/` (overview, requirements) for v2.0.0, then write change specs in `.kiro/specs/` per feature: GPA, timetable and exam ICS export, cross-class exchange, theme.
8. Decide the MoveOut redesign: v2 has no student route for class schedules or class lists (see route map). Open-class lists of the class transfer application were empty on 2026-10-04; re-check during an add/drop period.
9. (Answered 2026-10-10, see constraints.md) Decide the v2 GPA rules before the GPA spec: default non-GPA list and prefix matching, whether the replaced-subjects transcript table counts (check the owner's transcript), and a source for any exam floor ([record](investigations/2026-10-10-jpdictionary-gpa-extension.md)).
10. Grade prediction: owner answers recorded (commit `data/flm/`, 80% attendance confirmed, case-insensitive GPA match). FAP-to-FLM mapper built in `tools/flm-scraper/marksheet.mjs`; validate `rowsFromTable` and the mapping on live `/Report/Grade` pages once signed in to FAP.
11. Before the design phase: approve `.kiro/specs/v2-core-scheduler/requirements.md`; then write requirements for GPA and grade prediction against [flm-subject-list.md](../20-architecture/flm-subject-list.md) and [constraints.md](../10-context/constraints.md).

Next session (owner, 2026-10-10; done the same day, see below): statically inspect the unvetted extension at `/mnt/DATA/DATA/Github/unvetted-gpa-fap-translation/` (said to contain a GPA calculator), read-only, then compare its GPA rules with the legacy GPA feature. Requirements in `.kiro/specs/v2-core-scheduler/requirements.md` still await owner approval.

Done 2026-10-10 (later): owner pass rules and GPA decisions recorded in [constraints.md](../10-context/constraints.md). FLM scraped read-only: 1,020 syllabi into `data/flm/subject-list.json` and `subject-rules.json` with `tools/flm-scraper/` ([record](investigations/2026-10-10-flm-syllabus-scrape.md), [contract](../20-architecture/flm-subject-list.md)).

Done 2026-10-10: the unvetted `unvetted-gpa-fap-translation/3.3.4_0` is "Japanese Dictionary JP" 3.3.4, a dictionary and tooltip translator with `<all_urls>` access, not a FAP extension; a small FAP GPA helper is appended to `popup2.js`. Store hashes match. GPA rules compared with legacy and FPTU Schedule ([record](investigations/2026-10-10-jpdictionary-gpa-extension.md)). Correction to journal entry 010: the renamed scheduler folder is `unvetted-fap-new-scheduler`.

Done 2026-10-05: owner decisions recorded in [decision 0001](../60-decisions/0001-v2-extension-foundations.md); legacy FAP `localStorage` keys exported to `ignore/legacy-storage/` and cleared; requirements drafted in `.kiro/specs/v2-core-scheduler/requirements.md`, awaiting owner review.

Done 2026-10-04: scheduler comparison and v2.0.0 module feasibility ([record](investigations/2026-10-04-scheduler-comparison-and-v2-scope.md)). Third-party FPTU Schedule 4.0.0 analyzed ([record](investigations/2026-10-04-fptu-schedule-extension.md)). Five student data domains verified at field level in [data-model.md](../20-architecture/fap-v2/data-model.md). `chrome-devtools` MCP attached to the owner's Chrome; page scripts, globals, DOM events and the function-to-endpoint matrix recorded in [scripts.md](../20-architecture/fap-v2/scripts.md).

## Last sync

<!-- docs-scaffold:sync:start -->
- last_sync: 2026-10-10T23:10:30+07:00
- head: ae0ae36
- journal: 20261010-223451.md entry 005 hash c3ee5897b5b6725f
- health: 0 error, 0 warn, 11 info
<!-- docs-scaffold:sync:end -->
