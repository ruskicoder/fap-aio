import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'tools/**/*.test.mjs'],
    environment: 'node',
  },
})
