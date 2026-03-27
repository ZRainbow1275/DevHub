import { create } from 'zustand'
import { WindowInfo, WindowGroup, WindowLayout } from '@shared/types-extended'

interface WindowState {
  windows: WindowInfo[]
  groups: WindowGroup[]
  layouts: WindowLayout[]
  isScanning: boolean
  selectedHwnd: number | null
  selectedGroupId: string | null

  // Actions
  setWindows: (windows: WindowInfo[]) => void
  setGroups: (groups: WindowGroup[]) => void
  setLayouts: (layouts: WindowLayout[]) => void
  setScanning: (scanning: boolean) => void
  selectWindow: (hwnd: number | null) => void
  selectGroup: (groupId: string | null) => void
  addGroup: (group: WindowGroup) => void
  removeGroup: (groupId: string) => void
  addLayout: (layout: WindowLayout) => void
  removeLayout: (layoutId: string) => void

  // Computed
  getWindowsByPid: (pid: number) => WindowInfo[]
  getWindowsByProcess: (processName: string) => WindowInfo[]
}

export const useWindowStore = create<WindowState>((set, get) => ({
  windows: [],
  groups: [],
  layouts: [],
  isScanning: false,
  selectedHwnd: null,
  selectedGroupId: null,

  setWindows: (windows) => set({ windows }),

  setGroups: (groups) => set({ groups }),

  setLayouts: (layouts) => set({ layouts }),

  setScanning: (isScanning) => set({ isScanning }),

  selectWindow: (selectedHwnd) => set({ selectedHwnd }),

  selectGroup: (selectedGroupId) => set({ selectedGroupId }),

  addGroup: (group) =>
    set((state) => ({
      groups: [...state.groups, group]
    })),

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      selectedGroupId: state.selectedGroupId === groupId ? null : state.selectedGroupId
    })),

  addLayout: (layout) =>
    set((state) => ({
      layouts: [...state.layouts, layout]
    })),

  removeLayout: (layoutId) =>
    set((state) => ({
      layouts: state.layouts.filter((l) => l.id !== layoutId)
    })),

  getWindowsByPid: (pid) => {
    return get().windows.filter((w) => w.pid === pid)
  },

  getWindowsByProcess: (processName) => {
    const lowerName = processName.toLowerCase()
    return get().windows.filter((w) =>
      w.processName.toLowerCase().includes(lowerName)
    )
  }
}))
