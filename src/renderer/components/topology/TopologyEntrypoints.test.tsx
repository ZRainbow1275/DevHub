import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../layout/Sidebar'
import { StatusBar } from '../layout/StatusBar'

describe('global topology redundant entrypoints', () => {
  it('exposes a sidebar activity entry for fullscreen topology', async () => {
    const onTopologyClick = vi.fn()
    render(<Sidebar onSettingsClick={vi.fn()} onTopologyClick={onTopologyClick} />)

    await act(async () => {
      await Promise.resolve()
    })

    const entry = document.querySelector('[data-activity-bar-icon="topology-global"]')
    expect(entry).not.toBeNull()
    fireEvent.click(entry as Element)
    expect(onTopologyClick).toHaveBeenCalledTimes(1)
  })

  it('exposes a status bar topology badge without emoji assets', () => {
    const onTopologyClick = vi.fn()
    render(<StatusBar onTopologyClick={onTopologyClick} />)

    fireEvent.click(screen.getByTestId('topology-status-badge'))
    expect(onTopologyClick).toHaveBeenCalledTimes(1)
  })
})
