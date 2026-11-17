// Core and scheduler settings (core R13.1, R13.2; panel-ux R8.1). Every value lives in the `settings`
// store and is read through storage.onChanged, so a change applies without reload.
// Reminders (CORE-8) and keep-alive (CORE-9) rows are registered by the scheduler module, which also
// wires the code that reads them (conventions rule 10).
import { createElement } from 'react'
import { registerSetting } from '../../content/panel/settings/registry'
import { PermissionToggle } from '../../content/panel/settings/permission-toggle'
import { registerOptionalFeature } from '../../content/panel/welcome/Welcome'

export const SCHEDULER_KEYS = {
  remindersEnabled: 'schedule.reminders.enabled',
  classOffset: 'schedule.reminders.classOffset',
  keepAliveEnabled: 'session.keepAlive.enabled',
  keepAliveMinutes: 'session.keepAlive.interval',
} as const

export function registerReminderSettings(): void {
  registerSetting<boolean>({
    key: SCHEDULER_KEYS.remindersEnabled, section: 'schedule', type: 'custom', default: false,
    label: 'Reminders', description: 'Browser notifications before classes (15 or 30 minutes) and exams (1 day and 1 hour); asks for permission first.',
    component: () => createElement(PermissionToggle, { settingKey: SCHEDULER_KEYS.remindersEnabled, reason: 'Remind you before classes and exams.' }),
  })
  // Listed, off, in the first-run welcome (panel-ux R9.1).
  registerOptionalFeature(SCHEDULER_KEYS.remindersEnabled)
  registerSetting<15 | 30>({
    key: SCHEDULER_KEYS.classOffset, section: 'schedule', type: 'select', default: 15,
    options: [{ value: 15, label: '15 minutes before' }, { value: 30, label: '30 minutes before' }],
    label: 'Class reminder', description: 'How long before a class starts the reminder appears.',
  })
}

export function registerKeepAliveSettings(): void {
  registerSetting<boolean>({
    key: SCHEDULER_KEYS.keepAliveEnabled, section: 'session', type: 'toggle', default: false,
    label: 'Keep FAP signed in', description: 'Touches FAP now and then while a FAP tab is open, so the session does not time out.',
  })
  registerSetting<number>({
    key: SCHEDULER_KEYS.keepAliveMinutes, section: 'session', type: 'number', default: 7, min: 1, max: 60, step: 1,
    validate: (v) => (Number.isInteger(v) && v >= 1 && v <= 60 ? null : 'Enter whole minutes from 1 to 60.'),
    label: 'Keep-alive interval (minutes)', description: 'Minutes between keep-alive requests; each one counts against the FAP request budget.',
  })
}
