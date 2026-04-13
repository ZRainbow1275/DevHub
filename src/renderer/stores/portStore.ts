import { create } from 'zustand'
import { PortInfo, PortFocusData, COMMON_DEV_PORTS } from '@shared/types-extended'

interface PortConflict {
  port: number
  resolved: boolean
  timestamp: Date
}

interface PortState {
  ports: PortInfo[]
  conflicts: PortConflict[]
  isScanning: boolean
  lastScanTime: Date | null
  selectedPort: number | null

  // Actions
  setPorts: (ports: PortInfo[]) => void
  setScanning: (scanning: boolean) => void
  selectPort: (port: number | null) => void
  addConflict: (port: number) => void
  resolveConflict: (port: number) => void
  removePort: (port: number) => void

  // Port detail cache (port number -> PortFocusData)
  portDetails: Map<number, PortFocusData>
  updatePortDetail: (port: number, detail: PortFocusData) => void

  // Computed
  getPortByNumber: (port: number) => PortInfo | undefined
  getCommonPorts: () => PortInfo[]
  getActiveConflicts: () => PortConflict[]
  isPortInUse: (port: number) => boolean
}

export const usePortStore = create<PortState>((set, get) => ({
  ports: [],
  conflicts: [],
  isScanning: false,
  lastScanTime: null,
  selectedPort: null,
  portDetails: new Map(),

  setPorts: (ports) =>
    set({
      ports,
      lastScanTime: new Date()
    }),

  setScanning: (isScanning) => set({ isScanning }),

  selectPort: (selectedPort) => set({ selectedPort }),

  addConflict: (port) =>
    set((state) => ({
      conflicts: [
        ...state.conflicts.filter((c) => c.port !== port),
        { port, resolved: false, timestamp: new Date() }
      ]
    })),

  resolveConflict: (port) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.port === port ? { ...c, resolved: true } : c
      )
    })),

  removePort: (port) =>
    set((state) => ({
      ports: state.ports.filter((p) => p.port !== port),
      selectedPort: state.selectedPort === port ? null : state.selectedPort
    })),

  updatePortDetail: (port, detail) =>
    set((state) => {
      const next = new Map(state.portDetails)
      next.set(port, detail)
      return { portDetails: next }
    }),

  getPortByNumber: (port) => {
    return get().ports.find((p) => p.port === port)
  },

  getCommonPorts: () => {
    return get().ports.filter((p) =>
      COMMON_DEV_PORTS.includes(p.port as typeof COMMON_DEV_PORTS[number])
    )
  },

  getActiveConflicts: () => {
    return get().conflicts.filter((c) => !c.resolved)
  },

  isPortInUse: (port) => {
    return get().ports.some((p) => p.port === port)
  }
}))
