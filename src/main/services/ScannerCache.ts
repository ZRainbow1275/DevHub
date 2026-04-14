import { EventEmitter } from 'events'
import {
  ProcessInfo, PortInfo, WindowInfo, AITask,
  ScannerDiff, ScannerCacheEntry, SystemSummary, ScannerCacheSnapshot,
  ScannerType
} from '@shared/types-extended'

// Re-export shared types for backward compatibility
export type { ScannerDiff, ScannerCacheSnapshot, SystemSummary, ScannerType }
export type CacheEntry<T> = ScannerCacheEntry<T>

// ============ ID Extractors ============

function getProcessId(item: ProcessInfo): string {
  return String(item.pid)
}

function getPortId(item: PortInfo): string {
  return `${item.port}:${item.pid}:${item.state}`
}

function getWindowId(item: WindowInfo): string {
  return String(item.hwnd)
}

function getAITaskId(item: AITask): string {
  return item.id
}

// ============ Diff Computation ============

function shallowDiff<T extends Record<string, unknown>>(prev: T, next: T): Partial<T> {
  const changes: Partial<T> = {}
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (prev[key] !== next[key]) {
      changes[key] = next[key]
    }
  }
  return changes
}

export function computeDiff<T>(
  prev: T[],
  next: T[],
  getId: (item: T) => string
): ScannerDiff<T> {
  const prevMap = new Map(prev.map(x => [getId(x), x]))
  const nextMap = new Map(next.map(x => [getId(x), x]))

  const added = next.filter(x => !prevMap.has(getId(x)))
  const removed = prev.filter(x => !nextMap.has(getId(x)))
  const updated = next
    .filter(x => prevMap.has(getId(x)))
    .map(x => {
      // computeDiff is called by callers with Scanner item shapes (ProcessInfo,
      // PortInfo, WindowInfo, AITask) that are all plain objects, so they
      // structurally match Record<string, unknown>. The single cast at the
      // call site is safer than dual-as-unknown chains.
      const prevItem = prevMap.get(getId(x))!
      const prevRecord = prevItem as Record<string, unknown>
      const nextRecord = x as Record<string, unknown>
      return {
        id: getId(x),
        changes: shallowDiff(prevRecord, nextRecord) as Partial<T>
      }
    })
    .filter(x => Object.keys(x.changes).length > 0)

  const hasChanges = added.length > 0 || removed.length > 0 || updated.length > 0

  return { hasChanges, added, removed, updated }
}

// ============ Scanner Cache ============

export class ScannerCache extends EventEmitter {
  private processes: CacheEntry<ProcessInfo> = {
    data: [],
    lastUpdated: 0,
    isScanning: false,
    error: null
  }

  private ports: CacheEntry<PortInfo> = {
    data: [],
    lastUpdated: 0,
    isScanning: false,
    error: null
  }

  private windows: CacheEntry<WindowInfo> = {
    data: [],
    lastUpdated: 0,
    isScanning: false,
    error: null
  }

  private aiTasks: CacheEntry<AITask> = {
    data: [],
    lastUpdated: 0,
    isScanning: false,
    error: null
  }

  constructor() {
    super()
    this.setMaxListeners(30)
  }

  // ---- Getters ----

  getSnapshot(): ScannerCacheSnapshot {
    return {
      processes: { ...this.processes },
      ports: { ...this.ports },
      windows: { ...this.windows },
      aiTasks: { ...this.aiTasks },
      systemSummary: this.computeSummary()
    }
  }

  getProcesses(): ProcessInfo[] {
    return this.processes.data
  }

  getPorts(): PortInfo[] {
    return this.ports.data
  }

  getWindows(): WindowInfo[] {
    return this.windows.data
  }

  getAITasks(): AITask[] {
    return this.aiTasks.data
  }

  getScanStatus(): Record<ScannerType, { isScanning: boolean; lastUpdated: number; error: string | null }> {
    return {
      processes: {
        isScanning: this.processes.isScanning,
        lastUpdated: this.processes.lastUpdated,
        error: this.processes.error
      },
      ports: {
        isScanning: this.ports.isScanning,
        lastUpdated: this.ports.lastUpdated,
        error: this.ports.error
      },
      windows: {
        isScanning: this.windows.isScanning,
        lastUpdated: this.windows.lastUpdated,
        error: this.windows.error
      },
      aiTasks: {
        isScanning: this.aiTasks.isScanning,
        lastUpdated: this.aiTasks.lastUpdated,
        error: this.aiTasks.error
      }
    }
  }

  // ---- Setters (with diff) ----

  updateProcesses(data: ProcessInfo[]): ScannerDiff<ProcessInfo> {
    const diff = computeDiff(this.processes.data, data, getProcessId)
    this.processes = {
      data,
      lastUpdated: Date.now(),
      isScanning: false,
      error: null
    }
    if (diff.hasChanges) {
      this.emit('processes:updated', diff)
      this.emit('summary:updated', this.computeSummary())
    }
    return diff
  }

  updatePorts(data: PortInfo[]): ScannerDiff<PortInfo> {
    const diff = computeDiff(this.ports.data, data, getPortId)
    this.ports = {
      data,
      lastUpdated: Date.now(),
      isScanning: false,
      error: null
    }
    if (diff.hasChanges) {
      this.emit('ports:updated', diff)
      this.emit('summary:updated', this.computeSummary())
    }
    return diff
  }

  updateWindows(data: WindowInfo[]): ScannerDiff<WindowInfo> {
    const diff = computeDiff(this.windows.data, data, getWindowId)
    this.windows = {
      data,
      lastUpdated: Date.now(),
      isScanning: false,
      error: null
    }
    if (diff.hasChanges) {
      this.emit('windows:updated', diff)
      this.emit('summary:updated', this.computeSummary())
    }
    return diff
  }

  updateAITasks(data: AITask[]): ScannerDiff<AITask> {
    const diff = computeDiff(this.aiTasks.data, data, getAITaskId)
    this.aiTasks = {
      data,
      lastUpdated: Date.now(),
      isScanning: false,
      error: null
    }
    if (diff.hasChanges) {
      this.emit('aiTasks:updated', diff)
      this.emit('summary:updated', this.computeSummary())
    }
    return diff
  }

  // ---- Scanning state ----

  setScanning(type: ScannerType, isScanning: boolean): void {
    this[type].isScanning = isScanning
    this.emit('scanning:changed', { type, isScanning })
  }

  setError(type: ScannerType, error: string): void {
    this[type].error = error
    this[type].isScanning = false
    this.emit('error', { type, error })
  }

  // ---- Summary computation ----

  private computeSummary(): SystemSummary {
    const processes = this.processes.data
    const ports = this.ports.data
    const windows = this.windows.data
    const aiTasks = this.aiTasks.data

    // Count unique listening ports
    const listeningPorts = new Set(
      ports.filter(p => p.state === 'LISTENING').map(p => p.port)
    )

    const cpuTotal = processes.reduce((sum, p) => sum + p.cpu, 0)
    const totalMemory = processes.reduce((sum, p) => sum + p.memory, 0)

    return {
      processCount: processes.length,
      activePortCount: listeningPorts.size,
      windowCount: windows.length,
      aiToolCount: aiTasks.length,
      cpuTotal: Math.round(cpuTotal * 10) / 10,
      memoryUsedPercent: Math.round(totalMemory)
    }
  }

  // ---- Cleanup ----

  cleanup(): void {
    this.removeAllListeners()
    this.processes = { data: [], lastUpdated: 0, isScanning: false, error: null }
    this.ports = { data: [], lastUpdated: 0, isScanning: false, error: null }
    this.windows = { data: [], lastUpdated: 0, isScanning: false, error: null }
    this.aiTasks = { data: [], lastUpdated: 0, isScanning: false, error: null }
  }
}
