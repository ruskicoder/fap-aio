/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      // Panel tokens (src/content/panel/panel.css); the values follow density and the active theme.
      colors: {
        aio: {
          surface: 'var(--aio-surface)',
          'surface-alt': 'var(--aio-surface-alt)',
          text: 'var(--aio-text)',
          muted: 'var(--aio-text-muted)',
          border: 'var(--aio-border)',
          accent: 'var(--aio-accent)',
          success: 'var(--aio-success)',
          warning: 'var(--aio-warning)',
          danger: 'var(--aio-danger)',
        },
      },
      height: { control: 'var(--aio-control-h)' },
      minHeight: { control: 'var(--aio-control-h)', hit: 'var(--aio-hit)' },
      minWidth: { hit: 'var(--aio-hit)' },
      fontSize: { small: 'var(--aio-small)' },
      spacing: { 'row-x': 'var(--aio-row-px)', 'row-y': 'var(--aio-row-py)', gap: 'var(--aio-gap)' },
    },
  },
  plugins: [],
}
