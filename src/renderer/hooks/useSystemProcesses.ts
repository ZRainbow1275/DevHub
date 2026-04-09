import { useEffect, useCallback } from 'react'
import { useProcessStore } from '../stores/processStore'
import { ProcessInfo, ProcessGroup } from '@shared/types-extended'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useSystemProcesses() {
  const {
    processes,
    groups,
    zombies,
    isScanning,
    lastScanTime,
    selectedPid,
    setProcesses,
    setGroups,
    setZombies,
    setScanning,
    selectProcess,
    removeProcess,
    getProcessesByProject,
    getProcessByPid,
    getTotalResources
  } = useProcessStore()

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
    scan,
    getGroups,
    killProcess,
    cleanupZombies,
    selectProcess,
    getProcessesByProject,
    getProcessByPid,
    getTotalResources,
    getProcessTree
  }
}
