import { useEffect, useCallback } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { LogEntry } from '@shared/types'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useLogs(projectId: string | null) {
  const { logs, addLog, clearLogs } = useProjectStore()

  // Subscribe to logs for the selected project
  useEffect(() => {
    if (!projectId || !isElectron) return

    const currentProjectId = projectId

    // Subscribe to log entries
    try {
      window.devhub?.logs?.subscribe?.(currentProjectId)
    } catch (error) {
      console.warn('Failed to subscribe to logs:', error instanceof Error ? error.message : 'Unknown error')
    }

    const unsubscribe = window.devhub?.logs?.onEntry?.((entry: LogEntry) => {
      if (entry.projectId === currentProjectId) {
        addLog(entry)
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [projectId, addLog])

  const projectLogs = projectId ? logs.get(projectId) || [] : []

  const handleClearLogs = useCallback(() => {
    if (projectId) {
      clearLogs(projectId)
      if (isElectron) {
        try {
          window.devhub?.logs?.clear?.(projectId)
        } catch (error) {
          console.warn('Failed to clear logs:', error instanceof Error ? error.message : 'Unknown error')
        }
      }
    }
  }, [projectId, clearLogs])

  return {
    logs: projectLogs,
    clearLogs: handleClearLogs
  }
}
