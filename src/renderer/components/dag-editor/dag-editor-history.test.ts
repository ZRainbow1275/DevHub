import { beforeEach, describe, expect, it } from 'vitest'
import type { CsvLockResult, CsvTaskRow18 } from '@shared/schemas/r8-runtime'
import { CSV_TASK_ROW_SCHEMA_VERSION } from '@shared/schemas/csv-task-row'
import { useDagEditorStore } from '../../stores/dagEditorStore'
import { applyRowsUpdate, createDagEditorHistoryState, redoRows, toDagEditorPatchStack, undoRows } from './dag-editor-history'
import { applyDependencyEdgeChange, deriveDagCanvasGraph, formatDependencyRefs, parseDependencyRefs } from './dag-editor-sync'

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

function lock(rows: CsvTaskRow18[]): CsvLockResult {
  return {
    acquired: true,
    csvPath: 'D:/tasks.csv',
    expiresAt: 999999,
    locked: true,
    lockedAt: 1,
    lockPath: 'D:/tasks.csv.lock',
    mtimeMs: 10,
    owner: 'vitest',
    ownerPid: 1,
    rows,
    stale: false
  }
}

describe('dag editor sync', () => {
  it('round-trips dependency strings and projects rows into a canvas graph', () => {
    expect(parseDependencyRefs('after:A|B if=success')).toEqual(['A', 'B'])
    expect(formatDependencyRefs(['A', 'A', 'B'])).toBe('after:A|B')

    const rows = applyDependencyEdgeChange([row('A'), row('B')], { fromTaskId: 'A', kind: 'add', toTaskId: 'B' })
    expect(rows[1].dependsOn).toBe('after:A')

    const graph = deriveDagCanvasGraph(rows, null, [['A', 'B', 'A']])
    expect(graph.nodes.map(node => node.id)).toEqual(['A', 'B'])
    expect(graph.edges).toEqual([expect.objectContaining({ inCycle: true, source: 'A', target: 'B' })])
  })
})

describe('dag editor history', () => {
  it('uses immer patches for undo, redo, max-depth, and adjacent field compaction', () => {
    const rows = [row('A'), row('B')]
    let history = createDagEditorHistoryState()
    const first = applyRowsUpdate(rows, history, current => current.map(item => item.taskId === 'B' ? { ...item, dependsOn: 'after:A' } : item), { field: 'dependsOn', label: 'row-edit', taskId: 'B' }, 1000)
    history = first.history
    const second = applyRowsUpdate(first.rows, history, current => current.map(item => item.taskId === 'B' ? { ...item, dependsOn: 'after:A|C' } : item), { field: 'dependsOn', label: 'row-edit', taskId: 'B' }, 1500)
    history = second.history

    expect(history.undo).toHaveLength(1)
    expect(toDagEditorPatchStack(history.undo)[0].patch).toEqual(expect.objectContaining({ taskId: 'B' }))

    const undone = undoRows(second.rows, history)
    expect(undone.rows[1].dependsOn).toBe('')
    const redone = redoRows(undone.rows, undone.history)
    expect(redone.rows[1].dependsOn).toBe('after:A|C')

    let cappedHistory = createDagEditorHistoryState()
    let cappedRows = rows
    for (let index = 0; index < 55; index += 1) {
      const result = applyRowsUpdate(cappedRows, cappedHistory, current => [...current, row(`N${index}`)], { field: 'rows', label: 'append', taskId: `N${index}` }, 10_000 + index * 3000)
      cappedRows = result.rows
      cappedHistory = result.history
    }
    expect(cappedHistory.undo).toHaveLength(50)
  })
})

describe('dag editor zustand store', () => {
  beforeEach(() => {
    useDagEditorStore.getState().reset()
  })

  it('keeps EditorState as the top-level source for view rows and patch stacks', () => {
    const initialRows = [row('A'), row('B')]
    useDagEditorStore.getState().loadRowsFromLock(lock(initialRows))

    expect(useDagEditorStore.getState().editorState).toEqual(expect.objectContaining({
      csvPath: 'D:/tasks.csv',
      isDirty: false,
      isLocked: true,
      selectedTaskIds: ['A']
    }))

    const nextRows = useDagEditorStore.getState().applyRowsUpdate(
      current => applyDependencyEdgeChange(current, { fromTaskId: 'A', kind: 'add', toTaskId: 'B' }),
      { field: 'dependsOn', label: 'edge-add', taskId: 'B' }
    )

    expect(nextRows?.[1].dependsOn).toBe('after:A')
    expect(useDagEditorStore.getState().editorState.undoStack).toHaveLength(1)
    expect(useDagEditorStore.getState().editorState.isDirty).toBe(true)

    const undone = useDagEditorStore.getState().undoRows()
    expect(undone?.[1].dependsOn).toBe('')
    expect(useDagEditorStore.getState().editorState.redoStack).toHaveLength(1)

    const redone = useDagEditorStore.getState().redoRows()
    expect(redone?.[1].dependsOn).toBe('after:A')
  })
})
