import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import manifest from './src/manifest'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { grant: resolve(__dirname, 'src/pages/grant/grant.html') },
      output: { chunkFileNames: 'assets/chunk-[hash].js' },
    },
  },
  plugins: [react(), crx({
      manifest,
      // Self-contained IIFE content scripts: no loader and no web_accessible_resources (R1.5).
      contentScripts: { standaloneFiles: ['src/content/appearance.ts', 'src/content/index.ts'] },
    })],
})
