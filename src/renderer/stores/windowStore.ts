import { create } from 'zustand'
import { WindowInfo, WindowGroup, WindowLayout } from '@shared/types-extended'

export const LAYOUT_PRESETS = {
  tile: { name: '平铺 (Tile)', description: '等分屏幕给所有窗口' },
  masterSlave: { name: '主次分区 (Master-Slave)', description: '主窗口占大面积，其余小排列' },
  cascade: { name: '层叠 (Cascade)', description: '窗口斜向层叠排列' },
} as const

interface WindowState {
  windows: WindowInfo[]
  groups: WindowGroup[]
  layouts: WindowLayout[]
  isScanning: boolean
  selectedHwnd: number | null
  selectedGroupId: string | null
  activePreset: string | null

  // Actions
  setWindows: (windows: WindowInfo[]) => void
  setGroups: (groups: WindowGroup[]) => void
  setLayouts: (layouts: WindowLayout[]) => void
  setScanning: (scanning: boolean) => void
  selectWindow: (hwnd: number | null) => void
  selectGroup: (groupId: string | null) => void
  setActivePreset: (preset: string | null) => void
  addGroup: (group: WindowGroup) => void
  removeGroup: (groupId: string) => void
  addLayout: (layout: WindowLayout) => void
  removeLayout: (layoutId: string) => void

  // Layout preset
  applyLayoutPreset: (preset: keyof typeof LAYOUT_PRESETS, hwnds: number[]) => Promise<boolean>

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
  activePreset: null,

  setWindows: (windows) => set({ windows }),

  setGroups: (groups) => set({ groups }),

  setLayouts: (layouts) => set({ layouts }),

  setScanning: (isScanning) => set({ isScanning }),

  selectWindow: (selectedHwnd) => set({ selectedHwnd }),

  selectGroup: (selectedGroupId) => set({ selectedGroupId }),

  setActivePreset: (activePreset) => set({ activePreset }),

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

  applyLayoutPreset: async (preset, hwnds) => {
    if (hwnds.length === 0) return false
    const isElectron = typeof window !== 'undefined' && window.devhub !== undefined
    if (!isElectron) return false
    try {
      let result: { success: boolean } | undefined
      switch (preset) {
        case 'tile':
          result = await window.devhub.windowManager?.tileLayout?.(hwnds)
          break
        case 'cascade':
          result = await window.devhub.windowManager?.cascadeLayout?.(hwnds)
          break
        case 'masterSlave':
          // Master-slave uses tile layout with first window as master
          result = await window.devhub.windowManager?.tileLayout?.(hwnds)
          break
      }
      if (result?.success) {
        set({ activePreset: preset })
      }
      return result?.success ?? false
    } catch (error) {
      console.warn('Failed to apply layout preset:', error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  },

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
