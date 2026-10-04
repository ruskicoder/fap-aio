---
id: architecture.fap-v2.scripts
type: interface
status: draft
owner: unassigned
summary: "FAP v2 first-party scripts: which page loads which script, the globals and events they expose, and which function calls which endpoint."
---

# FAP v2 page scripts

Observed 2026-10-04 from a student account. Scripts were read from 25 top-level routes and 11 sub-pages (create forms, detail pages) with GET requests only; no script function was invoked. Endpoint parameters and response shapes live in [endpoints.md](endpoints.md). Asset URLs carry a `?v=<hash>` cache-buster, so a changed hash signals a changed script.

## Script per page

Every authenticated page loads the layout set: `jidox/config.js`, `jidox/vendor.min.js` (jQuery 3.7, Bootstrap 5, SimpleBar), `flatpickr` with `l10n/vn.js`, `jquery.toast`, `jidox/app.min.js`, then `/js/app-toast.js`, `base.js`, `fap-table-cards.js`, `sidebar-state.js`, `lazy-firebase-loader.js`, `fap-notification-payload.js`, `web-notification-device.js`, `notification-bell.js`. Page scripts on top of that:

| Route | Page scripts |
|---|---|
| `/` | `pages/home-student-content.js`; lazily loads `pages/home-pinned-modal.js`, `bootbox`, `pages/home.js` from `data-*-script-url` |
| `/WeeklyTimetable` | `pages/timetable-common.js`, `pages/weekly-timetable.js` |
| `/Report/Grade`, `/Report/Attendance` | `pages/academic-report.js` |
| `/News`, `/Document`, `/Transaction`, `/Wishlist` | `fap-paged-list.js` (DataTables on `/Transaction` and `/Wishlist`) |
| `/News/Detail/{guid}` | `news-detail.js` |
| `/Document`, `/StartupGroup` | `modules/file-attach.js` |
| `/Transaction` | `pages/transaction-list.js` |
| `/Wishlist` | `pages/wishlist-list.js`, `pages/wishlist-actions.js` |
| `/Wishlist/Register` | `pages/wishlist-register.js` (select2) |
| `/CrossClassChange` | `pages/cross-class-change-index.js` |
| `/CrossClassChange/Create` | `pages/cross-class-change-create.js` |
| `/Application/Create` | `applications/app-type-runtime-form.js`, `applications/application-create.js` |
| `/ShoppingCart` | `shopping-cart.js` |
| `/StartupGroup` | `pages/startup-group-index-note-popup.js` |
| `/Account` | `account-parent-login-confirm.js` |
| `/StudentProfile` | `pages/student-profile.js` |
| `/ExamSchedule`, `/Report/Transcript`, `/Report/OjtConditions`, `/Report/ThesisConditions`, `/Curriculum`, `/Subject`, `/Application`, `/Application/Catalog`, `/CoursePendingPayment`, `/FyeCheckInLog`, detail pages | layout set only |

No page carries an inline script, with one exception: `/FyeCheckInLog/Create` has an inline `<script>` without a nonce that toggles the support section (`#needsSupportYes`, `#needsSupportNo`, `#supportSection`). The page's `script-src` has no `'unsafe-inline'`, so the browser blocks it and that toggle does not run (a FAP defect, not an extension concern). `/Notification` itself is 404; the bell is the only notification UI.

## Globals

Set on `window` by first-party scripts (a live diff against a clean frame):

| Global | Owner | Members |
|---|---|---|
| `fetch` | `base.js` | Replaced by `fapPermissionAwareFetch`, which applies the feedback gate and permission normalization from [platform.md](platform.md) to every page-world `fetch` |
| `AppToast` | `app-toast.js` | `success`, `error`, `warning`, `info`; a toast queued in `localStorage` keys `toast_message`, `toast_type` is shown on the next page load |
| `isFetchPermissionResponse`, `handleFetchPermissionResponse` | `base.js` | Permission helpers |
| `fapTimetable` | `timetable-common.js` | `toIsoDate`, `parseIsoDate`, `getMonthGridStart`, `createAbortController`, `fetchPartial(url, signal)`, `setElementText`, `toggleLink`, `normalizeSafeHttpUrl` |
| `fapFirebaseLoader` | `lazy-firebase-loader.js` | `ensureLoaded`, `isReady` |
| `fapNotificationPayload` | `fap-notification-payload.js` | Payload readers: `resolveNotificationId`, `resolveNotificationLink`, `resolveNotificationContent`, ... |
| `fapWebNotification` | `web-notification-device.js` | `forceSync`, `requestPermissionAndSync` |

Template globals (`config`, `defaultConfig`, `ThemeCustomizer`, `bootstrap`, `$`, `jQuery`, `SimpleBar`, `flatpickr`, `vn`) come from Jidox and its vendor bundle.

## DOM events

Hooks an extension can listen to instead of polling the DOM:

| Event | Fired by | Meaning |
|---|---|---|
| `partial:loaded` | `base.js` (modal partials); consumed by `fap-table-cards.js` | A partial was inserted; tables may need re-reading |
| `fap:notification-received` | `web-notification-device.js` | A foreground push arrived; the bell prepends it |
| `fap:web-notification-synced` | `web-notification-device.js` | Device token synced |
| `fapApplicationFormDataChanged` | `app-type-runtime-form.js` | Runtime application form value changed; `application-create.js` re-previews the fee |

`academic-report.js` and `weekly-timetable.js` swap their content without firing an event, so a content script must observe `.academic-report-content` or the timetable container with a `MutationObserver`.

## Function to endpoint matrix

URL source `data-*` means the script reads the URL from that attribute on the page; `const` means a literal in the script.

| Script | Function | Method | Endpoint | URL source | Trigger |
|---|---|---|---|---|---|
| `base.js` | `openPartialInModal` | GET | any, from `.js-open-modal[data-action]` | `data-action` | click |
| `base.js` | click handler on `.js-delete` | POST | any, from `data-action` | `data-action` | click after `confirm()`; submits the enclosing form if there is one |
| `base.js` | `submitAjaxForm` | form method | `form.js-ajax-form[action]` | form | submit; body `FormData`, header `X-Requested-With` |
| `base.js` | `handleFeedbackRequired` | | `/Feedback?required=1` | const | response header `X-Feedback-Required: 1` |
| `notification-bell.js` | `loadPage` via `requestText` | GET | `/Notification/BellList` | `data-load-url` | dropdown shown, idle or hover prefetch, "load more" with `data-next-cursor` |
| `notification-bell.js` | `prefetchUnreadBadge` | GET | `/Notification/UnreadCount` | `data-unread-url` | page idle |
| `notification-bell.js` | `postMarkRead` via `postNotification` | POST | `/Notification/MarkRead` | `data-mark-read-url` | click; JSON body, `RequestVerificationToken` header |
| `notification-bell.js` | `postMarkAll` | POST | `/Notification/MarkReadAll` | `data-mark-all-read-url` | click |
| `web-notification-device.js` | `postDeviceSync` | POST | `/Notification/SyncWebDevice` | `data-sync-url` | after permission and FCM token; JSON body |
| `lazy-firebase-loader.js` | `ensureFirebaseLoaded` | GET | `/assets/vendor/firebase/firebase-*-compat.js` | `data-fap-firebase-src`, const | on demand |
| `pages/home-student-content.js` | `attach` | GET | `/Home/StudentContentPartial` | `data-fetch-url` | page load; fills `[data-home-slot]`, strips markup the CSP would block |
| `pages/home.js` | `getBalance` | GET | `/Application/GetBalance` | const | payment dialog |
| `pages/home.js` | `createDngInvoice` | POST | `/Application/InsertToDNG` | const | payment confirm |
| `pages/home.js` | `getFoxPay` | POST | `/Application/GetFoxPay` | const | payment confirm |
| `pages/home.js` | `getQr` | POST | `/Application/GetQr` | const | payment confirm |
| `pages/timetable-common.js` | `fetchPartial` | GET | caller's URL | argument | shared helper, `X-Requested-With` header |
| `pages/weekly-timetable.js` | `loadWeek` | GET | `/WeeklyTimetable/WeekPartial?referenceDate=yyyy-MM-dd` | `data-fetch-url` | week change; results cached per week in memory |
| `pages/weekly-timetable.js` | `requestEdunextCreate` | POST | per slot | `.js-edunext-action[data-edunext-url]` | click; JSON `{success, urlValidRedirect, message}`, then navigates to `urlValidRedirect` |
| `pages/academic-report.js` | `loadReport` | GET | `/Report/Grade` or `/Report/Attendance` with `termId`, `courseId` | `data-report-url`, `data-report-*-param` | select change; falls back to `data-fallback-href` on error |
| `modules/file-attach.js` | `fetchViewToken` | GET | `/Cdn/GetViewToken` | `data-token-endpoint` | click on an attachment; then opens `data-cdn-url-pattern` |
| `news-detail.js` | `rewriteNewsContentImages` | GET (via `img src`) | `/Cdn/ViewImage?fileRef=<hash>` | const | page load; rewrites CDN image URLs in the article body |
| `pages/student-profile.js` | wards change handler | GET | `/StudentProfile/Wards` | `data-wards-url` | province change |
| `pages/cross-class-change-create.js` | `resolveTarget` | GET | `/CrossClassChange/ResolveTargetStudent` | `data-resolve-url` | roll number input |
| `pages/wishlist-register.js` | select2 `ajax` | GET | `/Wishlist/SearchSubjects?term=&page=` | `data-search-url` | typing; JSON `{results, pagination: {more}}` |
| `pages/wishlist-register.js` | `loadPreview` | GET | `/Wishlist/RegistrationPreview?subjectId=` | `data-preview-url` | subject chosen |
| `pages/wishlist-register.js` | `postDeposit` | POST | `/Wishlist/Deposit` | `data-deposit-url` | deposit confirm; then polls balance |
| `pages/wishlist-actions.js` | `postCancel` | POST | `/Wishlist/Cancel` | `data-cancel-url` | bootbox confirm |
| `applications/application-create.js` | `loadSchema` | GET | `/Application/GetFormSchema?applicationTypeId=` | `data-get-schema-url` | type chosen |
| `applications/application-create.js` | `resolveStudentIdByMssv` | GET | `/Application/GetStudentIdByMssv?mssv=` | `data-get-student-id-url` | roll number entered |
| `applications/application-create.js` | `requestPreviewFee` | POST | `/Application/PreviewApplicationFee` | `data-preview-fee-url` | debounced on form change, process-driven fee keys only |
| `applications/application-create.js` | `pollPaymentStatus` | GET | per application | `data-payment-status-url` | after create, while unpaid |
| `applications/application-create.js` | `requestFoxpayUrl` | POST | per application | `data-foxpay-url` | pay click |
| `applications/app-type-runtime-form.js` | `loadOptionsFromApi` | GET | `/Application/GetFormSchema<Source>` (34) | `data-form-schema-*-url` | field render and cascade change |
| `applications/app-type-runtime-form.js` | `uploadSinglePendingFile` | POST | `/Application/UploadFormFile` | `data-fap-upload-url` | before submit; multipart |

Forms posted by the browser without a script: `/Language/SetLanguage`, `/Auth/Logout` (every page), `/Application/Create`, `/Wishlist/Register`, `/FyeCheckInLog/Create`, `/StudentProfile`, `/Account/StudentParentLogin` (`#formParentLoginRegenerate`, confirm in `account-parent-login-confirm.js`), `/Account/ChangeFeIdPassword`. Cross-class create and index forms submit through confirm handlers in their page scripts.

## Consequences for FAP-AIO

- The page-world `fetch` is wrapped. Extension content scripts run in an isolated world with their own `fetch`, so they bypass the feedback gate and permission normalization; they must check `X-Feedback-Required` and the 404-for-unauthorized rule themselves.
- No first-party script exposes timetable, grade or transcript data as a JavaScript object. Data stays in HTML, so FAP-AIO parses the DOM or the partials listed in [endpoints.md](endpoints.md).
- `window.fapTimetable.fetchPartial` and the `data-fetch-url` hooks give stable URLs; prefer reading the `data-*` attribute over hard-coding the path.
- Third-party globals from the owner's own browser extensions (for example a video speed controller) appear in the live window and are not part of FAP.
