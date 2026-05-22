import { useCallback, useMemo, useState } from 'react'
import { normalizeBatchPids } from '../components/monitor/process/processBatchModel'

export interface ProcessSelectionGesture {
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

export interface ProcessSelectionState {
  selectedPids: Set<number>
  anchorPid: number | null
}

export interface ProcessSelectionUpdate {
  selectedPids: Set<number>
  anchorPid: number | null
}

function selectRange(orderedPids: readonly number[], anchorPid: number | null, targetPid: number): number[] {
  const normalized = normalizeBatchPids(orderedPids)
  const targetIndex = normalized.indexOf(targetPid)
  if (targetIndex < 0) return [targetPid]
  const anchorIndex = anchorPid === null ? targetIndex : normalized.indexOf(anchorPid)
  const start = Math.min(anchorIndex < 0 ? targetIndex : anchorIndex, targetIndex)
  const end = Math.max(anchorIndex < 0 ? targetIndex : anchorIndex, targetIndex)
  return normalized.slice(start, end + 1)
}

export function applyProcessSelectionGesture(
  current: ProcessSelectionState,
  pid: number,
  orderedPids: readonly number[],
  gesture: ProcessSelectionGesture = {}
): ProcessSelectionUpdate {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { selectedPids: new Set(current.selectedPids), anchorPid: current.anchorPid }
  }

  if (gesture.shiftKey) {
    const next = new Set(current.selectedPids)
    for (const rangePid of selectRange(orderedPids, current.anchorPid, pid)) {
      next.add(rangePid)
    }
    return { selectedPids: next, anchorPid: current.anchorPid ?? pid }
  }

  if (gesture.ctrlKey || gesture.metaKey) {
    const next = new Set(current.selectedPids)
    if (next.has(pid)) {
      next.delete(pid)
    } else {
      next.add(pid)
    }
    return { selectedPids: next, anchorPid: pid }
  }

  return { selectedPids: new Set([pid]), anchorPid: pid }
}

export function useProcessSelection() {
  const [selection, setSelection] = useState<ProcessSelectionState>({
    selectedPids: new Set(),
    anchorPid: null
  })

  const selectedPidList = useMemo(() => [...selection.selectedPids], [selection.selectedPids])

  const clearSelection = useCallback(() => {
    setSelection({ selectedPids: new Set(), anchorPid: null })
  }, [])

  const selectAll = useCallback((orderedPids: readonly number[]) => {
    const pids = normalizeBatchPids(orderedPids)
    setSelection({
      selectedPids: new Set(pids),
      anchorPid: pids[0] ?? null
    })
  }, [])

  const pruneSelection = useCallback((availablePids: readonly number[]) => {
    const available = new Set(normalizeBatchPids(availablePids))
    setSelection((current) => {
      const selectedPids = new Set([...current.selectedPids].filter(pid => available.has(pid)))
      const anchorPid = current.anchorPid !== null && available.has(current.anchorPid) ? current.anchorPid : selectedPids.values().next().value ?? null
      if (selectedPids.size === current.selectedPids.size && anchorPid === current.anchorPid) return current
      return { selectedPids, anchorPid }
    })
  }, [])

  const selectPid = useCallback((pid: number, orderedPids: readonly number[], gesture: ProcessSelectionGesture = {}) => {
    setSelection(current => applyProcessSelectionGesture(current, pid, orderedPids, gesture))
  }, [])

  return {
    selectedPids: selection.selectedPids,
    selectedPidList,
    anchorPid: selection.anchorPid,
    selectedCount: selection.selectedPids.size,
    clearSelection,
    pruneSelection,
    selectAll,
    selectPid
  }
}
