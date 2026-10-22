import { defineManifest } from '@crxjs/vite-plugin'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pkg from '../package.json'

// Public key for a stable unpacked id; written by tools/release/extension-key.mjs (gate G-EXT-KEY).
const keyFile = resolve(__dirname, 'manifest-key.txt')
const key = existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : undefined

export const manifestConfig = {
  manifest_version: 3,
  name: pkg.displayName,
  description: pkg.description,
  version: pkg.version,
  minimum_chrome_version: '120',
  ...(key ? { key } : {}),
  icons: {
    16: 'img/logo-16.png',
    32: 'img/logo-32.png',
    48: 'img/logo-48.png',
    128: 'img/logo-128.png',
  },
  action: { default_title: 'FAP-AIO' },
  background: { service_worker: 'src/background/index.ts', type: 'module' as const },
  content_scripts: [
    {
      matches: ['https://fap.fpt.edu.vn/*'],
      js: ['src/content/appearance.ts'],
      run_at: 'document_start' as const,
      all_frames: false,
    },
    {
      matches: ['https://fap.fpt.edu.vn/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle' as const,
      all_frames: false,
    },
  ],
  permissions: ['storage', 'alarms', 'unlimitedStorage'],
  optional_permissions: ['notifications'],
  host_permissions: ['https://fap.fpt.edu.vn/*'],
  optional_host_permissions: ['https://flm.fpt.edu.vn/*'],
  commands: {
    'toggle-panel': {
      suggested_key: { default: 'Alt+Shift+F' },
      description: 'Show or hide the FAP-AIO panel',
    },
  },
}

export default defineManifest(manifestConfig)
