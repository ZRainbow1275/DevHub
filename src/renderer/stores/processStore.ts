import { create } from 'zustand'
import { ProcessInfo, ProcessGroup, SortConfig, SortColumn, ProcessStatusType, ProcessType } from '@shared/types-extended'

interface ProcessState {
  processes: ProcessInfo[]
  groups: ProcessGroup[]
  zombies: ProcessInfo[]
  isScanning: boolean
  lastScanTime: Date | null
  selectedPid: number | null

  // Sort state (multi-level, max 3)
  sortConfigs: SortConfig[]

  // Filter state
  searchQuery: string
  statusFilters: Set<ProcessStatusType>
  typeFilters: Set<ProcessType>

  // Actions
  setProcesses: (processes: ProcessInfo[]) => void
  setGroups: (groups: ProcessGroup[]) => void
  setZombies: (zombies: ProcessInfo[]) => void
  setScanning: (scanning: boolean) => void
  selectProcess: (pid: number | null) => void
  removeProcess: (pid: number) => void

  // Sort/Filter Actions
  toggleSort: (column: SortColumn, append: boolean) => void
  clearSort: () => void
  setSearchQuery: (query: string) => void
  toggleStatusFilter: (status: ProcessStatusType) => void
  toggleTypeFilter: (type: ProcessType) => void
  clearFilters: () => void

  // Computed
  getProcessesByProject: (projectId: string) => ProcessInfo[]
  getProcessByPid: (pid: number) => ProcessInfo | undefined
  getTotalResources: () => { cpu: number; memory: number }
  getFilteredAndSortedProcesses: () => ProcessInfo[]
}

// Status priority for sorting
const STATUS_PRIORITY: Record<ProcessStatusType, number> = {
  running: 3,
  idle: 2,
  waiting: 1,
  unknown: 0
}

// Type priority for sorting
const TYPE_PRIORITY: Record<ProcessType, number> = {
  'ai-tool': 5,
  'dev-server': 4,
  'build': 3,
  'database': 2,
  'other': 1
}

function compareProcesses(a: ProcessInfo, b: ProcessInfo, config: SortConfig): number {
  const { column, direction } = config
  const dir = direction === 'asc' ? 1 : -1

  switch (column) {
    case 'name':
      return dir * a.name.localeCompare(b.name)
    case 'pid':
      return dir * (a.pid - b.pid)
    case 'cpu':
      return dir * (a.cpu - b.cpu)
    case 'memory':
      return dir * (a.memory - b.memory)
    case 'port': {
      const aPort = a.port ?? Number.MAX_SAFE_INTEGER
      const bPort = b.port ?? Number.MAX_SAFE_INTEGER
      return dir * (aPort - bPort)
    }
    case 'startTime':
      return dir * (a.startTime - b.startTime)
    case 'status':
      return dir * ((STATUS_PRIORITY[a.status] || 0) - (STATUS_PRIORITY[b.status] || 0))
    case 'type':
      return dir * ((TYPE_PRIORITY[a.type] || 0) - (TYPE_PRIORITY[b.type] || 0))
    default:
      return 0
  }
}

function matchesSearch(process: ProcessInfo, query: string): boolean {
  if (!query) return true

  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true

  // Support pid:1234 exact matching
  if (trimmed.startsWith('pid:')) {
    const pidStr = trimmed.slice(4).trim()
    return process.pid.toString() === pidStr
  }

  // Fuzzy match on name, pid, port, command, workingDir
  const searchFields = [
    process.name,
    process.pid.toString(),
    process.port?.toString() || '',
    process.command || '',
    process.workingDir || ''
  ].join(' ').toLowerCase()

  return searchFields.includes(trimmed)
}

export const useProcessStore = create<ProcessState>((set, get) => ({
  processes: [],
  groups: [],
  zombies: [],
  isScanning: false,
  lastScanTime: null,
  selectedPid: null,
  sortConfigs: [{ column: 'cpu' as SortColumn, direction: 'desc' as const }],
  searchQuery: '',
  statusFilters: new Set<ProcessStatusType>(),
  typeFilters: new Set<ProcessType>(),

  setProcesses: (processes) =>
    set({
      processes,
      lastScanTime: new Date()
    }),

  setGroups: (groups) => set({ groups }),

  setZombies: (zombies) => set({ zombies }),

  setScanning: (isScanning) => set({ isScanning }),

  selectProcess: (selectedPid) => set({ selectedPid }),

  removeProcess: (pid) =>
    set((state) => ({
      processes: state.processes.filter((p) => p.pid !== pid),
      zombies: state.zombies.filter((p) => p.pid !== pid),
      selectedPid: state.selectedPid === pid ? null : state.selectedPid
    })),

  // Sort: click toggles asc/desc/clear. Shift+click appends (max 3 levels).
  toggleSort: (column, append) =>
    set((state) => {
      const existing = state.sortConfigs.findIndex(s => s.column === column)

      if (append && existing === -1) {
        // Append new sort level (max 3)
        if (state.sortConfigs.length >= 3) return state
        return { sortConfigs: [...state.sortConfigs, { column, direction: 'asc' as const }] }
      }

      if (existing !== -1) {
        const current = state.sortConfigs[existing]
        if (current.direction === 'asc') {
          // asc -> desc
          const updated = [...state.sortConfigs]
          updated[existing] = { column, direction: 'desc' as const }
          return { sortConfigs: updated }
        } else {
          // desc -> remove
          return { sortConfigs: state.sortConfigs.filter((_, i) => i !== existing) }
        }
      }

      // New sort (replace all if not appending)
      return { sortConfigs: [{ column, direction: 'asc' as const }] }
    }),

  clearSort: () => set({ sortConfigs: [] }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  toggleStatusFilter: (status) =>
    set((state) => {
      const next = new Set(state.statusFilters)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return { statusFilters: next }
    }),

  toggleTypeFilter: (type) =>
    set((state) => {
      const next = new Set(state.typeFilters)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return { typeFilters: next }
    }),

  clearFilters: () =>
    set({
      searchQuery: '',
      statusFilters: new Set<ProcessStatusType>(),
      typeFilters: new Set<ProcessType>()
    }),

  getProcessesByProject: (projectId) => {
    return get().processes.filter((p) => p.projectId === projectId)
  },

  getProcessByPid: (pid) => {
    return get().processes.find((p) => p.pid === pid)
  },

  getTotalResources: () => {
    const { processes } = get()
    return {
      cpu: processes.reduce((sum, p) => sum + p.cpu, 0),
      memory: processes.reduce((sum, p) => sum + p.memory, 0)
    }
  },

  getFilteredAndSortedProcesses: () => {
    const { processes, sortConfigs, searchQuery, statusFilters, typeFilters } = get()

    // Filter
    let filtered = processes

    if (searchQuery) {
      filtered = filtered.filter(p => matchesSearch(p, searchQuery))
    }

    if (statusFilters.size > 0) {
      filtered = filtered.filter(p => statusFilters.has(p.status))
    }

    if (typeFilters.size > 0) {
      filtered = filtered.filter(p => typeFilters.has(p.type))
    }

    // Sort (multi-level)
    if (sortConfigs.length > 0) {
      filtered = [...filtered].sort((a, b) => {
        for (const config of sortConfigs) {
          const result = compareProcesses(a, b, config)
          if (result !== 0) return result
        }
        return 0
      })
    }

    return filtered
  }
}))
