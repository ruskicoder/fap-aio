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

Done 2026-10-04: scheduler comparison and v2.0.0 module feasibility ([record](investigations/2026-10-04-scheduler-comparison-and-v2-scope.md)). Third-party FPTU Schedule 4.0.0 analyzed ([record](investigations/2026-10-04-fptu-schedule-extension.md)). Five student data domains verified at field level in [data-model.md](../20-architecture/fap-v2/data-model.md). `chrome-devtools` MCP attached to the owner's Chrome; page scripts, globals, DOM events and the function-to-endpoint matrix recorded in [scripts.md](../20-architecture/fap-v2/scripts.md).

## Last sync

<!-- docs-scaffold:sync:start -->
- last_sync: 2026-10-04T22:13:36+07:00
- head: 065fad3
- journal: 20261004-213350.md entry 005 hash d36816c2457f3055
- health: 0 error, 0 warn, 12 info
<!-- docs-scaffold:sync:end -->
