// Tab presence for the service worker (platform R3.8): `tab-ready` after bootstrap, `tab-focus`
// when the tab gains focus or becomes visible.
import { call } from '../shared/call'

export function announceReady(): void {
  void call({ type: 'tab-ready', path: location.pathname })
  const focus = () => void call({ type: 'tab-focus' })
  window.addEventListener('focus', focus)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') focus()
  })
  if (document.hasFocus()) focus()
}
