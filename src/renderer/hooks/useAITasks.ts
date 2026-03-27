import { useEffect, useCallback, useRef } from 'react'
import { useAITaskStore } from '../stores/aiTaskStore'
import { AITask, AITaskHistory } from '@shared/types-extended'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useAITasks() {
  const {
    activeTasks,
    history,
    statistics,
    selectedTaskId,
    setActiveTasks,
    updateTask,
    addToHistory,
    setHistory,
    setStatistics,
    selectTask,
    getTasksByTool,
    getActiveTaskCount
  } = useAITaskStore()

  // 使用 ref 来避免在依赖数组中包含 activeTasks
  const activeTasksRef = useRef(activeTasks)
  activeTasksRef.current = activeTasks

  const fetchActiveTasks = useCallback(async (): Promise<AITask[]> => {
    if (!isElectron) return []
    try {
      const result = await window.devhub.aiTask?.getAll?.() ?? []
      setActiveTasks(result)
      return result
    } catch (error) {
      console.warn('Failed to fetch active tasks:', error instanceof Error ? error.message : 'Unknown error')
      return []
    }
  }, [setActiveTasks])

  const fetchHistory = useCallback(async (limit?: number): Promise<AITaskHistory[]> => {
    if (!isElectron) return []
    try {
      const result = await window.devhub.aiTask?.getHistory?.(limit) ?? []
      setHistory(result)
      return result
    } catch (error) {
      console.warn('Failed to fetch history:', error instanceof Error ? error.message : 'Unknown error')
      return []
    }
  }, [setHistory])

  const fetchStatistics = useCallback(async () => {
    if (!isElectron) return null
    try {
      const result = await window.devhub.aiTask?.getStatistics?.() ?? null
      if (result) {
        setStatistics(result)
      }
      return result
    } catch (error) {
      console.warn('Failed to fetch statistics:', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }, [setStatistics])

  const getTaskById = useCallback(async (taskId: string): Promise<AITask | undefined> => {
    if (!isElectron) return undefined
    return window.devhub.aiTask?.getById?.(taskId)
  }, [])

  useEffect(() => {
    if (!isElectron) return

    const devhub = window.devhub

    const unsubStarted = devhub.aiTask?.onStarted?.((task: AITask) => {
      // 使用 ref 而不是直接引用 activeTasks，避免无限循环
      setActiveTasks([...activeTasksRef.current, task])
    })

    const unsubStatusChanged = devhub.aiTask?.onStatusChanged?.((task: AITask) => {
      updateTask(task)
    })

    const unsubCompleted = devhub.aiTask?.onCompleted?.((entry: AITaskHistory) => {
      addToHistory(entry)
    })

    return () => {
      unsubStarted?.()
      unsubStatusChanged?.()
      unsubCompleted?.()
    }
  }, [setActiveTasks, updateTask, addToHistory])

  return {
    activeTasks,
    history,
    statistics,
    selectedTaskId,
    fetchActiveTasks,
    fetchHistory,
    fetchStatistics,
    getTaskById,
    selectTask,
    getTasksByTool,
    getActiveTaskCount
  }
}
