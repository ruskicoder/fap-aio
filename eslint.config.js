import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: [
      'dist/', 'node_modules/', '.deprecated/', 'ignore/', 'coverage/', '*.zip',
      // Browser console scripts kept byte-for-byte as validated reference tools.
      'tools/flm-scraper/flm-scraper.js', 'tools/news/news-scraper.js',
    ] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tools/**/*.{js,mjs}', '*.config.{js,ts}', 'src/manifest.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
)
