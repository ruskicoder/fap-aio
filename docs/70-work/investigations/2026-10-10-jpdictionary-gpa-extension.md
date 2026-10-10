---
id: work.investigations.10-10-jpdictionary-gpa-extension
type: investigation
status: draft
owner: unassigned
summary: "Static analysis of the unvetted 'Japanese Dictionary JP' 3.3.4 extension, which carries a FAP v2 GPA helper, and comparison of its GPA rules with legacy FAP-AIO and FPTU Schedule."
---

# Third-party extension "Japanese Dictionary JP" 3.3.4 with a FAP GPA helper (2026-10-10)

## Goal

The owner supplied an unvetted copy at `/mnt/DATA/DATA/Github/unvetted-gpa-fap-translation/3.3.4_0/` (outside this repository), described as containing a GPA calculator. Goal: find the GPA code, record what the extension does and sends, and compare its GPA rules with the legacy GPA feature and FPTU Schedule ([record](2026-10-04-fptu-schedule-extension.md)).

Rules: read-only static analysis. The extension was not loaded or executed. No README was supplied. Minified files were copied to `/tmp` and beautified there for reading; the folder itself was not modified. No FAP page was opened this session, so the GPA helper's DOM assumptions are checked against [pages.md](../../20-architecture/fap-v2/pages.md) and [data-model.md](../../20-architecture/fap-v2/data-model.md), not against the live site.

## Findings

### Identity and integrity

| Item | Value |
|---|---|
| Name, version | `Japanese Dictionary JP` (`_locales/en`), `3.3.4`, Manifest V3. Description: Japanese vocabulary and Kanji lookup and translation. |
| Chrome Web Store item | `jaclholjkcdapeppngdgepndkjpomlfe` (from `_metadata/verified_contents.json`; the manifest `key` hashes to the same id) |
| Lineage | Fork of `github.com/ttop32/MouseTooltipTranslator` (linked in the code; `pdfInject.js` still opens the upstream id `hmigninkgibhdckiaphhmbgcghochdjc`). The in-page dictionary widget is a Vue 2 bundle built from a Windows path under `Omoha\Embedded\embed`. |
| Author signals | Dictionary site `jpdictionary.com`; GPA links point to `ezse.net/other/grade/`. A YouTube video titled "Extension tính GPA Đại học FPT - Giao diện FAP" was open in the owner's Chrome, channel "EZSE - Easy to become SE" (read once before the tab was closed). |
| Permissions | `storage`, `tts`, `tabs`, `scripting`, `contextMenus`, `webNavigation`; host `<all_urls>` |
| Content scripts | `contentScript.js` and `bootstrapcustom.min.css` on `<all_urls>`, all frames, `document_idle` |
| Programmatic injection | `background.js` runs `chrome.scripting.executeScript({files: ["popup2.js"], allFrames: true})` on every `webNavigation.onDOMContentLoaded` for any `http(s)` URL, except frames inside `jpdictionary.com` |
| Other | Omnibox keyword `jp`; context menu "Search on JP Dictionary"; bundled pdf.js viewer; sandboxed `opencvHandler.html` (references `/opencv/opencv.js`, which is not in the package); first install opens `https://jpdictionary.com/setting` |
| Size | 367 files (mostly pdf.js cmaps and locales); main bundles `background.js` 764 KB, `popup.js` 873 KB, `popup2.js` 198 KB, `contentScript.js` 138 KB |

Integrity: tree hashes in `verified_contents.json` were recomputed for all 367 files. Every file on disk is listed and every listed file exists. 361 match, including `popup2.js`, `background.js`, `contentScript.js` and `popup.js`. Six differ: `manifest.json`, `_locales/en/messages.json` and the four `icons/*.png`. That is the same pattern as FPTU Schedule (Chrome rewrites the manifest and message catalog and re-encodes images at install; inferred, not tested). The code on disk, including the GPA helper, is the code the store signed for 3.3.4.

### Where the GPA helper lives

The GPA helper is a self-contained IIFE appended to the end of `popup2.js`, after the dictionary widget bootstrap (`setupJPDictionary()`). It is guarded by `window.__fapGpaCalcLoaded`. It has no hostname check; it branches only on `location.pathname.toLowerCase()`:

- contains `/report/transcript`: transcript GPA panel;
- contains `/report/grade`: per-course "need to pass" badge, re-run through a `MutationObserver` on `document.body` with a 100 ms debounce.

Because `popup2.js` is injected into every http(s) frame, the helper's code runs on every site, and acts on any site whose path contains those strings.

### Transcript GPA rules (`/Report/Transcript`)

| Rule | Behavior |
|---|---|
| Tables read | Every `.content-page table.fap-sheet` not inside `.fap-result-card`. On FAP v2 that is both transcript tables: the main table and the replaced or extra subjects table ([pages.md](../../20-architecture/fap-v2/pages.md)). |
| Column lookup | By header text, lowercased and NFC-normalized, exact match against `semester`/`học kỳ`, `subject code`/`mã môn`, `credits`/`tín chỉ`, `grade`/`điểm`, `status`/`trạng thái`. Matches the recorded en and vi headers (vi `HỌC KỲ` lowercases to `học kỳ`; `KỲ` is not confused). A table without code or grade columns is skipped. |
| Counted subject | Not excluded, status in `passed`/`đạt`, grade a finite number (comma accepted as decimal point). `Exempt` and `In progress` are not counted. Credit that does not parse becomes 0. |
| Exclusion | User list in FAP-origin `localStorage["excludedSubjectCodes"]`, default `GDQP,ENT,VOV,TRS,ÐSA,ĐSA,TMI,LAB,OJS,OJT,SYB301`. Match is substring anywhere in the code (`code.includes(key)`), not prefix. `ÐSA` (U+00D0) and `ĐSA` (U+0110) cover two look-alike letters. |
| Cumulative GPA | Credit-weighted mean of counted subjects, rounded to 3 decimals with `toFixed(3)`; `N/A` when no credits. Shows total counted credits. |
| Per-semester GPA | Rows grouped by semester text containing a 4-digit year; ordered by `year*10 + {spring:1, summer:2, fall:3}`; same mean per group. Counted rows get bold semester and code cells. |
| "Not finished" rows | Not excluded, no finite grade, status not passed. Not counted; passed to the external editor with an empty grade. |
| UI | `#gpa-helper` card inserted before the first `.content-page .card`: GPA badge, per-semester badges, exclusion input with OK and Reset. Values interpolated into `innerHTML` are HTML-escaped. |

### Grade page rules (`/Report/Grade`)

| Rule | Behavior |
|---|---|
| Source | `#grade-report table.student-mark-sheet`, once per table (`data-grade-done`). Skips `tr.sheet-row-total` and `tr.sheet-grand-total`. Reads name, weight and value by position after the optional `.sheet-group-cell`. |
| Resit | A row whose group or name matches `/resit/i` replaces the value, and the weight if present, of the non-resit row with the same name (or group) after removing `(Resit)`. Consistent with the `(Resit)` suffix recorded in [data-model.md](../../20-architecture/fap-v2/data-model.md). |
| Need to pass | Only when `.grade-status--passed` is absent and some weight has no value: `need = (5 - Σ value×weight/100) / (remaining weight/100)`, 3 decimals; labels "Need: 0", "Need: x", or "x (>10, cannot pass)". Its own tooltip states that per-exam minimum scores are not considered. |
| UI | A "Recalculate" link in `.fap-result-card__title` (fallbacks: `.fap-result-card .card-header`, then before the table) and the need badge appended to the last cell of the last `tr.sheet-grand-total`. Inline styles set through `style` properties and `element.animate`. |
| Language | Labels in vi or en chosen from `document.documentElement.lang`. |

### Network and data flow

| Path | Trigger | Destination | Data |
|---|---|---|---|
| GPA "edit and recalculate" links | User click only (`target=_blank` anchors) | `https://ezse.net/other/grade/gpa.html?data=` and `percentagegrade.html?data=` | Base64 of subject code, credit, grade per line (transcript), or mark name, weight, value (grade page). Characters outside Latin-1 are dropped before encoding. The grade data goes to a third-party server in the URL query string. |
| Tooltip translation | Default on: `useTooltip: "true"`, `translateWhen: "mouseoverselect"`, `detectType: "sentence"`, vendor `google`, `langExcludeList: []` | `translate.googleapis.com` (default), `www.bing.com`, `papago.naver.com`, via the background worker | The sentence under the mouse or the selection, on every page including FAP. Text already in the target language is fetched and then hidden, so it is still sent. |
| Dictionary widget | Selection containing Japanese script (`[぀-ヿ＀-ﾟ一-龯]`) | POST `https://tudienjp.com/f/w` and `/f/k`; Google Translate for sentences | The selected Japanese text |
| Navigation | Install, omnibox, context menu, widget links | `jpdictionary.com` | Search word |

The GPA helper itself makes no request and reads no other FAP page; it only parses the page the user opened. No `eval` and no remote script. `new Function` appears only in the bundled Vue template compiler and the standard `globalThis` polyfill. Storage: `chrome.storage.local` for translator settings and history (`historyList`, capped at 20), FAP-origin `localStorage["excludedSubjectCodes"]` for the GPA exclusion list.

### Comparison with legacy FAP-AIO and FPTU Schedule

Legacy rules are from `.deprecated/fap-aio/src/contentScript/features/gpa/` (`utils.ts`, `types.ts`); FPTU Schedule rules are from the [scheduler comparison](2026-10-04-scheduler-comparison-and-v2-scope.md).

| Aspect | Legacy FAP-AIO | Japanese Dictionary JP 3.3.4 | FPTU Schedule 4.0.0 |
|---|---|---|---|
| Page | FAP v1 `#ctl00_mainContent_divGrade`, first table only; does not exist on v2 | v2 `/Report/Transcript`, both `table.fap-sheet` tables | v2 `/Report/Grade?courseId=` per course; no transcript GPA |
| Columns | Fixed indices `[2,3,6,7,8,9]` | Header text, en and vi | Classes and `data-label` (vi and en) |
| Counted | `Passed`, grade > 0, credit > 0 | `Passed`/`Đạt`, finite grade, any credit | not applicable |
| Exclusion | Prefix (`startsWith`); `OJS, VOV, GDQP, LAB, ENT, SSS, TMI, TRS, OTP`; editable, extension storage | Substring (`includes`); `GDQP, ENT, VOV, TRS, ÐSA, ĐSA, TMI, LAB, OJS, OJT, SYB301`; editable, FAP-origin `localStorage` | not applicable |
| Per-semester | Yes; rows without semester grouped by status | Yes; only semesters with a 4-digit year | No |
| Rounding | None in the mean | 3 decimals | not applicable |
| Course prediction | No | Need to reach 5.0 on remaining weight, no exam floor, resit replaces its original row | Need to reach a target (default 5.0) with an exam floor of 4.0 (not verified); resit rows skipped, bonus rows added |
| Editing | Exclusion list only | External site via link (`ezse.net`) | In the popup |
| Data leaves the browser | No | On click, to `ezse.net`; hovered text to translators by default | No |

Differences that matter for v2.0.0:

1. Exclusion lists disagree. JPD adds `OJT`, `ĐSA` (two spellings) and `SYB301`, and lacks `SSS` and `OTP`. None of the lists has been checked against FAP v2 subject codes or an official FPT rule (unverified). JPD's substring match can exclude a code that merely contains a key; prefix matching is the safer default.
2. JPD counts the replaced or extra subjects table. Whether those rows belong in the GPA, and whether they duplicate a row of the main table, is not established. The owner's transcript has to be checked before deciding (unverified).
3. JPD accepts a credit that fails to parse as 0. That is harmless in the mean but hides parse errors. Legacy requires grade > 0 and credit > 0.
4. The need-to-pass formula is the same weighted-remaining approach as FPTU Schedule's predictor, minus the exam floor. FAP v2 shows no per-exam minimum on the mark sheet (not recorded in [data-model.md](../../20-architecture/fap-v2/data-model.md)). So any floor is a rule outside FAP and needs a source.
5. Both third-party tools parse the page the user opened and FPTU also fetches `/Report/Grade?courseId=`. Neither has a hidden API, which is consistent with the earlier finding that FAP v2 has no JSON for academic data.

## Outcome

- Classification: not a FAP extension. It is a Japanese dictionary and tooltip translator with host access to every site, plus a small FAP GPA helper appended to a script injected into every frame. The GPA helper is benign in isolation (local parse, no requests, escaped HTML). The extension as a whole sends hovered or selected sentences from every page, FAP included, to Google Translate by default. It also sends grade data to `ezse.net` when the user clicks a GPA link. Reuse nothing from it; do not install it alongside FAP-AIO for testing.
- Practices worth adopting in v2.0.0: header-text column lookup with an en/vi constant table (consistent with decision 0001 item 2); per-semester ordering by `year*10 + season`; resit row replacing its base row by normalized name; the need-to-pass formula with an explicit note when no exam floor is applied; a guard flag against double initialization.
- Practices to avoid: `<all_urls>` injection, path-only matching without a host check, substring exclusion, writing settings into FAP-origin `localStorage` (decision 0001 item 5 removed legacy keys there), sending grade data off-device.
- Open: decide the default non-GPA list and match mode; check the replaced-subjects table against the owner's transcript; source or drop the 4.0 exam floor.
- The owner's Chrome had `jpdictionary.com/setting` open, which this extension opens on first install. Whether it is installed was not checked. If it is, it runs on every FAP page.

## Owner decisions (2026-10-10, after this record)

- The owner installed the extension only to extract its files and removed it right after.
- Default non-GPA list: the JPD list. Matching: case-insensitive pattern match.
- The replaced-subjects table does not count toward GPA; it only marks a subject as superseding an older one.
- Keep the 4.0 FE minimum. The full pass rules are in [constraints.md](../../10-context/constraints.md).
