import { useCallback, useEffect, useState } from 'react'
import type { BlocklistEntry } from '@shared/schemas/r8-runtime'
import { buildDefaultBlocklistEntries } from '@shared/port-security'

interface UseBlocklistState {
  entries: BlocklistEntry[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
  addEntry: (input: { port?: number; ip?: string; reason?: string; confirmedBy?: string }) => Promise<BlocklistEntry>
  removeEntry: (input: { id?: string; port?: number; ip?: string; confirmedBy?: string }) => Promise<void>
  resetDefaults: (confirmedBy?: string) => Promise<void>
}

function portSecurityApi() {
  return window.devhub?.r8?.portSecurity
}

export function useBlocklist(autoLoad = true): UseBlocklistState {
  const [entries, setEntries] = useState<BlocklistEntry[]>([])
  const [isLoading, setIsLoading] = useState(autoLoad)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const api = portSecurityApi()
      if (!api?.listBlocklist) {
        setEntries(buildDefaultBlocklistEntries())
        return
      }
      setEntries(await api.listBlocklist())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addEntry = useCallback(async (input: { port?: number; ip?: string; reason?: string; confirmedBy?: string }) => {
    const api = portSecurityApi()
    if (!api?.addBlocklist) throw new Error('E_UNAVAILABLE:port blocklist bridge is not available')
    const entry = await api.addBlocklist(input)
    await reload()
    return entry
  }, [reload])

  const removeEntry = useCallback(async (input: { id?: string; port?: number; ip?: string; confirmedBy?: string }) => {
    const api = portSecurityApi()
    if (!api?.removeBlocklist) throw new Error('E_UNAVAILABLE:port blocklist bridge is not available')
    await api.removeBlocklist(input)
    await reload()
  }, [reload])

  const resetDefaults = useCallback(async (confirmedBy?: string) => {
    const api = portSecurityApi()
    if (!api?.resetBlocklist) throw new Error('E_UNAVAILABLE:port blocklist bridge is not available')
    await api.resetBlocklist(confirmedBy)
    await reload()
  }, [reload])

  useEffect(() => {
    if (autoLoad) void reload()
  }, [autoLoad, reload])

  return { entries, isLoading, error, reload, addEntry, removeEntry, resetDefaults }
}
