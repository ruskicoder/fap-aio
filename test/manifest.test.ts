import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { manifestConfig } from '../src/manifest'

const FORBIDDEN_PERMS = ['downloads', 'tabs', 'scripting', '<all_urls>']
const FORBIDDEN_KEYS = ['externally_connectable', 'web_accessible_resources', 'content_security_policy']

function check(m: Record<string, unknown>) {
  expect(m.manifest_version).toBe(3)
  expect(m.minimum_chrome_version).toBe('120')
  expect(m.permissions).toEqual(['storage', 'alarms', 'unlimitedStorage'])
  expect(m.host_permissions).toEqual(['https://fap.fpt.edu.vn/*'])
  expect(m.optional_permissions).toEqual(['notifications'])
  expect(m.optional_host_permissions).toEqual(['https://flm.fpt.edu.vn/*'])
  const all = JSON.stringify([m.permissions, m.host_permissions, m.optional_permissions, m.optional_host_permissions])
  for (const p of FORBIDDEN_PERMS) expect(all).not.toContain(`"${p}"`)
  for (const k of FORBIDDEN_KEYS) expect(m).not.toHaveProperty(k)
  const cs = m.content_scripts as { matches: string[]; all_frames?: boolean }[]
  expect(cs).toHaveLength(2)
  for (const s of cs) {
    expect(s.matches).toEqual(['https://fap.fpt.edu.vn/*'])
    expect(s.all_frames).toBe(false)
  }
  expect(m.commands).toHaveProperty('toggle-panel')
}

describe('manifest', () => {
  it('source manifest has only the allowed permissions and keys', () => {
    check(manifestConfig as unknown as Record<string, unknown>)
  })

  it.skipIf(!existsSync('dist/manifest.json'))('built manifest has no forbidden key', () => {
    check(JSON.parse(readFileSync('dist/manifest.json', 'utf8')))
  })
})
