# FAP-AIO

> The All-in-One Enhancement Suite for FPT University Academic Portal

A comprehensive collection of tools to enhance the FPT Academic Portal (FAP) experience, available as both a browser extension and Tampermonkey userscript.

## 📦 Projects

This monorepo contains multiple implementations of the FAP enhancement suite:

### Browser Extensions

- **[fap-aio](./fap-aio/)** - Main Chromium extension (Chrome, Edge, Brave, Opera)
  - Built with Vite + React + TypeScript + Manifest V3
  - Full feature suite with optimized performance
  
- **[fap-gpa](./fap-gpa/)** - Standalone GPA Calculator extension
  - Calculate and simulate your GPA from transcript pages
  
- **[fap-moveout](./fap-moveout/)** - Standalone Class Switching Tool extension
  - Visualize timetables and switch classes easily
  
- **[fap-scheduler](./fap-scheduler/)** - Standalone Schedule Exporter extension
  - Export exam and weekly schedules to ICS calendar files

### Userscripts (Tampermonkey/Violentmonkey)

- **[userscript/fap-aio](./userscript/fap-aio/)** - Main userscript (in development)
  - All features in a single userscript
  - Compatible with Tampermonkey, Violentmonkey, Greasemonkey
  - Auto-updates via GitHub Pages

### Userstyle

- **[fap-userstyle](./fap-userstyle/)** - Dark mode theme CSS
  - Can be used standalone with Stylus/Stylish

## ✨ Features

All implementations include these core features:

### 🎨 Dark Mode Theme
Beautiful dark theme applied across all FAP pages to reduce eye strain.

### 📊 GPA Calculator
- Automatically parse transcript tables
- Calculate semester and cumulative GPA
- Simulate grade changes and "what-if" scenarios
- Exclude non-GPA courses

### 📅 Schedule Exporter
- Sync exam schedules and weekly timetables
- Export to ICS format for Google Calendar, Outlook, Apple Calendar
- Automatic categorization and reminders
- Separate online/offline class calendars

### 🔄 MoveOut Tool (Class Switcher)
- Visualize class schedules in timetable grid
- Filter by lecturer, room, or time slot
- Switch classes directly from the tool
- GitHub Pages integration for notifications

### 🛠️ UI Enhancements
- Improved back button on all FAP pages
- Enhanced title links for better navigation

## 🚀 Quick Start

### Using the Browser Extension

1. Navigate to the [fap-aio extension directory](./fap-aio/)
2. Follow installation instructions in the extension README
3. Load unpacked extension in Chrome Developer Mode

### Using the Userscript

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Click the installation link (coming soon)
3. The script will auto-update when new versions are released

## 🛠️ Development

This is a monorepo with independent projects. Each project has its own:
- `package.json` for dependencies
- Build configuration (Vite, Rollup, etc.)
- README with specific instructions

See individual project READMEs for development setup.

## 📝 Requirements & Specifications

The `.kiro/specs/` directory contains detailed specifications:
- **fap-aio-merge/**: Extension specifications (completed)
- **fap-aio-userscript/**: Userscript conversion specifications

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 👤 Author

**ruskicoder**

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## ⭐ Show your support

Give a ⭐️ if this project helped you!
