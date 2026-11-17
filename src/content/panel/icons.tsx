// Tabler outline icons (MIT) as an SVG sprite inside the shadow root (panel-ux design, "Layout"): the
// symbols are drawn once by <IconSprite/> at the panel root and every <Icon/> refers to one with <use>,
// so no icon font loads against FAP's CSP.
import type { ReactNode } from 'react'

const PATHS = {
  refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></>,
  dock: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M15 4v16" /></>,
  settings: <><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></>,
  minus: <path d="M5 12h14" />,
  back: <><path d="M5 12h14" /><path d="M5 12l6 6" /><path d="M5 12l6-6" /></>,
  download: <><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M7 11l5 5l5-5" /><path d="M12 4v12" /></>,
  grip: <><circle cx="9" cy="9" r="1" /><circle cx="15" cy="9" r="1" /><circle cx="9" cy="15" r="1" /><circle cx="15" cy="15" r="1" /></>,
  bell: <><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></>,
  calendar: <><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></>,
  school: <><path d="M22 9l-10-4l-10 4l10 4l10-4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" /></>,
  chart: <><path d="M3 13a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" /><path d="M15 9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" /><path d="M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" /><path d="M4 20h14" /></>,
  home: <><path d="M5 12l-2 0l9-9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" /></>,
  search: <><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0" /><path d="M21 21l-6-6" /></>,
  x: <><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></>,
  check: <path d="M5 12l5 5l10-10" />,
  chevronDown: <path d="M6 9l6 6l6-6" />,
  alert: <><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87l-8.106-13.536a1.914 1.914 0 0 0-3.274 0z" /><path d="M12 16h.01" /></>,
  info: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></>,
  external: <><path d="M12 6h-6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /><path d="M11 13l9-9" /><path d="M15 4h5v5" /></>,
} satisfies Record<string, ReactNode>
export type IconName = keyof typeof PATHS
export const ICON_NAMES = Object.keys(PATHS) as IconName[]

const symbolId = (name: IconName) => `aio-i-${name}`

/** Drawn once per shadow root, at the panel root. */
export function IconSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      {ICON_NAMES.map((n) => (
        <symbol key={n} id={symbolId(n)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {PATHS[n]}
        </symbol>
      ))}
    </svg>
  )
}

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className} data-icon={name}>
      <use href={`#${symbolId(name)}`} />
    </svg>
  )
}
