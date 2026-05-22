import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { normalizeGlobalShortcut, useGlobalShortcuts, type GlobalShortcutRegistration } from './useGlobalShortcuts'

function ShortcutHarness({ shortcuts }: { shortcuts: GlobalShortcutRegistration[] }) {
  useGlobalShortcuts(shortcuts)
  return <input aria-label="editor" />
}

describe('useGlobalShortcuts', () => {
  it('normalizes shortcut aliases deterministically', () => {
    expect(normalizeGlobalShortcut('Cmd + Shift + K')).toBe('meta+shift+k')
    expect(normalizeGlobalShortcut('Control+Alt+Escape')).toBe('ctrl+alt+escape')
  })

  it('dispatches matching global shortcuts and prevents default browser handling', () => {
    const onCommand = vi.fn()
    render(<ShortcutHarness shortcuts={[{ id: 'command.palette', keys: ['Ctrl+K', 'Meta+K'], handler: onCommand }]} />)

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'k'
    })
    window.dispatchEvent(event)

    expect(onCommand).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not trigger shortcuts from editable targets unless explicitly allowed', () => {
    const blocked = vi.fn()
    const allowed = vi.fn()
    render(
      <ShortcutHarness
        shortcuts={[
          { id: 'blocked.command', keys: ['Ctrl+K'], handler: blocked },
          { id: 'allowed.topology', keys: ['Ctrl+T'], handler: allowed, allowInEditable: true }
        ]}
      />
    )

    const input = screen.getByLabelText('editor')
    fireEvent.keyDown(input, { ctrlKey: true, key: 'k' })
    fireEvent.keyDown(input, { ctrlKey: true, key: 't' })

    expect(blocked).not.toHaveBeenCalled()
    expect(allowed).toHaveBeenCalledTimes(1)
  })

  it('ignores disabled registrations', () => {
    const handler = vi.fn()
    render(<ShortcutHarness shortcuts={[{ id: 'disabled.command', keys: ['Ctrl+K'], handler, enabled: false }]} />)

    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'k' }))

    expect(handler).not.toHaveBeenCalled()
  })
})
