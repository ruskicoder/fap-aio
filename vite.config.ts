import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import manifest from './src/manifest'

/**
 * Copies the packaged data files and their unsigned manifest into dist/data/ (platform R5.1).
 * The build fails when data/manifest.json is stale; regenerate it with tools/data/packaged-manifest.mjs.
 */
function packagedData(): Plugin {
  return {
    name: 'fap-aio-packaged-data',
    apply: 'build',
    generateBundle() {
      const manifestText = readFileSync(resolve(__dirname, 'data/manifest.json'), 'utf8')
      const manifest = JSON.parse(manifestText) as { files: { path: string; sha256: string }[] }
      for (const f of manifest.files) {
        const bytes = readFileSync(resolve(__dirname, 'data', f.path))
        if (createHash('sha256').update(bytes).digest('hex') !== f.sha256) {
          this.error(`data/${f.path} does not match data/manifest.json; run node tools/data/packaged-manifest.mjs`)
        }
        this.emitFile({ type: 'asset', fileName: `data/${f.path}`, source: bytes })
      }
      this.emitFile({ type: 'asset', fileName: 'data/manifest.json', source: manifestText })
    },
  }
}

export default defineConfig(({ mode }) => ({
  // The IIFE content-script build does not set NODE_ENV by itself; without it React ships its dev build.
  define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  // Escape every non-ASCII character in the output. Chrome refuses a content script that holds a Unicode
  // noncharacter such as U+FFFF ("isn't UTF-8 encoded"), and CodeMirror's view defines one as a sentinel.
  esbuild: { charset: 'ascii' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        grant: resolve(__dirname, 'src/pages/grant/grant.html'),
        // The theme editor page carries CodeMirror and csstree, away from every FAP page (F-21).
        'theme-editor': resolve(__dirname, 'src/pages/theme-editor/editor.html'),
        // The printable grade list (GRD-7.3), opened by the service worker like the grant window.
        print: resolve(__dirname, 'src/pages/print/print.html'),
      },
      output: { chunkFileNames: 'assets/chunk-[hash].js' },
    },
  },
  plugins: [react(), packagedData(), crx({
      manifest,
      // Self-contained IIFE content scripts: no loader and no web_accessible_resources (R1.5).
      contentScripts: { standaloneFiles: ['src/content/appearance.ts', 'src/content/index.ts'] },
    })],
}))
