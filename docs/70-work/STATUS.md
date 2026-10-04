---
id: work.status
type: status
status: draft
owner: unassigned
summary: "Single living progress ledger."
---

# Status

## Current focus

FAP-AIO v2.0.0 upgrade for the rewritten FAP portal. Legacy code is preserved in `/.deprecated/` (moved 2026-10-04, staged, not committed). FAP v2 inventory recorded in [20-architecture/fap-v2](../20-architecture/fap-v2/README.md).

## Next steps

1. Commit the `.deprecated/` move, `node_modules` untracking and the docs scaffold (awaiting user approval).
2. Fix the branch structure: `main`, `dev` and their remotes all point at `b10f788`; set up `features/Design_<Story>` and `features/Implementation_<Story>` per story (awaiting user approval).
3. Fill `10-context/` (overview, requirements) for v2.0.0, then write change specs in `.kiro/specs/` per feature: GPA, timetable and exam ICS export, cross-class exchange, theme.
4. Decide the MoveOut redesign: v2 has no student route for class schedules or class lists (see route map).

## Last sync

<!-- docs-scaffold:sync:start -->
- last_sync: 2026-10-04T16:36:57+07:00
- head: b10f788
- journal: 20261004-162854.md entry 005 hash 32cca66a8f19bd58
- health: 0 error, 0 warn, 12 info
<!-- docs-scaffold:sync:end -->
