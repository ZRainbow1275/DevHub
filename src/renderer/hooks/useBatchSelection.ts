import { useCallback, useMemo, useState } from 'react'

export interface WindowSelectionGesture {
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  toggle?: boolean
}

export interface WindowSelectionState {
  selectedWindows: Set<number>
  anchorHwnd: number | null
}

export interface WindowSelectionUpdate {
  selectedWindows: Set<number>
  anchorHwnd: number | null
}

function normalizeBatchHwnds(hwnds: readonly number[]): number[] {
  const seen = new Set<number>()
  const normalized: number[] = []
  for (const hwnd of hwnds) {
    if (!Number.isInteger(hwnd) || hwnd <= 0 || seen.has(hwnd)) continue
    seen.add(hwnd)
    normalized.push(hwnd)
  }
  return normalized
}

export function selectWindowRange(orderedHwnds: readonly number[], anchorHwnd: number | null, targetHwnd: number): number[] {
  const normalized = normalizeBatchHwnds(orderedHwnds)
  const targetIndex = normalized.indexOf(targetHwnd)
  if (targetIndex < 0) return Number.isInteger(targetHwnd) && targetHwnd > 0 ? [targetHwnd] : []
  const anchorIndex = anchorHwnd === null ? targetIndex : normalized.indexOf(anchorHwnd)
  const safeAnchorIndex = anchorIndex < 0 ? targetIndex : anchorIndex
  const start = Math.min(safeAnchorIndex, targetIndex)
  const end = Math.max(safeAnchorIndex, targetIndex)
  return normalized.slice(start, end + 1)
}

export function applyWindowSelectionGesture(
  current: WindowSelectionState,
  hwnd: number,
  orderedHwnds: readonly number[],
  gesture: WindowSelectionGesture = {}
): WindowSelectionUpdate {
  if (!Number.isInteger(hwnd) || hwnd <= 0) {
    return { selectedWindows: new Set(current.selectedWindows), anchorHwnd: current.anchorHwnd }
  }

  if (gesture.shiftKey) {
    const next = new Set(current.selectedWindows)
    for (const rangeHwnd of selectWindowRange(orderedHwnds, current.anchorHwnd, hwnd)) {
      next.add(rangeHwnd)
    }
    return { selectedWindows: next, anchorHwnd: current.anchorHwnd ?? hwnd }
  }

  if (gesture.toggle || gesture.ctrlKey || gesture.metaKey) {
    const next = new Set(current.selectedWindows)
    if (next.has(hwnd)) {
      next.delete(hwnd)
    } else {
      next.add(hwnd)
    }
    return { selectedWindows: next, anchorHwnd: hwnd }
  }

  return { selectedWindows: new Set([hwnd]), anchorHwnd: hwnd }
}

export function applyWindowRectangleSelection(
  current: WindowSelectionState,
  rectangleHwnds: readonly number[],
  gesture: WindowSelectionGesture = {}
): WindowSelectionUpdate {
  const normalized = normalizeBatchHwnds(rectangleHwnds)
  const next = gesture.ctrlKey || gesture.metaKey || gesture.shiftKey
    ? new Set(current.selectedWindows)
    : new Set<number>()

  for (const hwnd of normalized) {
    next.add(hwnd)
  }

  return {
    selectedWindows: next,
    anchorHwnd: normalized[normalized.length - 1] ?? current.anchorHwnd
  }
}

export function useBatchSelection() {
  const [selection, setSelection] = useState<WindowSelectionState>({
    selectedWindows: new Set(),
    anchorHwnd: null
  })

  const selectedHwnds = useMemo(() => [...selection.selectedWindows], [selection.selectedWindows])

  const clearSelection = useCallback(() => {
    setSelection({ selectedWindows: new Set(), anchorHwnd: null })
  }, [])

  const selectAll = useCallback((orderedHwnds: readonly number[]) => {
    const hwnds = normalizeBatchHwnds(orderedHwnds)
    setSelection({
      selectedWindows: new Set(hwnds),
      anchorHwnd: hwnds[0] ?? null
    })
  }, [])

  const removeWindows = useCallback((hwnds: readonly number[]) => {
    const removing = new Set(normalizeBatchHwnds(hwnds))
    setSelection((current) => {
      const selectedWindows = new Set([...current.selectedWindows].filter(hwnd => !removing.has(hwnd)))
      const anchorHwnd = current.anchorHwnd !== null && selectedWindows.has(current.anchorHwnd)
        ? current.anchorHwnd
        : selectedWindows.values().next().value ?? null
      if (selectedWindows.size === current.selectedWindows.size && anchorHwnd === current.anchorHwnd) return current
      return { selectedWindows, anchorHwnd }
    })
  }, [])

  const pruneSelection = useCallback((availableHwnds: readonly number[]) => {
    const available = new Set(normalizeBatchHwnds(availableHwnds))
    setSelection((current) => {
      const selectedWindows = new Set([...current.selectedWindows].filter(hwnd => available.has(hwnd)))
      const anchorHwnd = current.anchorHwnd !== null && available.has(current.anchorHwnd)
        ? current.anchorHwnd
        : selectedWindows.values().next().value ?? null
      if (selectedWindows.size === current.selectedWindows.size && anchorHwnd === current.anchorHwnd) return current
      return { selectedWindows, anchorHwnd }
    })
  }, [])

  const selectWindow = useCallback((hwnd: number, orderedHwnds: readonly number[], gesture: WindowSelectionGesture = {}) => {
    setSelection(current => applyWindowSelectionGesture(current, hwnd, orderedHwnds, gesture))
  }, [])

  const selectRectangle = useCallback((hwnds: readonly number[], gesture: WindowSelectionGesture = {}) => {
    setSelection(current => applyWindowRectangleSelection(current, hwnds, gesture))
  }, [])

  return {
    selectedWindows: selection.selectedWindows,
    selectedHwnds,
    anchorHwnd: selection.anchorHwnd,
    selectedCount: selection.selectedWindows.size,
    clearSelection,
    pruneSelection,
    removeWindows,
    selectAll,
    selectRectangle,
    selectWindow
  }
}
