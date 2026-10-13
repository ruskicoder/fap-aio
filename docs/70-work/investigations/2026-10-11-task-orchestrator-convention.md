---
id: work.investigations.10-11-task-orchestrator-convention
type: investigation
status: draft
owner: unassigned
summary: "Should one central task orchestrator file (with a checker) become a convention in the owner's global prompt orchestrator? Recommendation: yes, as an opt-in workflow for multi-spec work, with the rules and conflicts listed here."
---

# Central task orchestrator file as a convention

## Goal

The owner asked (2026-10-11) for all spec tasks to be linked through one central orchestrator file that tracks state and knows what is next and what needs fixing, so that implementation can run as an autonomous loop. The owner also asked whether this convention is worth adding to the main prompt orchestrator (`~/.claude/AGENTS.md`), which the owner will evaluate and upgrade.

Built for FAP-AIO as a trial:
- [`.kiro/orchestrator.md`](../../../.kiro/orchestrator.md): loop control switches, loop protocol, gates, task registry with dependencies, waves, fix queue, decision queue, log.
- `tools/orchestrator/orchestrator.mjs`: `check`, `next`, `waves`, `status`.
- Six `tasks.md` files whose phases and subtasks carry global ids (`PLT-4.2`).

## Findings

### Sources

| Source | What it says | Bearing |
|---|---|---|
| [Anthropic, Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | A structured feature list with a `passes` field the agent may only flip, plus a plain-text progress log and git history. The agent picks the highest-priority unfinished feature and works on one at a time. JSON is used because the model is "less likely to inappropriately change or overwrite JSON files compared to Markdown files". Failure modes addressed: premature victory, undocumented progress, incomplete features, startup confusion. | The core pattern: one tracking file, one item per iteration, status-only edits, verification before marking done. |
| [Kiro specs](https://kiro.dev/docs/specs/), [Kiro best practices](https://kiro.dev/docs/specs/best-practices/) | `tasks.md` per spec; "Run all Tasks" builds a dependency graph and runs independent tasks in waves; many specs per repository are recommended. Neither page describes dependencies between specs. | Kiro covers order inside one spec only. A project with several specs that depend on each other needs something above them. |
| `~/.claude/AGENTS.md` and `~/.claude/rules/instructions.instructions.md` (read 2026-10-11) | One task at a time, stop after each task for review; no automatic progression; no unsolicited commits; loop detection after more than 2 identical attempts; file-edit oscillation stop; crash-safe checkpoints. The `agent-loop` workflow keeps a todo list in the conversation only. | The global rules have no persistent, cross-session task state, and their stop-after-each-task rule conflicts with an autonomous loop unless the loop has an explicit mode switch. |

### What the trial showed

- The checker found a real scheduling flaw before any code existed. Several phases depended on whole phases whose last subtask waits for an owner gate (fixtures, settings view), which would have stalled about half the graph. The fix was to depend on specific subtasks and to move gated subtasks to the end of their phase. Judging the order by reading the task files would likely have missed this.
- A computed `next` keeps the order deterministic: wave first, then spec order, then number. In the fault-injection test it held work behind an open gate, released the next subtask after a gate passed and a box was ticked, and reported a false `done`, an unknown gate and an injected cycle.
- Separating gates (owner or live actions) from tasks kept the `tasks.md` files coding-only, as the Kiro rules require. The loop can then run to the next gate and stop with a precise request.

### Costs and risks

| Risk | Mitigation in the trial |
|---|---|
| The orchestrator and `tasks.md` drift apart | Ids are written in both and the checker cross-validates them; the status of a phase is derived from its checkboxes |
| The agent rewrites the plan to make progress look better | Edit rules allow status, fix, decision and log edits only; the checker rejects a `done` with unchecked subtasks. Markdown is easier to overwrite than JSON (Anthropic); a pre-commit run of `check` limits the damage |
| Duplication with `STATUS.md` and the session journal | Roles split: the orchestrator holds the current task state; `STATUS.md` holds the human narrative and points to it; the journal holds the audit history |
| An autonomous loop violates "stop after each task" and "no unsolicited commits" | `mode: step` (default) keeps the Kiro rule; `autocommit: false` by default; `paused: true` until the owner approves |
| Retry loops | `max_attempts: 2` matches the AGENTS.md loop and oscillation thresholds and moves the task to the fix queue as blocking |
| Overhead on small work | Only worth it for two or more specs, or more than about 15 tasks, or work spanning sessions; Kiro's own run-all covers a single spec |

## Outcome

Recommendation: worth adding, as an opt-in workflow, not as an always-on rule. Proposed text for the owner to evaluate (not applied to `~/.claude/AGENTS.md`):

```markdown
### Task orchestrator (multi-spec or multi-session implementation)

WHEN a project has two or more specs with cross-spec dependencies, or more than about 15 tasks, or work that spans sessions THEN keep one orchestrator file (`.kiro/orchestrator.md`) beside the specs:
- Loop control: mode (step | phase | auto, default step), autocommit (default false), max_attempts (default 2), paused.
- Gates: owner or live checkpoints, never passed by the agent.
- Task registry: one row per phase (plus subtask rows with extra dependencies or gates), with depends-on, gates and status.
- Fix queue, decision queue, append-only log.

Task ids are global (`<SPEC>-<phase>.<sub>`) and appear in both the registry and `tasks.md`. A checker validates both and computes `next`; the agent never chooses the order by judgment.

Each iteration: check, then pick (blocking fixes first, then `next`), then load all three spec documents, implement one subtask, verify with tests, tick the box, update status, log and journal; commit only when autocommit is on. On failure, revert and add a fix row; after max_attempts, block and stop. Stop at the mode boundary, at a gate, or at a decision.

The agent edits only status, fix, decision and log entries. Plan changes need the owner.
```

Open choices for the owner:
1. Format: Markdown tables plus a checker (this trial), or a JSON state file (Anthropic's choice) with a generated Markdown view.
2. Where the checker lives: per project (this trial), or as a shared tool in the skills folder that takes the project path.
3. Whether the `agent-loop` workflow should read and write this file when it exists, replacing its in-conversation todo list.
