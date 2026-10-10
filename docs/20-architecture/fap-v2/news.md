---
id: architecture.fap-v2.news
type: data-model
status: draft
owner: unassigned
summary: "How FAP news is structured (list, detail, title grammar) and the convention FAP-AIO uses to classify, prioritize and alert on news."
---

# FAP news: structure and classification convention

Source: 600 news items from `/News` (created 2024-08-15 to 2026-10-09) and 7 detail pages, read 2026-10-11 with GET requests paced 2.5 to 3 s apart (`tools/news/news-scraper.js`). The raw dump is personal-context data and stays in `ignore/fap-news/`. The rules live in one file, [data/news/news-rules.json](../../../data/news/news-rules.json), read by `tools/news/analyze-news.py` and by the extension (`v2-info`).

## List page

`/News?pageIndex=&pageSize=(10|20|50|100)&SortBy=CreatedAt&IsDesc=true`, one `table` with columns No., Title, Type, Expires, Pinned, Created at, Details. The Details link is `/News/Detail/{guid}`. Dates use the format `M/d/yyyy h:mm AM` in the `en` culture.

- Type (`select[name=FAPNewsTypeId]`): Thông báo tài chính, Thông tin chung, Thông tin Đào tạo, Thông tin Khảo Thí. Only 9 of 600 items carry a type; the rest show `—`. The type is not a usable classifier.
- Expires: set on 6 of 600 items. Pinned: 1 of 600.
- Volume: 6 to 43 items per month, about 25 on average. Peaks fall before and at the start of each term (April, August, October to December).
- Reposts: 61 titles appear more than once (reminders and re-publications).
- The list is scoped to the student's campus. Every detail read showed `Cơ sở TP. Hồ Chí Minh`.

## Detail page

`/News/Detail/{guid}`:

| Part | Selector | Notes |
|---|---|---|
| Type badge | `.fap-news-badge--type` | Often absent |
| Title | `.fap-news-detail-title` | Same as the list title |
| Meta | `.fap-news-detail-meta__item` | In order: author login (a shortcode such as `LanHTT14`, same pattern as lecturers), `Published on: ...`, `Last updated: ...`, campus (`Cơ sở TP. Hồ Chí Minh`), optional `Expires on: ...` |
| Body | `.fap-news-content` | Free HTML: numbered sections (Đối tượng, Mức học phí, Thời hạn, Hồ sơ, Cách thức đăng ký), sometimes tables (thesis defence lists, registration windows), images |
| Links | `a[href]` in the body | Google Forms (`forms.gle`), Drive and Slides guides, YouTube; e-mail addresses are Cloudflare-obfuscated (`/cdn-cgi/l/email-protection`, `data-cfemail`) |
| Attachments | `.fap-news-attachment` with `button.js-open-file-attachment[data-file-ref]` | Opened through the CDN token flow in [endpoints.md](endpoints.md) |

Deadlines are mostly in the body, not the title (27 of 600 titles carry a date). Seen phrasings: `đến hết ngày dd/mm/yyyy`, `Từ ngày dd/mm/yyyy đến ngày dd/mm/yyyy`, `Thời hạn ...`, `chốt danh sách ... ngày dd/mm/yyyy`, times such as `18:00 ngày 24/08/2026 đến 23:59' ngày 01/09/2026`. Dates in titles and bodies are `dd/mm/yyyy` (Vietnamese order), unlike the list's `M/d/yyyy`.

## Title grammar

```text
[TAG] <separator> <TITLE IN MIXED OR UPPER CASE> <term tokens> <optional deadline>
TAG        = department, in brackets; some items drop the brackets ("QLĐT_...") or have none
separator  = "_", " - ", ":", " " (inconsistent)
term       = Spring|Summer|Fall YYYY | SP25|SU26|FA24 | Half 1|2 | Block 10W|3W|10 tuần|03 tuần | K22 (cohort)
flags      = [QUAN TRỌNG] (important), [REMIND] / NHẮC NHỞ (reminder), GIA HẠN (extension), Bắt buộc (mandatory)
```

Department tags (normalized) and counts:

| Tag id | Seen as | Count |
|---|---|---|
| exam-office | `[Khảo thí]`, `[KHẢO THÍ]`, `[Khaothi]` | 222 |
| academic | `[QLĐT]`, `[QLDT]`, `QLĐT_`, `[Đào tạo]` | 204 |
| library | `[THƯ VIỆN]` | 55 |
| finance | `[TÀI CHÍNH]`, `[ TÀI CHÍNH ]` | 37 |
| student-services | `[SSC]`, `[SSc]` | 14 |
| development | `[Phòng PDP]`, `[IC-PDP]` | 6 |
| it, vovinam, international, corporate | `[CNTT]`, `[IT.HCM]`, `[Bộ môn VOV]`, `[IC]`, `[P. QHDN]` | 12 |
| other | untagged | 50 |

## Event families and priority

Priorities:
- P1: action needed, usually with a deadline or a consequence.
- P2: schedule or result information.
- P3: opportunity.
- P4: low value for a student.

Counts are over the 600 titles. An item can belong to several families; its priority is the highest one.

| Family | P | Count | Typical title |
|---|---|---|---|
| exam-eligibility | P1 | 4 | Danh sách sinh viên không đủ điều kiện dự thi ... |
| tuition | P1 | 39 | THÔNG BÁO HỌC PHÍ KỲ FALL 2026 – HALF 2 ... THỜI HẠN ... ĐẾN HẾT 28/10/2026 |
| course-registration | P1 | 114 | ĐĂNG KÝ MÔN HỌC BLOCK 10 TUẦN; GIA HẠN ĐĂNG KÝ; MỞ THÊM LỚP |
| exam-registration | P1 | 14 | ĐĂNG KÝ THI COURSERA; thi thẩm định |
| attendance-exemption | P1 | 17 | NỘP HỒ SƠ MIỄN ĐIỂM DANH |
| academic-procedure | P1 | 69 | TẠM NGHỈ/TẠM HOÃN; NHẬP HỌC LẠI; CHUYỂN NGÀNH/CHUYỂN CƠ SỞ; XỬ LÝ HỌC VỤ |
| health-insurance | P1 | 11 | ĐĂNG KÝ MUA BẢO HIỂM Y TẾ ... Bắt buộc |
| thesis | P1 | 77 | Lịch bảo vệ Khóa luận tốt nghiệp |
| graduation | P1 | 21 | Nhận bằng và bảng điểm tốt nghiệp |
| mandatory-program | P1 | 55 | Vovinam, nhạc cụ dân tộc, GDQP, rèn luyện tập trung K22 |
| student-card | P1 | 2 | gia hạn thẻ sinh viên |
| exam-schedule | P2 | 37 | Lịch thi ... Half 1 |
| mock-exam | P2 | 56 | Thi thử (test EOS and PEA software) |
| exam-guidance | P2 | 74 | Quy định nộp bài thi, vật dụng, thi trên USB, check out E360 |
| results | P2 | 58 | Kết quả LUK, phúc khảo, khen thưởng, tôn vinh |
| class-mode | P2 | 14 | Các lớp môn EXE201 học online 100% |
| coursera-guidance | P2 | 28 | Hướng dẫn học các môn Coursera; chính sách học trước, hoàn tiền |
| timetable-change | P2 | 27 | Lịch bù, xem lịch học, lịch đào tạo, địa điểm học |
| curriculum-change | P2 | 12 | Học phần thay thế, khung chương trình |
| textbooks | P2 | 23 | Lịch mượn/trả giáo trình |
| movement-points | P2 | 6 | Điểm phong trào |
| security | P2 | 4 | Email giả mạo, địa chỉ MAC |
| opportunity | P3 | 17 | OJT abroad, winter school, Level 6, competitions |
| skills-course | P3 | 15 | Professionalism in the workplace, IBSTPI, seminars |
| library, service-closure, survey, staff-only | P4 | 77 | New books, closures, surveys, staff holiday rules |

The flags `[QUAN TRỌNG]`, `[REMIND]`/`NHẮC NHỞ` and `Bắt buộc` raise the priority by one level.

## Convention for FAP-AIO

1. Classify by title first, using `news-rules.json`: normalize (lowercase, remove diacritics, `đ` to `d`), detect the tag, families, flags, term tokens and any deadline.
2. Read the detail page only for items that are P1 after personalization, at most 3 per background cycle. From it, extract the campus, the expiry and every body date in the deadline phrasings (`dd/mm/yyyy`), and take the latest date following "đến" as the deadline.
3. Personalize, using the student's context (subjects in progress and not passed, Coursera subjects, thesis or capstone enrolment, cohort, campus):
   - raise the priority by one level when the title or body names one of the student's subject codes;
   - raise thesis items for thesis or capstone students (`*490` to `*492`), and exam-registration and Coursera items for students with a Coursera subject;
   - lower items for another campus to P4, and ignore staff-only items.
4. Alert, as a notification (opt-in) and on the Overview, only when the item is P1 after personalization AND one of these holds:
   - it has a deadline within the next 14 days;
   - it is an exam-eligibility item;
   - it names one of the student's subject codes;
   - it was posted within the last 3 days.
   P2 items appear in the News list with a badge and no alert.
5. Deduplicate: the same normalized title within 30 days is one item, keeping the newest and marking it "reposted".
6. Keep the user's watch keywords as an extra rule: a match raises the item to P1 for that user.
7. When the rules or FAP's titling change, re-run `tools/news/analyze-news.py` on a fresh dump. The target is no unclassified titles and no false P1 families on a manual sample of 30.
