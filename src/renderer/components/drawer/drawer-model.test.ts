import { describe, expect, it } from 'vitest'
import type { DrawerState } from '@shared/schemas/r8-runtime'
import {
  BUILTIN_DRAWER_CONTENTS,
  DRAWER_SLOTS,
  clampDrawerSize,
  createDefaultDrawerStateMap,
  drawerStatesToMap,
  getDrawerDefaultState,
  updateDrawerOpen,
  updateDrawerSize
} from './drawer-model'

describe('R8.B drawer model', () => {
  it('creates five closed default drawer slots without fake content data', () => {
    const states = createDefaultDrawerStateMap(1700000000000)

    expect(Object.keys(states)).toEqual(DRAWER_SLOTS)
    expect(DRAWER_SLOTS.every(slot => states[slot].open === false)).toBe(true)
    expect(states.top.contentId).toBe(BUILTIN_DRAWER_CONTENTS.TOP_NOTIFICATIONS)
    expect(states.right.width).toBe(360)
    expect(states.bottom.height).toBe(240)
    expect(states.floating.zIndex).toBe(4000)
    expect(states.statusbar.zIndex).toBe(1500)
  })

  it('clamps slot sizes to the spec-03 boundaries', () => {
    expect(clampDrawerSize('top', 12)).toBe(40)
    expect(clampDrawerSize('right', 2000)).toBe(800)
    expect(clampDrawerSize('bottom', 90)).toBe(120)
    expect(clampDrawerSize('statusbar', 200)).toBe(96)
  })

  it('normalizes partial persisted states while preserving all five slots', () => {
    const right = updateDrawerSize(updateDrawerOpen(getDrawerDefaultState('right', 1), true), 1600)
    const stateMap = drawerStatesToMap([right as DrawerState], 2)

    expect(stateMap.right.open).toBe(true)
    expect(stateMap.right.width).toBe(800)
    expect(stateMap.top.open).toBe(false)
    expect(stateMap.statusbar.contentId).toBe(BUILTIN_DRAWER_CONTENTS.STATUSBAR_AGGREGATE)
  })
})
