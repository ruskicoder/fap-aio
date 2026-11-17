import { runMigrations } from '../shared/storage/migrations'
import { registerMigrationSteps } from '../shared/storage/steps'
import { installRouter } from './router'
import { installTabs } from './tabs'
import { installStatus } from './status'
import { installBudget } from './budget-handlers'
import { installDataStore } from './data/db'
import { installDataHandlers } from './data/handlers'
import { installPermissions } from './permissions'
import { installDiagnostics } from './diagnostics'
import { installReminders } from './reminders'

registerMigrationSteps()
installRouter()
installTabs()
installStatus()
installBudget()
installDataStore()
installDataHandlers()
installPermissions()
installDiagnostics()
installReminders()

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') void runMigrations()
})
