import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortInfo, WindowInfo } from '@shared/types-extended'
import { TopologyDetailPanel } from './TopologyDetailPanel'

const port: PortInfo = {
  port: 5173,
  pid: 4200,
  processName: 'node.exe',
  protocol: 'TCP',
  state: 'LISTENING',
  localAddress: '127.0.0.1:5173',
  foreignAddress: '*:*'
}

const windowInfo: WindowInfo = {
  hwnd: 10001,
  title: 'DevHub',
  processName: 'node.exe',
  pid: 4200,
  className: 'Chrome_WidgetWin_1',
  rect: { x: 0, y: 0, width: 1280, height: 720 },
  isVisible: true,
  isMinimized: false,
  isSystemWindow: false
}

describe('TopologyDetailPanel global topology bridge', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('opens global topology for port, window, and project detail nodes', () => {
    const openGlobal = vi.fn()
    window.addEventListener('devhub:open-topology-global', openGlobal)

    const { rerender } = render(
      <TopologyDetailPanel
        node={{ nodeType: 'port', portInfo: port }}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('topology-detail-global-button'))
    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('port-5173-4200-TCP')

    rerender(
      <TopologyDetailPanel
        node={{ nodeType: 'window', windowInfo }}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('topology-detail-global-button'))
    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('window-10001')

    rerender(
      <TopologyDetailPanel
        node={{ nodeType: 'project', projectId: 'devhub', projectName: 'DevHub' }}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('topology-detail-global-button'))
    expect(window.sessionStorage.getItem('devhub:topology:global:selected-node')).toBe('project-devhub')
    expect(openGlobal).toHaveBeenCalledTimes(3)

    window.removeEventListener('devhub:open-topology-global', openGlobal)
  })
})
