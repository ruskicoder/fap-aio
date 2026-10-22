import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeChrome, type FakeChrome } from './helpers/fake-chrome'
import { CATALOG, read } from '../src/shared/storage/catalog'
import { addMigration, migrations, readMigrated, runMigrations } from '../src/shared/storage/migrations'

describe('migrations', () => {
  let c: FakeChrome
  beforeEach(() => {
    c = installFakeChrome()
    for (const k of Object.keys(migrations)) delete migrations[k]
  })

  it('runs steps in order up to the catalog version', async () => {
    const order: number[] = []
    const entry = CATALOG['panel.state']
    expect(entry.version).toBe(2)
    addMigration('panel.state', 1, (o) => { order.push(1); return { ...o, mode: 'floating' } })
    await c.storage.local.set({ 'panel.state': { schemaVersion: 1, updatedAt: 0, data: { x: 5 } } })
    const r = await runMigrations()
    expect(r).toEqual({ migrated: ['panel.state'], discarded: [] })
    expect(order).toEqual([1])
    expect(await read('panel.state')).toEqual({ x: 5, mode: 'floating' })
  })

  it('discards only the store with a missing step and flags it for sync again', async () => {
    await c.storage.local.set({
      'panel.state': { schemaVersion: 1, updatedAt: 0, data: { x: 5 } },
      legacy: { schemaVersion: 1, updatedAt: 0, data: { dismissed: true } },
    })
    const r = await runMigrations()
    expect(r.discarded).toEqual(['panel.state'])
    expect(c.storage.local.data['panel.state']).toBeUndefined()
    expect(await read('legacy')).toEqual({ dismissed: true })
    expect(await read('storage.discarded')).toEqual({ keys: ['panel.state'] })
  })

  it('discards a store whose step throws', async () => {
    addMigration('panel.state', 1, () => { throw new Error('bad') })
    await c.storage.local.set({ 'panel.state': { schemaVersion: 1, updatedAt: 0, data: {} } })
    expect((await runMigrations()).discarded).toEqual(['panel.state'])
  })

  it('applies a cache:* step to every cache key', async () => {
    // cache is at version 1, so a version-0 record needs the step from 0
    addMigration('cache:*', 0, (o) => ({ entries: o }))
    await c.storage.local.set({ 'cache:exam.list': { schemaVersion: 0, updatedAt: 0, data: {} } })
    expect((await runMigrations()).migrated).toEqual(['cache:exam.list'])
  })

  it('a reader of an old version waits for the migration', async () => {
    addMigration('panel.state', 1, (o) => ({ ...o, mode: 'docked' }))
    await c.storage.local.set({ 'panel.state': { schemaVersion: 1, updatedAt: 0, data: { x: 1 } } })
    const p = readMigrated('panel.state', 1000)
    await runMigrations()
    expect(await p).toEqual({ x: 1, mode: 'docked' })
  })
})
