---
id: architecture.fap-v2.endpoints
type: interface
status: draft
owner: unassigned
summary: "Catalog of every FAP v2 endpoint found, grouped by MVC controller, with method, parameters and response."
---

# FAP v2 endpoint catalog

Observed 2026-10-04 from a student account. Rules for reading this table:

- **Evidence** says how the endpoint was found. `GET 200` means it was requested and answered 200. `form` means an HTML `<form action>`. `data-*` means a URL in a `data-*-url` attribute. `js` means a call site in the named script. Only `GET 200` rows were actually exercised; every other row is declared by the site but was not called.
- **Response** `page` is a full HTML document with layout. `partial` is an HTML fragment without layout. `json` is JSON.
- **CSRF**: `form` means a hidden `__RequestVerificationToken` field; `header` means a `RequestVerificationToken` request header carrying the same token. See [platform.md](platform.md).
- `{guid}` is a UUID (the v2 database uses UUIDv7-style ids, for example `01a07ca7-...`).

## Shell and session

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/` | none | page (student home shell) | | GET 200 |
| GET | `/Home/StudentContentPartial` | none; sends `X-Requested-With: XMLHttpRequest`, `Accept: text/html` | partial (profile card, metrics, wallet, news, pinned modal) | | GET 200, `data-fetch-url`, `home-student-content.js` |
| POST | `/Language/SetLanguage` | `returnUrl`, `culture` (submit button value) | redirect | form | form in layout |
| POST | `/Auth/Logout` | none | redirect | form | form in layout |
| GET | `/Feedback` | `required=1` when forced | page | | GET 200, `base.js` |

## Notifications (layout bell)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Notification/BellList` | paging (`pageIndex`, cursor; names not captured) | partial | | `data-load-url`, `notification-bell.js` |
| GET | `/Notification/UnreadCount` | none | json | | `data-unread-url`, `notification-bell.js` |
| POST | `/Notification/MarkRead` | notification id (body shape not captured) | json | header | `data-mark-read-url` |
| POST | `/Notification/MarkReadAll` | none | json | header | `data-mark-all-read-url` |
| POST | `/Notification/SyncWebDevice` | JSON body (FCM device token, enabled flag, permission) | json | header | `data-sync-url`, `web-notification-device.js` |
| GET | `/firebase-messaging-sw.js` | none | script (FCM service worker) | | GET 200 |

## Account and profile

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Account` | none | page (personal information) | | GET 200 |
| POST | `/Account/StudentParentLogin` | none (regenerates parent login) | redirect | form | form `#formParentLoginRegenerate` |
| POST | `/Account/ChangeFeIdPassword` | `CurrentPassword`, `NewPassword`, `ConfirmPassword` (all required) | redirect | form | form |
| GET | `/StudentProfile` | none | page (edit form) | | GET 200 |
| POST | `/StudentProfile` | `Form.PlaceOfIssue`, `Form.NationCode`, `Form.EthnicId`, `Form.ReligionId`, `Form.ProvinceId`, `Form.WardId`, `Form.Address` | redirect | form | form |
| GET | `/StudentProfile/Wards` | `provinceId` | json array of options | | `data-wards-url`, `student-profile.js` |

## Schedule

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/WeeklyTimetable` | none | page (shell with `data-fetch-url`, `data-reference-date`, `data-culture`) | | GET 200 |
| GET | `/WeeklyTimetable/WeekPartial` | `referenceDate=YYYY-MM-DD` (any day in the week) | partial (week grid table plus mobile cards) | | GET 200, `weekly-timetable.js` |
| POST | per-slot `data-edunext-url` | none | json | header | `weekly-timetable.js`; URL only rendered on eligible slots, not observed |
| GET | `/ExamSchedule` | none | page (`table.fap-sheet`) | | GET 200 |

## Academic reports

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Report/Attendance` | `termId={guid}`, `courseId={guid}` (both optional) | page; partial when `X-Requested-With: XMLHttpRequest` | | GET 200, `academic-report.js` |
| GET | `/Report/Grade` | `termId={guid}`, `courseId={guid}` (both optional) | page; partial when `X-Requested-With: XMLHttpRequest` (observed: 8 KB partial against a 40 KB page) | | GET 200, `academic-report.js` |
| GET | `/Report/Transcript` | none | page (two `table.fap-sheet`) | | GET 200 |
| GET | `/Report/OjtConditions` | none | page | | GET 200 |
| GET | `/Report/ThesisConditions` | none | page | | GET 200 |

## Subjects and curriculum

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Subject` | `keyword`, `TakeAttendance`, `IsGraded`, `IsGraduate`, `pageIndex` | page (paged table, 50 rows) | | GET 200, GET form |
| GET | `/Subject/Detail/{guid}` | none | page (detail grid) | | GET 200 |
| GET | `/Curriculum` | none | page (`table.fap-sheet`) | | GET 200 |

## News, documents, files

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/News` | `keyword`, `FAPNewsTypeId={guid}`, `IsPin`, `SortBy` (`Title`, `FAPNewsTypeId`, `ExpiredDate`, `CreatedAt`), `IsDesc`, `pageIndex`, `pageSize` | page | | GET 200, GET form `#news-filter-form` |
| GET | `/News/Detail/{guid}` | none | page | | GET 200 |
| GET | `/Document` | `keyword`, `DocumentTypeId`, `IsActive`, `SortBy` (`Name`, `DocumentTypeId`, `CreatedAt`), `IsDesc`, `pageIndex`, `pageSize` | page | | GET 200, GET form `#document-filter-form` |
| GET | `/Document/Detail/{guid}` | none | page | | GET 200 |
| GET | `/Document/DrivePdf` | none | redirect to a cross-origin target (opaque under `redirect: manual`) | | GET 3xx |
| GET | `/Cdn/GetViewToken` | `fileId`, `fileName` | json (view token) | | `data-token-endpoint`, `file-attach.js` |
| GET | `https://cdn.fpt.edu.vn/api/cdn/token_cdn/{hash}` | `project`, `token` | file | | `data-cdn-url-pattern` |
| GET | `/Cdn/ViewImage` | `fileRef` | image | | `news-detail.js` |

## Applications (student requests)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Application` | none | page (my applications) | | GET 200 |
| GET | `/Application/Catalog` | none | page (46 application types) | | GET 200 |
| GET | `/Application/Create` | `applicationTypeId={guid}` | page (dynamic form) | | GET 200 |
| POST | `/Application/Create` | `ApplicationTypeId`, `Mssv`, `Reason`, `Number`, `FormData` (JSON of the runtime form) | redirect | form | form `#test-create-app-form` |
| GET | `/Application/GetFormSchema` | `applicationTypeId` | json (runtime form schema) | | `data-get-schema-url`, `application-create.js` |
| GET | `/Application/GetFormSchema*` (34 option sources, listed below) | schema-defined | json options | | `data-form-schema-*-url` |
| GET | `/Application/GetStudentIdByMssv` | `mssv` | json `{studentId}` | | `data-get-student-id-url` |
| POST | `/Application/UploadFormFile` | multipart `file`, `__RequestVerificationToken` | json `{success, hash, error}` | form field | `data-fap-upload-url`, `app-type-runtime-form.js` |
| POST | `/Application/PreviewApplicationFee` | JSON body | json | header | `data-preview-fee-url` |
| GET | `/Application/GetBalance` | none | json `{balance}` | | `home.js` |
| POST | `/Application/InsertToDNG` | `Amount`, `typeDng`, use-balance flag | json (payment invoice) | header | `home.js` |
| POST | `/Application/GetFoxPay` | `typeDng` | json (FPT Pay link) | header | `home.js` |
| POST | `/Application/GetQr` | `typeDng` | json (VietQR data) | header | `home.js` |
| GET | per-application `data-payment-status-url` | none | json | | `application-create.js`; not observed |
| POST | per-application `data-foxpay-url` | `dngItemId` | json | header | `application-create.js`; not observed |

`GetFormSchema*` option sources, all `GET /Application/<name>`: `GetFormSchemaReferencedApplicationOptions`, `GetFormSchemaRetakeEligibleSubjects`, `GetFormSchemaPassedSubjectsWithPrerequisites`, `GetFormSchemaStudiedNonCourseraSubjects`, `GetFormSchemaCurriculumPastTermUnstudiedSubjectsWithPrerequisites`, `GetFormSchemaCurriculumNextTermSubjects`, `GetFormSchemaSubjectsByStudentCurrentTerm`, `GetFormSchemaCampusesExceptStudentCurrent`, `GetFormSchemaBanks`, `GetFormSchemaProvincesOptions`, `GetFormSchemaWardsByProvinceOptions`, `GetFormSchemaBankBranches`, `GetFormSchemaTerms`, `GetFormSchemaSemesterSubjectsByTerm`, `GetFormSchemaCourseraSubjects`, `GetFormSchemaNewMajors`, `GetFormSchemaSpecializationsByMajor`, `GetFormSchemaStudentCurrentMajor`, `GetFormSchemaStudentCurrentSpecialization`, `GetFormSchemaMarkGroupNames`, `GetFormSchemaMarkNames`, `GetFormSchemaCurriculumFutureTermUnstudiedSubjectsWithPrerequisites`, `GetFormSchemaOpenCoursesBySubject`, `GetFormSchemaPlacedSubjectsNoPresentAttendance`, `GetFormSchemaRetutoringSubjects`, `GetFormSchemaOpenCoursesBySubjectExcludingStudentCourse`, `GetFormSchemaStudentLukCourses`, `GetFormSchemaStudentNonLukSubjects`, `GetFormSchemaStudentNonLukCourses`, `GetFormSchemaCourseAttendanceSessions`, `GetFormSchemaUnpassedCurriculumSubjectsWithPrerequisites`, `GetFormSchemaOpenInternationalCoursesBySubject`, `GetFormSchemaStudentProfileDisplayOptions`, `GetFormSchemaHealthInsuranceFacilitiesOptions`.

## Cross-class exchange (replaces legacy MoveOut)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/CrossClassChange` | `termId={guid}` (select with 28 terms, Fall2017 to Fall2026) | page (my exchange requests) | | GET 200, GET form |
| GET | `/CrossClassChange/Create` | none | page; shows an empty card when the student has no eligible class | | GET 200 |
| GET | `/CrossClassChange/ResolveTargetStudent` | `fromCourseId={guid}`, `rollNumber` | json `{rollNumber, courses: [{courseId, ...}]}` | | `data-resolve-url`, `cross-class-change-create.js` |
| POST | `/CrossClassChange/Create` (inferred) | from course, target student, to course | not observed | form | form not rendered for this account |

## Payments and wallet

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/ShoppingCart` | none | page (tuition and dormitory items, wallet modal) | | GET 200 |
| GET | `/CoursePendingPayment` | none | page | | GET 200 |
| GET | `/Transaction` | `keyword`, `FromReceiptDate`, `ToReceiptDate`, `SortBy`, `IsDesc`, `pageIndex`, `pageSize` | page (`#transaction-datatable`) | | GET 200, GET form |
| GET | `/Transaction/Detail/{guid}` | none | page | | GET 200 |

## Class waitlist (Wishlist)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Wishlist` | `Status`, `IsActive`, `pageIndex`, `pageSize` | page (`#wishlist-datatable`) | | GET 200, GET form |
| POST | `/Wishlist/Cancel` | multipart `id` | json | header | `data-cancel-url`, `wishlist-actions.js` |
| GET | `/Wishlist/Register` | none | page | | GET 200 |
| POST | `/Wishlist/Register` | `SubjectId` (required) | redirect | form | form `#wishlist-register-form` |
| GET | `/Wishlist/SearchSubjects` | select2 search term (name not captured) | json | | `data-search-url` |
| GET | `/Wishlist/RegistrationPreview` | `subjectId` | json | | `data-preview-url` |
| POST | `/Wishlist/Deposit` | multipart `amount` and related fields | json `{success, message}` | header | `data-deposit-url` |

## Startup applications

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/StartupGroup` | none | page | | GET 200 |
| GET | `/StartupGroup/Add` | none | page (no form rendered for this account) | | GET 200 |

## First Year Experience (FYE)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/FyeCheckInLog` | none | page | | GET 200 |
| GET | `/FyeCheckInLog/Create` | none | page | | GET 200 |
| POST | `/FyeCheckInLog/Create` | `Request.MeetingDate`, `Request.MeetingMethod`, `Request.ConnectionScore`, `Topic*` flags, `Request.TopicOtherText`, `Request.NeedsSupport`, `Signal*` flags, `Request.SupportDescription`, `Request.AdditionalNote` | redirect | form | form |
| GET | `/FyeMentorFeedback` | none | page | | GET 200 |
| GET | `/FyeMentorFeedback/Create` | none | page | | GET 200 |
| POST | `/FyeMentorFeedback/Create` | `AssignmentId`, `OverallRating`, `SupportRating`, `CommunicationRating`, `EngagementRating`, `Comment`, `IsAnonymous` | redirect | form | form |

## Not found or not captured

- Request bodies of `MarkRead`, `SyncWebDevice`, `PreviewApplicationFee`, `Wishlist/Deposit` and the `CrossClassChange` create form are partly unknown. Capturing them needs a real interaction, which this scrape did not do.
- The edunext, payment-status and foxpay URLs are rendered per item and were not present for this account.
- No JSON API exists for timetable, exams, grades, attendance or transcript. All are server-rendered HTML; the timetable and reports also serve HTML partials.
