---
id: work.investigations.10-04-endpoint-and-flow-verification
type: investigation
status: draft
owner: unassigned
summary: "Each read-only GET endpoint called once, ResolveTargetStudent probed, and four owner-approved low-risk POST and navigation flows run."
---

# Endpoint and flow verification (2026-10-04)

Third pass over FAP v2. The account owner approved four low-risk flows and declined every flow with side effects (file upload, waitlist register or cancel, payment invoices). No application, waitlist, exchange, profile, FYE or payment action was submitted.

## Read-only GETs

Every GET endpoint in the [catalog](../../20-architecture/fap-v2/endpoints.md) was called at least once and answered 200, except `ResolveTargetStudent` (HTTP 400 by design, below). Response shapes are recorded in the catalog. Values (names, balances, ids) were not recorded.

## ResolveTargetStudent

Called with two roll numbers supplied by the account owner, against each of the owner's four current-term courses, plus a fake roll number and a call without `fromCourseId`. Every call with a course returned HTTP 400 `{"success":false,"message":"Không tìm thấy sinh viên/lớp phù hợp để đổi."}`, including the fake roll number, so the endpoint does not reveal whether a student exists. Without `fromCourseId` it returns `"Please enter all class exchange information."`. The success path requires a from-course that `/CrossClassChange/Create` offers as exchange-eligible; this account has none.

## Approved flows

| Flow | Request | Result |
|---|---|---|
| Mark one notification read | `POST /Notification/MarkRead` with `RequestVerificationToken` header, body `{notificationIds:[id]}` | Item flag changed to `True`. Repeating returns `200 {success:true, affected:0, hasUnread:true}`. Without the token: `400`, empty body. |
| Language switch | Layout form `POST /Language/SetLanguage` with `culture=vi`, then `culture=en` | Redirect to `returnUrl`; `<html lang>` and all labels, headers and `title` attributes switch. Culture cookie is HttpOnly. Restored to `en`. |
| Fee preview | `POST /Application/PreviewApplicationFee` with JSON `{applicationTypeId, number, reason, formData}` | `200 {feeAmount:null, errorCode:"APPLICATION_REGISTRATION_CLOSED", message}` for two process-driven types. |
| Document file and user guide | Navigation to the CDN `token_cdn` URL and to `/Document/DrivePdf` | CDN redirects to a MinIO presigned URL (1 hour). `DrivePdf` redirects to a Google Drive viewer. |

## Findings that change FAP-AIO design

- Page text is localized in both cultures, including table headers and the `title` attributes the first scrape treated as selectors. Parsers must use positions, classes or icon classes ([pages.md](../../20-architecture/fap-v2/pages.md#localization-of-page-text)).
- `APPLICATION_REGISTRATION_CLOSED` confirms the registration window is closed, which explains the empty open-course lists recorded in [the roster investigation](2026-10-04-class-roster-and-rendering.md).
- A CSRF token must come from a live form on a FAP page. A page whose DOM was rewritten loses it and every POST then fails with a bare 400.

## Not run

File upload, waitlist register and cancel, payment invoice creation (QR, FPT Pay, DNG), application, cross-class, FYE and profile submissions, password change, parent-login regeneration, web-push device sync.
