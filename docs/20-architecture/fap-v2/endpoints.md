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
| GET | `/Home/Index`, `/Account/Index`, `/Feedback/Index` | none | page (same as the controller root) | | GET 200 |
| GET | `/Home/Privacy` | none | HTTP 500 (template leftover) | | GET 500 |

## Notifications (layout bell)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Notification/BellList` | `pageIndex`, `pageSize`, `cursor` (optional) | partial | | GET 200, `data-load-url`, `notification-bell.js` |
| GET | `/Notification/UnreadCount` | none | json `{hasUnread}` | | GET 200, `data-unread-url` |
| POST | `/Notification/MarkRead` | JSON body `{notificationIds: [...]}` | json | header | `data-mark-read-url`, `notification-bell.js` |
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
| GET | `/StudentProfile/Wards` | `provinceId` | json `[{id, name}]` | | GET 200, `data-wards-url` |

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
| GET | `/Subject` | `keyword`, `TakeAttendance`, `IsGraded`, `IsGraduate`, `pageIndex`, `pageSize` (max 100) | page (paged table, 50 rows by default) | | GET 200, GET form |
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
| GET | `/Cdn/GetViewToken` | `fileId`, `fileName`, split from `data-file-ref` (`<fileId>_<fileName>`) at the first `_` | json `{data: {success, message, code, data: {token}}, isSuccess, message, code, validationErrors}` | | GET 200, `file-attach.js` |
| GET | `https://cdn.fpt.edu.vn/api/cdn/token_cdn/{hash}` | `{hash}` is the whole file ref; `project`, `token` | file | | `data-cdn-url-pattern`; `fetch` from the page is blocked by CSP `connect-src` (verified), the browser opens it as a navigation |
| GET | `/Cdn/ViewImage` | `fileRef` | image | | `news-detail.js` |

## Applications (student requests)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Application` | none | page (my applications) | | GET 200 |
| GET | `/Application/Catalog` | none | page (46 application types) | | GET 200 |
| GET | `/Application/Create` | `applicationTypeId={guid}` | page (dynamic form) | | GET 200 |
| POST | `/Application/Create` | `ApplicationTypeId`, `Mssv`, `Reason`, `Number`, `FormData` (JSON of the runtime form) | redirect | form | form `#test-create-app-form` |
| GET | `/Application/GetFormSchema` | `applicationTypeId` | json (runtime form schema, see below) | | GET 200 (all 46 types), `data-get-schema-url` |
| GET | `/Application/GetFormSchema*` (34 option sources, listed below) | see "Option sources" below | json `[{value, label, description, isDefault}]` | | GET 200 (sampled), `data-form-schema-*-url` |
| GET | `/Application/GetStudentIdByMssv` | `mssv` | json `{studentId}` | | GET 200 (own roll number) |
| POST | `/Application/UploadFormFile` | multipart `file`, `__RequestVerificationToken` | json `{success, hash, error}` | form field | `data-fap-upload-url`, `app-type-runtime-form.js` |
| POST | `/Application/PreviewApplicationFee` | JSON body | json | header | `data-preview-fee-url` |
| GET | `/Application/GetBalance` | none | json `{balance}` (wallet, number) | | GET 200, `home.js` |
| POST | `/Application/InsertToDNG` | `Amount`, `typeDng`, use-balance flag | json (payment invoice) | header | `home.js` |
| POST | `/Application/GetFoxPay` | `typeDng` | json (FPT Pay link) | header | `home.js` |
| POST | `/Application/GetQr` | `typeDng` | json (VietQR data) | header | `home.js` |
| GET | per-application `data-payment-status-url` | none | json | | `application-create.js`; not observed |
| POST | per-application `data-foxpay-url` | `dngItemId` | json | header | `application-create.js`; not observed |

### Option sources

Verified 2026-10-04 (GET 200, shape `[{value, label, description, isDefault}]` unless noted): `Terms`, `Banks`, `BankBranches?bankId=`, `ProvincesOptions`, `WardsByProvinceOptions?provinceId=`, `NewMajors`, `SpecializationsByMajor?majorId=`, `StudentCurrentMajor`, `StudentCurrentSpecialization`, `StudiedNonCourseraSubjects`, `CurriculumNextTermSubjects`, `StudentNonLukSubjects`, `PlacedSubjectsNoPresentAttendance`, `PassedSubjectsWithPrerequisites`, `UnpassedCurriculumSubjectsWithPrerequisites`, `CampusesExceptStudentCurrent`, `StudentProfileDisplayOptions?apiKey=StudentApplicant<Field>`. These returned an empty array for this account: `CourseraSubjects`, `HealthInsuranceFacilitiesOptions`, `ReferencedApplicationOptions`, `MarkGroupNames`, `MarkNames`, `SemesterSubjectsByTerm?termId=`, `CourseAttendanceSessions?courseId=`, `StudentLukCourses`, `StudentNonLukCourses`, `SubjectsByStudentCurrentTerm`, `RetakeEligibleSubjects`, `RetutoringSubjects`, both curriculum past and future term lists, and all three open-course lists.

The schema returned by `GetFormSchema` is `{formSchema, isPrintRequire, requiresQuantity, deadline, fixedFeeAmount, feeKey, note, registrationPeriodDisplay}`, where `formSchema` is a JSON string `{fields: [...], version}`. Field types seen across all 46 application types: `select` (45), `text` (8), `displayApi` (8), `file` (6), `number`, `staticText`, `radio`, `confirm`, `checkbox`. Field keys: `id, name, type, label, accept, required, apiUrl, apiMethod, labelField, valueField, optionSource, regex, regexMessage, content, options, confirmText, referencedApplicationTypeId`.

Option fields declare `apiUrl: /Academic/ApplicationTypes/OptionsProxy?apiKey=<Key>` with `apiMethod: GET` (38 distinct keys). That proxy is a staff route and returns 404 to students; `app-type-runtime-form.js` rewrites each key to the dedicated `/Application/GetFormSchema<...>` route below. Dependent fields add query parameters taken from the preceding field: `subjectId`, `courseId`, `termId`, `markGroupName`, `majorId`, `bankId`, `provinceId`, `studentId` (for `SubjectsByStudentCurrentTerm`, `CurriculumNextTermSubjectsForStudent`, `CampusesExceptStudentCurrent`), `applicationTypeId` (Coursera list) and `referencedApplicationTypeId`.

Dependency chains, from the script's `upstreamKeys` table: `SemesterSubjectsByTerm` then `MarkGroupsByTermSubject` then `MarksByTermSubjectGroup`; subject lists then `OpenCoursesBySubject` (or `...ExcludingStudentCourse`, `OpenInternationalCoursesBySubject`); `StudentLukCourses` or `StudentNonLukCourses` then `CourseAttendanceSessions`; `ProvincesList` then `WardsByProvince`; `BanksList` then `BankBranchesByBank`; `NewMajorsList` then `SpecializationsByNewMajor`.

`GetFormSchema*` option sources, all `GET /Application/<name>`: `GetFormSchemaReferencedApplicationOptions`, `GetFormSchemaRetakeEligibleSubjects`, `GetFormSchemaPassedSubjectsWithPrerequisites`, `GetFormSchemaStudiedNonCourseraSubjects`, `GetFormSchemaCurriculumPastTermUnstudiedSubjectsWithPrerequisites`, `GetFormSchemaCurriculumNextTermSubjects`, `GetFormSchemaSubjectsByStudentCurrentTerm`, `GetFormSchemaCampusesExceptStudentCurrent`, `GetFormSchemaBanks`, `GetFormSchemaProvincesOptions`, `GetFormSchemaWardsByProvinceOptions`, `GetFormSchemaBankBranches`, `GetFormSchemaTerms`, `GetFormSchemaSemesterSubjectsByTerm`, `GetFormSchemaCourseraSubjects`, `GetFormSchemaNewMajors`, `GetFormSchemaSpecializationsByMajor`, `GetFormSchemaStudentCurrentMajor`, `GetFormSchemaStudentCurrentSpecialization`, `GetFormSchemaMarkGroupNames`, `GetFormSchemaMarkNames`, `GetFormSchemaCurriculumFutureTermUnstudiedSubjectsWithPrerequisites`, `GetFormSchemaOpenCoursesBySubject`, `GetFormSchemaPlacedSubjectsNoPresentAttendance`, `GetFormSchemaRetutoringSubjects`, `GetFormSchemaOpenCoursesBySubjectExcludingStudentCourse`, `GetFormSchemaStudentLukCourses`, `GetFormSchemaStudentNonLukSubjects`, `GetFormSchemaStudentNonLukCourses`, `GetFormSchemaCourseAttendanceSessions`, `GetFormSchemaUnpassedCurriculumSubjectsWithPrerequisites`, `GetFormSchemaOpenInternationalCoursesBySubject`, `GetFormSchemaStudentProfileDisplayOptions`, `GetFormSchemaHealthInsuranceFacilitiesOptions`.

## Cross-class exchange (replaces legacy MoveOut)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/CrossClassChange` | `termId={guid}` (select with 28 terms, Fall2017 to Fall2026) | page (my exchange requests) | | GET 200, GET form |
| GET | `/CrossClassChange/Create` | none | page; shows an empty card when the student has no eligible class | | GET 200 |
| GET | `/CrossClassChange/ResolveTargetStudent` | `fromCourseId={guid}` (one of the caller's courses), `rollNumber` | success: json `{rollNumber, courses: [{courseId, label or courseName}]}` (from the script). Failure: HTTP 400 json `{success: false, message}` | | GET 400 verified, see note below |
| POST | `/CrossClassChange/Create` (inferred) | form `#cross-class-change-form`: from course `#cross-class-from-course`, target roll `#cross-class-target-roll`, resolved student `#cross-class-target-student`, to course `#cross-class-to-course`; field `name`s not observed | not observed | form | `cross-class-change-create.js`; form markup not rendered for this account |

`ResolveTargetStudent` verification (2026-10-04, two roll numbers supplied by the account owner, against each of the owner's four current-term courses): every call returned HTTP 400 `{"success":false,"message":"Không tìm thấy sinh viên/lớp phù hợp để đổi."}` ("no matching student or class to exchange"). A non-existent roll number returns the same message, so the endpoint does not reveal whether a student exists. Omitting `fromCourseId` returns HTTP 400 `"Please enter all class exchange information."`. The success path needs a from-course that the Create page offers as exchange-eligible; this account had none.

## Payments and wallet

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/ShoppingCart` | none | page (tuition and dormitory items, wallet modal) | | GET 200 |
| POST | per-item `form.js-payment-form` / `.js-total-payment-form` action | `amount`, `typeDng`, `useBalance`, `payableIds`, `isPayable`, `externalId`, `isDormitory` | redirect to payment | form | `shopping-cart.js`; no cart items for this account, so the action URL was not rendered |
| GET | `/CoursePendingPayment` | none | page | | GET 200 |
| GET | `/Transaction` | `keyword`, `FromReceiptDate`, `ToReceiptDate`, `SortBy`, `IsDesc`, `pageIndex`, `pageSize` | page (`#transaction-datatable`) | | GET 200, GET form |
| GET | `/Transaction/Detail/{guid}` | none | page | | GET 200 |

## Class waitlist (Wishlist)

| Method | Path | Parameters | Response | CSRF | Evidence |
|---|---|---|---|---|---|
| GET | `/Wishlist` | `Status`, `IsActive`, `pageIndex`, `pageSize` | page (`#wishlist-datatable`) | | GET 200, GET form |
| POST | `/Wishlist/Cancel` | url-encoded `__RequestVerificationToken`, `id` | json `{success, message}` | header and field | `data-cancel-url`, `wishlist-actions.js` |
| GET | `/Wishlist/Register` | none | page | | GET 200 |
| POST | `/Wishlist/Register` | `SubjectId` (required) | redirect | form | form `#wishlist-register-form` |
| GET | `/Wishlist/SearchSubjects` | `term`, `page` (select2) | json `{results: [{id, text}], pagination: {more}}`, 20 per page; empty `term` returns no results | | GET 200 |
| GET | `/Wishlist/RegistrationPreview` | `subjectId` | json `{subjectId, subjectCode, subjectName, enrollmentTermId, enrollmentTermName, referenceTermName, referenceTermCode, referenceSubjectCode, isGradeImprovement, isRepeatEnrollment, isSuspended, baseFee, finalAmount, feePercent, walletBalance, sufficientBalance, canRegister, blockReasonCode, blockReasonMessage}` | | GET 200 |
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
| GET | `/FyeMentorFeedback/SearchAssignments` | `keyword` (2 or more characters, optional); sends `X-Requested-With` | json array (empty for this account) | | GET 200 |
| POST | `/FyeMentorFeedback/Create` | `AssignmentId`, `OverallRating`, `SupportRating`, `CommunicationRating`, `EngagementRating`, `Comment`, `IsAnonymous` | redirect | form | form |

## Not found or not captured

- Request bodies of `MarkRead`, `SyncWebDevice`, `PreviewApplicationFee`, `Wishlist/Deposit` and the `CrossClassChange` create form are partly unknown. Capturing them needs a real interaction, which this scrape did not do.
- Unauthorized and non-existent routes both return 404 (see [platform.md](platform.md)), so routes outside this list cannot be discovered by guessing. 78 guessed routes (course, group, class, student, lecturer, admin, API and Swagger paths) all returned 404.
- The edunext, payment-status and foxpay URLs are rendered per item and were not present for this account.
- No JSON API exists for timetable, exams, grades, attendance or transcript. All are server-rendered HTML; the timetable and reports also serve HTML partials.
