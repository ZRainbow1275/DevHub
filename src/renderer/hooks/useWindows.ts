import { useCallback } from 'react'
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
  } = useWindowStore()

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
    saveLayout,
    restoreLayout,
    fetchLayouts,
    removeLayout,
    selectWindow,
    selectGroup,
    getWindowsByPid,
    getWindowsByProcess
  }
}
