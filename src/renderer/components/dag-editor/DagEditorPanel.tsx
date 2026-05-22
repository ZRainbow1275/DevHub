import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CsvSaveResult, CsvTaskRow18, DagSnapshot, DagViewKind, NodeTemplate } from '@shared/schemas/r8-runtime'
import { CSV_TASK_ROW_SCHEMA_VERSION } from '@shared/schemas/csv-task-row'
import { useDagEditorStore } from '../../stores/dagEditorStore'
import { DagCanvas } from './DagCanvas'
import { NodeDetailPanel, validateDagEditorRows } from './NodeDetailPanel'
import { TemplateNodePalette } from './TemplateNodePalette'
import { applyDependencyEdgeChange, deriveCycleEdgeKeys, deriveDagCanvasGraph, parseDependencyRefs } from './dag-editor-sync'

const VIEW_LABELS: Record<DagViewKind, string> = {
  canvas: 'Canvas',
  list: 'List',
  gantt: 'Gantt',
  kanban: 'Kanban'
}

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const
const STATUSES = ['pending', 'running', 'done', 'failed', 'skipped'] as const

function isDagSnapshot(value: unknown): value is DagSnapshot {
  return typeof value === 'object' && value !== null
    && Array.isArray((value as { nodes?: unknown }).nodes)
    && Array.isArray((value as { edges?: unknown }).edges)
    && Array.isArray((value as { layers?: unknown }).layers)
}

function isCsvSaveResult(value: unknown): value is CsvSaveResult {
  return typeof value === 'object' && value !== null && typeof (value as { success?: unknown }).success === 'boolean'
}

function templateSafeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.:-]/g, '-').slice(0, 48) || 'template-task'
}

function templateToRow(template: NodeTemplate, index: number): CsvTaskRow18 {
  const nowIso = new Date().toISOString()
  const taskId = `${templateSafeName(template.name)}-${index + 1}`
  return {
    taskName: template.name,
    priority: 'P1',
    status: 'pending',
    tool: 'codex',
    skill: 'code-review',
    inputFile: '',
    inputArgs: '{}',
    outputDir: '',
    outputFormat: 'md',
    tags: 'template',
    dependsOn: '',
    timeoutMs: 60000,
    retries: 1,
    concurrencyKey: '',
    createdAt: nowIso,
    scheduledAt: 'now',
    note: template.description ?? '',
    ...template.rowTemplate,
    schemaVersion: template.rowTemplate?.schemaVersion ?? CSV_TASK_ROW_SCHEMA_VERSION,
    taskId
  }
}

function formatMtime(ms: number | null | undefined): string {
  return typeof ms === 'number' ? new Date(ms).toLocaleString() : 'N/A'
}

export function DagEditorPanel() {
  const editorState = useDagEditorStore(state => state.editorState)
  const lock = useDagEditorStore(state => state.lock)
  const expectedMtimeMs = useDagEditorStore(state => state.expectedMtimeMs)
  const message = useDagEditorStore(state => state.message)
  const saving = useDagEditorStore(state => state.saving)
  const templates = useDagEditorStore(state => state.templates)
  const templateId = useDagEditorStore(state => state.templateId)
  const conflict = useDagEditorStore(state => state.conflict)
  const externalChange = useDagEditorStore(state => state.externalChange)
  const setCsvPath = useDagEditorStore(state => state.setCsvPath)
  const setEvaluationResult = useDagEditorStore(state => state.setEvaluationResult)
  const setTemplates = useDagEditorStore(state => state.setTemplates)
  const setTemplateId = useDagEditorStore(state => state.setTemplateId)
  const mergeLockStatus = useDagEditorStore(state => state.mergeLockStatus)
  const applyRowsUpdateToStore = useDagEditorStore(state => state.applyRowsUpdate)
  const loadRowsFromLock = useDagEditorStore(state => state.loadRowsFromLock)
  const clearForBlockedLock = useDagEditorStore(state => state.clearForBlockedLock)
  const clearExternalChange = useDagEditorStore(state => state.clearExternalChange)
  const setLockReleased = useDagEditorStore(state => state.setLockReleased)
  const markSaved = useDagEditorStore(state => state.markSaved)
  const setConflict = useDagEditorStore(state => state.setConflict)
  const setExternalChange = useDagEditorStore(state => state.setExternalChange)
  const setMessage = useDagEditorStore(state => state.setMessage)
  const setSaving = useDagEditorStore(state => state.setSaving)
  const setSelectedTaskId = useDagEditorStore(state => state.setSelectedTaskId)
  const setValidationErrors = useDagEditorStore(state => state.setValidationErrors)
  const setView = useDagEditorStore(state => state.setView)
  const undoRows = useDagEditorStore(state => state.undoRows)
  const redoRows = useDagEditorStore(state => state.redoRows)
  const {
    csvPath,
    cyclePaths,
    isDirty: dirty,
    redoStack,
    rows,
    selectedTaskIds,
    snapshot,
    undoStack,
    view
  } = editorState
  const selectedTaskId = selectedTaskIds[0] ?? null
  const dragFromRef = useRef<string | null>(null)
  const evaluationVersionRef = useRef(0)

  const selectedRow = useMemo(() => rows.find(row => row.taskId === selectedTaskId) ?? rows[0] ?? null, [rows, selectedTaskId])
  const selectedRowIndex = useMemo(() => selectedRow ? rows.findIndex(row => row.taskId === selectedRow.taskId) : -1, [rows, selectedRow])
  const validationErrors = useMemo(() => validateDagEditorRows(rows), [rows])
  const selectedValidationErrors = useMemo(() => validationErrors.filter(error => error.rowIndex === selectedRowIndex), [selectedRowIndex, validationErrors])
  const cycleKeys = useMemo(() => deriveCycleEdgeKeys(cyclePaths), [cyclePaths])
  const dagCanvasGraph = useMemo(() => deriveDagCanvasGraph(rows, snapshot, cyclePaths), [cyclePaths, rows, snapshot])
  const saveDisabled = !lock?.acquired || saving || !dirty || cyclePaths.length > 0 || validationErrors.length > 0

  const evaluateRows = useCallback(async (nextRows: CsvTaskRow18[]) => {
    const version = evaluationVersionRef.current + 1
    evaluationVersionRef.current = version
    if (nextRows.length === 0) {
      setEvaluationResult(null, [], null)
      return
    }
    try {
      const cycle = await window.devhub.r8.dag.detectCycle({ rows: nextRows })
      if (evaluationVersionRef.current !== version) return
      if (cycle.hasCycle) {
        setEvaluationResult(null, cycle.cyclePaths ?? cycle.cycles, '检测到 DAG cycle，保存已禁用')
        return
      }
      const built = await window.devhub.r8.dag.build({ sessionId: `dag-editor-${Date.now()}`, rows: nextRows })
      if (evaluationVersionRef.current !== version) return
      setEvaluationResult(isDagSnapshot(built) ? built : null, [], null)
    } catch (error) {
      if (evaluationVersionRef.current !== version) return
      setEvaluationResult(null, [], error instanceof Error ? error.message : String(error))
    }
  }, [setEvaluationResult])

  const refreshTemplates = useCallback(async () => {
    setTemplates(await window.devhub.r8.csv.listTemplates())
  }, [setTemplates])

  useEffect(() => {
    void refreshTemplates()
  }, [refreshTemplates])

  useEffect(() => {
    setValidationErrors(validationErrors)
  }, [setValidationErrors, validationErrors])

  useEffect(() => {
    const unsubscribe = window.devhub.r8.csv.onLockStatus(status => {
      if (status.csvPath === lock?.csvPath || status.csvPath === csvPath) {
        mergeLockStatus(status)
      }
    })
    return unsubscribe
  }, [csvPath, lock?.csvPath, mergeLockStatus])

  useEffect(() => {
    const unsubscribe = window.devhub.r8.csv.onExternalChange(payload => {
      if (payload.csvPath === lock?.csvPath || payload.csvPath === csvPath) {
        setExternalChange(payload)
      }
    })
    return unsubscribe
  }, [csvPath, lock?.csvPath, setExternalChange])

  const undo = useCallback(() => {
    const nextRows = undoRows()
    if (nextRows) void evaluateRows(nextRows)
  }, [evaluateRows, undoRows])

  const redo = useCallback(() => {
    const nextRows = redoRows()
    if (nextRows) void evaluateRows(nextRows)
  }, [evaluateRows, redoRows])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [redo, undo])

  const setRowsWithHistory = useCallback((updater: (current: readonly CsvTaskRow18[]) => CsvTaskRow18[], taskId: string | null, field: string | null, label: string) => {
    const nextRows = applyRowsUpdateToStore(updater, { field, label, taskId })
    if (nextRows) void evaluateRows(nextRows)
  }, [applyRowsUpdateToStore, evaluateRows])

  const updateRow = useCallback((taskId: string, patch: Partial<CsvTaskRow18>) => {
    setRowsWithHistory(
      current => current.map(row => row.taskId === taskId ? { ...row, ...patch } : row),
      taskId,
      Object.keys(patch).join(','),
      'row-edit'
    )
  }, [setRowsWithHistory])

  const createDependency = useCallback((fromTaskId: string, toTaskId: string) => {
    if (fromTaskId === toTaskId) return
    setRowsWithHistory(
      current => applyDependencyEdgeChange(current, { fromTaskId, kind: 'add', toTaskId }),
      toTaskId,
      'dependsOn',
      'edge-add'
    )
  }, [setRowsWithHistory])

  const lockCsv = useCallback(async () => {
    setMessage(null)
    const result = await window.devhub.r8.csv.lock(csvPath, 'r8-dag-editor')
    if (!result.acquired) {
      clearForBlockedLock(result, `CSV 已被进程 ${result.ownerPid ?? 'unknown'} 锁定`)
      return
    }
    loadRowsFromLock(result)
    await evaluateRows(result.rows)
  }, [clearForBlockedLock, csvPath, evaluateRows, loadRowsFromLock, setMessage])

  const unlockCsv = useCallback(async () => {
    if (!lock) return
    const result = await window.devhub.r8.csv.unlock(lock.csvPath, 'r8-dag-editor')
    setLockReleased(result)
    setMessage(result.released ? 'CSV 锁已释放' : 'CSV 锁未由当前进程持有')
  }, [lock, setLockReleased, setMessage])

  const saveCsv = useCallback(async (forceWrite = false) => {
    if (!lock?.acquired) return
    setSaving(true)
    try {
      const result = await window.devhub.r8.csv.save({ csvPath: lock.csvPath, rows, expectedMtimeMs, forceWrite, confirmedBy: 'r8-dag-editor' })
      if (!isCsvSaveResult(result)) throw new Error('E_VALIDATION:invalid csv save result')
      if (!result.success) {
        setConflict(result.error === 'E_INTEGRITY_FAIL')
        setEvaluationResult(snapshot, result.cyclePaths, result.error === 'E_INTEGRITY_FAIL' ? '外部修改 / 重新加载 / 覆盖保存 / 取消' : result.error ?? 'CSV 保存失败')
        return
      }
      markSaved(result.mtimeMs)
      setMessage(`已保存 ${result.rowCount} 行`)
    } finally {
      setSaving(false)
    }
  }, [expectedMtimeMs, lock, markSaved, rows, setConflict, setEvaluationResult, setMessage, setSaving, snapshot])

  const reloadExternalCsv = useCallback(() => {
    clearExternalChange()
    setConflict(false)
    void lockCsv()
  }, [clearExternalChange, lockCsv, setConflict])

  const overwriteExternalCsv = useCallback(() => {
    clearExternalChange()
    setConflict(false)
    void saveCsv(true)
  }, [clearExternalChange, saveCsv, setConflict])

  const keepLocalEdits = useCallback(() => {
    clearExternalChange()
    setConflict(false)
    setMessage('继续本地编辑；下一次普通保存仍会执行 mtime 冲突校验')
  }, [clearExternalChange, setConflict, setMessage])

  const saveSelectedTemplate = useCallback(async () => {
    if (!selectedRow) return
    const result = await window.devhub.r8.csv.saveTemplate(selectedRow.taskName, selectedRow, 'r8-dag-editor', `Saved from ${selectedRow.taskId}`)
    setTemplates([result.template, ...templates.filter(template => template.id !== result.template.id)])
    setMessage(`模板已保存: ${result.template.name}`)
  }, [selectedRow, setMessage, setTemplates, templates])

  const insertTemplate = useCallback(() => {
    const template = templates.find(item => item.id === templateId)
    if (!template) return
    setRowsWithHistory(
      current => [...current, templateToRow(template, current.length)],
      null,
      'rows',
      'template-insert'
    )
  }, [setRowsWithHistory, templateId, templates])

  return (
    <div data-testid="dag-editor-panel" className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="text-xs text-text-muted">
          CSV path
          <input className="mt-1 w-full border border-surface-700 bg-surface-950 px-3 py-2 font-mono text-xs text-text-primary radius-sm" value={csvPath} onChange={event => setCsvPath(event.currentTarget.value)} placeholder="D:/path/tasks.csv" />
        </label>
        <button type="button" className="btn-secondary self-end" disabled={!csvPath.trim()} onClick={() => { void lockCsv() }}>锁定并载入</button>
        <button type="button" className="btn-secondary self-end" disabled={!lock?.locked} onClick={() => { void unlockCsv() }}>释放锁</button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="border border-surface-800 bg-surface-950 p-3 text-xs radius-sm"><span className="text-text-muted">Lock</span><div className={lock?.acquired ? 'text-success' : 'text-warning'}>{lock?.acquired ? 'owned' : lock?.locked ? 'blocked' : 'none'}</div></div>
        <div className="border border-surface-800 bg-surface-950 p-3 text-xs radius-sm"><span className="text-text-muted">Rows</span><div className="font-mono text-text-primary">{rows.length}</div></div>
        <div className="border border-surface-800 bg-surface-950 p-3 text-xs radius-sm"><span className="text-text-muted">Cycles</span><div className={cyclePaths.length > 0 ? 'text-danger' : 'text-success'}>{cyclePaths.length}</div></div>
        <div className="border border-surface-800 bg-surface-950 p-3 text-xs radius-sm"><span className="text-text-muted">MTime</span><div className="font-mono text-text-primary">{formatMtime(expectedMtimeMs)}</div></div>
      </div>

      {message && <div className="border border-warning/50 bg-warning/10 p-3 text-xs text-warning radius-sm">{message}</div>}
      {externalChange && (
        <div role="dialog" aria-modal="true" aria-label="外部文件变更" data-testid="external-change-modal" className="border border-warning/60 bg-surface-950 p-4 text-xs text-text-primary shadow-lg radius-md">
          <div className="font-semibold text-warning">检测到外部 CSV 文件变更</div>
          <div className="mt-2 text-text-muted">
            {externalChange.kind} at {formatMtime(externalChange.observedMtimeMs)}; expected {formatMtime(externalChange.expectedMtimeMs)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={reloadExternalCsv}>重新加载外部版本</button>
            <button type="button" className="btn-secondary" onClick={overwriteExternalCsv}>覆盖保存本地版本</button>
            <button type="button" className="btn-secondary" onClick={keepLocalEdits}>继续本地编辑</button>
          </div>
        </div>
      )}
      {conflict && !externalChange && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => { void lockCsv() }}>重新加载</button>
          <button type="button" className="btn-secondary" onClick={() => { void saveCsv(true) }}>覆盖保存</button>
          <button type="button" className="btn-secondary" onClick={() => setConflict(false)}>取消</button>
        </div>
      )}

      {cyclePaths.length > 0 && (
        <div className="border border-danger/60 bg-danger/10 p-3 text-xs text-danger radius-sm">
          {cyclePaths.map(path => <div key={path.join('->')}>{path.join(' -> ')}</div>)}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(VIEW_LABELS).map(([kind, label]) => (
          <button key={kind} type="button" className={view === kind ? 'btn-primary' : 'btn-secondary'} onClick={() => setView(kind as DagViewKind)}>{label}</button>
        ))}
        <button type="button" className="btn-secondary" disabled={undoStack.length === 0} onClick={undo}>Undo</button>
        <button type="button" className="btn-secondary" disabled={redoStack.length === 0} onClick={redo}>Redo</button>
        <button type="button" data-testid="csv-save-btn" className="btn-primary" disabled={saveDisabled} onClick={() => { void saveCsv(false) }}>保存 CSV</button>
      </div>
      <TemplateNodePalette
        canInsert={Boolean(templateId)}
        canSaveSelected={Boolean(selectedRow)}
        onInsert={insertTemplate}
        onSaveSelected={() => { void saveSelectedTemplate() }}
        onSelectTemplate={setTemplateId}
        selectedTemplateId={templateId}
        templates={templates}
      />

      <NodeDetailPanel
        row={selectedRow}
        rowIndex={selectedRowIndex}
        validationErrors={selectedValidationErrors}
        onPatch={patch => {
          if (selectedRow) updateRow(selectedRow.taskId, patch)
        }}
      />

      {view === 'canvas' && (
        <div data-testid="dag-canvas" className="min-h-64 border border-surface-700 bg-surface-950 p-4 radius-md">
          <DagCanvas
            className="h-72 w-full overflow-hidden border border-surface-800 bg-surface-950 radius-sm"
            focusNodeId={selectedTaskId}
            graph={dagCanvasGraph}
            onNodeClick={setSelectedTaskId}
            testId="dag-editor-cytoscape-canvas"
          />
          <div className="flex flex-wrap gap-3">
            {rows.map(row => (
              <div
                key={row.taskId}
                data-cy-id={row.taskId}
                draggable
                onDragStart={() => { dragFromRef.current = row.taskId }}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  const from = dragFromRef.current
                  dragFromRef.current = null
                  if (from) createDependency(from, row.taskId)
                }}
                onClick={() => setSelectedTaskId(row.taskId)}
                className={`min-w-40 cursor-grab border px-3 py-2 text-xs radius-sm ${selectedTaskId === row.taskId ? 'border-accent bg-accent/10' : 'border-surface-700 bg-surface-900'}`}
              >
                <div className="font-mono text-text-primary">{row.taskId}</div>
                <div className="truncate text-text-muted">{row.taskName}</div>
                <div className="mt-2 flex gap-2"><span className="status-badge">{row.priority}</span><span className="status-badge">{row.status}</span></div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs">
            {(snapshot?.edges ?? rows.flatMap(row => parseDependencyRefs(row.dependsOn).map(ref => ({ from: ref, to: row.taskId })))).map(edge => (
              <div key={`${edge.from}->${edge.to}`} data-edge-cycle={cycleKeys.has(`${edge.from}->${edge.to}`)} className={cycleKeys.has(`${edge.from}->${edge.to}`) ? 'text-danger' : 'text-text-muted'}>{edge.from} -&gt; {edge.to}</div>
            ))}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="overflow-x-auto border border-surface-700 radius-md">
          <table className="min-w-full text-xs">
            <thead className="bg-surface-900 text-text-muted"><tr><th className="px-2 py-2 text-left">Task</th><th className="px-2 py-2">Priority</th><th className="px-2 py-2">DependsOn</th><th className="px-2 py-2">Status</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.taskId} className="border-t border-surface-800" onClick={() => setSelectedTaskId(row.taskId)}>
                  <td className="px-2 py-2 font-mono text-text-primary">{row.taskId}</td>
                  <td className="px-2 py-2"><select aria-label={`${row.taskId} priority`} value={row.priority} onChange={event => updateRow(row.taskId, { priority: event.currentTarget.value as CsvTaskRow18['priority'] })}>{PRIORITIES.map(priority => <option key={priority} value={priority}>{priority}</option>)}</select></td>
                  <td className="px-2 py-2"><input aria-label={`${row.taskId} dependsOn`} className="w-56 bg-surface-950 px-2 py-1 font-mono text-text-primary" value={row.dependsOn} onChange={event => updateRow(row.taskId, { dependsOn: event.currentTarget.value })} /></td>
                  <td className="px-2 py-2"><select aria-label={`${row.taskId} status`} value={row.status} onChange={event => updateRow(row.taskId, { status: event.currentTarget.value as CsvTaskRow18['status'] })}>{STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'gantt' && (
        <div className="space-y-2 border border-surface-700 bg-surface-950 p-4 radius-md">
          {(snapshot?.layers ?? []).map((layer, layerIndex) => (
            <div key={layer.join('|')} className="grid grid-cols-[80px_1fr] gap-3 text-xs"><span className="text-text-muted">Layer {layerIndex}</span><div className="flex flex-wrap gap-2">{layer.map(taskId => <span key={taskId} className="border border-accent/40 bg-accent/10 px-3 py-1 text-text-primary radius-sm">{taskId}</span>)}</div></div>
          ))}
          {!snapshot && <div className="text-xs text-text-muted">等待无环 DAG snapshot</div>}
        </div>
      )}

      {view === 'kanban' && (
        <div className="grid gap-3 md:grid-cols-5">
          {STATUSES.map(status => (
            <div key={status} data-testid={`kanban-column-${status}`} className="min-h-32 border border-surface-700 bg-surface-950 p-3 radius-md">
              <div className="mb-2 text-xs font-bold uppercase text-text-muted">{status}</div>
              <div className="space-y-2">{rows.filter(row => row.status === status).map(row => <div key={row.taskId} data-testid={`kanban-card-${row.taskId}`} className="border border-surface-800 bg-surface-900 px-2 py-1 text-xs text-text-primary radius-sm">{row.taskId}</div>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
