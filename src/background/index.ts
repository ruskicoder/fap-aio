import { runMigrations } from '../shared/storage/migrations'
import { installRouter } from './router'
import { installTabs } from './tabs'
import { installStatus } from './status'

installRouter()
installTabs()
installStatus()

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') void runMigrations()
})
