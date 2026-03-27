import { useEffect, useCallback } from 'react'
import { usePortStore } from '../stores/portStore'
import { PortInfo } from '@shared/types-extended'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function usePorts() {
  const {
    ports,
    conflicts,
    isScanning,
    lastScanTime,
    selectedPort,
    setPorts,
    setScanning,
    selectPort,
    addConflict,
    resolveConflict,
    removePort,
    getPortByNumber,
    getCommonPorts,
    getActiveConflicts,
    isPortInUse
  } = usePortStore()

  const scan = useCallback(async (): Promise<PortInfo[]> => {
    if (!isElectron) return []
    setScanning(true)
    try {
      const result = await window.devhub.port?.scan?.() ?? []
      setPorts(result)
      return result
    } finally {
      setScanning(false)
    }
  }, [setPorts, setScanning])

  const scanCommon = useCallback(async (): Promise<PortInfo[]> => {
    if (!isElectron) return []
    return window.devhub.port?.scanCommon?.() ?? []
  }, [])

  const checkPort = useCallback(async (port: number): Promise<PortInfo | null> => {
    if (!isElectron) return null
    return window.devhub.port?.check?.(port) ?? null
  }, [])

  const releasePort = useCallback(async (port: number): Promise<boolean> => {
    if (!isElectron) return false
    const success = await window.devhub.port?.release?.(port) ?? false
    if (success) {
      removePort(port)
      resolveConflict(port)
    }
    return success
  }, [removePort, resolveConflict])

  const findAvailable = useCallback(async (startPort: number): Promise<number> => {
    if (!isElectron) return startPort
    return window.devhub.port?.findAvailable?.(startPort) ?? startPort
  }, [])

  const detectConflicts = useCallback(async (projectPorts: number[]): Promise<PortInfo[]> => {
    if (!isElectron) return []
    const result = await window.devhub.port?.detectConflicts?.(projectPorts) ?? []
    result.forEach((p: PortInfo) => addConflict(p.port))
    return result
  }, [addConflict])

  useEffect(() => {
    if (!isElectron) return

    const unsubConflict = window.devhub.port?.onConflict?.((data: { port: number; resolved: boolean }) => {
      if (data.resolved) {
        resolveConflict(data.port)
      } else {
        addConflict(data.port)
      }
    })

    return () => {
      unsubConflict?.()
    }
  }, [addConflict, resolveConflict])

  return {
    ports,
    conflicts,
    isScanning,
    lastScanTime,
    selectedPort,
    scan,
    scanCommon,
    checkPort,
    releasePort,
    findAvailable,
    detectConflicts,
    selectPort,
    getPortByNumber,
    getCommonPorts,
    getActiveConflicts,
    isPortInUse
  }
}
