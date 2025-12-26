# FAP-AIO Userscript

> Tampermonkey/Violentmonkey userscript version of the FAP-AIO extension

**Status**: 🚧 In Development

All-in-One enhancement for FPT University Academic Portal, packaged as a single userscript file for Tampermonkey, Violentmonkey, or Greasemonkey.

## ✨ Features

All features from the browser extension in a single userscript:

- **🎨 Dark Mode Theme**: Beautiful dark theme across all FAP pages
- **📊 GPA Calculator**: Parse transcripts and calculate GPA with simulation
- **📅 Schedule Exporter**: Export exam and weekly schedules to ICS format
- **🔄 MoveOut Tool**: Visualize timetables and switch classes easily
- **🛠️ UI Enhancements**: Improved navigation and back button

## 📋 Requirements

- **Userscript Manager**: Tampermonkey (recommended) or Violentmonkey
- **Browser**: Any modern browser (Chrome, Firefox, Edge, Safari, Opera)
- **FAP Access**: FPT University student account

## 🚀 Installation

### Quick Install (Coming Soon)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Click the installation link: [Install FAP-AIO Userscript](https://ruskicoder.github.io/fap-aio/fap-aio.user.js)
3. Click "Install" when prompted
4. Navigate to [FAP Portal](https://fap.fpt.edu.vn/) and features will activate automatically

### Manual Installation (Development)

1. Install a userscript manager
2. Copy the contents of `dist/fap-aio.user.js`
3. Create a new userscript in your manager
4. Paste the code and save

## 🔧 Development

This userscript is built from the same TypeScript/React codebase as the extension, with platform adapters for userscript APIs.

### Setup

```bash
# Navigate to this directory
cd userscript/fap-aio

# Install dependencies (if separate from extension)
npm install

# Build userscript
npm run build:userscript

# Development build with watch mode
npm run dev:userscript
```

### Project Structure

```
userscript/fap-aio/
├── src/                      # Userscript-specific source
│   ├── adapters/            # Platform adapters
│   │   ├── storage.adapter.ts   # GM_setValue/GM_getValue
│   │   ├── http.adapter.ts      # GM_xmlhttpRequest
│   │   └── style.adapter.ts     # GM_addStyle
│   ├── utils/               # Utilities
│   │   └── dom-parser.ts    # Native DOM parser (replaces Cheerio)
│   └── main.ts              # Entry point
├── dist/                    # Built userscript
│   └── fap-aio.user.js     # Final userscript file
├── vite.userscript.config.ts # Vite config for userscript
└── README.md
```

## 📖 Usage

The userscript works identically to the browser extension. All features activate automatically when you visit FAP pages:

- **GPA Calculator**: Visit StudentTranscript.aspx
- **Schedule Exporter**: Visit ScheduleExams.aspx or ScheduleOfWeek.aspx
- **MoveOut Tool**: Visit Courses.aspx or MoveSubject.aspx
- **Dark Mode**: Applied to all fap.fpt.edu.vn pages

See the [main extension README](../../fap-aio/README.md) for detailed feature usage.

## 🔄 Auto-Update

The userscript includes auto-update metadata:

```javascript
// @updateURL    https://ruskicoder.github.io/fap-aio/fap-aio.user.js
// @downloadURL  https://ruskicoder.github.io/fap-aio/fap-aio.user.js
```

Your userscript manager will automatically check for updates daily. You can also manually check via the manager's dashboard.

## 🆚 Extension vs Userscript

| Feature | Browser Extension | Userscript |
|---------|------------------|------------|
| Installation | Chrome Web Store or manual | One-click from URL |
| Updates | Manual (unpacked) or automatic (store) | Automatic via metadata |
| Browser Support | Chromium only | All browsers with userscript manager |
| Bundle Size | ~150KB | ~100KB gzipped |
| Performance | Faster (native APIs) | Slightly slower (polyfills) |
| Storage | chrome.storage | GM_setValue or localStorage |
| Network | fetch | GM_xmlhttpRequest or fetch |

## 🐛 Troubleshooting

### Userscript not running
- Check that your userscript manager is enabled
- Verify the script is enabled in the manager dashboard
- Check that the URL pattern matches: `https://fap.fpt.edu.vn/*`
- Try disabling other FAP-related scripts (conflicts)

### Features not working
- Open browser console (F12) and check for errors
- Verify GM API permissions are granted (@grant directives)
- Ensure React/ReactDOM CDN resources loaded successfully
- Try disabling/re-enabling the script

### Storage not persisting
- Check if GM_setValue is available (Greasemonkey has limited support)
- Falls back to localStorage if GM APIs unavailable
- Clear browser data may also clear GM storage

### Performance issues
- Disable debug mode if enabled: `localStorage.removeItem('fap-aio:debug')`
- Check for conflicts with other userscripts
- Ensure only one FAP enhancement script is active

## 🔧 Configuration

The userscript stores settings in GM storage (or localStorage fallback):

```javascript
// Enable debug mode
localStorage.setItem('fap-aio:debug', 'true');

// Clear all stored data
// (Open console on FAP page)
Object.keys(GM_listValues()).forEach(key => GM_deleteValue(key));
```

## 🗺️ Roadmap

- [x] Requirements specification
- [x] Design architecture
- [x] Task breakdown
- [ ] Phase 0: Cheerio elimination (preparation)
- [ ] Phase 1-3: Adapter layer and build system
- [ ] Phase 4: Feature adaptations
- [ ] Phase 5-7: Testing and validation
- [ ] Phase 8: Documentation
- [ ] Phase 9: Optimization
- [ ] Phase 10: v1.0.0 release

See [.kiro/specs/fap-aio-userscript/](../../.kiro/specs/fap-aio-userscript/) for detailed specifications.

## 📝 Specifications

Detailed specs are maintained in the repository:
- **Requirements**: [requirements.md](../../.kiro/specs/fap-aio-userscript/requirements.md)
- **Design**: [design.md](../../.kiro/specs/fap-aio-userscript/design.md)
- **Tasks**: [tasks.md](../../.kiro/specs/fap-aio-userscript/tasks.md)

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.

## 👤 Author

**ruskicoder**
- GitHub: [@ruskicoder](https://github.com/ruskicoder)

## 🤝 Contributing

This userscript shares the codebase with the browser extension. Contributions should be made to the main repository with platform-agnostic feature code.

## ⭐ Show your support

Give a ⭐️ if this project helps you!
