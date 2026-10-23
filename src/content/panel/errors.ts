// User-facing text for access errors (core design, "Error Handling"; panel-ux R10.8): what
// happened and what to do.
import type { FapError } from '../fap/access'

export function errorText(e: FapError): string {
  switch (e.kind) {
    case 'session-expired': return 'Your FAP session ended. Sign in to FAP again, then retry.'
    case 'feedback-required': return 'FAP asks you to complete a feedback form first. Open the form on FAP, then retry.'
    case 'unavailable': return 'FAP did not find this page. It may not be open for your account yet.'
    case 'challenge': return 'FAP asked your browser to verify. Reload this page to continue.'
    case 'forbidden': return 'FAP refused the request. Wait a few minutes, then retry.'
    case 'network': return 'FAP could not be reached. Check your connection, then retry.'
    case 'layout-changed': return `FAP changed the layout of ${e.source}. Your last synced data is kept; an update of the extension is needed.`
  }
}
