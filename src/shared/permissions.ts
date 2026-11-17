// Optional permissions (platform R1.3, R1.4, R1.6, R1.7): what each one asks Chrome for, the settings
// that depend on it, and the grant window's copy (decision D-4, 2026-11-17).
export type PermId = 'notifications' | 'flm'

export const PERMS: Record<PermId, chrome.permissions.Permissions> = {
  notifications: { permissions: ['notifications'] },
  flm: { origins: ['https://flm.fpt.edu.vn/*'] },
}

/** Setting keys turned off when the permission is refused or removed; a key ending in `.` is a prefix. */
export const DEPENDENT_SETTINGS: Record<PermId, string[]> = {
  notifications: ['schedule.reminders.enabled', 'alerts.notify.'],
  flm: ['info.flmRefresh.enabled'],
}

export const GRANT_COPY: Record<PermId, { title: string; purpose: string; button: string; granted: string; refused: string; removed: string }> = {
  notifications: {
    title: 'Allow notifications',
    purpose: 'FAP-AIO needs notifications to remind you before classes and exams.',
    button: 'Allow notifications',
    granted: 'Notifications allowed',
    refused: 'Notifications stay off',
    removed: 'Reminders turned off: notifications permission was removed.',
  },
  flm: {
    title: 'Allow FLM access',
    purpose: "FAP-AIO needs to read flm.fpt.edu.vn to refresh this subject's syllabus.",
    button: 'Allow FLM access',
    granted: 'FLM access allowed',
    refused: 'FLM access stays off',
    removed: 'Refresh from FLM turned off: FLM access was removed.',
  },
}

export const EXPIRED_TEXT = 'This request has expired. Turn the setting on again from the panel.'
export const GRANT_PAGE = 'src/pages/grant/grant.html'
export const GRANT_TIMEOUT_MS = 120_000

export const isPermId = (x: string | null): x is PermId => x === 'notifications' || x === 'flm'
