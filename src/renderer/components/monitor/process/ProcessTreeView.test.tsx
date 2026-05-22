import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessInfo } from '@shared/types-extended'
import type { ProcessTreeNode } from '@shared/schemas/r8-runtime'
import { useProcessStore } from '../../../stores/processStore'
import { ProcessTreeView } from './ProcessTreeView'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => count * estimateSize(),
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index,
      start: index * estimateSize(),
      size: estimateSize()
    }))
  })
}))

function processRow(overrides: Partial<ProcessInfo> & { ppid?: number; parentPid?: number }): ProcessInfo & { ppid?: number; parentPid?: number } {
  return {
    pid: overrides.pid ?? 1,
    name: overrides.name ?? `process-${overrides.pid ?? 1}.exe`,
    command: overrides.command ?? '',
    cpu: overrides.cpu ?? 0,
    memory: overrides.memory ?? 0,
    status: overrides.status ?? 'running',
    startTime: overrides.startTime ?? 1,
    type: overrides.type ?? 'other',
    ...overrides
  }
}

function treeNode(overrides: Partial<ProcessTreeNode> & { pid: number; exe: string }): ProcessTreeNode {
  return {
    pid: overrides.pid,
    ppid: overrides.ppid ?? 0,
    exe: overrides.exe,
    cmdline: overrides.cmdline,
    rss: overrides.rss ?? 0,
    cpu: overrides.cpu ?? 0,
    children: overrides.children ?? [],
    expanded: overrides.expanded ?? false,
    depth: overrides.depth ?? 1,
    isAiTool: overrides.isAiTool ?? false,
    permissionLevel: overrides.permissionLevel
  }
}

describe('ProcessTreeView lazy children', () => {
  beforeEach(() => {
    useProcessStore.setState({
      processes: [],
      processByPid: new Map(),
      childPidsByParentPid: new Map(),
      selectedPid: null
    })
    Object.assign(window.devhub, {
      r8: {
        processViews: {
          treeChildren: vi.fn()
        }
      }
    })
  })

  it('loads child rows through processViews.treeChildren when expanding an indexed parent', async () => {
    const parent = processRow({ pid: 100, ppid: 0, name: 'parent.exe', memory: 4096 })
    const child = processRow({ pid: 101, ppid: 100, name: 'child.exe', memory: 2048 })
    const treeChildren = vi.fn(async () => ({
      children: [treeNode({ pid: 101, ppid: 100, exe: 'child.exe', rss: 2048, cpu: 1.5 })]
    }))

    Object.assign(window.devhub, {
      r8: {
        processViews: {
          treeChildren
        }
      }
    })
    useProcessStore.getState().setProcesses([parent, child])

    render(
      <ProcessTreeView
        processes={[parent]}
        selectedPid={null}
        onSelectProcess={vi.fn()}
        onShowDetail={vi.fn()}
      />
    )

    expect(screen.getByText('parent.exe')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByTestId('tree-expand'))
    })

    expect(await screen.findByText('child.exe')).toBeInTheDocument()
    expect(treeChildren).toHaveBeenCalledWith(100)
  })
})
