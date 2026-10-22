# Implementation Plan

Spec prefix `PLT`. Phases are numbered `N.`, subtasks `N.M`; the global id is `PLT-N` or `PLT-N.M`. Dependencies, gates, milestones and status for every spec live in the orchestrator: [`.kiro/orchestrator.md`](../../orchestrator.md). Requirement references point to `requirements.md` in this folder unless prefixed with a spec (`core R3.8`). Tasks are coding only; owner actions and live checks are gates (`G-*`) listed in the orchestrator, and a task that needs one says `_Gate: G-..._`.

Compacted on 2026-10-22 from 33 to 21 subtasks with no requirement dropped; the previous list is in [`.deprecated/tasks.md`](.deprecated/tasks.md).

- [x] 1. [PLT-1] Repository scaffold, manifest and CI
- [x] 1.1 [PLT-1.1] Create the toolchain, manifest, entry points and key tool
  - `package.json` with exact versions: Vite 5, `@crxjs/vite-plugin` 2, React 18, TypeScript strict, Tailwind 3, ESLint, Vitest, zod, linkedom (dev); `.nvmrc` with Node 22 LTS; `package-lock.json` committed.
  - Scripts: `typecheck`, `lint`, `test`, `build`, `zip`, `check:version`, `check:fixtures`.
  - Source layout: `src/background/`, `src/content/`, `src/features/`, `src/shared/`, `src/pages/grant/`, `test/`.
  - `src/manifest.ts` exactly as in the design, including `minimum_chrome_version` 120, the two content scripts (top frame only) and the `toggle-panel` command. The `key` field is read from `src/manifest-key.txt` when that file exists (written after gate G-EXT-KEY) and omitted otherwise, so builds before the gate load with a changing unpacked id.
  - Entries `src/background/index.ts`, `src/content/appearance.ts`, `src/content/index.ts` and `src/pages/grant/grant.html` that load and log nothing.
  - `tools/release/extension-key.mjs`: generates an RSA 2048 key pair with Node's `crypto`, writes the private key to `ignore/keys/extension-key.pem`, writes the base64 SPKI public key to `src/manifest-key.txt` and prints the resulting extension id.
  - A unit test that reads the built manifest and fails on any forbidden key (`downloads`, `tabs`, `scripting`, `<all_urls>`, `externally_connectable`, `web_accessible_resources`, a `content_security_policy` override).
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 7.5, 9.5 (design: stable extension id)_
- [x] 1.2 [PLT-1.2] Add `.github/workflows/ci.yml`
  - On `pull_request` and `push`: `npm ci`, typecheck, lint, test, `check:fixtures`, build, then `npm audit --audit-level=high` as a non-failing step.
  - ESLint rules: `no-eval`, `no-implied-eval`, `no-new-func`; `no-restricted-globals` for `localStorage` and `sessionStorage` outside `src/features/legacy/`.
  - _Requirements: 7.5, 9.1, 4.7_

- [ ] 2. [PLT-2] Message contract and service worker router
- [ ] 2.1 [PLT-2.1] Define `src/shared/messages.ts` and the content-script client
  - The `Msg` union and `Reply<T>` from the design, protocol version 1, with one zod schema per message type and a per-type timeout table (default 10 s; `perm.request` 120 s; `flm.refresh` 60 s).
  - `src/shared/call.ts`: `call(msg, timeoutMs?)` returning `Reply<T>`, with `{ kind: 'timeout' }` on no reply; a typed `onMessage` subscription for service-worker-to-tab messages.
  - Unit tests: every type has a schema; a wrong `v` or an unknown `type` is rejected; a missing reply resolves to `timeout`.
  - _Requirements: 2.1, 2.4, 2.5_
- [ ] 2.2 [PLT-2.2] Build the service worker router
  - `src/background/router.ts`: checks `sender.id`, the FAP origin and `frameId === 0` for content scripts, and the `grant.html` URL for `perm.result`; validates with zod; dispatches to registered handlers; replies with `Reply<T>`.
  - Invalid messages are dropped and counted in `diag.counters`.
  - Unit tests with forged senders (other origin, sub-frame, other extension id).
  - _Requirements: 2.2, 2.3, 2.4_
- [ ] 2.3 [PLT-2.3] Track FAP tabs, toolbar action and global command
  - Content side: send `tab-ready` after bootstrap and `tab-focus` on `focus` and visible `visibilitychange`.
  - Service worker: keep known FAP tabs and `focusedTab`; the toolbar action sends `panel.toggle` to an active FAP tab or opens `https://fap.fpt.edu.vn/`; `chrome.commands` `toggle-panel` sends `panel.toggle`; `commands.list` returns `chrome.commands.getAll()`.
  - _Requirements: 3.8, 1.5; panel-ux R7.1, R7.4_

- [ ] 3. [PLT-3] Storage catalog, migrations and pruning
- [ ] 3.1 [PLT-3.1] Implement the storage catalog with pruning and usage
  - `src/shared/storage/catalog.ts`: one typed entry per key in the design's catalog (owner, version, retention), `Versioned<T>`, and typed `read(key)`, `write(key, value)` and `subscribe(key)` built on `chrome.storage.local` and `storage.onChanged`.
  - Age and count limits per catalog entry applied inside `write`: alerts (200 or 60 days), timetable and exams (400 days), cache (30 days), news seen (30 days).
  - `data.status` includes `getBytesInUse` per key and `navigator.storage.estimate()` for IndexedDB.
  - Tests: a scan of `src/` fails on a storage key that is not in the catalog; one test per pruning rule.
  - _Requirements: 4.1, 4.2, 4.5, 4.6; core R5.1, R5.2_
- [ ] 3.2 [PLT-3.2] Add migrations
  - `src/shared/storage/migrations.ts` and `runMigrations()` on `runtime.onInstalled` (reason `update`); readers wait for the migrated value when they see an old version.
  - A missing or throwing step discards only that key and sets a "sync again" flag the panel shows.
  - Unit tests: ordered steps, missing step, throwing step.
  - _Requirements: 4.3, 4.4; core R5.3, R5.4_

- [ ] 4. [PLT-4] Shared request budget
- [ ] 4.1 [PLT-4.1] Implement the budget ledger
  - `src/background/budget.ts`: the `Ledger` in `chrome.storage.session` and the six-step `acquire` decision from the design (challenge, inflight lease of 15 s, 400 ms or 1.5 s gap, 30 per rolling 5 minutes, background cap 12 and user priority window of 5 s).
  - Unit tests with a fake clock for every step, including a service worker restart between grants.
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7_
- [ ] 4.2 [PLT-4.2] Wire acquire, release, stop, resume and timer routing
  - Handlers for `budget.acquire` and `budget.release`; `outcome: 'challenge'` sets `challenged` and broadcasts `reads.stop` to every known FAP tab; the next `tab-ready` clears it and broadcasts `reads.resume`.
  - `runOnFapTab(job)`: sends `timer.run` to `focusedTab`, falls back to the latest `tab-ready` sender, and skips when no FAP tab is open.
  - _Requirements: 3.4, 3.5, 3.8; core R11.2_

- [ ] 5. [PLT-5] Test fixture pipeline
- [ ] 5.1 [PLT-5.1] Build the anonymizer and deny-list check, then generate the committed fixtures
  - `tools/fixtures/anonymize.mjs` and `fields.json`: linkedom parse, seeded PRNG, value replacement per kind with a consistent mapping per run, same-length filler for other text, a kept list of structural labels for the vi and en constant tests.
  - `tools/fixtures/check-denylist.mjs`, `.githooks/pre-commit` using `ignore/fixture-denylist.txt`, and the CI step reading the `FIXTURE_DENYLIST` secret; a notice and pass when no list exists.
  - Run the anonymizer over every page captured under `ignore/fixtures-raw/` into `test/fixtures/`; the deny-list check passes on the result.
  - Tests: the same seed gives the same output; element, class and attribute sets are unchanged.
  - _Gate: G-CAPTURE_
  - _Requirements: 8.1, 8.2, 8.3, 7.6_
- [ ] 5.2 [PLT-5.2] Write `tools/fixtures/grade-cases.mjs`
  - Synthetic mark sheets for the validation categories (pass, fail with an average of 5 or more, bonus, resit, unscored, uneven groups, summary rows only); expected results from `tools/flm-scraper/marksheet.mjs` and `predict.mjs`, written to `test/fixtures/grades/golden.json`.
  - _Requirements: 8.4; grades R4, R5_

- [ ] 6. [PLT-6] Packaged data and IndexedDB data service
- [ ] 6.1 [PLT-6.1] Package the data files and build the IndexedDB store
  - Copy `data/flm/subject-rules.json`, `data/flm/subject-list.json` and `data/news/news-rules.json` into the build; generate an unsigned `data/manifest.json` with `dataVersion` and SHA-256 values; zod schemas `subject-rules@1`, `subject-list@1`, `news-rules@1` validated against the committed files in a test.
  - `src/background/data/db.ts` with stores `files`, `subjects`, `overrides`, `search`; on install, read the packaged files with `fetch(chrome.runtime.getURL(...))` and index them in one transaction; re-index from packaged files when the database is missing.
  - Tests with `fake-indexeddb`.
  - _Requirements: 4.2, 5.1, 7.4_
- [ ] 6.2 [PLT-6.2] Add the data query handlers and client
  - Handlers `data.rules`, `data.subject`, `data.search` (normalized tokens: NFD, diacritics removed, `đ` to `d`, lowercase), `data.file`, `data.status`; the content-side `dataClient` with an in-memory cache per tab.
  - Lookup order: override when its syllabus is newer than or equal to the active entry, else the active entry.
  - _Requirements: 2.4, 6.5, 6.6; grades R12.2; info R2.1_

- [ ] 7. [PLT-7] Signed data channel
- [ ] 7.1 [PLT-7.1] Write the offline signing tool `tools/data-sign/`
  - `keygen` (32 random bytes as a Crockford base32 phrase), deterministic HKDF-SHA256 derivation to a P-256 key, `keyId`, `publish <dir>` (hash, next `dataVersion`, sign, verify against `src/shared/keyring.ts`, print the git commands for `data/live` and `data/<date>`), `verify`.
  - Tests: the same phrase gives the same `keyId` twice; a signature verifies with WebCrypto in Node.
  - _Requirements: 5.8, 5.9, 9.4_
- [ ] 7.2 [PLT-7.2] Implement the channel client
  - `src/background/data-channel.ts`: alarm `data-check` (60 s after install or update, then weekly), manifest and signature GET with `cache: 'no-store'` and `credentials: 'omit'`, verification (key ring, signature, increasing `dataVersion`, `minExtensionVersion`, `format`), download of changed files only, SHA-256 and schema checks, one-transaction activation, `data.progress` broadcasts and `data.status.lastSkip`.
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 7.1_
- [ ] 7.3 [PLT-7.3] Add "Check for data updates" and "Use packaged data"
  - Handlers `data.check` and `data.usePackaged`; the weekly check pauses while packaged data is forced.
  - Integration tests with a stubbed `fetch`: valid update, wrong key, tampered file, lower version, high `minExtensionVersion`, rollback republish under a new version.
  - _Requirements: 5.6, 5.7, 5.8_

- [ ] 8. [PLT-8] Optional permissions
- [ ] 8.1 [PLT-8.1] Build the grant flow and handle removal
  - `grant.html` (one sentence of purpose, one button) opened with `chrome.windows.create`; `perm.request` and `perm.result` with the 120 s timeout; a closed window counts as refused.
  - `permissions.onRemoved` turns off reminders and alert notifications (`notifications`) or live FLM read (FLM host) and pushes an alert with the reason; a `notify` handler mirrors alerts only when the kind is enabled and the permission is held.
  - _Requirements: 1.3, 1.4, 1.6, 1.7; panel-ux R6.5_

- [ ] 9. [PLT-9] Live FLM read
- [ ] 9.1 [PLT-9.1] Write the FLM cookie probe and port the FLM parser
  - A development-only service worker command (`dev.flmProbe`, compiled out of production builds) that fetches the FLM syllabus search route and reports whether the response is signed in; the owner runs it in gate G-FLM-COOKIE, and the result (decision D-1) picks the path for 9.2.
  - TypeScript port of the detail parsing in `tools/flm-scraper/flm-scraper.js`, run on `flm.parse` in a FAP tab; results stored in `overrides` with `fetchedAt`; overrides overtaken by a newer channel or packaged syllabus are deleted during indexing; a remove action.
  - Parity test: the port and the reference tool give the same entry for a saved detail page under `ignore/flm/` (skips without it).
  - _Requirements: 6.3, 6.5, 6.6_
- [ ] 9.2 [PLT-9.2] Implement `flm.refresh`
  - Permission check and request, search then detail GET 2.5 s apart on the path chosen in D-1 (service worker fetch, or a content-script fallback that needs `scripting` and owner approval), sign-in detection with the "Sign in to FLM to refresh syllabi" prompt and link.
  - _Gate: G-FLM-COOKIE_
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 10. [PLT-10] Privacy, diagnostics and release
- [ ] 10.1 [PLT-10.1] Build "Copy diagnostics" and the network destination check
  - The allow-list report from the design (`diagnostics` message); a test seeds stores with records and asserts no record value appears in the output.
  - A build test that collects the targets of `fetch`, `XMLHttpRequest` and `chrome.tabs.create`/`windows.create` calls in `src/` and fails on any host outside `fap.fpt.edu.vn`, `flm.fpt.edu.vn` and `raw.githubusercontent.com`; URL strings that are never requested (XML namespaces, library error links, About links) are out of scope.
  - _Requirements: 7.1, 7.2, 7.3_
- [ ] 10.2 [PLT-10.2] Add `.github/workflows/release.yml`
  - On `v*.*.*` tags: `check:version` (tag equals `package.json` equals manifest), build, `fap-aio-<version>.zip` and `.sha256`, `gh release create --draft --generate-notes`.
  - _Requirements: 9.2, 9.3_
