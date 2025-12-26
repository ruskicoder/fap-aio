# FAP-AIO Browser Extension

> A Chromium browser extension built with Vite + React + TypeScript + Manifest V3

All-in-One enhancement suite for FPT University Academic Portal (FAP) with dark mode theme, GPA calculator, schedule exporter, and class switching tool.

## ✨ Features

### 🎨 Dark Mode Theme
Beautiful dark theme automatically applied to all FAP pages for improved readability and reduced eye strain.

### 📊 GPA Calculator
- **Automatic Parsing**: Extract grades directly from StudentTranscript.aspx
- **Real-time Calculation**: Calculate semester and cumulative GPA instantly
- **Grade Simulation**: Test "what-if" scenarios by editing grades
- **Course Exclusion**: Mark courses as non-GPA to exclude from calculations
- **Persistent Settings**: Your exclusion list is saved across sessions

### 📅 Schedule Exporter
- **Exam Schedules**: Sync exam schedules from ScheduleExams.aspx
- **Weekly Timetables**: Export weekly schedules from ScheduleOfWeek.aspx
- **ICS Export**: Generate RFC 5545-compliant ICS files for any calendar app
- **Smart Categorization**: Automatically separate online/offline classes
- **Semester Sync**: Multi-page sync with automatic year handling
- **Calendar Integration**: Works with Google Calendar, Outlook, Apple Calendar

### 🔄 MoveOut Tool (Class Switcher)
- **Timetable Visualization**: See all available class slots in a grid view
- **Advanced Filtering**: Filter by lecturer, room, or time slot
- **Direct Switching**: Submit class change requests directly from the tool
- **Smart Caching**: 24-hour cache to reduce FAP server load
- **Notifications**: GitHub Pages integration for announcements

### 🛠️ UI Enhancements
- **Enhanced Back Button**: Better navigation on all FAP pages
- **Improved Title Links**: Quick access to frequently used pages

## 📋 Requirements

- **Node.js** version >= **14.18.0**
- **npm** version >= **6.0.0**
- **Chromium-based browser**: Chrome, Edge, Brave, Opera, Arc

## 🚀 Installation

### For Users (Production Build)

1. Download the latest release from [Releases](../../releases)
2. Extract the ZIP file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right corner)
5. Click **Load unpacked**
6. Select the extracted `build` folder
7. The extension icon will appear in your toolbar

### For Developers (Development Mode)

1. **Clone the repository**
```bash
git clone https://github.com/ruskicoder/fap-aio.git
cd fap-aio/fap-aio
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

4. **Load extension in Chrome**
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `fap-aio/build` folder

5. **Development URLs** (for testing outside extension context)
   - Main: `http://localhost:5173/`
   - Popup: `http://localhost:5173/popup.html`
   - Options: `http://localhost:5173/options.html`

## 🔧 Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build production version
npm run build

# Preview production build
npm run preview

# Format code with Prettier
npm run fmt

# Build and create ZIP for distribution
npm run zip
```

### Project Structure

```
fap-aio/
├── src/
│   ├── manifest.ts           # Extension manifest configuration
│   ├── background/           # Background service worker
│   ├── contentScript/        # Content scripts (main logic)
│   │   ├── index.ts         # Router for feature detection
│   │   ├── features/        # Feature modules
│   │   │   ├── gpa/         # GPA Calculator
│   │   │   ├── moveout/     # MoveOut Tool
│   │   │   ├── scheduler/   # Schedule Exporter
│   │   │   └── userstyle/   # Dark mode theme
│   │   └── shared/          # Shared utilities
│   ├── popup/               # Extension popup UI
│   ├── options/             # Options page UI
│   ├── assets/              # Icons and images
│   │   └── logo.png        # Main extension icon
│   └── styles/              # Global styles
├── public/
│   ├── img/                 # Public images
│   │   ├── logo-16.png     # Extension icon 16x16
│   │   ├── logo-32.png     # Extension icon 32x32
│   │   ├── logo-48.png     # Extension icon 48x48
│   │   └── logo-128.png    # Extension icon 128x128
│   └── icons/               # Additional icons
├── build/                   # Built extension (generated)
└── package.json            # Project configuration
```

### Building for Production

```bash
npm run build
```

The `build` folder will contain the production-ready extension that can be:
- Loaded as unpacked extension for testing
- Zipped and uploaded to Chrome Web Store
- Distributed directly to users

For Chrome Web Store submission, see the [official publishing guide](https://developer.chrome.com/docs/webstore/publish).

## 🎯 Usage

### GPA Calculator

1. Navigate to your [Student Transcript](https://fap.fpt.edu.vn/Student/StudentTranscript.aspx)
2. The GPA calculator UI will automatically appear above the transcript table
3. Your GPA is calculated automatically from all visible semesters
4. **Edit grades**: Click any grade to simulate different scores
5. **Exclude courses**: Use the exclusion menu for non-GPA courses
6. **Reset**: Click reset to restore original grades

### Schedule Exporter

1. **For Exam Schedules**:
   - Go to [Schedule Exams](https://fap.fpt.edu.vn/Student/ScheduleExams.aspx)
   - Click the floating panel button
   - Click "Sync Schedule"
   - Click "Export to Calendar" to download ICS file

2. **For Weekly Schedules**:
   - Go to [Schedule of Week](https://fap.fpt.edu.vn/Student/ScheduleOfWeek.aspx)
   - Click "Sync Current Week" for this week only
   - Or "Sync Semester" to sync the entire semester (auto-handles page reloads)
   - Export separate calendars for online and offline classes

3. **Import to Calendar App**:
   - Google Calendar: Settings → Import & Export → Import
   - Outlook: File → Open & Export → Import/Export
   - Apple Calendar: File → Import

### MoveOut Tool

1. Go to [Courses](https://fap.fpt.edu.vn/Student/Courses.aspx)
2. Select your subject from the dropdown
3. The MoveOut UI will load available class slots
4. **Filter**: Use lecturer/room/time filters to narrow options
5. **Switch**: Click "Switch" on your desired class
6. Confirm the action and submit

## 🐛 Troubleshooting

### Extension not loading
- Ensure you're using a Chromium-based browser
- Check that Developer mode is enabled
- Try removing and re-adding the extension
- Check browser console for errors (F12)

### Features not working
- Make sure you're on `fap.fpt.edu.vn` domain
- Refresh the page after enabling the extension
- Clear browser cache and cookies
- Check that content scripts have proper permissions

### GPA calculation incorrect
- Verify your transcript table structure matches expected format
- Check that all grades are visible (expand all semesters)
- Ensure non-GPA courses are properly excluded
- Report specific issues with transcript HTML structure

### Schedule sync stuck
- If semester sync stalls, check browser console for errors
- Manually reload page if automatic reload fails
- Clear extension storage and try again
- Ensure FAP server is accessible

## 🔄 Updating

The extension does not auto-update when loaded as unpacked. To update:

1. Pull latest changes: `git pull origin main`
2. Rebuild: `npm run build`
3. Go to `chrome://extensions/`
4. Click the refresh icon on the FAP-AIO extension card

For Chrome Web Store installations (when published), updates are automatic.

## 🧪 Testing

Manual testing checklist:
- [ ] Dark mode applies on all FAP pages
- [ ] GPA calculator loads on StudentTranscript.aspx
- [ ] GPA calculation matches manual calculation
- [ ] Grade simulation updates GPA in real-time
- [ ] Exam schedule syncs and exports correctly
- [ ] Weekly schedule syncs and exports correctly
- [ ] MoveOut loads class data and displays timetable
- [ ] MoveOut filters work correctly
- [ ] Class switching form submits successfully

## 📝 Known Issues

- Cheerio dependency increases bundle size (~30KB) - planned for removal in userscript version
- Semester sync requires manual confirmation for year changes
- MoveOut cache expires after 24 hours (by design)

See [Issues](../../issues) for bug reports and feature requests.

## 🗺️ Roadmap

- [ ] Remove Cheerio dependency (replace with native DOM APIs)
- [ ] Userscript version for Tampermonkey/Violentmonkey
- [ ] Settings UI for customization
- [ ] Multi-language support (English/Vietnamese)
- [ ] Direct calendar API integration (Google Calendar)
- [ ] Browser notifications for exam reminders

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

## 👤 Author

**ruskicoder**
- GitHub: [@ruskicoder](https://github.com/ruskicoder)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🙏 Acknowledgments

Built with:
- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) - Chrome extension bundler
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## ⭐ Show your support

Give a ⭐️ if this project helps you!

