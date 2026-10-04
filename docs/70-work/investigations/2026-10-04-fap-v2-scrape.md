---
id: work.investigations.10-04-fap-v2-scrape
type: investigation
status: draft
owner: unassigned
summary: "Read-only scrape of the rewritten FAP v2 portal to inventory routes, endpoints and page structure for the FAP-AIO v2.0.0 upgrade."
---

# FAP v2 scrape (2026-10-04)

## Goal

Inventory every route, endpoint, HTTP method and page structure of the rewritten FAP portal so the FAP-AIO upgrade can be specified against the real site.

## Method

- Logged-in student session in Chrome. All requests were same-origin `fetch` GETs from the page, parsed with `DOMParser`. No form was submitted, no POST endpoint was called.
- Pass 1: the 27 sidebar routes. Pass 2: 19 detail and partial pages (first item of each list, `WeekPartial`, report partials with `termId` and `courseId`). Pass 3: source of 30 site scripts, scanned for `fetch`, `$.ajax`, `method`, `type` and `data-*Url` usages. Pass 4: layout `data-*-url` attributes and response headers. Pass 5: status of the 9 legacy `.aspx` routes referenced by the old source.
- The crawler is kept locally as `ignore/scripts/fap-crawl.js` (git-ignored, see the verification guide).

## Findings

- 108 endpoint entries across 24 controllers (75 catalog rows; one row stands for 34 `GetFormSchema*` option sources), recorded in [endpoints.md](../../20-architecture/fap-v2/endpoints.md). Rows marked `GET 200` were requested and answered 200; the rest are declared by forms, `data-*` attributes or scripts and were not exercised.
- No JSON API exists for timetable, exams, grades, attendance or transcript. They are server-rendered HTML; timetable and reports also serve HTML partials ([platform.md](../../20-architecture/fap-v2/platform.md)).
- All 9 legacy routes used by FAP-AIO v0.0.1 return 404. Replacements exist for every feature except the MoveOut class lookups (`/Course/Groups.aspx`, `/Course/Courses.aspx`), which have no student-facing equivalent ([route-map.md](../../20-architecture/fap-v2/route-map.md)).
- Strict CSP: `connect-src 'self'` plus Google hosts; `style-src 'self'`.

## Gaps

- Request bodies of several POST endpoints are partly unknown (listed at the end of the endpoint catalog).
- The cross-class exchange create form did not render (no eligible class for this account).
- Per-item URLs (edunext join, application payment status, foxpay) did not appear for this account.

## Outcome

Section [20-architecture/fap-v2](../../20-architecture/fap-v2/README.md) created as the single home for these facts.
