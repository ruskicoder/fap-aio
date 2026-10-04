---
id: architecture.fap-v2.platform
type: cross-cutting
status: draft
owner: unassigned
summary: "FAP v2 cross-cutting behavior: CSP, security headers, CSRF, partial rendering, auth and client libraries."
---

# FAP v2 platform behavior

## Hosting and headers

Served through Cloudflare. Response headers on `/` (2026-10-04):

```text
content-security-policy: default-src 'self';
  script-src 'self' https://www.google.com https://www.gstatic.com https://static.cloudflareinsights.com;
  style-src 'self' https://fonts.googleapis.com;
  img-src 'self' data: https://cdn.fpt.edu.vn https://img.vietqr.io;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://www.google.com https://fcmregistrations.googleapis.com
              https://firebaseinstallations.googleapis.com https://www.googleapis.com;
  frame-src https://www.google.com; frame-ancestors 'none';
cache-control: no-cache, no-store
referrer-policy: same-origin
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
strict-transport-security: max-age=31536000; includeSubDomains
permissions-policy: camera=(), microphone=(), geolocation=()
```

Consequences for FAP-AIO:

- Page-context scripts cannot fetch any origin except FAP itself and the listed Google hosts. Cross-origin data (for example the legacy MoveOut department JSON) must be bundled or fetched from the extension service worker.
- Inline `<script>` and inline `style` attributes from injected markup are blocked by CSP. Content scripts run in the isolated world and are not subject to page CSP for their own code, but anything they inject into the page is.
- `style-src 'self'` blocks injected `<style>` elements created by page scripts; extension CSS must be declared in the manifest or injected through `chrome.scripting.insertCSS`.

## Authentication

Cookie session (FeID single sign-on). All endpoints in [endpoints.md](endpoints.md) need the session cookie; `fetch` from a content script on `fap.fpt.edu.vn` sends it with `credentials: "same-origin"`.

## CSRF

ASP.NET Core antiforgery. Forms carry a hidden `__RequestVerificationToken`. Script-driven POSTs read that input and send it as the `RequestVerificationToken` header (or as a form field for multipart uploads).

## Partial rendering

The same controller action serves a full page or an HTML partial. Scripts send `X-Requested-With: XMLHttpRequest` to get the partial (confirmed on `/Report/Grade`; used by `academic-report.js`, `timetable-common.js`, `notification-bell.js`, `base.js` modals). Dedicated partial actions also exist: `/Home/StudentContentPartial`, `/WeeklyTimetable/WeekPartial`.

## Rendering modes per module

Measured 2026-10-04 by requesting each route three ways: plain, with `X-Requested-With: XMLHttpRequest`, and with `Accept: application/json`.

| Module | Plain | `X-Requested-With` | `Accept: application/json` |
|---|---|---|---|
| `/Report/Attendance` | full page | partial (about 40% of the page) | full page |
| `/Report/Grade` | full page | partial (about 21% of the page) | full page |
| `/WeeklyTimetable/WeekPartial`, `/Home/StudentContentPartial`, `/Notification/BellList` | partial | partial | partial |
| `/Notification/UnreadCount` | json | json | json |
| Every other page: `/`, `/WeeklyTimetable`, `/ExamSchedule`, `/Report/Transcript`, `/Report/OjtConditions`, `/Report/ThesisConditions`, `/Curriculum`, `/Subject`, `/News`, `/Document`, `/Transaction`, `/Wishlist`, `/CrossClassChange`, `/Application`, `/ShoppingCart`, `/CoursePendingPayment`, `/StartupGroup`, `/FyeCheckInLog`, `/Account`, `/StudentProfile` | full page | full page | full page |

No route negotiates JSON. The transcript, exam schedule and curriculum exist only as server-rendered HTML tables, so FAP-AIO must parse HTML for them. JSON exists only for the lookup endpoints in [endpoints.md](endpoints.md) (application option sources, waitlist, cross-class resolve, wards, notifications).

## Route visibility

Routes the user may not access respond 404, exactly like routes that do not exist. Example: `/Academic/ApplicationTypes/OptionsProxy` is referenced by every application schema but returns 404 to a student. Endpoint discovery therefore relies on what pages and scripts reference, not on probing.

## Gates and permission handling (`base.js`)

- `base.js` wraps `window.fetch` (`fapPermissionAwareFetch`). A response header `X-Feedback-Required: 1` redirects the user to `/Feedback?required=1` (a mandatory survey gate).
- Permission-denied responses are normalized into a JSON shape and shown as a "no permission" alert.
- Generic AJAX modal forms post `new FormData(form)` with `X-Requested-With`.

## Client libraries

Jidox template (`vendor.min.js` bundles jQuery and Bootstrap 5), flatpickr (Vietnamese locale), jquery-toast, select2 (waitlist), bootbox (payment dialogs), Firebase compat SDK for web push (`firebase-messaging-sw.js`, device sync to `/Notification/SyncWebDevice`). Assets are cache-busted with `?v=<hash>`.

## Localization

Two cultures switched by `POST /Language/SetLanguage`. Labels on student pages default to English; some pages (application catalog, FYE) are Vietnamese only. Selectors in [pages.md](pages.md) avoid text matching where a class or `title` attribute exists.
