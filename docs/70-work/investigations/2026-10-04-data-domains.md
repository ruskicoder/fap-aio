---
id: work.investigations.10-04-data-domains
type: investigation
status: draft
owner: unassigned
summary: "Field-level verification of the five FAP v2 data domains seen by a student."
---

# Data domain verification (2026-10-04)

Follow-up to [the script mapping](../../20-architecture/fap-v2/scripts.md). Same rules: GET only, no form submitted, no POST called. Run in the `en` culture through the `chrome-devtools` MCP on the owner's logged-in tab, fetching pages with the page's own `fetch` and parsing them with `DOMParser`. Only labels, classes and value kinds were read back; no personal values were recorded.

Result: [data-model.md](../../20-architecture/fap-v2/data-model.md).

| Domain | Pages read | Outcome |
|---|---|---|
| User, role, campus | `/Account`, `/StudentProfile`, `/Home/StudentContentPartial`, layout topbar | 55 labelled fields in 8 data cards. No role field or switcher. Campus is display-only in the topbar. |
| Course, class, schedule, room | `/Subject`, `/Subject/Detail/{guid}`, report selectors | Term, Subject, Course, Group, Session, Room keys and formats recorded. Groups and rooms have no ids. |
| Attendance, grade, transcript | `/Report/Grade` and `/Report/Attendance` for 4 terms, 3 courses each | 4 attendance states; mark row kinds by class; course result `--studying`, `--passed`, `--failed`. |
| Application, registration, fee | `/Application`, `/Wishlist`, `/ShoppingCart`, `/CoursePendingPayment`, `/Transaction`, one transaction detail | Waitlist and transaction shapes recorded. Application list and payable items empty, shapes unverified. |
| News, documents, feedback | `/News`, one news detail, `/Document`, `/Feedback` | News and document shapes and type lists recorded. No open feedback session, form shape unverified. |

Still unverified: application list rows, payable cart items, waitlist cancel button, feedback survey form, a failed transcript status, an attendance summary over the absence limit.
