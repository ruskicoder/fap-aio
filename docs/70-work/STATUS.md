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

1. Review `version2/scaffold` before any merge or push (nothing pushed yet).
2. Fix the branch structure: `main`, `dev` and their remotes all point at `b10f788`; set up `features/Design_<Story>` and `features/Implementation_<Story>` per story (awaiting user approval).
3. Fill `10-context/` (overview, requirements) for v2.0.0, then write change specs in `.kiro/specs/` per feature: GPA, timetable and exam ICS export, cross-class exchange, theme.
4. Decide the MoveOut redesign: v2 has no student route for class schedules or class lists (see route map).

## Last sync

<!-- docs-scaffold:sync:start -->
- last_sync: 2026-10-04T18:45:09+07:00
- head: 985b9ca
- journal: 20261004-162854.md entry 011 hash dde63dff448079cc
- health: 0 error, 0 warn, 12 info
<!-- docs-scaffold:sync:end -->
