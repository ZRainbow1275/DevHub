import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CsvExternalChangeEvent, CsvTaskRow18, DagSnapshot } from '@shared/schemas/r8-runtime'
import { CSV_TASK_ROW_SCHEMA_VERSION } from '@shared/schemas/csv-task-row'
import { BUILTIN_NODE_TEMPLATES } from '@shared/schemas/dag-editor-state'
import { useDagEditorStore } from '../../stores/dagEditorStore'
import { DagEditorPanel } from './DagEditorPanel'

function row(taskId: string, dependsOn = ''): CsvTaskRow18 {
  return {
    schemaVersion: CSV_TASK_ROW_SCHEMA_VERSION,
    taskId,
    taskName: `Task ${taskId}`,
    priority: 'P1',
    status: 'pending',
    tool: 'codex',
    skill: 'code-review',
    inputFile: 'src/app.ts',
    inputArgs: '{}',
    outputDir: 'out',
    outputFormat: 'md',
    tags: '',
    dependsOn,
    timeoutMs: 60000,
    retries: 1,
    concurrencyKey: '',
    createdAt: '2026-05-03T08:00:00Z',
    scheduledAt: 'now',
    note: ''
  }
}

function refs(dependsOn: string): string[] {
  return dependsOn.replace(/^after:/, '').replaceAll('|', ',').split(',').map(item => item.trim()).filter(Boolean)
}

function snapshot(rows: CsvTaskRow18[]): DagSnapshot {
  const edges = rows.flatMap(item => refs(item.dependsOn).map(ref => ({ from: ref, to: item.taskId, condition: 'success' as const, combinator: 'all' as const })))
  return {
    sessionId: 'editor-test',
    generatedAt: 1,
    nodes: rows.map((item, index) => ({ taskId: item.taskId, layer: index, parallelGroup: null, parallelGroupMax: null, priority: 75, estimatedDurationMs: null, isCriticalPath: false, inDegree: refs(item.dependsOn).length, outDegree: 0 })),
    edges,
    layers: rows.map(item => [item.taskId]),
    totalLayers: rows.length,
    criticalPath: rows.map(item => item.taskId),
    estimatedTotalMs: null,
    warnings: [],
    hash: 'hash'
  }
}

describe('DagEditorPanel', () => {
  const rows = [row('A'), row('B')]
  let emitExternalChange: ((payload: CsvExternalChangeEvent) => void) | null = null
  const api = {
    csv: {
      listTemplates: vi.fn(async () => BUILTIN_NODE_TEMPLATES),
      lock: vi.fn(async () => ({ acquired: true, csvPath: 'D:/tasks.csv', lockPath: 'D:/tasks.csv.lock', locked: true, ownerPid: 1, owner: 'vitest', lockedAt: 1, expiresAt: 999999, stale: false, mtimeMs: 10, rows })),
      unlock: vi.fn(async () => ({ released: true, csvPath: 'D:/tasks.csv', lockPath: 'D:/tasks.csv.lock', locked: false, ownerPid: null, owner: null, lockedAt: null, expiresAt: null, stale: false, mtimeMs: 11 })),
      save: vi.fn(async () => ({ success: true, cycleDetected: false, validationErrors: [], cyclePaths: [], savedAt: 2, mtimeMs: 11, rowCount: 2, csvPath: 'D:/tasks.csv' })),
      saveTemplate: vi.fn(async () => ({ template: { id: 'tpl-1', name: 'Task A', rowTemplate: rows[0], createdAt: 1, source: 'user' } })),
      onLockStatus: vi.fn(() => () => undefined),
      onExternalChange: vi.fn((callback: (payload: CsvExternalChangeEvent) => void) => {
        emitExternalChange = callback
        return () => {
          if (emitExternalChange === callback) emitExternalChange = null
        }
      })
    },
    dag: {
      detectCycle: vi.fn(async (input: { rows: CsvTaskRow18[] }) => {
        const currentRows = input.rows
        const a = currentRows.find(item => item.taskId === 'A')
        const b = currentRows.find(item => item.taskId === 'B')
        const cyclic = Boolean(a?.dependsOn.includes('B') && b?.dependsOn.includes('A'))
        return cyclic ? { hasCycle: true, cycles: [['A', 'B', 'A']], cyclePaths: [['A', 'B', 'A']] } : { hasCycle: false, cycles: [], cyclePaths: [] }
      }),
      build: vi.fn(async (input: { rows: CsvTaskRow18[] }) => snapshot(input.rows))
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    emitExternalChange = null
    useDagEditorStore.getState().reset()
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: api }
    })
  })

  it('locks a real CSV path, syncs four views, supports drag dependency, undo, and cycle save guard', async () => {
    render(<DagEditorPanel />)
    expect(await screen.findByTestId('template-node-palette')).toHaveTextContent('5 builtin / 0 user')

    fireEvent.change(screen.getByPlaceholderText('D:/path/tasks.csv'), { target: { value: 'D:/tasks.csv' } })
    fireEvent.click(screen.getByRole('button', { name: '锁定并载入' }))
    expect(await screen.findByText('A')).toBeInTheDocument()
    expect(screen.getByTestId('dag-editor-cytoscape-canvas')).toHaveAttribute('data-cytoscape-engine', 'cytoscape')

    fireEvent.dragStart(screen.getByText('A'))
    fireEvent.drop(screen.getByText('B'))
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    await waitFor(() => expect(screen.getByLabelText('B dependsOn')).toHaveValue('after:A'))

    fireEvent.click(screen.getByRole('button', { name: '保存选中为模板' }))
    await waitFor(() => expect(api.csv.saveTemplate).toHaveBeenCalledWith('Task A', expect.objectContaining({ taskId: 'A' }), 'r8-dag-editor', 'Saved from A'))
    expect(screen.getByTestId('template-node-palette')).toHaveTextContent('5 builtin / 1 user')
    fireEvent.change(screen.getByLabelText('Node template'), { target: { value: 'tpl-1' } })
    fireEvent.click(screen.getByRole('button', { name: '插入模板' }))
    expect(await screen.findByText('Task-A-3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.queryByText('Task-A-3')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.getByLabelText('B dependsOn')).toHaveValue(''))

    fireEvent.change(screen.getByLabelText('A dependsOn'), { target: { value: 'after:B' } })
    fireEvent.change(screen.getByLabelText('B dependsOn'), { target: { value: 'after:A' } })
    await waitFor(() => expect(screen.getByTestId('csv-save-btn')).toBeDisabled())
    expect(await screen.findByText('A -> B -> A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Gantt' }))
    expect(screen.getByText('等待无环 DAG snapshot')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0)
  })

  it('loads builtin TemplateNodePalette entries and inserts a real row template', async () => {
    render(<DagEditorPanel />)

    fireEvent.change(screen.getByPlaceholderText('D:/path/tasks.csv'), { target: { value: 'D:/tasks.csv' } })
    fireEvent.click(screen.getByRole('button', { name: '锁定并载入' }))
    expect(await screen.findByTestId('template-node-palette')).toHaveTextContent('5 builtin / 0 user')

    fireEvent.click(screen.getByRole('button', { name: '写测试' }))
    fireEvent.click(screen.getByRole('button', { name: '插入模板' }))

    await waitFor(() => expect(api.dag.detectCycle).toHaveBeenLastCalledWith(expect.objectContaining({
      rows: expect.arrayContaining([expect.objectContaining({ taskName: '写测试', skill: 'write-tests' })])
    })))
    expect(screen.getByTestId('dag-editor-panel')).toHaveTextContent('写测试')
  })

  it('validates NodeDetailPanel edits with the shared 18-column schema before save', async () => {
    render(<DagEditorPanel />)

    fireEvent.change(screen.getByPlaceholderText('D:/path/tasks.csv'), { target: { value: 'D:/tasks.csv' } })
    fireEvent.click(screen.getByRole('button', { name: '锁定并载入' }))
    expect(await screen.findByTestId('node-detail-panel')).toHaveTextContent('18 columns')

    fireEvent.change(screen.getByLabelText('A detail inputArgs'), { target: { value: '{not-json' } })
    expect(await screen.findByText('inputArgs must be valid JSON')).toBeInTheDocument()
    expect(screen.getByTestId('csv-save-btn')).toBeDisabled()

    fireEvent.change(screen.getByLabelText('A detail inputArgs'), { target: { value: '{}' } })
    await waitFor(() => expect(screen.queryByText('inputArgs must be valid JSON')).not.toBeInTheDocument())
    expect(screen.getByTestId('csv-save-btn')).not.toBeDisabled()
  })

  it('opens a three-action external modify modal from the real CSV mtime stream', async () => {
    render(<DagEditorPanel />)

    fireEvent.change(screen.getByPlaceholderText('D:/path/tasks.csv'), { target: { value: 'D:/tasks.csv' } })
    fireEvent.click(screen.getByRole('button', { name: '锁定并载入' }))
    expect(await screen.findByText('A')).toBeInTheDocument()

    const externalChange: CsvExternalChangeEvent = {
      csvPath: 'D:/tasks.csv',
      kind: 'change',
      observedAt: 20,
      expectedMtimeMs: 10,
      observedMtimeMs: 12,
      sizeBytes: 512
    }
    act(() => {
      emitExternalChange?.(externalChange)
    })
    expect(await screen.findByTestId('external-change-modal')).toHaveTextContent('检测到外部 CSV 文件变更')
    expect(screen.getByRole('button', { name: '重新加载外部版本' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '覆盖保存本地版本' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续本地编辑' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '继续本地编辑' }))
    await waitFor(() => expect(screen.queryByTestId('external-change-modal')).not.toBeInTheDocument())

    act(() => {
      emitExternalChange?.({ ...externalChange, observedAt: 21, observedMtimeMs: 13 })
    })
    fireEvent.click(await screen.findByRole('button', { name: '覆盖保存本地版本' }))
    await waitFor(() => expect(api.csv.save).toHaveBeenLastCalledWith(expect.objectContaining({ forceWrite: true })))

    act(() => {
      emitExternalChange?.({ ...externalChange, observedAt: 22, observedMtimeMs: 14 })
    })
    fireEvent.click(await screen.findByRole('button', { name: '重新加载外部版本' }))
    await waitFor(() => expect(api.csv.lock).toHaveBeenCalledTimes(2))
  })
})
