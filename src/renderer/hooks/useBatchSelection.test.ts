import { describe, expect, it } from 'vitest'
import {
  applyWindowRectangleSelection,
  applyWindowSelectionGesture,
  selectWindowRange
} from './useBatchSelection'

describe('R8.B window batch selection model', () => {
  it('selects a visible shift range from the stored anchor', () => {
    const result = applyWindowSelectionGesture(
      { selectedWindows: new Set([102]), anchorHwnd: 102 },
      105,
      [101, 102, 103, 104, 105, 106],
      { shiftKey: true }
    )

    expect([...result.selectedWindows]).toEqual([102, 103, 104, 105])
    expect(result.anchorHwnd).toBe(102)
    expect(selectWindowRange([101, 102, 103, 104], 102, 104)).toEqual([102, 103, 104])
  })

  it('toggles individual HWNDs for checkbox and Ctrl/Cmd gestures', () => {
    const added = applyWindowSelectionGesture(
      { selectedWindows: new Set([201]), anchorHwnd: 201 },
      202,
      [201, 202, 203],
      { ctrlKey: true }
    )
    const removed = applyWindowSelectionGesture(
      { selectedWindows: added.selectedWindows, anchorHwnd: added.anchorHwnd },
      201,
      [201, 202, 203],
      { toggle: true }
    )

    expect([...added.selectedWindows]).toEqual([201, 202])
    expect([...removed.selectedWindows]).toEqual([202])
    expect(removed.anchorHwnd).toBe(201)
  })

  it('replaces or extends selection from real lasso hit HWNDs', () => {
    const replaced = applyWindowRectangleSelection(
      { selectedWindows: new Set([301]), anchorHwnd: 301 },
      [302, 303]
    )
    const extended = applyWindowRectangleSelection(
      { selectedWindows: replaced.selectedWindows, anchorHwnd: replaced.anchorHwnd },
      [304, 305],
      { metaKey: true }
    )

    expect([...replaced.selectedWindows]).toEqual([302, 303])
    expect(replaced.anchorHwnd).toBe(303)
    expect([...extended.selectedWindows]).toEqual([302, 303, 304, 305])
    expect(extended.anchorHwnd).toBe(305)
  })
})
