import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyboardNavGroup, getNextRovingIndex } from './KeyboardNavGroup'

describe('KeyboardNavGroup', () => {
  it('calculates roving indexes with wrapping', () => {
    expect(getNextRovingIndex(0, 3, 1, true)).toBe(1)
    expect(getNextRovingIndex(2, 3, 1, true)).toBe(0)
    expect(getNextRovingIndex(0, 3, -1, false)).toBe(0)
  })

  it('moves focus with arrow keys', () => {
    render(
      <KeyboardNavGroup ariaLabel="Test group">
        <button type="button">One</button>
        <button type="button">Two</button>
        <button type="button">Three</button>
      </KeyboardNavGroup>
    )

    const one = screen.getByRole('button', { name: 'One' })
    const two = screen.getByRole('button', { name: 'Two' })
    one.focus()

    fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Test group' }), { key: 'ArrowRight' })

    expect(two).toHaveFocus()
  })
})
