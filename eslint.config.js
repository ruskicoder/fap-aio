import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: [
      'dist/', '.gitnexus/', 'node_modules/', '.deprecated/', 'ignore/', 'coverage/', '*.zip',
      // Browser console scripts kept byte-for-byte as validated reference tools.
      'tools/flm-scraper/flm-scraper.js', 'tools/news/news-scraper.js',
    ] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // No remote or string code (platform R7.5).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // FAP origin storage is never written (platform R4.7); only the legacy cleanup reads and removes keys.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/features/legacy/**'],
    rules: {
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage'],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage' },
        { object: 'window', property: 'sessionStorage' },
      ],
    },
  },
  {
    files: ['tools/**/*.{js,mjs}', '*.config.{js,ts}', 'src/manifest.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
)
