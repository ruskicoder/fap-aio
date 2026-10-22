import { describe, expect, it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
// @ts-expect-error untyped tool module
import { extensionIdFromSpki } from '../tools/release/extension-key.mjs'

describe('extension key tool', () => {
  it('derives a 32-letter a-p id deterministically from the public key', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const der = publicKey.export({ type: 'spki', format: 'der' })
    const id = extensionIdFromSpki(der)
    expect(id).toMatch(/^[a-p]{32}$/)
    expect(extensionIdFromSpki(der)).toBe(id)
  })
})
