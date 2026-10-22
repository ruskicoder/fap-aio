import { announceReady } from './tab'

if (window.top === window) announceReady()
