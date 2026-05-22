import { useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useProcessStore } from '../stores/processStore'
import { ProcessInfo, ProcessGroup, ProcessRelationship, ProcessDeepDetail, NetworkConnectionInfo, LoadedModuleInfo, AccessReport } from '@shared/types-extended'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useSystemProcesses() {
  const {
    processes,
    groups,
    zombies,
    isScanning,
    lastScanTime,
    selectedPid,
    sortConfigs,
    searchQuery,
    statusFilters,
    typeFilters,
    setProcesses,
    setGroups,
    setZombies,
    setScanning,
    selectProcess,
    removeProcess,
    toggleSort,
    clearSort,
    setSearchQuery,
    toggleStatusFilter,
    toggleTypeFilter,
    clearFilters,
    getProcessesByProject,
    getProcessByPid,
    getTotalResources,
    getFilteredAndSortedProcesses
  } = useProcessStore(
    useShallow(s => ({
      processes: s.processes,
      groups: s.groups,
      zombies: s.zombies,
      isScanning: s.isScanning,
      lastScanTime: s.lastScanTime,
      selectedPid: s.selectedPid,
      sortConfigs: s.sortConfigs,
      searchQuery: s.searchQuery,
      statusFilters: s.statusFilters,
      typeFilters: s.typeFilters,
      setProcesses: s.setProcesses,
      setGroups: s.setGroups,
      setZombies: s.setZombies,
      setScanning: s.setScanning,
      selectProcess: s.selectProcess,
      removeProcess: s.removeProcess,
      toggleSort: s.toggleSort,
      clearSort: s.clearSort,
      setSearchQuery: s.setSearchQuery,
      toggleStatusFilter: s.toggleStatusFilter,
      toggleTypeFilter: s.toggleTypeFilter,
      clearFilters: s.clearFilters,
      getProcessesByProject: s.getProcessesByProject,
      getProcessByPid: s.getProcessByPid,
      getTotalResources: s.getTotalResources,
      getFilteredAndSortedProcesses: s.getFilteredAndSortedProcesses
    }))
  )

  const scan = useCallback(async (): Promise<ProcessInfo[]> => {
    if (!isElectron) return []
    setScanning(true)
    try {
      const result = await window.devhub.systemProcess?.scan?.()
      const processes = result?.data ?? []
      if (result && !result.success) {
        console.error('Process scan failed:', result.error)
      }
      setProcesses(processes)
      return processes
    } finally {
      setScanning(false)
    }
  }, [setProcesses, setScanning])

  const getGroups = useCallback(async (): Promise<ProcessGroup[]> => {
    if (!isElectron) return []
    const result = await window.devhub.systemProcess?.getGroups?.() ?? []
    setGroups(result)
    return result
  }, [setGroups])

  const killProcess = useCallback(async (pid: number): Promise<boolean> => {
    if (!isElectron) return false
    const success = await window.devhub.systemProcess?.kill?.(pid) ?? false
    if (success) {
      removeProcess(pid)
    }
    return success
  }, [removeProcess])

  const cleanupZombies = useCallback(async (): Promise<number> => {
    if (!isElectron) return 0
    const cleaned = await window.devhub.systemProcess?.cleanupZombies?.() ?? 0
    if (cleaned > 0) {
      await scan()
    }
    return cleaned
  }, [scan])

  const getProcessTree = useCallback(async (pid: number): Promise<ProcessInfo[]> => {
    if (!isElectron) return []
    return window.devhub.systemProcess?.getProcessTree?.(pid) ?? []
  }, [])

  const getFullRelationship = useCallback(async (pid: number): Promise<ProcessRelationship | null> => {
    if (!isElectron) return null
    return window.devhub.systemProcess?.getFullRelationship?.(pid) ?? null
  }, [])

  const getProcessHistory = useCallback(async (pid: number): Promise<{ cpuHistory: number[]; memoryHistory: number[] }> => {
    if (!isElectron) return { cpuHistory: [], memoryHistory: [] }
    return window.devhub.systemProcess?.getProcessHistory?.(pid) ?? { cpuHistory: [], memoryHistory: [] }
  }, [])

  const getBasicInfo = useCallback(async (pid: number): Promise<ProcessInfo | null> => {
    if (!isElectron) return null
    return window.devhub.systemProcess?.getBasicInfo?.(pid) ?? null
  }, [])

  const getDeepDetail = useCallback(async (pid: number): Promise<ProcessDeepDetail | null> => {
    if (!isElectron) return null
    return window.devhub.systemProcess?.getDeepDetail?.(pid) ?? null
  }, [])

  const probeAccess = useCallback(async (pid: number): Promise<AccessReport> => {
    if (!isElectron) {
      return {
        pid,
        elevationRequired: false,
        scanAttempted: false,
        scanResult: 'wmi-error',
        currentUser: 'browser',
        suggestion: 'retry',
        triedAt: Date.now()
      }
    }

    return window.devhub.systemProcess?.probeAccess?.(pid) ?? {
      pid,
      elevationRequired: false,
      scanAttempted: false,
      scanResult: 'wmi-error',
      currentUser: 'unknown',
      suggestion: 'retry',
      triedAt: Date.now()
    }
  }, [])

  const getConnections = useCallback(async (pid: number): Promise<NetworkConnectionInfo[]> => {
    if (!isElectron) return []
    return window.devhub.systemProcess?.getConnections?.(pid) ?? []
  }, [])

  const getEnvironment = useCallback(async (pid: number): Promise<{ variables: Record<string, string>; requiresElevation: boolean }> => {
    if (!isElectron) return { variables: {}, requiresElevation: false }
    return window.devhub.systemProcess?.getEnvironment?.(pid) ?? { variables: {}, requiresElevation: false }
  }, [])

  const killProcessTree = useCallback(async (pid: number): Promise<boolean> => {
    if (!isElectron) return false
    const success = await window.devhub.systemProcess?.killTree?.(pid) ?? false
    if (success) {
      removeProcess(pid)
    }
    return success
  }, [removeProcess])

  const setProcessPriority = useCallback(async (pid: number, priority: string): Promise<boolean> => {
    if (!isElectron) return false
    return window.devhub.systemProcess?.setPriority?.(pid, priority) ?? false
  }, [])

  const openFileLocation = useCallback(async (filePath: string): Promise<void> => {
    if (!isElectron) return
    await window.devhub.systemProcess?.openFileLocation?.(filePath)
  }, [])

  const getModules = useCallback(async (pid: number): Promise<{ modules: LoadedModuleInfo[]; requiresElevation: boolean }> => {
    if (!isElectron) return { modules: [], requiresElevation: false }
    return window.devhub.systemProcess?.getModules?.(pid) ?? { modules: [], requiresElevation: false }
  }, [])

  const relaunchAsAdmin = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!isElectron) {
      return { ok: false, reason: 'not-electron' }
    }

    return window.devhub.systemProcess?.relaunchAsAdmin?.() ?? { ok: false, reason: 'unavailable' }
  }, [])

  useEffect(() => {
    if (!isElectron) return

    const unsubUpdated = window.devhub.systemProcess?.onUpdated?.((procs: ProcessInfo[]) => {
      setProcesses(procs)
    })

    const unsubZombies = window.devhub.systemProcess?.onZombieDetected?.((zs: ProcessInfo[]) => {
      setZombies(zs)
    })

    return () => {
      unsubUpdated?.()
      unsubZombies?.()
    }
  }, [setProcesses, setZombies])

  return {
    processes,
    groups,
    zombies,
    isScanning,
    lastScanTime,
    selectedPid,
    sortConfigs,
    searchQuery,
    statusFilters,
    typeFilters,
    scan,
    getGroups,
    killProcess,
    cleanupZombies,
    selectProcess,
    getProcessesByProject,
    getProcessByPid,
    getTotalResources,
    getProcessTree,
    getFullRelationship,
    getProcessHistory,
    getBasicInfo,
    getDeepDetail,
    probeAccess,
    getConnections,
    getEnvironment,
    killProcessTree,
    setProcessPriority,
    openFileLocation,
    getModules,
    relaunchAsAdmin,
    toggleSort,
    clearSort,
    setSearchQuery,
    toggleStatusFilter,
    toggleTypeFilter,
    clearFilters,
    getFilteredAndSortedProcesses
  }
}
