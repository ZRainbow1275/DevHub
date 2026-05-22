import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DagCanvas, type DagCanvasGraph } from './DagCanvas'

const graph: DagCanvasGraph = {
  nodes: [
    { id: 'A', kind: 'task', label: 'Alpha', status: 'pending' },
    { id: 'B', kind: 'task', label: 'Beta', status: 'running' },
    { id: 'C', kind: 'task', label: 'Gamma', status: 'done' }
  ],
  edges: [
    { id: 'A-B', source: 'A', target: 'B' },
    { id: 'B-C', source: 'B', target: 'C' }
  ]
}

describe('DagCanvas a11y roving navigation', () => {
  it('exposes node names to screen readers and moves focus with roving tabindex', async () => {
    const onNodeClick = vi.fn()
    render(<DagCanvas graph={graph} focusNodeId="A" onNodeClick={onNodeClick} testId="test-dag-canvas" />)

    const listbox = screen.getByRole('listbox', { name: 'DAG canvas nodes' })
    const alpha = screen.getByRole('option', { name: '节点 Alpha (A)' })
    const beta = screen.getByRole('option', { name: '节点 Beta (B)' })
    const gamma = screen.getByRole('option', { name: '节点 Gamma (C)' })

    expect(listbox).toHaveAttribute('aria-activedescendant', 'test-dag-canvas-node-option-A')
    expect(alpha).toHaveAttribute('tabindex', '0')
    expect(beta).toHaveAttribute('tabindex', '-1')
    expect(screen.getByTestId('test-dag-canvas-a11y-status')).toHaveTextContent('当前节点 Alpha (A)')

    fireEvent.keyDown(alpha, { key: 'ArrowRight' })
    await waitFor(() => expect(beta).toHaveFocus())
    expect(onNodeClick).toHaveBeenLastCalledWith('B')
    expect(beta).toHaveAttribute('tabindex', '0')
    expect(screen.getByTestId('test-dag-canvas-a11y-status')).toHaveTextContent('当前节点 Beta (B)')

    fireEvent.keyDown(beta, { key: 'End' })
    await waitFor(() => expect(gamma).toHaveFocus())
    expect(onNodeClick).toHaveBeenLastCalledWith('C')

    fireEvent.keyDown(gamma, { key: 'Home' })
    await waitFor(() => expect(alpha).toHaveFocus())
    expect(onNodeClick).toHaveBeenLastCalledWith('A')

    fireEvent.keyDown(alpha, { key: 'Enter' })
    expect(onNodeClick).toHaveBeenLastCalledWith('A')
  })
})
