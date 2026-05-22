import { describe, expect, it } from 'vitest'
import type { StatusTile } from '@shared/schemas/r8-runtime'
import {
  STATUSBAR_BUILTIN_TILE_IDS,
  applyStatusbarConfig,
  createEmptyStatusAggregate,
  createStatusTile,
  mergeStatusTiles,
  splitStatusBarTiles
} from './statusbar-model'

describe('R8.B statusbar model', () => {
  it('defines twelve built-in statusbar tile ids without emoji assets', () => {
    expect(STATUSBAR_BUILTIN_TILE_IDS).toHaveLength(12)
    expect(STATUSBAR_BUILTIN_TILE_IDS).toContain('cmdk')
    expect(STATUSBAR_BUILTIN_TILE_IDS).toContain('popouts')
  })

  it('splits visible tiles into overflow without showing hidden battery tile', () => {
    const aggregate = createEmptyStatusAggregate(1000)
    const { visibleTiles, overflowTiles } = splitStatusBarTiles(aggregate.tiles, 7)

    expect(visibleTiles).toHaveLength(7)
    expect(overflowTiles.length).toBeGreaterThanOrEqual(4)
    expect([...visibleTiles, ...overflowTiles].some(tile => tile.id === 'battery')).toBe(false)
  })

  it('merges runtime values while preserving renderer click actions', () => {
    const fallback = [
      createStatusTile('cmdk', 'Ctrl+K', 1000, {
        clickAction: { type: 'open-cmdk', args: {} }
      })
    ]
    const runtime: StatusTile[] = [
      createStatusTile('cmdk', 'Ctrl+K', 2000, {
        source: 'r8-runtime',
        tone: 'success'
      })
    ]

    const merged = mergeStatusTiles(runtime, fallback)

    expect(merged).toHaveLength(1)
    expect(merged[0].source).toBe('r8-runtime')
    expect(merged[0].clickAction?.type).toBe('open-cmdk')
  })

  it('applies persisted hidden tile and order settings without replacing live values', () => {
    const now = 1000
    const tiles = [
      createStatusTile('cpu', 31, now, { order: 0, visible: true }),
      createStatusTile('cmdk', 'Ctrl+K', now, { order: 11, visible: true }),
      createStatusTile('notifications', 4, now, { order: 8, visible: true })
    ]

    const configured = applyStatusbarConfig(tiles, {
      updatedAt: 2000,
      tiles: [
        createStatusTile('cpu', 0, 2000, { order: 10, visible: false }),
        createStatusTile('cmdk', 'Ctrl+K', 2000, { order: 0, visible: true })
      ]
    })

    expect(configured.map(tile => tile.id)).toEqual(['cmdk', 'notifications', 'cpu'])
    expect(configured.find(tile => tile.id === 'cpu')).toMatchObject({ value: 31, visible: false, order: 10 })
    expect(configured.find(tile => tile.id === 'cmdk')).toMatchObject({ value: 'Ctrl+K', visible: true, order: 0 })
  })
})
