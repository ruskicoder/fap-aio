---
id: work.investigations.10-10-flm-syllabus-scrape
type: investigation
status: draft
owner: unassigned
summary: "Read-only scrape of every syllabus on flm.fpt.edu.vn into subject-list.json, for per-subject pass requirements and goal-tier score prediction."
---

# FLM syllabus scrape (2026-10-10)

## Goal

Owner request: build a reusable tool that reads every subject's requirements from FPT University Learning Materials (FLM) and writes one `subject-list.json`. FAP-AIO v2 will use it to predict the scores a student needs for each goal tier (Pass 5, Fair 7, Good 8, Excellent 9), including FE and PE targets. Neither legacy FAP-AIO nor the third-party extensions read FLM.

Rules: the owner's signed-in Chrome, through the `chrome-devtools` MCP, in a new background tab. GET requests only, student routes only. FLM is a separate site from FAP; no FAP page was opened.

## Findings

### Site

| Item | Finding |
|---|---|
| Stack | ASP.NET (WebForms `.aspx` and MVC routes), Bootstrap 4, jQuery. Own session; the account shows `User's role: Student`, education level `FPTU`. |
| Student menu | `/gui/role/student/ListCurriculum`, `/gui/role/student/SyllabusManagement`, `/gui/tool/AllPrequisiteSubject.aspx`, `/gui/tool/AllCorollarySubject.aspx`. About 60 admin links (add curriculum, import syllabus, export grading structure, user management, ...) are in the HTML inside a `display: none` panel. None was opened. |
| Syllabus search | `GET /gui/role/student/SyllabusManagement?searchOn=Code|Name&keyword=` is a case-insensitive substring search with no paging. An empty keyword returns no table. One search per letter and digit (36 requests) gives the full list: 1,020 syllabi, one per subject code, all `IsActive` and `IsApproved`. |
| Syllabus detail | `GET /gui/role/student/SyllabusDetails?sylID=<id>`, about 110 KB of server-rendered HTML. Stable ids: `#table-detail` (20 key/value rows), `#gvMaterial`, `#gvLO`, `#gvSchedule`, `#gvCQ`, `#gvAssessment`. The assessment header is identical on all 1,015 syllabi that have one: No., Category, Type, Part, Weight, Completion Criteria, Duration, CLO, Question Type, No Question, Knowledge and Skill, Grading Guide, Note. |
| Language | Labels are English; content is English, Vietnamese or mixed (`JPD113`, `CHI*` and `KRL*` assessment names are Vietnamese, `OJT202` is bilingual). The site has an en/vi selector; it was not changed. |
| Run | 1,020 detail pages plus 36 list pages in 3 minutes 59 seconds (3 parallel, 150 ms pause), 0 errors. Raw dump 25 MB, kept in `ignore/flm/flm-raw-2026-10-10.json` (git-ignored). |

### Requirements data (normalized)

| Measure | Value |
|---|---|
| Subjects | 1,020; scored 1,014; not scored (pass by completion) `ADP201`, `ECL301`, `LAB101`, `LAB211`, `LAB221`, `LAB231` |
| `MinAvgMarkToPass` | 5 on 1,008; 7 on `LUK1` to `LUK6` |
| Credits | 3 on 852, 6 on 57, 10 on 44 (OJT and capstones), 0 on 28, 2 on 27, others rare |
| With a final | 878. 137 scored subjects have on-going work only (design, art and project subjects). |
| Final kinds (counted rows) | FE 842, presentation or defense 64, PE 40 |
| FE criterion | 4 on 783 rows, 5 on 19, 6 on 1, 0 or empty on 39 (the predictor applies 4) |
| PE criterion | 4 on 26 rows, above 0 on 13, 2 on 1 |
| Progress criterion | `>0` on 3,145 rows; 4 on 164; 5 on 47; other values on 47 |
| Attendance | 80% on 1,016 (stated by 823, default for the rest); 100% on `FOM210`, `HSK210`, `WBS210`, `WBS230`; `DTG201`, `GDG401` phrase it as "misses 20% ... will fail" |
| Coursera | Mentioned by 140, required by 135 (104 codes end in `c`; 33 required subjects do not end in `c`, for example `CSI106` "AI For Everyone"); bonus points mentioned by 57 |
| Prerequisites | 670 subjects name at least one subject code in free text (for example `SWP391`: "PRJ301, SWE201c or SWE202c, pass LAB211") |
| Materials | 4,860 entries, 1,482 with ISBN |
| Approved dates | 2014 to 2026; most in 2024 to 2026 (670 of 1,020) |

### Data-quality cases the normalizer handles

- Type spellings: `on-going`, `Ongoing`, `on going`, `on - going`, PDF-broken `on- goin g` (`EXE101`), `midterm exam`, `quiz`; finals as `Final exam`, `Final`, `FE`, `PE`, `practical exam`, `Defense`, `capstone project defense`, `Thi cuối kỳ`, `Final exam phần nói`.
- Aggregate rows: 79 syllabi list a total row and its parts (`JPD113` "Thi cuối kỳ" 2 parts 45% = 15% + 30%; `CHI111` 3 parts 40% = 15% + 15% + 10%; `CHN111` progress 3 parts 45% = 30% + 15%). Linked by part count, weight and name prefix. Two candidate subsets fit `CHN111`; name similarity picks the right one.
- Weight is the row total, split evenly over parts (`PRF192` Progress test, 2 parts at 15% total).

### Not resolvable from FLM (flagged in the data)

- Weights do not sum to 100% on 9 syllabi: `CHI421` (sums to 15%, percent entered as tenths), `MKT205`, `SYB302`, `SYB303c` (final entered as 1%), `CHG401mc`, `CMO301m`, `KRP492` (90% to 95%), `CTG401`, `KTM401` (ambiguous aggregates).
- `BDP301b` to `BDP304b`, `CPP201b`, `CQT201b`: completion criterion `10` on mentor Q&A and quiz rows.
- `AIT091`: pass/complete types (`Completion / Pass-Complete`).
- `OTP101`: scored, no assessment table.
- Session plan rows (`#gvSchedule`, 60 on most 3-credit subjects) are periods, not FAP slots. `JPD113` states "20 sessions, mỗi session=135p" for 45 contact hours. The attendance threshold must be applied to FAP's slot count, not to FLM's session rows.

### Tool

`tools/flm-scraper/`: `flm-scraper.js` (browser, dependency-free), `build-subject-list.mjs` (Node), `predict.mjs` (reference predictor). Outputs `data/flm/subject-list.json` (10.3 MB, full rubric) and `data/flm/subject-rules.json` (1.2 MB, 68 KB gzipped, prediction fields). Schema, interpretation rules and flags: [README](../../../tools/flm-scraper/README.md). Contract: [flm-subject-list.md](../../20-architecture/flm-subject-list.md).

Predictor checks run on the scraped data:

| Case | Input | Result |
|---|---|---|
| `PRF192` | Assignment 8, PE 7, PT 6 and 7, workshops 9, 18 of 20 slots | Pass needs FE 4 (floor), Fair FE 6.1, Good FE 9.5, Excellent unreachable; 2 more absences allowed |
| `JPD113` | Small tests 7 and 8, participation 9 | Fair 5.9 on both final parts, Good 8.2, Excellent unreachable (best 8.85) |
| `JPD113` | Final parts 2 and 3 | Fails: final average 2.67 below 4 |
| `PRF192` | Assignment 0, 15 of 20 slots | Fails: progress score 0; 5 absences exceed the 4 allowed |
| `SWE201c` | Nothing graded | PE and TE 5 / 7 / 8 / 9 per tier; Coursera warning |

## Outcome

- FLM is the source of per-subject pass rules; FAP has the marks. Requirements, criteria and weights are complete enough to predict for 1,005 of 1,014 scored subjects; 9 carry `weights-not-100` and need a warning in the UI.
- Owner pass rules recorded in [constraints.md](../../10-context/constraints.md), linked from [conventions](../../90-meta/conventions.md).
- Open: map FAP mark-sheet rows to FLM assessment indexes; bonus points and resit scenarios are not modelled; the owner's attendance example (18 of 20) disagrees with 80% and awaits confirmation; the GPA exclusion match mode (prefix plus wildcard) is an interpretation awaiting confirmation.
- Syllabus text (descriptions, CLOs, materials) is FPT University content. `data/flm/` is not committed yet; the owner decides whether it goes into the public repository or stays local or generated at build time.

## Follow-up (2026-10-10, owner answers)

- Commit `data/flm/` to the repository; the owner states the syllabus data is public.
- Attendance: 80% confirmed (20 slots, at most 4 absences).
- GPA exclusion: case-insensitive match; recorded in [constraints.md](../../10-context/constraints.md).
- FAP to FLM mapping built (`tools/flm-scraper/marksheet.mjs`). Synthetic sheets for `PRF192`, `JPD113` (uneven final items), `PMG201c`, `SWP391` and an unknown subject give the same targets as predicting on FLM directly; a graded resit (FE 3, resit 6) turns the `PRF192` result from failed to 6.97. The live check could not run: FAP had signed out (`/Auth/Login?ReturnUrl=%2FReport%2FGrade`), and signing in is left to the owner.
