import { create } from 'zustand'
import type { CsvExternalChangeEvent, CsvLockResult, CsvLockStatus, CsvTaskRow18, DagEditorState, DagEditorValidationError, DagSnapshot, DagViewKind, NodeTemplate } from '@shared/schemas/r8-runtime'
import { dagEditorStateSchema } from '@shared/schemas/dag-editor-state'
import {
  applyRowsUpdate,
  createDagEditorHistoryState,
  redoRows,
  toDagEditorPatchStack,
  undoRows,
  type DagEditorHistoryMeta,
  type DagEditorHistoryState,
  type DagEditorRowsUpdater
} from '../components/dag-editor/dag-editor-history'

interface DagEditorRuntimeState {
  conflict: boolean
  editorState: DagEditorState
  expectedMtimeMs: number | undefined
  externalChange: CsvExternalChangeEvent | null
  history: DagEditorHistoryState
  lock: CsvLockResult | null
  message: string | null
  saving: boolean
  templateId: string
  templates: NodeTemplate[]
}

type CsvUnlockResult = CsvLockStatus & { released: boolean }

interface DagEditorActions {
  applyRowsUpdate: (updater: DagEditorRowsUpdater, meta: DagEditorHistoryMeta) => CsvTaskRow18[] | null
  clearForBlockedLock: (lock: CsvLockResult, message: string) => void
  clearExternalChange: () => void
  loadRowsFromLock: (lock: CsvLockResult) => void
  markSaved: (mtimeMs: number | undefined) => void
  mergeLockStatus: (status: CsvLockStatus) => void
  redoRows: () => CsvTaskRow18[] | null
  reset: () => void
  setConflict: (conflict: boolean) => void
  setCsvPath: (csvPath: string) => void
  setEvaluationResult: (snapshot: DagSnapshot | null, cyclePaths: string[][], message: string | null) => void
  setExternalChange: (externalChange: CsvExternalChangeEvent) => void
  setLockReleased: (lock: CsvUnlockResult) => void
  setMessage: (message: string | null) => void
  setSaving: (saving: boolean) => void
  setSelectedTaskId: (taskId: string | null) => void
  setValidationErrors: (validationErrors: DagEditorValidationError[]) => void
  setTemplateId: (templateId: string) => void
  setTemplates: (templates: NodeTemplate[]) => void
  setView: (view: DagViewKind) => void
  undoRows: () => CsvTaskRow18[] | null
}

export type DagEditorStore = DagEditorRuntimeState & DagEditorActions

function createInitialEditorState(): DagEditorState {
  return dagEditorStateSchema.parse({
    csvPath: '',
    isDirty: false,
    isLocked: false,
    lockOwnerPid: null,
    redoStack: [],
    rows: [],
    selectedTaskIds: [],
    snapshot: null,
    undoStack: [],
    view: 'canvas',
    hoveredEdge: null
  })
}

function createInitialRuntimeState(): DagEditorRuntimeState {
  return {
    conflict: false,
    editorState: createInitialEditorState(),
    expectedMtimeMs: undefined,
    externalChange: null,
    history: createDagEditorHistoryState(),
    lock: null,
    message: null,
    saving: false,
    templateId: '',
    templates: []
  }
}

function withHistoryStacks(editorState: DagEditorState, history: DagEditorHistoryState): DagEditorState {
  return {
    ...editorState,
    redoStack: toDagEditorPatchStack(history.redo),
    undoStack: toDagEditorPatchStack(history.undo)
  }
}

export const useDagEditorStore = create<DagEditorStore>((set) => ({
  ...createInitialRuntimeState(),

  applyRowsUpdate: (updater, meta) => {
    let resultRows: CsvTaskRow18[] | null = null
    set(state => {
      const result = applyRowsUpdate(state.editorState.rows, state.history, updater, meta)
      resultRows = result.rows
      if (!result.changed) return state
      return {
        conflict: false,
        editorState: withHistoryStacks({
          ...state.editorState,
          isDirty: true,
          rows: result.rows
        }, result.history),
        history: result.history
      }
    })
    return resultRows
  },

  clearForBlockedLock: (lock, message) => {
    const history = createDagEditorHistoryState()
    set(state => ({
      conflict: false,
      editorState: withHistoryStacks({
        ...state.editorState,
        csvPath: lock.csvPath,
        isDirty: false,
        isLocked: false,
        lockOwnerPid: lock.ownerPid,
        rows: [],
        selectedTaskIds: [],
        snapshot: null,
        cyclePaths: []
      }, history),
      expectedMtimeMs: lock.mtimeMs ?? undefined,
      externalChange: null,
      history,
      lock,
      message
    }))
  },

  loadRowsFromLock: (lock) => {
    const history = createDagEditorHistoryState()
    set(state => ({
      conflict: false,
      editorState: withHistoryStacks({
        ...state.editorState,
        csvPath: lock.csvPath,
        isDirty: false,
        isLocked: lock.acquired,
        lockOwnerPid: lock.ownerPid,
        rows: lock.rows,
        selectedTaskIds: lock.rows[0]?.taskId ? [lock.rows[0].taskId] : [],
        snapshot: null,
        cyclePaths: [],
        validationErrors: []
      }, history),
      expectedMtimeMs: lock.mtimeMs ?? undefined,
      externalChange: null,
      history,
      lock,
      message: null
    }))
  },

  markSaved: (mtimeMs) => {
    set(state => ({
      conflict: false,
      editorState: {
        ...state.editorState,
        isDirty: false
      },
      expectedMtimeMs: mtimeMs,
      externalChange: null,
      message: null
    }))
  },

  mergeLockStatus: (status) => {
    set(state => {
      const nextLock = state.lock ? { ...state.lock, ...status, acquired: state.lock.acquired && status.locked } : null
      return {
        editorState: {
          ...state.editorState,
          isLocked: Boolean(nextLock?.acquired),
          lockOwnerPid: status.ownerPid
        },
        expectedMtimeMs: status.mtimeMs ?? state.expectedMtimeMs,
        lock: nextLock
      }
    })
  },

  redoRows: () => {
    let resultRows: CsvTaskRow18[] | null = null
    set(state => {
      const result = redoRows(state.editorState.rows, state.history)
      if (!result.changed) return state
      resultRows = result.rows
      return {
        conflict: false,
        editorState: withHistoryStacks({
          ...state.editorState,
          isDirty: true,
          rows: result.rows
        }, result.history),
        history: result.history
      }
    })
    return resultRows
  },

  clearExternalChange: () => set({ conflict: false, externalChange: null }),

  reset: () => set(createInitialRuntimeState()),

  setConflict: (conflict) => set({ conflict }),

  setCsvPath: (csvPath) => {
    set(state => ({
      editorState: {
        ...state.editorState,
        csvPath
      }
    }))
  },

  setEvaluationResult: (snapshot, cyclePaths, message) => {
    set(state => ({
      editorState: {
        ...state.editorState,
        cyclePaths,
        snapshot
      },
      message
    }))
  },

  setExternalChange: (externalChange) => {
    set({ conflict: true, externalChange, message: '外部 CSV 文件已变更，请选择处理方式' })
  },

  setLockReleased: (lock) => {
    set(state => ({
      editorState: {
        ...state.editorState,
        isLocked: false,
        lockOwnerPid: lock.ownerPid
      },
      externalChange: null,
      lock: state.lock ? { ...state.lock, ...lock, acquired: false } : null
    }))
  },

  setMessage: (message) => set({ message }),

  setSaving: (saving) => set({ saving }),

  setSelectedTaskId: (taskId) => {
    set(state => ({
      editorState: {
        ...state.editorState,
        selectedTaskIds: taskId ? [taskId] : []
      }
    }))
  },

  setValidationErrors: (validationErrors) => {
    set(state => ({
      editorState: {
        ...state.editorState,
        validationErrors
      }
    }))
  },

  setTemplateId: (templateId) => set({ templateId }),

  setTemplates: (templates) => set({ templates }),

  setView: (view) => {
    set(state => ({
      editorState: {
        ...state.editorState,
        view
      }
    }))
  },

  undoRows: () => {
    let resultRows: CsvTaskRow18[] | null = null
    set(state => {
      const result = undoRows(state.editorState.rows, state.history)
      if (!result.changed) return state
      resultRows = result.rows
      return {
        conflict: false,
        editorState: withHistoryStacks({
          ...state.editorState,
          isDirty: true,
          rows: result.rows
        }, result.history),
        history: result.history
      }
    })
    return resultRows
  }
}))
