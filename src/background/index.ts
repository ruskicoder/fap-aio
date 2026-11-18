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
import { installKeepAlive } from './keepalive'
import { installDataChannel } from './data-channel'
import { installEditorWindow } from './editor-window'

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
installKeepAlive()
installDataChannel()
installEditorWindow()

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') void runMigrations()
})
