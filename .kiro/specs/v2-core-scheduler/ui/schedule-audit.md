# Schedule UI audit (gate G-UI-SCHEDULE)

Append-only record of the chat audit rounds for the Classes, Exams and Export tabs. The legacy fap-scheduler (`/.deprecated/fap-scheduler/extension/popup.html`, `popup.css`, `popup.js`) is the reference: cards with the full title and coloured tags (exam type, countdown, attendance), "label: value" lines for room, date, time and format with no truncation, sync buttons at the top, upcoming and past with counts, a large export button.

## Round S1, Export (2026-10-26)

Shown: the Export tab with every candidate option group (1 what to export, classes, exams, one file or one each; 2 date range presets, the term, custom; 3 class filters online or offline and per subject; 4 exam filters types, no-room exams, past exams; 5 event title format; 6 event details in the description; 7 reminders in the file, editable; 8 preview of one event and the counts; and "remember my choices"), a keep or drop checklist, and three layouts (A one scrolling form with a pinned download button, B a Classes card and an Exams card each with its own download, C three steps).

Owner picks (2026-10-31): layout A, one scrolling form with the download button pinned at the bottom; keep all eight groups (1 what, 2 range, 3 class filters, 4 exam filters, 5 title format, 6 details, 7 reminders, 8 preview) and "remember my choices"; drop none. Owner: "lgtm". Next session implements Export in full; Classes and Exams rounds still to run before their rebuild (F-3).

Implementation note (2026-10-31, CORE-7.2): built to the S1 drawing. Choices made where the drawing left a value open, for the owner to confirm at the M1 acceptance test: the reminder values are drop-downs (classes 5, 10, 15, 30 or 60 minutes; exams first 1 week, 3 days, 2 days, 1 day or 12 hours, second 3 hours, 2 hours, 1 hour, 30 or 15 minutes); the date line under the range shows the bounds of every preset; custom dates are two date fields; the subject name for a class comes from the synced exam list until packaged FLM data ships (M2); FAP's schedule type label, when present, stays in the class description without a chip; with only one kind selected the file is named after it (`fap-classes-` or `fap-exams-`), with both in one file `fap-schedule-`.

## Round S2, Classes and Exams (2026-10-31)

Shown: the Classes tab (Sync this week and Sync the term at the top, This week and All with counts, day headers, cards with the full title CODE · name, a slot tag and a coloured attendance tag, label-value lines for room, time, lecturer and group, no truncation) and the Exams tab (Sync exams, Upcoming and Past with counts, a row of type chips, cards with the full title, a coloured type tag and a countdown tag, lines for format, room or "not assigned yet", date, time and results date), drawn from the legacy fap-scheduler cards. Questions: 1 grouping (day headers or flat cards with a date line), 2 Classes navigation (This week and All, or range chips), 3 tag colours (soft tints or legacy solid fills), 4 exam type filter (chips row or a filter dialog), 5 which card lines and tags to keep. Owner picks pending.

Owner picks (2026-10-31): 1 day headers; 2 This week and All with counts; 3 soft tints; 4 type chips row; 5 drop no lines. Owner: "lgtm continue". Round S2 agreed. With S1 this completes the gate: the agreed visual of all three tabs is saved as `ui/schedule.html`, requirement 8 is revised (old text in `.deprecated/2026-10-31-schedule-audit/`) and the rebuild is CORE-6.3 (fix F-3). Gate G-UI-SCHEDULE passed.

## G-UAT-M1 feedback on Export (2026-10-31)

Owner: every checklist item passes, but UAT is not passed. "I cannot have option: Room - SubjectCode. This is the most used format and I dislike any events that don't show the room in the event name; this is for a quick glance of the room position and the event." Tiered notifications: exams 30 minutes, 2 hours and 1 day before; classes 15 minutes, 2 hours and 1 day before. "Non customizable export options are the bummer here." Recorded as F-7; round S3 follows.


## Round S3, Export titles, reminders and customization (2026-10-31)

Shown: working editors. Titles built from pieces (class: room, code, subject name, group, slot, lecturer, start time; exam: room, exam type, code, subject name, exam format, start time) with a separator and a live preview, preloaded with Room - Code and Room - Type Code; reminder tiers per kind, any number, added from a list (5 minutes to 1 week) or typed, preloaded with classes 15 minutes, 2 hours, 1 day and exams 30 minutes, 2 hours, 1 day. Questions: 1 title editor (piece builder, text template with placeholders, or presets plus builder); 2 reminders (editable tiers or a checkbox grid); 3 further customization candidates (file name, description line order, several saved setups, event category per kind, text for online classes). Owner picks pending.

Owner picks (2026-10-31): 1 presets plus builder; 2 editable tiers; default class title Room - Code; default exam title Room - Exam type - Code; class reminders 15 minutes, 2 hours, 1 day; exam reminders 30 minutes, 2 hours, 1 day; more options: order of the description lines and an event category per kind. Owner notes: "calendar files must be separate for live classes, online classes, and Exams ... I tend to import a single ics file into a category to sort it ... AIO categories in a single file isn't what I want, unless there is option to sort it when import." Calendar apps import a file into one calendar, so the export writes three files by default: offline classes, online classes, exams; one file stays as a choice. Round S3 agreed; requirement 9 revised again (old text in `.deprecated/2026-10-31-export-s3/`); the rebuild is fix F-7.

## G-UAT-M1 Export recheck (2026-10-31)

All eight Export items pass, not accepted. Owner: "Our sites has 2 sites: the campus (use the prefix P.xxx) and Nha Van Hoa Sinh Vien (use the prefix NVH.XXX). The regular campus rooms don't get a P. prefix yet, which confuses the actual site." Raw FAP pages: the timetable writes `P.011` and `NVH 302`, the exam list a bare `011`. Recorded as F-8: rooms are shown as `P.xxx` and `NVH.xxx` on the cards and in the export.

