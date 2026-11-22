import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

// Colours as CSS variables (appearance R8.4, fix F-24): Tailwind's own values are the defaults on
// :root and :host, so pages and the light panel render exactly as before; the panel swaps in a dark
// set (src/content/panel/panel.css) when the active theme is dark.
const FAMILIES = ['gray', 'orange', 'red', 'green', 'amber', 'blue', 'violet']
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
const vars = { '--c-white': '255 255 255', '--c-black': '0 0 0' }
const palette = { white: 'rgb(var(--c-white) / <alpha-value>)', black: 'rgb(var(--c-black) / <alpha-value>)' }
for (const f of FAMILIES) {
  palette[f] = {}
  for (const [shade, hex] of Object.entries(colors[f])) {
    vars[`--c-${f}-${shade}`] = rgb(hex)
    palette[f][shade] = `rgb(var(--c-${f}-${shade}) / <alpha-value>)`
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      // Panel tokens (src/content/panel/panel.css); the values follow density and the active theme.
      colors: {
        ...palette,
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
  plugins: [plugin(({ addBase }) => addBase({ ':root, :host': vars }))],
}
