import { create } from 'zustand'
import {
  ProcessInfo,
  PortInfo,
  WindowInfo,
  AITask,
  SystemSummary,
  ScannerDiff,
  ScannerType
} from '@shared/types-extended'

// ============ Init Status ============

export type InitStatus = 'loading' | 'partial' | 'ready' | 'error'

interface ScannerTypeStatus {
  ready: boolean
  count: number
  error: string | null
}

// ============ Previous Summary (for delta display) ============

interface SummaryDelta {
  processCount: number
  activePortCount: number
  windowCount: number
  aiToolCount: number
}

// ============ Store Interface ============

interface ScannerState {
  // Data
  processes: ProcessInfo[]
  ports: PortInfo[]
  windows: WindowInfo[]
  aiTasks: AITask[]
  summary: SystemSummary

  // Status
  initStatus: InitStatus
  scannerStatus: Record<ScannerType, ScannerTypeStatus>
  summaryDelta: SummaryDelta

  // Previous summary values (for computing delta)
  _prevSummary: SystemSummary | null

  // Actions
  initialize: () => Promise<void>
  applyProcessesDiff: (diff: ScannerDiff<ProcessInfo>) => void
  applyPortsDiff: (diff: ScannerDiff<PortInfo>) => void
  applyWindowsDiff: (diff: ScannerDiff<WindowInfo>) => void
  applyAiTasksDiff: (diff: ScannerDiff<AITask>) => void
  updateSummary: (summary: SystemSummary) => void
  setScannerTypeReady: (type: ScannerType, count: number) => void
  setScannerTypeError: (type: ScannerType, error: string) => void
}

// ============ Helper: apply diff to array ============

function applyDiffToArray<T>(
  current: T[],
  diff: ScannerDiff<T>,
  getId: (item: T) => string
): T[] {
  if (!diff.hasChanges) return current

  const result = new Map(current.map(item => [getId(item), item]))

  // Remove
  for (const removed of diff.removed) {
    result.delete(getId(removed))
  }

  // Add
  for (const added of diff.added) {
    result.set(getId(added), added)
  }

  // Update
  for (const update of diff.updated) {
    const existing = result.get(update.id)
    if (existing) {
      result.set(update.id, { ...existing, ...update.changes } as T)
    }
  }

  return Array.from(result.values())
}

// ============ Default Summary ============

const defaultSummary: SystemSummary = {
  processCount: 0,
  activePortCount: 0,
  windowCount: 0,
  aiToolCount: 0,
  cpuTotal: 0,
  memoryUsedPercent: 0
}

const defaultScannerStatus: Record<ScannerType, ScannerTypeStatus> = {
  processes: { ready: false, count: 0, error: null },
  ports: { ready: false, count: 0, error: null },
  windows: { ready: false, count: 0, error: null },
  aiTasks: { ready: false, count: 0, error: null }
}

// ============ Store ============

export const useScannerStore = create<ScannerState>((set, get) => ({
  processes: [],
  ports: [],
  windows: [],
  aiTasks: [],
  summary: defaultSummary,
  initStatus: 'loading',
  scannerStatus: { ...defaultScannerStatus },
  summaryDelta: { processCount: 0, activePortCount: 0, windowCount: 0, aiToolCount: 0 },
  _prevSummary: null,

  initialize: async () => {
    try {
      // Subscribe to background scanner events
      window.devhub?.scanner?.subscribe()

      // Request initial snapshot
      const snapshot = await window.devhub?.scanner?.getSnapshot()
      if (!snapshot) {
        set({ initStatus: 'loading' })
        return
      }

      const allReady =
        snapshot.processes.lastUpdated > 0 &&
        snapshot.ports.lastUpdated > 0 &&
        snapshot.windows.lastUpdated > 0

      set({
        processes: snapshot.processes.data,
        ports: snapshot.ports.data,
        windows: snapshot.windows.data,
        aiTasks: snapshot.aiTasks.data,
        summary: snapshot.systemSummary,
        initStatus: allReady ? 'ready' : 'partial',
        scannerStatus: {
          processes: {
            ready: snapshot.processes.lastUpdated > 0,
            count: snapshot.processes.data.length,
            error: snapshot.processes.error
          },
          ports: {
            ready: snapshot.ports.lastUpdated > 0,
            count: snapshot.ports.data.length,
            error: snapshot.ports.error
          },
          windows: {
            ready: snapshot.windows.lastUpdated > 0,
            count: snapshot.windows.data.length,
            error: snapshot.windows.error
          },
          aiTasks: {
            ready: snapshot.aiTasks.lastUpdated > 0,
            count: snapshot.aiTasks.data.length,
            error: snapshot.aiTasks.error
          }
        }
      })
    } catch (err) {
      console.error('Scanner store initialization failed:', err)
      set({ initStatus: 'error' })
    }
  },

  applyProcessesDiff: (diff) => {
    if (!diff.hasChanges) return
    set((state) => {
      const processes = applyDiffToArray<ProcessInfo>(
        state.processes,
        diff,
        (p) => String(p.pid)
      )
      return {
        processes,
        scannerStatus: {
          ...state.scannerStatus,
          processes: { ready: true, count: processes.length, error: null }
        }
      }
    })
    // Check if we should transition to ready
    checkAndTransitionToReady(get, set)
  },

  applyPortsDiff: (diff) => {
    if (!diff.hasChanges) return
    set((state) => {
      const ports = applyDiffToArray<PortInfo>(
        state.ports,
        diff,
        (p) => `${p.port}:${p.pid}:${p.state}`
      )
      return {
        ports,
        scannerStatus: {
          ...state.scannerStatus,
          ports: { ready: true, count: ports.length, error: null }
        }
      }
    })
    checkAndTransitionToReady(get, set)
  },

  applyWindowsDiff: (diff) => {
    if (!diff.hasChanges) return
    set((state) => {
      const windows = applyDiffToArray<WindowInfo>(
        state.windows,
        diff,
        (w) => String(w.hwnd)
      )
      return {
        windows,
        scannerStatus: {
          ...state.scannerStatus,
          windows: { ready: true, count: windows.length, error: null }
        }
      }
    })
    checkAndTransitionToReady(get, set)
  },

  applyAiTasksDiff: (diff) => {
    if (!diff.hasChanges) return
    set((state) => {
      const aiTasks = applyDiffToArray<AITask>(
        state.aiTasks,
        diff,
        (t) => t.id
      )
      return {
        aiTasks,
        scannerStatus: {
          ...state.scannerStatus,
          aiTasks: { ready: true, count: aiTasks.length, error: null }
        }
      }
    })
    checkAndTransitionToReady(get, set)
  },

  updateSummary: (summary) => {
    set((state) => {
      const prev = state._prevSummary || state.summary
      const delta: SummaryDelta = {
        processCount: summary.processCount - prev.processCount,
        activePortCount: summary.activePortCount - prev.activePortCount,
        windowCount: summary.windowCount - prev.windowCount,
        aiToolCount: summary.aiToolCount - prev.aiToolCount
      }
      return {
        summary,
        summaryDelta: delta,
        _prevSummary: summary
      }
    })
  },

  setScannerTypeReady: (type, count) => {
    set((state) => ({
      scannerStatus: {
        ...state.scannerStatus,
        [type]: { ready: true, count, error: null }
      }
    }))
    checkAndTransitionToReady(get, set)
  },

  setScannerTypeError: (type, error) => {
    set((state) => ({
      scannerStatus: {
        ...state.scannerStatus,
        [type]: { ...state.scannerStatus[type], error }
      }
    }))
    checkAndTransitionToReady(get, set)
  }
}))

// ============ Helper: check if all scanners are ready ============

function checkAndTransitionToReady(
  get: () => ScannerState,
  set: (fn: (state: ScannerState) => Partial<ScannerState>) => void
): void {
  const state = get()
  if (state.initStatus === 'ready') return

  const initRequiredScanners: ScannerType[] = ['processes', 'ports', 'windows']
  const allReady = initRequiredScanners
    .map(key => state.scannerStatus[key])
    .every(s => s.ready)

  if (allReady) {
    set(() => ({ initStatus: 'ready' }))
  } else {
    const someReady = Object.values(state.scannerStatus).some(s => s.ready)
    if (someReady && state.initStatus === 'loading') {
      set(() => ({ initStatus: 'partial' }))
    }
  }
}
