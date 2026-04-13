import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useWindowStore } from '../stores/windowStore'
import { WindowInfo, WindowGroup, WindowLayout } from '@shared/types-extended'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useWindows() {
  const {
    windows,
    groups,
    layouts,
    isScanning,
    selectedHwnd,
    selectedGroupId,
    setWindows,
    setGroups,
    setLayouts,
    setScanning,
    selectWindow,
    selectGroup,
    addGroup,
    removeGroup: removeGroupFromStore,
    addLayout,
    removeLayout: removeLayoutFromStore,
    getWindowsByPid,
    getWindowsByProcess
  } = useWindowStore(
    useShallow(s => ({
      windows: s.windows,
      groups: s.groups,
      layouts: s.layouts,
      isScanning: s.isScanning,
      selectedHwnd: s.selectedHwnd,
      selectedGroupId: s.selectedGroupId,
      setWindows: s.setWindows,
      setGroups: s.setGroups,
      setLayouts: s.setLayouts,
      setScanning: s.setScanning,
      selectWindow: s.selectWindow,
      selectGroup: s.selectGroup,
      addGroup: s.addGroup,
      removeGroup: s.removeGroup,
      addLayout: s.addLayout,
      removeLayout: s.removeLayout,
      getWindowsByPid: s.getWindowsByPid,
      getWindowsByProcess: s.getWindowsByProcess
    }))
  )

  const scan = useCallback(async (includeSystemWindows?: boolean): Promise<WindowInfo[]> => {
    if (!isElectron) return []
    setScanning(true)
    try {
      const result = await window.devhub.windowManager?.scan?.(includeSystemWindows)
      const windowList = result?.data ?? []
      if (result && !result.success) {
        console.error('Window scan failed:', result.error)
      }
      setWindows(windowList)
      return windowList
    } finally {
      setScanning(false)
    }
  }, [setWindows, setScanning])

  const focusWindow = useCallback(async (hwnd: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.focus?.(hwnd)
    if (result && !result.success) {
      console.error('Focus window failed:', result.error)
    }
    return result?.success ?? false
  }, [])

  const focusGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.focusGroup?.(groupId)
    if (result && !result.success) {
      console.error('Focus group failed:', result.error)
    }
    return result?.success ?? false
  }, [])

  const moveWindow = useCallback(async (hwnd: number, x: number, y: number, width: number, height: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.move?.(hwnd, x, y, width, height)
    if (result && !result.success) {
      console.error('Move window failed:', result.error)
    }
    return result?.success ?? false
  }, [])

  const createGroup = useCallback(async (name: string, windowHwnds: number[], projectId?: string): Promise<WindowGroup | null> => {
    if (!isElectron) return null
    const group = await window.devhub.windowManager?.createGroup?.(name, windowHwnds, projectId) ?? null
    if (group) {
      addGroup(group)
    }
    return group
  }, [addGroup])

  const fetchGroups = useCallback(async (): Promise<WindowGroup[]> => {
    if (!isElectron) return []
    const result = await window.devhub.windowManager?.getGroups?.() ?? []
    setGroups(result)
    return result
  }, [setGroups])

  const removeGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isElectron) return false
    const success = await window.devhub.windowManager?.removeGroup?.(groupId) ?? false
    if (success) {
      removeGroupFromStore(groupId)
    }
    return success
  }, [removeGroupFromStore])

  const minimizeGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.minimizeGroup?.(groupId)
    if (result && !result.success) {
      console.error('Minimize group failed:', result.error)
    }
    return result?.success ?? false
  }, [])

  const closeGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.closeGroup?.(groupId)
    if (result && !result.success) {
      console.error('Close group failed:', result.error)
    }
    return result?.success ?? false
  }, [])

  const saveLayout = useCallback(async (name: string, description?: string): Promise<WindowLayout | null> => {
    if (!isElectron) return null
    const layout = await window.devhub.windowManager?.saveLayout?.(name, description) ?? null
    if (layout) {
      addLayout(layout)
    }
    return layout
  }, [addLayout])

  const restoreLayout = useCallback(async (layoutId: string): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.restoreLayout?.(layoutId)
    if (result && !result.success) {
      console.error('Restore layout failed:', result.error)
    }
    return result?.success ?? false
  }, [])

  const fetchLayouts = useCallback(async (): Promise<WindowLayout[]> => {
    if (!isElectron) return []
    const result = await window.devhub.windowManager?.getLayouts?.() ?? []
    setLayouts(result)
    return result
  }, [setLayouts])

  const removeLayout = useCallback(async (layoutId: string): Promise<boolean> => {
    if (!isElectron) return false
    const success = await window.devhub.windowManager?.removeLayout?.(layoutId) ?? false
    if (success) {
      removeLayoutFromStore(layoutId)
    }
    return success
  }, [removeLayoutFromStore])

  // ==================== Advanced Window Operations ====================

  const minimizeWindow = useCallback(async (hwnd: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.minimize?.(hwnd)
    return result?.success ?? false
  }, [])

  const maximizeWindow = useCallback(async (hwnd: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.maximize?.(hwnd)
    return result?.success ?? false
  }, [])

  const restoreWindow = useCallback(async (hwnd: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.restore?.(hwnd)
    return result?.success ?? false
  }, [])

  const closeWindow = useCallback(async (hwnd: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.close?.(hwnd)
    return result?.success ?? false
  }, [])

  const setWindowTopmost = useCallback(async (hwnd: number, topmost: boolean): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.setTopmost?.(hwnd, topmost)
    return result?.success ?? false
  }, [])

  const setWindowOpacity = useCallback(async (hwnd: number, opacity: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.setOpacity?.(hwnd, opacity)
    return result?.success ?? false
  }, [])

  const sendKeysToWindow = useCallback(async (hwnd: number, keys: string): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.sendKeys?.(hwnd, keys)
    return result?.success ?? false
  }, [])

  const tileWindows = useCallback(async (hwnds: number[]): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.tileLayout?.(hwnds)
    return result?.success ?? false
  }, [])

  const cascadeWindows = useCallback(async (hwnds: number[]): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.cascadeLayout?.(hwnds)
    return result?.success ?? false
  }, [])

  const stackWindows = useCallback(async (hwnds: number[]): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.stackLayout?.(hwnds)
    return result?.success ?? false
  }, [])

  const minimizeAll = useCallback(async (): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.minimizeAll?.()
    return result?.success ?? false
  }, [])

  const restoreAll = useCallback(async (): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.restoreAll?.()
    return result?.success ?? false
  }, [])

  const addToGroup = useCallback(async (groupId: string, hwnd: number): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.addToGroup?.(groupId, hwnd)
    return result?.success ?? false
  }, [])

  const restoreGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isElectron) return false
    const result = await window.devhub.windowManager?.restoreGroup?.(groupId)
    return result?.success ?? false
  }, [])

  return {
    windows,
    groups,
    layouts,
    isScanning,
    selectedHwnd,
    selectedGroupId,
    scan,
    focusWindow,
    focusGroup,
    moveWindow,
    createGroup,
    fetchGroups,
    removeGroup,
    minimizeGroup,
    closeGroup,
    saveLayout,
    restoreLayout,
    fetchLayouts,
    removeLayout,
    selectWindow,
    selectGroup,
    getWindowsByPid,
    getWindowsByProcess,
    // Advanced operations
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    closeWindow,
    setWindowTopmost,
    setWindowOpacity,
    sendKeysToWindow,
    tileWindows,
    cascadeWindows,
    stackWindows,
    minimizeAll,
    restoreAll,
    addToGroup,
    restoreGroup
  }
}
