---
id: context.constraints
type: constraints
status: draft
owner: unassigned
summary: "Regulatory, client, and technical constraints, including the FPTU academic pass rules that grade features must follow."
---

## Constraints

### FPTU academic pass rules

Stated by the owner on 2026-10-10. These rules apply to every grade, prediction and GPA feature. Per-subject values come from the FLM syllabus ([subject list](../20-architecture/flm-subject-list.md)). A syllabus value applies to its subject, except that an FE minimum is never below 4.

1. Overall: a subject is passed only when the weighted overall score is at least 5 (FLM `MinAvgMarkToPass`; 5 on 1,008 scored syllabi, 7 on `LUK1` to `LUK6`).
2. Final exam (FE): the FE score must be at least 4. Some syllabi set 5 or 6.
3. Practical exam (PE): some PE components may be below 4 but must be above 0. Others require at least 4 or at least 5; this is subject-specific and read from the syllabus completion criteria (2026-10-10 scrape: 26 PE rows need 4, 13 need above 0, 1 needs 2).
4. Progress (in-class) scores: every progress component must be above 0. A 0 in any column fails the subject, even before FE or PE.
5. Attendance score: some subjects grade attendance or participation. The lecturer computes it; no general rule applies.
6. Attendance: the student must attend at least 80% of the total slots, otherwise the subject is failed. Example: 20 slots, at least 16 attended, at most 4 absences (confirmed by the owner 2026-10-10). FLM syllabi state 80% in `StudentTasks` (823 state it, the rest default to 80%); `FOM210`, `HSK210`, `WBS210` and `WBS230` require 100%.
7. Coursera: some subjects require Coursera courses (most codes ending in `c`, also some regular subjects). All designated courses must be completed before the FE, otherwise the FE score is not validated. Completing after the first FE invalidates that FE score; completing after the resit (RE) invalidates the RE score, which means the subject is failed.

### GPA calculation (owner decisions 2026-10-10)

- Default non-GPA list: the list used by the third-party "Japanese Dictionary JP" helper, `GDQP, ENT, VOV, TRS, ÐSA, ĐSA, TMI, LAB, OJS, OJT, SYB301` ([record](../70-work/investigations/2026-10-10-jpdictionary-gpa-extension.md)); user-editable.
- Matching: case-insensitive; `prf192` matches `PRF192` and `prf192` (owner, 2026-10-10). An entry matches a subject code that starts with it, so group entries such as `GDQP` keep working; no wildcards.
- The replaced-subjects transcript table does not count toward GPA. A replaced subject only indicates that it supersedes an older subject.
- The 4.0 minimum for the final exam is kept in predictions (rule 2 above).
