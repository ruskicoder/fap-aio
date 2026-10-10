---
id: architecture.flm-subject-list
type: data-model
status: draft
owner: unassigned
summary: "FLM (flm.fpt.edu.vn) as the source of per-subject pass requirements, and the subject-list.json contract that grade prediction reads."
---

# FLM subject list

## Source

FPT University Learning Materials (`https://flm.fpt.edu.vn`) publishes the approved syllabus of every subject. It is a separate ASP.NET site from FAP, with its own sign-in. A student account sees `View Curriculum`, `View Syllabus`, `Show Learning Path of a Subject` and `A subject is the pre-requisite of`. Admin menus are in the HTML but hidden.

Each syllabus states the assessment plan: category, type (on-going or final), number of parts, weight, completion criterion, duration and CLOs. It also states `MinAvgMarkToPass`, `Is Scored`, credits, prerequisites, time allocation, attendance wording in `StudentTasks`, materials and learning outcomes. FAP shows the marks; FLM shows the rules that turn marks into pass or fail. Route details and the scrape method: [investigation](../70-work/investigations/2026-10-10-flm-syllabus-scrape.md).

## Contract

| Artifact | Path | Use |
|---|---|---|
| Full rubric | `data/flm/subject-list.json` (about 10 MB) | Subject pages, requirements view, materials, goal setting |
| Compact rules | `data/flm/subject-rules.json` (about 1.2 MB, 68 KB gzipped) | Bundled in the extension for prediction |
| Generator | `tools/flm-scraper/` | Refresh, schema, interpretation rules and flags ([README](../../tools/flm-scraper/README.md)) |
| Predictor | `tools/flm-scraper/predict.mjs`, `predict()` | Reference implementation of the pass check and tier targets |
| Mark-sheet mapper | `tools/flm-scraper/marksheet.mjs`, `rowsFromTable()`, `courseModel()` | FAP mark sheet plus FLM subject to a model `predict()` accepts |

Key: subject code (FAP and FLM use the same codes). An assessment is addressed by its `index`, the row order on FLM.

FAP mark sheets (`table.student-mark-sheet`, see [data-model.md](fap-v2/data-model.md)) map onto FLM through `tools/flm-scraper/marksheet.mjs`. The course model takes groups, items and weights from FAP, because a class can follow an older syllabus than FLM's active one. It takes completion criteria and exam kind from the best-matching FLM row (name tokens with FE/PE/PT aliases, weight, part count). Unmatched groups fall back to the owner rules. Groups with uneven item weights become a parent row with child rows, so a final's minimum applies to the group average. A graded `(Resit)` item replaces its base item. Tested on synthetic sheets only; the DOM adapter `rowsFromTable` needs a live check while signed in to FAP.

## Rules applied

[FPTU academic pass rules](../10-context/constraints.md): overall at least 5 (`MinAvgMarkToPass`, 7 for the LUK subjects), FE at least 4 or the syllabus value if higher, every progress score above 0, attendance at least 80% (100% for FOM210, HSK210, WBS210, WBS230), Coursera before the FE. Goal tiers: Pass 5, Fair 7, Good 8, Excellent 9.

## Data quality (2026-10-10 scrape)

1,020 subjects, 1,014 scored; 878 have a final, 137 are assessed by on-going work only. 79 syllabi list aggregate rows with sub-rows; 9 still do not sum to 100% (`CHG401mc`, `CHI421`, `CMO301m`, `CTG401`, `KRP492`, `KTM401`, `MKT205`, `SYB302`, `SYB303c`). Predictions for flagged subjects must show a warning.
