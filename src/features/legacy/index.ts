// Legacy module (core R12): the cleanup offer above the tabs and its Settings row under Data and privacy.
import { createElement } from 'react'
import { addModule } from '../../content/modules'
import { registerBanner } from '../../content/panel/banners'
import { registerSetting } from '../../content/panel/settings/registry'
import { LegacyBanner, LegacyReviewRow } from './LegacyBanner'

const Banner = () => createElement(LegacyBanner)

export function registerLegacy(): void {
  registerBanner(Banner)
  registerSetting<null>({
    key: 'legacy.review', section: 'data', type: 'custom', default: null, transfer: false,
    label: 'Old FAP-AIO data',
    description: "Data an older FAP-AIO version left in FAP's own storage, which can be exported and removed.",
    component: () => createElement(LegacyReviewRow),
  })
}

addModule({ id: 'legacy', registerViews: registerLegacy })
