// The FAP tab parses FLM detail pages for the service worker, which has no DOM parser (platform R6.3).
import { onMessage } from '../../shared/call'
import { parseFlmDetail } from './parse'

let wired = false
export function wireFlmParse(): void {
  if (wired) return
  wired = true
  onMessage('flm.parse', (m) => parseFlmDetail(m.html, m.code, m.sylId))
}
