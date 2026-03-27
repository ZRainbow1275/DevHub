import { create } from 'zustand'
import { ProcessInfo, ProcessGroup } from '@shared/types-extended'

interface ProcessState {
  processes: ProcessInfo[]
  groups: ProcessGroup[]
  zombies: ProcessInfo[]
  isScanning: boolean
  lastScanTime: Date | null
  selectedPid: number | null

  // Actions
  setProcesses: (processes: ProcessInfo[]) => void
  setGroups: (groups: ProcessGroup[]) => void
  setZombies: (zombies: ProcessInfo[]) => void
  setScanning: (scanning: boolean) => void
  selectProcess: (pid: number | null) => void
  removeProcess: (pid: number) => void

  // Computed
  getProcessesByProject: (projectId: string) => ProcessInfo[]
  getProcessByPid: (pid: number) => ProcessInfo | undefined
  getTotalResources: () => { cpu: number; memory: number }
}

export const useProcessStore = create<ProcessState>((set, get) => ({
  processes: [],
  groups: [],
  zombies: [],
  isScanning: false,
  lastScanTime: null,
  selectedPid: null,

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
  }
}))
