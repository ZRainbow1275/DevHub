import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import type { CsvTaskRow18, DagEditorPatch } from '@shared/schemas/r8-runtime'

enablePatches()

export interface DagEditorHistoryEntry {
  at: number
  field: string | null
  inversePatches: Patch[]
  label: string
  patches: Patch[]
  taskId: string | null
}

export interface DagEditorHistoryState {
  redo: DagEditorHistoryEntry[]
  undo: DagEditorHistoryEntry[]
}

export interface DagEditorHistoryMeta {
  field?: string | null
  label: string
  taskId?: string | null
}

export interface DagEditorRowsMutationResult {
  changed: boolean
  history: DagEditorHistoryState
  rows: CsvTaskRow18[]
}

export type DagEditorRowsUpdater = (current: readonly CsvTaskRow18[]) => CsvTaskRow18[]

const MAX_HISTORY_ENTRIES = 50
const COMPACT_WINDOW_MS = 2000

export function createDagEditorHistoryState(): DagEditorHistoryState {
  return { redo: [], undo: [] }
}

function shouldCompact(previous: DagEditorHistoryEntry | undefined, entry: DagEditorHistoryEntry): boolean {
  return Boolean(previous)
    && previous?.taskId === entry.taskId
    && previous?.field === entry.field
    && Boolean(entry.taskId)
    && Boolean(entry.field)
    && entry.at - previous.at <= COMPACT_WINDOW_MS
}

function pushUndo(history: DagEditorHistoryState, entry: DagEditorHistoryEntry): DagEditorHistoryState {
  const [previous, ...rest] = history.undo
  if (shouldCompact(previous, entry) && previous) {
    return {
      redo: [],
      undo: [{ ...entry, inversePatches: previous.inversePatches, label: `${previous.label} + ${entry.label}` }, ...rest].slice(0, MAX_HISTORY_ENTRIES)
    }
  }
  return {
    redo: [],
    undo: [entry, ...history.undo].slice(0, MAX_HISTORY_ENTRIES)
  }
}

export function toDagEditorPatchStack(entries: readonly DagEditorHistoryEntry[]): DagEditorPatch[] {
  return entries.map(entry => ({
    at: entry.at,
    patch: {
      field: entry.field,
      inversePatches: entry.inversePatches,
      label: entry.label,
      patches: entry.patches,
      taskId: entry.taskId
    }
  }))
}

export function applyRowsUpdate(
  rows: readonly CsvTaskRow18[],
  history: DagEditorHistoryState,
  updater: DagEditorRowsUpdater,
  meta: DagEditorHistoryMeta,
  now = Date.now()
): DagEditorRowsMutationResult {
  const [nextRows, patches, inversePatches] = produceWithPatches([...rows], () => updater(rows))
  if (patches.length === 0) return { changed: false, history, rows: [...rows] }
  const entry: DagEditorHistoryEntry = {
    at: now,
    field: meta.field ?? null,
    inversePatches,
    label: meta.label,
    patches,
    taskId: meta.taskId ?? null
  }
  return {
    changed: true,
    history: pushUndo(history, entry),
    rows: nextRows
  }
}

export function undoRows(rows: readonly CsvTaskRow18[], history: DagEditorHistoryState): DagEditorRowsMutationResult {
  const [entry, ...rest] = history.undo
  if (!entry) return { changed: false, history, rows: [...rows] }
  const nextRows = applyPatches([...rows], entry.inversePatches)
  return {
    changed: true,
    history: {
      redo: [entry, ...history.redo].slice(0, MAX_HISTORY_ENTRIES),
      undo: rest
    },
    rows: nextRows
  }
}

export function redoRows(rows: readonly CsvTaskRow18[], history: DagEditorHistoryState): DagEditorRowsMutationResult {
  const [entry, ...rest] = history.redo
  if (!entry) return { changed: false, history, rows: [...rows] }
  const nextRows = applyPatches([...rows], entry.patches)
  return {
    changed: true,
    history: {
      redo: rest,
      undo: [entry, ...history.undo].slice(0, MAX_HISTORY_ENTRIES)
    },
    rows: nextRows
  }
}
