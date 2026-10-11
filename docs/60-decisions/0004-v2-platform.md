---
id: decisions.v2-platform
type: adr
status: approved
owner: unassigned
summary: "FAP-AIO v2.0.0 platform: GitHub zip distribution, signed data channel on a data/live branch, service-worker-served syllabus data, optional permissions, IndexedDB storage, no telemetry, GitHub Actions, synthetic fixtures."
superseded_by: none
---

# Decision 0004: v2.0.0 platform

Date: 2026-10-11. Decided by the project owner in chat during co-design; recorded by the assistant. Builds on decisions [0001](0001-v2-extension-foundations.md) to [0003](0003-v2-panel-ux-and-news.md). Design: `.kiro/specs/v2-platform/`.

## Context

The five feature specs had approved requirements and design but no shared platform: manifest, messaging, storage limits, data updates, security, fixtures and releases (STATUS item 15). Verified facts that shaped the choices:
- Content scripts cannot use `chrome.permissions`, `chrome.commands`, `chrome.notifications` or `chrome.alarms`, and need `web_accessible_resources` to fetch packaged files.
- `downloads` and `notifications` show install warnings; `unlimitedStorage` does not.
- `chrome.storage.local` holds 10 MB, less than the 10.3 MB syllabus file.
- `raw.githubusercontent.com` allows CORS from any origin.

## Decision

1. Distribution: a zip attached to a GitHub release. Semver, stable channel only. No Chrome Web Store for v2.0.0.
2. Data:
   - The package ships default tables (`subject-rules.json`, `subject-list.json`, `news-rules.json`).
   - After install or update, then weekly, the extension fetches newer data from the repository's `data/live` branch. The panel shows "Syncing data" while this runs.
   - Snapshot branches `data/<date>` allow rollback by republishing.
3. Trust:
   - The channel manifest is signed with ECDSA P-256. The private keys are derived from offline recovery phrases, so they can be regenerated after loss or a machine change.
   - The key ring in the extension holds a primary and a backup public key.
   - The manifest's `dataVersion` must increase.
4. The full syllabus list is served by the service worker from IndexedDB; no `web_accessible_resources`. A live FLM read runs only when the user asks for it on a subject they consider stale. When FLM is signed out, the extension keeps its data and shows a sign-in link.
5. When a live FLM entry and a channel entry exist for the same subject, the one with the newer syllabus wins.
6. Permissions:
   - At install: `storage`, `alarms` and `unlimitedStorage`, plus host access to FAP.
   - Optional at runtime: `notifications` and the FLM host.
   - Not used: `downloads`.
7. Storage: settings, state and caches live in `chrome.storage.local`; data files live in IndexedDB.
8. Request budget: background reads may use at most 12 of the 30 grants per 5 minutes. Timer work goes to the most recently focused FAP tab.
9. No telemetry. A "Copy diagnostics" button gives a redacted report.
10. GitHub Actions run checks on every push and build a draft release on tags. Data signing stays offline and manual.
11. Committed test fixtures keep FAP's structure with synthetic values only. Real pages stay in `ignore/`.

## Alternatives

- Chrome Web Store, or store plus zip: rejected for v2.0.0; review and disclosures are not worth it yet.
- Data only with releases: rejected; syllabi change between releases.
- A full FLM rescan on first load: rejected; about 1,060 paced requests.
- Hash-only manifest: rejected; it does not stop a malicious commit.
- Required `notifications` and `downloads`: rejected; install warnings.
- Committing anonymized real marks: rejected; it would publish the owner's mark pattern.

## Consequences

- Five approved feature designs get amendments, listed in the platform design's last section: blob-link exports, service-worker data queries, `storage.onChanged` instead of a settings broadcast, and permission prompts.
- A signing tool and two recovery phrases must exist before the first channel publish.
- Whether a service worker fetch to FLM carries the FLM cookie is unverified. A spike runs before the live FLM read is built, with a fallback through a content script on FLM.
- A stable extension id for unpacked installs needs a manifest `key`. It was added by the assistant in the design and awaits owner confirmation.
- Owner approval 2026-10-11: requirements, design and this decision approved; the manifest `key` is kept.
