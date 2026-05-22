import { describe, expect, it } from 'vitest'
import {
  REQUIRED_WINDOW_OPERATION_KINDS,
  WINDOW_OPERATION_CATALOG,
  getWindowOperationByKind
} from './window-operations-catalog'

describe('WINDOW_OPERATION_CATALOG', () => {
  it('covers every required P4.2-e operation with stable ids', () => {
    const ids = WINDOW_OPERATION_CATALOG.map(item => item.kind)

    expect(new Set(ids).size).toBe(ids.length)
    expect(WINDOW_OPERATION_CATALOG.length).toBeGreaterThanOrEqual(12)
    for (const required of REQUIRED_WINDOW_OPERATION_KINDS) {
      expect(ids).toContain(required)
    }
  })

  it('keeps labels textual and free of emoji code points', () => {
    const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u

    for (const operation of WINDOW_OPERATION_CATALOG) {
      expect(operation.label.trim()).toBeTruthy()
      expect(operation.description.trim()).toBeTruthy()
      expect(operation.label).not.toMatch(emojiPattern)
      expect(operation.description).not.toMatch(emojiPattern)
    }
  })

  it('marks destructive operations as danger operations', () => {
    expect(getWindowOperationByKind('close')).toMatchObject({ category: 'danger', danger: true })
    expect(getWindowOperationByKind('kill-process')).toMatchObject({ category: 'danger', danger: true })
  })
})
