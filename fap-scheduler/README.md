# FPTU Scheduler

A modern Chrome extension for FPT University students to export exam and weekly schedules from the FAP system to `.ics` calendar files.

![Version](https://img.shields.io/badge/version-2.5.0-007AFF)
![Chrome](https://img.shields.io/badge/Chrome-Extension-34C759)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

### 📝 Exam Schedule
- **Sync exam schedules** directly from FAP's ScheduleExams page
- **Countdown badges** showing days until each exam (Today, Tomorrow, Urgent)
- **FE/PE tags** to distinguish exam types
- **Export to .ics** for Google Calendar, Apple Calendar, Outlook

### 📚 Weekly Class Schedule
- **Sync by week** or **sync entire semester** with progress tracking
- **Semester selector** (Spring, Summer, Fall from 2022 onwards)
- **Separate online/offline classes** - subjects ending with 'c' (e.g., PMG201c) are detected as online
- **Dual export** - separate .ics files for offline and online classes
- **Attendance status** display (Attended, Absent, Not Yet)
- **Google Meet links** for online classes

### 🎨 Modern UI
- **Floating panel** that persists through page navigation
- **Glassmorphism design** with vibrant blue (#007AFF) and green (#34C759) gradients
- **Tab counters** showing schedule counts
- **Draggable panel** with minimize/close controls
- **Data persistence** via localStorage

## 📦 Installation

### Chrome Web Store
*Coming soon*

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `extension` folder

## 🚀 Usage

1. Navigate to [FAP](https://fap.fpt.edu.vn) and log in
2. Go to:
   - **Exam Schedule**: `Exam > Schedule Exams`
   - **Weekly Schedule**: `Report > Schedule of Week`
3. The FPTU Scheduler panel will appear on the right side
4. Click **🔄 Đồng bộ** to sync your schedule
5. Click **📅 Tải xuống (.ics)** to export

### Syncing Weekly Schedule
- **Tuần này**: Sync current week only
- **Cả học kỳ**: Sync all weeks in the selected semester (shows progress bar)
- Select your semester from the dropdown before syncing

### Exporting
- **Lịch thi**: Single .ics file with all exams
- **Lịch học Offline**: Classes at physical locations
- **Lịch học Online**: Classes with 'c' suffix (online courses)

## 📁 Project Structure

```
extension/
├── manifest.json      # Chrome extension manifest (v3)
├── content.js         # Main content script with UI and logic
├── background.js      # Service worker (minimal)
├── icon-*.png         # Extension icons
└── popup.*            # Legacy popup files (unused)

userscript/
└── fptu-examination.user.js  # Alternative userscript version
```

## 🔧 Technical Details

- **Manifest Version**: 3
- **Content Script Only**: No popup, runs directly on FAP pages
- **Storage**: localStorage for schedule data persistence
- **ICS Generation**: RFC 5545 compliant calendar format
- **Slot Times**: Supports slots 1-8 with standard FPT time ranges

### Supported Pages
- `https://fap.fpt.edu.vn/Exam/ScheduleExams.aspx`
- `https://fap.fpt.edu.vn/Report/ScheduleOfWeek.aspx`

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ for FPT University students
