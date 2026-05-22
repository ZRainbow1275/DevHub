import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { monitorSnapshotSchema, type MonitorSnapshot } from '@shared/schemas/r8-runtime'
import { ConfidenceBadge, MonitorWindowCards } from './MonitorWindowCards'

function makeSnapshot(): MonitorSnapshot {
  return monitorSnapshotSchema.parse({
    cards: [
      {
        tool: 'codex',
        active: false,
        instanceCount: 0,
        currentPhase: 'idle',
        progress: null,
        tokens: null,
        costUsd: null,
        lastEventAt: null,
        recentEvents: []
      },
      {
        tool: 'claude',
        active: true,
        instanceCount: 1,
        currentPhase: 'running',
        progress: {
          instanceId: 'claude-live',
          percent: 0.42,
          source: 'cli-real',
          confidence: 0.65,
          observedAt: 1,
          message: 'running'
        },
        tokens: { input: 10, output: 8 },
        costUsd: 0.001,
        lastEventAt: 1,
        recentEvents: []
      },
      {
        tool: 'gemini',
        active: false,
        instanceCount: 0,
        currentPhase: 'idle',
        progress: null,
        tokens: null,
        costUsd: null,
        lastEventAt: null,
        recentEvents: []
      },
      {
        tool: 'cursor',
        active: true,
        instanceCount: 1,
        currentPhase: 'editing',
        progress: {
          instanceId: 'cursor-window',
          percent: 0.45,
          source: 'heuristic',
          confidence: 0.8,
          observedAt: 2,
          message: 'window-title'
        },
        tokens: null,
        costUsd: null,
        lastEventAt: 2,
        recentEvents: []
      },
      {
        tool: 'copilot',
        active: false,
        instanceCount: 0,
        currentPhase: 'idle',
        progress: null,
        tokens: null,
        costUsd: null,
        lastEventAt: null,
        recentEvents: []
      }
    ],
    windowState: {
      alwaysOnTop: true,
      opacity: 0.8,
      bounds: { x: 10, y: 20, w: 720, h: 520 }
    },
    collectedAt: 1
  })
}

describe('MonitorWindowCards', () => {
  it('renders five tool cards and yellow confidence for 65 percent', () => {
    const focus = vi.fn()
    const openPopout = vi.fn()
    render(
      <MonitorWindowCards
        snapshot={makeSnapshot()}
        prefsDraft={{ alwaysOnTop: true, opacity: 0.8 }}
        onFocusInstance={focus}
        onOpenPopout={openPopout}
        onPrefsChange={vi.fn()}
      />
    )

    expect(screen.getAllByRole('button')).toHaveLength(10)
    expect(screen.getByRole('button', { name: /Claude 监控卡片/ })).toBeInTheDocument()
    expect(screen.getByText('65%')).toHaveClass('text-warning')
    expect(screen.getByRole('progressbar', { name: /Claude progress/i })).toHaveAttribute('aria-valuenow', '42')

    fireEvent.click(screen.getByText('Claude'))
    expect(focus).toHaveBeenCalledWith('claude', 'claude-live')
    fireEvent.click(screen.getAllByRole('button', { name: '弹出' })[1])
    expect(openPopout).toHaveBeenCalledWith('claude', 'compact')
  })

  it('maps confidence thresholds without color-only text loss', () => {
    const { rerender } = render(<ConfidenceBadge confidence={0.49} />)
    expect(screen.getByText('49%')).toHaveClass('text-error')
    rerender(<ConfidenceBadge confidence={0.7} />)
    expect(screen.getByText('70%')).toHaveClass('text-accent')
    rerender(<ConfidenceBadge confidence={0.95} />)
    expect(screen.getByText('95%')).toHaveClass('text-success')
  })

  it('renders single-tool popout mode and returns to main on double click', () => {
    const returnPopout = vi.fn()
    render(
      <MonitorWindowCards
        snapshot={makeSnapshot()}
        prefsDraft={{ alwaysOnTop: true, opacity: 0.8 }}
        targetTool="claude"
        poppedOutTools={new Set(['claude'])}
        onFocusInstance={vi.fn()}
        onReturnPopout={returnPopout}
        onPrefsChange={vi.fn()}
      />
    )

    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.queryByText('Codex')).not.toBeInTheDocument()
    expect(screen.getByText('已弹出')).toBeInTheDocument()
    fireEvent.doubleClick(screen.getByRole('button', { name: /Claude/i }))
    expect(returnPopout).toHaveBeenCalledWith('claude')
  })

  it('opens an accessible right-click layout menu for monitor tool popouts', () => {
    const setLayout = vi.fn()
    const { rerender } = render(
      <MonitorWindowCards
        snapshot={makeSnapshot()}
        prefsDraft={{ alwaysOnTop: true, opacity: 0.8 }}
        targetTool="claude"
        targetPopoutLayout="compact"
        poppedOutTools={new Set(['claude'])}
        onFocusInstance={vi.fn()}
        onSetPopoutLayout={setLayout}
        onPrefsChange={vi.fn()}
      />
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: /Claude/i }))
    expect(screen.getByRole('menu', { name: /Claude layout menu/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: '仅事件' }))
    expect(setLayout).toHaveBeenCalledWith('claude', 'events-only')

    rerender(
      <MonitorWindowCards
        snapshot={makeSnapshot()}
        prefsDraft={{ alwaysOnTop: true, opacity: 0.8 }}
        targetTool="claude"
        targetPopoutLayout="events-only"
        poppedOutTools={new Set(['claude'])}
        onFocusInstance={vi.fn()}
        onSetPopoutLayout={setLayout}
        onPrefsChange={vi.fn()}
      />
    )

    expect(screen.queryByRole('progressbar', { name: /Claude progress/i })).not.toBeInTheDocument()
    expect(screen.getByText('暂无实时事件')).toBeInTheDocument()
  })
})
