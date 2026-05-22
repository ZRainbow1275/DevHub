import { useCallback, useMemo, useState } from 'react'
import type { ProcessInfo } from '@shared/types-extended'
import { processHistorySchema, type ProcessHistory } from '@shared/schemas/r8-runtime'
import { processIdentityForProcess } from './useProcessTag'

export function useProcessHistory24h() {
  const [histories, setHistories] = useState<Map<string, ProcessHistory>>(new Map())

  const loadHistory = useCallback(async (process: Pick<ProcessInfo, 'name' | 'workingDir'>): Promise<ProcessHistory> => {
    const response = await window.devhub.systemProcess.getProcessHistory24h({
      exe: process.name,
      cwd: process.workingDir,
    })
    const identity = processIdentityForProcess(process)
    const parsed = processHistorySchema.safeParse(response)
    const history: ProcessHistory = parsed.success
      ? parsed.data
      : {
          key: identity,
          exe: process.name,
          cwd: process.workingDir,
          windowMs: 86_400_000,
          points: [],
        }
    setHistories(current => {
      const next = new Map(current)
      next.set(identity, history)
      return next
    })
    return history
  }, [])

  const loadHistories = useCallback(async (processes: Array<Pick<ProcessInfo, 'name' | 'workingDir'>>) => {
    const loaded = await Promise.allSettled(processes.map(process => loadHistory(process)))
    return loaded.filter((result): result is PromiseFulfilledResult<ProcessHistory> => result.status === 'fulfilled').map(result => result.value)
  }, [loadHistory])

  const getHistory = useCallback((process: Pick<ProcessInfo, 'name' | 'workingDir'>): ProcessHistory | undefined => {
    return histories.get(processIdentityForProcess(process))
  }, [histories])

  const knownKeys = useMemo(() => new Set(histories.keys()), [histories])

  return { getHistory, loadHistory, loadHistories, knownKeys }
}
