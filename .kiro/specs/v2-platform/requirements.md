# Requirements Document

## Introduction

This spec covers the cross-cutting platform of FAP-AIO v2.0.0 that the five feature specs (`v2-core-scheduler`, `v2-grades`, `v2-info`, `v2-appearance`, `v2-panel-ux`) share but do not define:
- the manifest and permissions;
- the messaging contract between content scripts, the service worker and extension pages, including the shared FAP request budget;
- the storage catalog, quotas and migrations;
- the bundled and live data channel for the FLM rubric and news rules;
- privacy and security;
- test fixtures;
- build and release.

Owner decisions (2026-10-11, co-designed in chat, recorded in [decision 0004](../../../docs/60-decisions/0004-v2-platform.md)):
- Distribution as a GitHub release zip; semantic versions, stable channel only.
- Data: the package ships default tables. A signed data channel on a dedicated Git branch updates the FLM rubric and news rules after install or update, then weekly. The panel shows "Syncing data" while it runs.
- The full syllabus list is served by the service worker. A live FLM read happens only when the user asks for it on a subject they consider stale.
- `notifications` and the FLM host are optional permissions requested at runtime. `downloads` is not used.
- Large data lives in IndexedDB with `unlimitedStorage`.
- No telemetry.
- GitHub Actions for checks and release builds; data signing stays offline.
- Test fixtures keep FAP's real structure with synthetic values only.

## Requirements

### Requirement 1: Manifest and permissions

**User Story:** As a student, I want the extension to ask for as little access as possible, so that I can trust it with my FAP session.

#### Acceptance Criteria

1. The manifest SHALL be Manifest V3 with `minimum_chrome_version` "120".
2. Install-time permissions SHALL be limited to `storage`, `alarms` and `unlimitedStorage`, and host access SHALL be limited to `https://fap.fpt.edu.vn/*`.
3. `notifications` SHALL be an optional permission, requested only when the user turns on a feature that notifies (reminders, alert notifications).
4. `https://flm.fpt.edu.vn/*` SHALL be an optional host permission, requested only when the user starts a live FLM read.
5. The extension SHALL NOT declare `downloads`, `tabs`, `scripting`, `<all_urls>`, `externally_connectable` or any `web_accessible_resources`.
6. WHEN an optional permission is needed THEN the extension SHALL request it from an extension page after a user click, and SHALL explain in one sentence what it is for.
7. IF the user refuses or later removes an optional permission THEN the dependent feature SHALL turn itself off and show why, and every other feature SHALL keep working.
8. Content scripts SHALL run only in the top frame of `https://fap.fpt.edu.vn/*`.

### Requirement 2: Messaging contract

**User Story:** As a developer, I want one typed message contract between the parts of the extension, so that features stay independent and messages cannot be spoofed.

#### Acceptance Criteria

1. Every runtime message SHALL be a member of one typed union with a `type` field and a protocol version.
2. WHEN the service worker or an extension page receives a message THEN it SHALL accept it only if `sender.id` equals the extension's id and, for content-script senders, the sender URL is on `https://fap.fpt.edu.vn/`.
3. Messages that fail validation SHALL be dropped and counted, never executed.
4. Content-script calls that need APIs content scripts cannot use (permissions, notifications, commands, alarms, IndexedDB data files) SHALL go through the service worker by message.
5. Each request message SHALL get exactly one response, either a result or a typed error, within 10 seconds or a stated longer limit.

### Requirement 3: Shared FAP request budget

**User Story:** As a student, I want all my FAP tabs together to stay under FAP's bot protection threshold, so that my session is not challenged.

#### Acceptance Criteria

1. Every FAP request from any tab SHALL obtain a grant from the service worker before it is sent.
2. The service worker SHALL grant at most 30 FAP requests per rolling 5 minutes per browser, and SHALL grant one request at a time across all tabs.
3. The budget ledger SHALL survive service worker restarts within a browser session.
4. WHEN any tab reports a `challenge` error THEN the service worker SHALL refuse all grants and SHALL tell every FAP tab to stop reads.
5. WHILE reads are stopped by a challenge THEN they SHALL resume only after a FAP page finishes loading normally (`tab-ready`).
6. User-started reads SHALL be granted before background reads when both wait.
7. Background reads SHALL use at most 12 of the 30 grants in any rolling 5 minutes.
8. WHEN timer work needs FAP THEN the service worker SHALL route it to the most recently focused FAP tab.
9. The panel status strip SHALL show the remaining budget whenever a read is waiting for a grant.

### Requirement 4: Storage catalog, quotas and migrations

**User Story:** As a student, I want my data stored predictably and recoverably, so that updates do not lose it and storage does not fill up.

#### Acceptance Criteria

1. Every `chrome.storage.local` key SHALL be listed in one catalog with its owner module, schema version, expected size and retention.
2. Settings, state and parsed FAP caches SHALL live in `chrome.storage.local`. Data-channel files and the full syllabus list SHALL live in IndexedDB on the extension origin, owned by the service worker.
3. Each stored value SHALL carry a `schemaVersion`. WHEN the extension starts after an update THEN it SHALL run migrations in order before any feature reads the store.
4. IF a migration step is missing or throws THEN the extension SHALL discard only that store and show "sync again" for it (core R5.4).
5. Caches SHALL have retention limits (age or count) and SHALL be pruned on write.
6. The Settings Data section SHALL show usage per store and the IndexedDB total.
7. The extension SHALL NOT write to FAP's `localStorage`, `sessionStorage`, cookies or IndexedDB.

### Requirement 5: Data channel

**User Story:** As a student, I want syllabus rules and news rules kept current without a new release, so that predictions and alerts follow the latest syllabi.

#### Acceptance Criteria

1. The package SHALL ship default copies of `subject-rules.json`, `subject-list.json` and `news-rules.json`, and every feature SHALL work from them with no network access.
2. WHEN the extension is installed or updated, and then once a week, THEN the service worker SHALL fetch the channel manifest from the `data/live` branch of the project repository.
3. The extension SHALL accept a channel manifest only IF its signature verifies against a public key in the extension's key ring, its `dataVersion` is higher than the last accepted one, and its `minExtensionVersion` is not above the running version.
4. The extension SHALL download only the files whose SHA-256 differs from the active copy, and SHALL activate a file only IF its SHA-256 matches the signed manifest and its schema major version is supported.
5. WHILE the channel runs THEN the panel status strip SHALL show "Syncing data". WHEN it ends THEN the strip SHALL show the active data version, or why the update was skipped.
6. IF any check fails THEN the extension SHALL keep the active data and SHALL record the reason in Settings Data.
7. Settings SHALL offer "Check for data updates" and "Use packaged data", which reverts to the defaults.
8. The release process SHALL allow the owner to roll back by republishing an earlier snapshot under a new `dataVersion`.
9. The signing key SHALL be regenerable from an offline recovery phrase, and the key ring SHALL hold a backup key, so that losing one machine does not stop data releases.

### Requirement 6: Live FLM read

**User Story:** As a student, I want to refresh one subject's syllabus from FLM when I think it is out of date, so that my targets use the current rubric.

#### Acceptance Criteria

1. The Subjects view SHALL offer "Refresh from FLM" per subject. The extension SHALL NOT read FLM in the background.
2. WHEN the user starts a live read for the first time THEN the extension SHALL request the FLM optional host permission (R1.4).
3. A live read SHALL use GET only, at most 2 requests per subject (search, detail), paced at least 2.5 seconds apart.
4. IF FLM is not signed in THEN the extension SHALL keep the existing data and SHALL show "Sign in to FLM to refresh syllabi" with a link that opens FLM in a new tab. The extension SHALL NOT automate sign-in.
5. A live result SHALL override the channel or packaged entry for that subject only, SHALL be marked with its fetch date, and SHALL be removable.
6. WHEN a channel or packaged entry for the same subject has a newer syllabus (higher syllabus id, or a later approval date for the same id) THEN the live override SHALL be dropped automatically.

### Requirement 7: Privacy and security

**User Story:** As a student, I want my grades and session to stay on my machine, so that using the extension carries no new privacy risk.

#### Acceptance Criteria

1. The extension SHALL send no data about the user to any server. Its only network destinations SHALL be FAP, FLM (optional, user-started) and the data channel host (manifest and data files, no user data, no identifying query parameters).
2. The extension SHALL have no telemetry, analytics or remote error reporting.
3. Settings SHALL offer "Copy diagnostics", which SHALL build a redacted text report of versions, error kinds and source ids with no names, ids, marks, schedule entries or lecturer data.
4. Imported themes, settings files and data-channel files SHALL be treated as untrusted input and validated by schema before use.
5. The extension SHALL NOT evaluate remote code: no `eval`, no `new Function`, no remote scripts. The extension CSP SHALL be the MV3 default or stricter.
6. Personal data used during development SHALL stay under the git-ignored `ignore/` folder.

### Requirement 8: Test fixtures

**User Story:** As the owner, I want tests based on real FAP structure without publishing anyone's data, so that the public repository is safe.

#### Acceptance Criteria

1. Committed fixtures SHALL keep FAP's HTML structure, classes, attributes and column order, and SHALL replace every value (names, logins, ids, subject codes where personal, marks, dates, rooms, emails) with generated values.
2. A fixture generator SHALL turn a page saved under `ignore/` into a committed fixture deterministically from a seed, so that the result is reproducible.
3. A deny-list check SHALL fail IF a committed fixture contains a listed value (the owner's name, roll number, email, lecturer shortcodes seen in real pages). It SHALL run in a local pre-commit hook from the copy under `ignore/`, and in CI from a repository secret. It SHALL skip with a notice when the list is absent.
4. Golden grade cases SHALL use synthetic marks, with expected results produced by the validated reference tools in `tools/flm-scraper/`.

### Requirement 9: Build and release

**User Story:** As the owner, I want repeatable builds and releases, so that every published zip is traceable to a commit.

#### Acceptance Criteria

1. On every pull request and push THEN CI SHALL run typecheck, lint, unit tests, the fixture deny-list check and a production build.
2. WHEN a tag `v<major>.<minor>.<patch>` is pushed THEN CI SHALL build, zip the extension and attach the zip and its SHA-256 to a draft GitHub release for the owner to publish.
3. The manifest version SHALL equal the tag version, and CI SHALL fail on a mismatch.
4. Data signing SHALL NOT run in CI. The signing tool SHALL run offline on the owner's machine.
5. The build SHALL be reproducible from the lockfile with pinned tool versions.
