import { runMigrations } from '../shared/storage/migrations'
import { installRouter } from './router'
import { installTabs } from './tabs'
import { installStatus } from './status'
import { installBudget } from './budget-handlers'

installRouter()
installTabs()
installStatus()
installBudget()

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') void runMigrations()
})
