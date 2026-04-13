import { useEffect, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePortStore } from '../stores/portStore'
import { PortInfo, PortTopologyData, PortFocusData, PortDetailIncrementalResult } from '@shared/types-extended'

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
  } = usePortStore(
    useShallow(s => ({
      ports: s.ports,
      conflicts: s.conflicts,
      isScanning: s.isScanning,
      lastScanTime: s.lastScanTime,
      selectedPort: s.selectedPort,
      setPorts: s.setPorts,
      setScanning: s.setScanning,
      selectPort: s.selectPort,
      addConflict: s.addConflict,
      resolveConflict: s.resolveConflict,
      removePort: s.removePort,
      getPortByNumber: s.getPortByNumber,
      getCommonPorts: s.getCommonPorts,
      getActiveConflicts: s.getActiveConflicts,
      isPortInUse: s.isPortInUse
    }))
  )

  const updatePortDetail = usePortStore((s) => s.updatePortDetail)

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

  const getTopology = useCallback(async (): Promise<PortTopologyData> => {
    if (!isElectron) return { nodes: [], edges: [] }
    return window.devhub.port?.getTopology?.() ?? { nodes: [], edges: [] }
  }, [])

  const getPortFocusData = useCallback(async (port: number): Promise<PortFocusData | null> => {
    if (!isElectron) return null
    return window.devhub.port?.getPortFocusData?.(port) ?? null
  }, [])

  // Track the last queried port for cancellation
  const lastQueriedPortRef = useRef<number | null>(null)

  const getPortDetailIncremental = useCallback(async (port: number): Promise<PortDetailIncrementalResult> => {
    if (!isElectron) return { data: null, source: 'cache', isStale: true }

    // Cancel previous query if different port
    const prevPort = lastQueriedPortRef.current
    if (prevPort !== null && prevPort !== port) {
      window.devhub.port?.cancelPortQuery?.(prevPort)
    }
    lastQueriedPortRef.current = port

    try {
      const result = await window.devhub.port?.getPortDetailIncremental?.(port) ?? { data: null, source: 'cache', isStale: true }
      if (result.data) {
        updatePortDetail(port, result.data)
      }
      return result
    } catch {
      return { data: null, source: 'cache', isStale: true }
    }
  }, [updatePortDetail])

  const cancelPortQuery = useCallback(async (port: number): Promise<boolean> => {
    if (!isElectron) return false
    return window.devhub.port?.cancelPortQuery?.(port) ?? false
  }, [])

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
    isPortInUse,
    getTopology,
    getPortFocusData,
    getPortDetailIncremental,
    cancelPortQuery
  }
}
