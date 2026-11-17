import { bootstrap } from './bootstrap'
import { registerPanelHost } from './panel/host'
import '../features/scheduler'
import '../features/grades'
import '../features/info'

registerPanelHost()
void bootstrap()
