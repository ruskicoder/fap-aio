# Schedule UI audit (gate G-UI-SCHEDULE)

Append-only record of the chat audit rounds for the Classes, Exams and Export tabs. The legacy fap-scheduler (`/.deprecated/fap-scheduler/extension/popup.html`, `popup.css`, `popup.js`) is the reference: cards with the full title and coloured tags (exam type, countdown, attendance), "label: value" lines for room, date, time and format with no truncation, sync buttons at the top, upcoming and past with counts, a large export button.

## Round S1, Export (2026-10-26)

Shown: the Export tab with every candidate option group (1 what to export, classes, exams, one file or one each; 2 date range presets, the term, custom; 3 class filters online or offline and per subject; 4 exam filters types, no-room exams, past exams; 5 event title format; 6 event details in the description; 7 reminders in the file, editable; 8 preview of one event and the counts; and "remember my choices"), a keep or drop checklist, and three layouts (A one scrolling form with a pinned download button, B a Classes card and an Exams card each with its own download, C three steps).

Owner picks (2026-10-31): layout A, one scrolling form with the download button pinned at the bottom; keep all eight groups (1 what, 2 range, 3 class filters, 4 exam filters, 5 title format, 6 details, 7 reminders, 8 preview) and "remember my choices"; drop none. Owner: "lgtm". Next session implements Export in full; Classes and Exams rounds still to run before their rebuild (F-3).

Implementation note (2026-10-31, CORE-7.2): built to the S1 drawing. Choices made where the drawing left a value open, for the owner to confirm at the M1 acceptance test: the reminder values are drop-downs (classes 5, 10, 15, 30 or 60 minutes; exams first 1 week, 3 days, 2 days, 1 day or 12 hours, second 3 hours, 2 hours, 1 hour, 30 or 15 minutes); the date line under the range shows the bounds of every preset; custom dates are two date fields; the subject name for a class comes from the synced exam list until packaged FLM data ships (M2); FAP's schedule type label, when present, stays in the class description without a chip; with only one kind selected the file is named after it (`fap-classes-` or `fap-exams-`), with both in one file `fap-schedule-`.

## Round S2, Classes and Exams (2026-10-31)

Shown: the Classes tab (Sync this week and Sync the term at the top, This week and All with counts, day headers, cards with the full title CODE · name, a slot tag and a coloured attendance tag, label-value lines for room, time, lecturer and group, no truncation) and the Exams tab (Sync exams, Upcoming and Past with counts, a row of type chips, cards with the full title, a coloured type tag and a countdown tag, lines for format, room or "not assigned yet", date, time and results date), drawn from the legacy fap-scheduler cards. Questions: 1 grouping (day headers or flat cards with a date line), 2 Classes navigation (This week and All, or range chips), 3 tag colours (soft tints or legacy solid fills), 4 exam type filter (chips row or a filter dialog), 5 which card lines and tags to keep. Owner picks pending.

Owner picks (2026-10-31): 1 day headers; 2 This week and All with counts; 3 soft tints; 4 type chips row; 5 drop no lines. Owner: "lgtm continue". Round S2 agreed. With S1 this completes the gate: the agreed visual of all three tabs is saved as `ui/schedule.html`, requirement 8 is revised (old text in `.deprecated/2026-10-31-schedule-audit/`) and the rebuild is CORE-6.3 (fix F-3). Gate G-UI-SCHEDULE passed.

