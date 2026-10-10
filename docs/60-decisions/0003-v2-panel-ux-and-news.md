---
id: decisions.v2-panel-ux-and-news
type: adr
status: approved
owner: unassigned
summary: "Panel layout and navigation (floating and docked hybrid, four tabs, palette, inbox, keybinds), rule-based news classification, and request budgeting after Cloudflare challenges."
superseded_by: none
---

# Decision 0003: panel layout, news classification and request budget

Date: 2026-10-11. Decided by the project owner in chat; recorded by the assistant. Builds on [decision 0001](0001-v2-extension-foundations.md) and [decision 0002](0002-v2-module-scope.md).

## Context

The approved specs had no panel layout or settings design. The news watch had only a flat keyword list. Repeated grade reads triggered a Cloudflare managed challenge on FAP ([platform.md](../20-architecture/fap-v2/platform.md)).

## Decision

1. Panel layout:
   - A hybrid of a floating tabbed panel and a docked full-height side panel; dragging to the right edge docks.
   - It collapses to a pill (floating) or a 48 px rail (docked).
   - First run opens docked at comfortable density.
2. Navigation:
   - Four primary tabs: Today, Schedule, Grades, Info, each with segmented sub-views. Theme and Settings sit behind the header gear.
   - A page-aware default tab.
   - A command palette (Ctrl or Cmd+K).
   - An alerts inbox.
   - Keyboard shortcuts with user-customizable keybinds and conflict checks.
3. Settings: every module declares its settings in one registry, which renders one searchable Settings view grouped by section, with export, import and reset.
4. News:
   - FAP news is classified by title rules (department tag, event family, priority P1 to P4, flags, term, deadline) in `data/news/news-rules.json`, then personalized.
   - Alerts fire only for personalized P1 items with a near deadline, an exam-eligibility list, a subject-code match, or a recent posting.
   - User watch keywords are an optional extra rule.
   - Convention: [news.md](../20-architecture/fap-v2/news.md).
5. Request budget: at most 30 FAP requests per 5 minutes per browser, one at a time. A Cloudflare challenge stops all reads until the user reloads FAP. The extension never interacts with the challenge.

## Alternatives

- Bottom taskbar with a drawer (unbuilt legacy redesign): rejected; it fits only the timetable page.
- Docked only or floating only: rejected in favour of the hybrid.
- Flat keyword watch list (first `v2-info` draft): replaced; the analysis of 600 titles showed keywords such as "đăng ký" and "thi" match most news.

## Consequences

- The docked mode needs FAP layout selectors (top bar, footer) confirmed on live FAP before implementation.
- `cmdk` (React command menu) becomes a dependency.
- Range syncs and grade refreshes queue behind the request budget, so long syncs take longer.
