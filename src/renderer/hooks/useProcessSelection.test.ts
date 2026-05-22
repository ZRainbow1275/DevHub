import { describe, expect, it } from 'vitest'
import { applyProcessSelectionGesture } from './useProcessSelection'

describe('R8.B process selection model', () => {
  it('single click replaces selection and stores anchor', () => {
    const result = applyProcessSelectionGesture(
      { selectedPids: new Set([11, 12]), anchorPid: 11 },
      21,
      [21, 22, 23]
    )

    expect([...result.selectedPids]).toEqual([21])
    expect(result.anchorPid).toBe(21)
  })

  it('ctrl click toggles membership without touching unrelated PIDs', () => {
    const added = applyProcessSelectionGesture(
      { selectedPids: new Set([31]), anchorPid: 31 },
      32,
      [31, 32, 33],
      { ctrlKey: true }
    )
    const removed = applyProcessSelectionGesture(
      { selectedPids: added.selectedPids, anchorPid: added.anchorPid },
      31,
      [31, 32, 33],
      { metaKey: true }
    )

    expect([...added.selectedPids]).toEqual([31, 32])
    expect([...removed.selectedPids]).toEqual([32])
    expect(removed.anchorPid).toBe(31)
  })

  it('shift click selects the visible PID range from the anchor', () => {
    const result = applyProcessSelectionGesture(
      { selectedPids: new Set([42]), anchorPid: 42 },
      45,
      [41, 42, 43, 44, 45, 46],
      { shiftKey: true }
    )

    expect([...result.selectedPids]).toEqual([42, 43, 44, 45])
    expect(result.anchorPid).toBe(42)
  })
})
