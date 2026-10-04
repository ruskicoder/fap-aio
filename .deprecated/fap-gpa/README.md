# FAP-GPA

> A Chrome extension for calculating GPA from FPT University's Academic Portal (FAP)

**Author**: [ruskicoder](https://github.com/ruskicoder)

## Features

- Calculate semester GPA based on subjects and credits
- Calculate cumulative GPA across all semesters
- Configure subjects to exclude from GPA calculation (Vovinam, Military training, etc.)
- Simulate grade changes to project future GPA
- Privacy-focused: No tracking, no analytics, no data collection

## Installation

### From Source

1. Ensure `Node.js` version >= **14** is installed
2. Clone this repository
3. Install dependencies:
   ```shell
   npm install
   # or if using bun:
   bun install
   ```
4. Build the extension:
   ```shell
   npm run build
   # or: bun run build
   ```
5. Open Chrome and go to `chrome://extensions/`
6. Enable "Developer mode"
7. Click "Load unpacked" and select the `dist` folder

## Development

```shell
npm install       # Install dependencies (one time)
npm run dev       # Start dev server with hot reload
```

### Chrome Extension Developer Mode

1. Enable 'Developer mode' in Chrome extensions
2. Click 'Load unpacked' and select the `dist` folder

## Building for Production

```shell
bun run build
```

The `dist` folder will contain the extension ready for Chrome Web Store submission.

## License

MIT License - see [LICENSE](LICENSE) for details

---

Maintained by [ruskicoder](https://github.com/ruskicoder)
