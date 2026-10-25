// Outline icons drawn inline (Tabler outline paths, MIT), so no font loads against FAP's CSP.
const PATHS = {
  refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></>,
  dock: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M15 4v16" /></>,
  settings: <><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37 1 .608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></>,
  minus: <path d="M5 12h14" />,
  back: <><path d="M5 12h14" /><path d="M5 12l6 6" /><path d="M5 12l6-6" /></>,
  grip: <><circle cx="9" cy="9" r="1" /><circle cx="15" cy="9" r="1" /><circle cx="9" cy="15" r="1" /><circle cx="15" cy="15" r="1" /></>,
}
export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name]}
    </svg>
  )
}
