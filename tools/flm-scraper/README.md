# FLM syllabus scraper

Builds `data/flm/subject-list.json`, a rubric of every subject on FPT University Learning Materials (`https://flm.fpt.edu.vn`): assessments, weights, completion criteria, attendance, Coursera, prerequisites, materials and learning outcomes. FAP-AIO v2 uses it to predict the scores a student needs per goal tier. Rules behind the prediction: [constraints.md](../../docs/10-context/constraints.md). Findings: [investigation](../../docs/70-work/investigations/2026-10-10-flm-syllabus-scrape.md).

| File | Runs in | Does |
|---|---|---|
| `flm-scraper.js` | Browser, on `flm.fpt.edu.vn`, signed in (student role) | Lists every syllabus and fetches each detail page. GET only, 3 parallel requests, 150 ms pause. Output: raw dump in FLM's own labels. |
| `build-subject-list.mjs` | Node 18+, no dependencies | Raw dump to `subject-list.json` (full) and `subject-rules.json` (compact, for bundling). |
| `predict.mjs` | Node or the extension (pure `predict()` export) | Pass check and per-tier required scores for one subject. |
| `marksheet.mjs` | Browser (`rowsFromTable`) and Node (`courseModel`) | FAP mark sheet plus FLM subject to a course model and scores for `predict()`. |

## Refresh

1. Open `https://flm.fpt.edu.vn` and sign in.
2. DevTools console: paste `flm-scraper.js`, then `await flmScrape({ download: true })`. A full run (1,020 syllabi on 2026-10-10) takes about 4 minutes and saves `flm-raw-YYYY-MM-DD.json`. Options: `delayMs`, `concurrency`, `limit`, `only: ['PRF192']`, `onProgress(done, total, code)`.
3. Keep the raw dump in `ignore/flm/` (git-ignored, about 25 MB).
4. `node tools/flm-scraper/build-subject-list.mjs ignore/flm/flm-raw-YYYY-MM-DD.json data/flm`
5. Review the printed flag counts against the previous run.

Prediction check:

```bash
node tools/flm-scraper/predict.mjs data/flm/subject-rules.json PRF192 '{"0":[8],"1":[7],"2":[6,7],"3":[9,9,9,9,9]}' 18/20
```

## FLM routes used

| Route | Use |
|---|---|
| `GET /gui/role/student/SyllabusManagement?searchOn=Code&keyword=<k>` | Substring search on subject code. An empty keyword returns nothing, so the scraper unions the 36 searches `A`..`Z`, `0`..`9`. The student view lists one active, approved syllabus per code. |
| `GET /gui/role/student/SyllabusDetails?sylID=<id>` | Detail page. `#table-detail` (key/value rows), `#gvMaterial`, `#gvLO`, `#gvSchedule`, `#gvCQ`, `#gvAssessment`. |

## subject-list.json (schema version 1)

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "ISO time",
  "source": { "site": "https://flm.fpt.edu.vn", "scrapedAt": "ISO time", "tool": "tools/flm-scraper" },
  "rules": {                       // owner defaults; syllabus values override (FE never below finalExamMin)
    "minAvgMarkToPass": 5, "finalExamMin": 4, "progressMin": { "value": 0, "inclusive": false },
    "attendanceMinPercent": 80, "slotMinutes": 135,
    "tiers": [ { "id": "pass", "minAverage": 5 }, { "id": "fair", "minAverage": 7 },
               { "id": "good", "minAverage": 8 }, { "id": "excellent", "minAverage": 9 } ]
  },
  "stats": { "subjects", "scored", "withFinal", "courseraMentioned", "courseraRequired", "flags": { "<flag>": n }, "scrapeErrors" },
  "errors": [ { "sylId", "code", "error" } ],
  "subjects": {
    "PRF192": {
      "code": "PRF192", "sylId": 12223,
      "name": { "en": "Programming Fundamentals", "vi": "Cơ sở lập trình" },
      "credits": 3, "degreeLevel": "Bachelor", "method": "...",
      "prerequisites": { "raw": "", "codes": [] },           // codes: subject codes found in the free text
      "scored": true, "scoringScale": 10, "minAvgMarkToPass": 5,
      "decision": { "number": "1286/QĐ-ĐHFPT", "date": "2024-11-22" }, "approvedDate": "2024-11-22",
      "isActive": true, "isApproved": true,
      "timeAllocation": "Study hour (150h) = 45h contact hours + ...", "contactHours": 45,
      "syllabusSessions": 60,                                // rows of the session plan, not FAP slots
      "attendance": { "minPercent": 80, "source": "syllabus" | "default", "evidence": "..." },
      "hasFinal": true,
      "coursera": { "mentioned": false, "required": false, "bonus": false, "suffixC": false, "evidence": [] },
      "assessments": [ {
        "index": 0,                                          // row order on FLM; key for predict() scores
        "category": "Assignment",
        "type": "ongoing" | "final" | "other", "typeRaw": "on-going",
        "finalKind": null | "FE" | "PE" | "presentation" | "resit",
        "parts": 1, "weight": 0.15, "weightPerPart": 0.15,  // weight is the row total, split evenly over parts
        "completion": { "value": 0, "inclusive": false },    // score must be > 0; null when the cell is empty
        "completionRaw": ">0",
        "parentIndex": null,                                 // set on sub-rows of an aggregate row
        "duration", "clo", "questionType", "questions", "knowledgeAndSkill", "gradingGuide", "note"
      } ],
      "weightSum": 1,                                        // over rows with parentIndex null
      "flags": [],
      "materials": [ { "description", "author", "publisher", "published", "edition", "isbn", "isMain", "isHardCopy", "isOnline", "note" } ],
      "clos": [ { "id": "CLO1", "details": "..." } ],
      "description", "studentTasks", "tools", "note"
    }
  }
}
```

`subject-rules.json` has the same top level with `"kind": "compact"`. Each subject keeps `code`, `name` (English), `credits`, `scored`, `scoringScale`, `minAvgMarkToPass`, `prerequisites` (codes), `attendance`, `coursera` (`required`, `bonus`), `hasFinal`, the assessment fields `predict()` reads, `weightSum`, `flags` and `sylId`.

### Interpretation rules

- Completion criterion: `>X` is exclusive, a bare number is inclusive (`4` means at least 4), a bare `0` means above 0.
- Type comes from the Type column: Final, Thi cuối kỳ, kết thúc, FE, PE, TE, Defense, bảo vệ and practical exam are finals; on-going (and its PDF-broken spellings), midterm, quiz and assignment are progress. The Category column is used only when Type is empty.
- Final kind: practical or `PE` gives PE, presentation, defense or project gives presentation, resit wording gives resit, anything else is FE.
- Aggregate rows: when the weights add up to more than 100%, a row with several parts whose part count and weight equal the sum of a subset of same-type rows becomes their parent (JPD113 "Thi cuối kỳ" 45% = 15% + 30%). Progress sub-rows must share a name prefix with the parent; final sub-rows may be named by skill only. Linking stops once the counted weight is 100% and never goes below it.
- Coursera required: mandatory wording (must, in order to, certificate, điều kiện, phải, ...) near a Coursera or MOOC mention, a Coursera assessment row, or a `c` subject whose finals come from the specialization.
- Attendance: "at least X%" gives X; "misses X% ... fail" gives 100 - X; otherwise the 80% default.

### Flags

| Flag | Meaning |
|---|---|
| `has-subcomponents` | Aggregate rows linked; prediction scores the sub-rows. |
| `weights-not-100` | Counted weights do not sum to 100% after linking. FLM data entry; check before trusting predictions. |
| `criterion-suspect` | A progress criterion above 5 (seen: `10` on mentor Q&A rows of `b` subjects). Kept as written. |
| `type-unclassified` | A Type value outside the known set. |
| `pdf-artifacts` | Broken words from a PDF import (`on- goin g`). Parsed anyway. |
| `no-assessment` | Scored syllabus without an assessment table. |

## predict()

`predict(subject, scores, { attendance: { attended, total }, courseraDone })`, `scores = { "<assessment index>": [part1, part2, ...] }`. Applies the owner rules: FE at least 4 (or the syllabus value if higher), every progress score above 0, attendance threshold, the Coursera warning, and an aggregate's criterion on its sub-rows' weighted average. For each tier it finds the smallest uniform score on the remaining components (0.1 steps) such that the weighted total reaches the tier, raising each component to its own floor. It returns per-component minimums or `reachable: false`.

## marksheet.mjs

`courseModel(flmSubject | null, rows)` returns `{ subject, scores, mapping }`. Weights and items come from the FAP mark sheet. Criteria and exam kind come from the matched FLM row; the score adds name similarity (token overlap with FE, PE, TE, PT, lab and similar aliases), 0.5 for equal weight and 0.25 for equal part count, and needs at least 0.5. Uneven item weights inside a group become a parent row with child rows. A graded `(Resit)` item replaces the base item of the same name. `mapping` lists each FAP group, its FLM match and the confidence, so the UI can show weak matches.

Not modelled: bonus points, free-text extra conditions (for example `SWP391` "average on-going at least 5 to qualify for final"), resit (RE) scenarios, lecturer-computed attendance scores, per-subject rounding of the average.
