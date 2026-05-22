import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WindowInfo, WindowOperationKind } from '@shared/types-extended'
import { ThumbnailWall } from './ThumbnailWall'

const windowFixtures: WindowInfo[] = [
  {
    hwnd: 501,
    title: 'DevHub Main Window',
    processName: 'DevHub.exe',
    pid: 9001,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 0, y: 0, width: 1440, height: 900 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false
  },
  {
    hwnd: 502,
    title: 'Code Workspace',
    processName: 'Code.exe',
    pid: 9002,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 1920, y: 0, width: 1280, height: 800 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false
  },
  {
    hwnd: 503,
    title: 'Browser Research',
    processName: 'chrome.exe',
    pid: 9003,
    className: 'Chrome_WidgetWin_1',
    rect: { x: 200, y: 100, width: 1200, height: 760 },
    isVisible: true,
    isMinimized: false,
    isSystemWindow: false
  }
]

function renderWall() {
  const onSelectWindow = vi.fn()
  const onToggleWindowSelection = vi.fn()
  const onRunOperation = vi.fn()
  render(
    <ThumbnailWall
      windows={windowFixtures}
      selectedHwnd={501}
      selectedWindows={new Set([502])}
      getDisplayName={(windowInfo) => windowInfo.hwnd === 501 ? 'DevHub main' : windowInfo.processName}
      onSelectWindow={onSelectWindow}
      onToggleWindowSelection={onToggleWindowSelection}
      onRunOperation={onRunOperation}
    />
  )
  return { onSelectWindow, onToggleWindowSelection, onRunOperation }
}

describe('R8.B ThumbnailWall', () => {
  it('renders real window metadata tiles with explicit no-capture fallback', () => {
    renderWall()

    expect(screen.getByTestId('thumbnail-wall')).toHaveAttribute('data-r8b-thumbnail-wall', 'true')
    expect(screen.getByTestId('thumbnail-wall-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('thumbnail-tile-501')).toHaveAttribute('data-thumbnail-stale', 'true')
    expect(screen.getByTestId('thumbnail-tile-501')).toHaveAttribute('data-window-selection-hwnd', '501')
    expect(screen.getAllByText('no-capture')).toHaveLength(3)
    expect(screen.getByText('PID 9001')).toBeInTheDocument()
    expect(screen.getByText('HWND 501')).toBeInTheDocument()
    expect(screen.getByTestId('vd-monitor-badge-501')).toHaveTextContent('VD current / Mon 1')
  })

  it('focuses the clicked tile through the existing window operation path', () => {
    const { onSelectWindow, onRunOperation } = renderWall()

    fireEvent.click(screen.getByTestId('thumbnail-tile-503'))

    expect(onSelectWindow).toHaveBeenCalledWith(503)
    expect(onRunOperation).toHaveBeenCalledWith('focus' satisfies WindowOperationKind, windowFixtures[2])
  })

  it('supports filter, monitor grouping, refresh interval, and four zoom levels', () => {
    renderWall()

    fireEvent.change(screen.getByTestId('thumbnail-wall-filter'), { target: { value: 'Code' } })
    expect(screen.getByTestId('thumbnail-wall-visible-count')).toHaveTextContent('1/3')
    expect(screen.getByText('Code Workspace')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('thumbnail-wall-groupby'), { target: { value: 'monitor' } })
    expect(screen.getByTestId('thumbnail-group-header-monitor-1')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('thumbnail-wall-refresh'), { target: { value: '15000' } })
    expect(screen.getByTestId('thumbnail-wall-refresh')).toHaveValue('15000')

    fireEvent.change(screen.getByTestId('thumbnail-wall-zoom'), { target: { value: 'lg' } })
    expect(screen.getByTestId('thumbnail-wall')).toHaveAttribute('data-zoom-level', 'lg')
  })

  it('keeps Ctrl selection separate from focus navigation', () => {
    const { onToggleWindowSelection, onRunOperation } = renderWall()

    fireEvent.click(screen.getByTestId('thumbnail-tile-501'), { ctrlKey: true })

    expect(onToggleWindowSelection).toHaveBeenCalledWith(501, {
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      toggle: true
    })
    expect(onRunOperation).not.toHaveBeenCalled()
  })

  it('supports roving keyboard focus and keyboard tile actions', () => {
    const { onSelectWindow, onToggleWindowSelection, onRunOperation } = renderWall()
    fireEvent.change(screen.getByTestId('thumbnail-wall-groupby'), { target: { value: 'none' } })

    const firstTile = screen.getByTestId('thumbnail-tile-501')
    const secondTile = screen.getByTestId('thumbnail-tile-502')
    const rovingGroup = firstTile.parentElement as HTMLElement

    expect(rovingGroup).toHaveAttribute('role', 'listbox')
    expect(firstTile).toHaveAttribute('tabindex', '0')
    expect(secondTile).toHaveAttribute('tabindex', '-1')

    firstTile.focus()
    fireEvent.keyDown(rovingGroup, { key: 'ArrowRight' })
    expect(secondTile).toHaveFocus()

    fireEvent.keyDown(secondTile, { key: ' ' })
    expect(onToggleWindowSelection).toHaveBeenCalledWith(502)

    fireEvent.keyDown(secondTile, { key: 'Enter' })
    expect(onSelectWindow).toHaveBeenCalledWith(502)
    expect(onRunOperation).toHaveBeenCalledWith('focus' satisfies WindowOperationKind, windowFixtures[1])
  })
})
