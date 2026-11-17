// Info and alerts settings (info R8.1, R9.1, R9.2; platform R1.3; panel-ux R8.1): browser notifications per
// alert kind, off by default; turning one on asks for the `notifications` permission first. Only kinds that
// are produced today are listed; background refresh and watch keywords register with their features.
import { createElement } from 'react'
import type { AlertKind } from '../../shared/alerts'
import { registerSetting } from '../../content/panel/settings/registry'
import { PermissionToggle } from '../../content/panel/settings/permission-toggle'

export const NOTIFY_KINDS: { kind: AlertKind; label: string; description: string }[] = [
  { kind: 'grade', label: 'Notify grade warnings', description: 'A browser notification when a course is failing or its goal falls out of reach.' },
  { kind: 'coursera', label: 'Notify Coursera deadlines', description: 'A browser notification when Coursera courses are due before a final exam.' },
]

export function NotifyToggle({ kind }: { kind: AlertKind }) {
  return createElement(PermissionToggle, { settingKey: `alerts.notify.${kind}`, reason: 'Show alerts as browser notifications.' })
}

export function registerInfoSettings(): void {
  for (const k of NOTIFY_KINDS) {
    registerSetting<boolean>({
      key: `alerts.notify.${k.kind}`, section: 'info', type: 'custom', default: false,
      label: k.label, description: k.description,
      component: () => createElement(NotifyToggle, { kind: k.kind }),
    })
  }
}
