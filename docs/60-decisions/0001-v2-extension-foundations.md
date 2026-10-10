---
id: decisions.v2-extension-foundations
type: adr
status: approved
owner: unassigned
summary: "FAP-AIO v2.0.0 foundations: persistent in-page panel, English-only UI with locale-independent parsing, opt-in session keep-alive, legacy page storage exported and cleared."
superseded_by: none
---

# Decision 0001: v2.0.0 extension foundations

Date: 2026-10-05. Decided by the project owner in chat; recorded by the assistant.

## Context

FAP was rewritten to v2 ([fap-v2 section](../20-architecture/fap-v2/README.md)). The legacy FAP-AIO and the third-party FPTU Schedule 4.0.0 take opposite approaches to where the UI lives, and neither handles both FAP cultures cleanly ([comparison](../70-work/investigations/2026-10-04-scheduler-comparison-and-v2-scope.md)). Legacy builds also left data in the FAP origin's `localStorage`.

## Decision

1. UI surface: a persistent panel injected into FAP pages. It can be moved and minimized like the legacy panel, and its state (position, size, minimized, open view) survives reloads and navigation.
2. Language: the extension UI is English only, with no localization layer. Parsing must not depend on FAP's visible labels: it reads structure (classes, ids, `data-*` attributes, icon classes, column positions) and maps any text it must read through defined constants that cover both `vi` and `en`, so a FAP language change does not break it.
3. Session keep-alive: included as a setting, opt-in, off by default.
4. Self-service "quick set or send request": to be decided; no work until the use case is defined.
5. Legacy page storage: the owner's legacy keys were exported to `ignore/legacy-storage/2026-10-05-fap-localStorage.json` (git-ignored, personal data) and removed from the FAP origin on 2026-10-05. v2 stores its data in `chrome.storage.local` only.

## Alternatives

- Toolbar popup as the main surface (FPTU Schedule): rejected; it duplicates FAP's own views and needs a sync step before every view.
- Chrome side panel: not chosen.
- Localized extension UI (vi and en): rejected; English only.
- Keep-alive on by default (FPTU Schedule): rejected; it must not be forced.

## Consequences

- Panel styles must reach the page despite FAP's CSP (`style-src 'self'`); the design phase picks the injection method.
- A text-to-meaning table (constants for both cultures) is part of the parser layer and needs a test per entry.
- Removed legacy keys can be restored from the export file if needed.
- Self-service stays out of every spec until decision 4 is made.
