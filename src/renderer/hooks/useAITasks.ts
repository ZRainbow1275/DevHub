import { useEffect, useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAITaskStore } from '../stores/aiTaskStore'
import { AITask, AITaskHistory, DEFAULT_AI_TOOL_CONFIGS, AIToolType } from '@shared/types-extended'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useAITasks() {
  const {
    activeTasks,
    history,
    statistics,
    selectedTaskId,
    detectionConfigs,
    setActiveTasks,
    updateTask,
    addToHistory,
    setHistory,
    setStatistics,
    selectTask,
    setDetectionConfigs,
    getTasksByTool,
    getActiveTaskCount
  } = useAITaskStore(
    useShallow(s => ({
      activeTasks: s.activeTasks,
      history: s.history,
      statistics: s.statistics,
      selectedTaskId: s.selectedTaskId,
      detectionConfigs: s.detectionConfigs,
      setActiveTasks: s.setActiveTasks,
      updateTask: s.updateTask,
      addToHistory: s.addToHistory,
      setHistory: s.setHistory,
      setStatistics: s.setStatistics,
      selectTask: s.selectTask,
      setDetectionConfigs: s.setDetectionConfigs,
      getTasksByTool: s.getTasksByTool,
      getActiveTaskCount: s.getActiveTaskCount
    }))
  )

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

  /** Fetch detection config for a tool type (uses static DEFAULT_AI_TOOL_CONFIGS, cached in store) */
  const fetchDetectionConfig = useCallback((toolType: AIToolType) => {
    // Detection configs are static from DEFAULT_AI_TOOL_CONFIGS -- no IPC needed
    if (detectionConfigs[toolType]) return detectionConfigs[toolType]
    const toolKey = toolType as Exclude<AIToolType, 'other'>
    const config = DEFAULT_AI_TOOL_CONFIGS[toolKey]
    if (config) {
      setDetectionConfigs({ ...detectionConfigs, [toolType]: config })
    }
    return config ?? null
  }, [detectionConfigs, setDetectionConfigs])

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
    detectionConfigs,
    fetchActiveTasks,
    fetchHistory,
    fetchStatistics,
    getTaskById,
    fetchDetectionConfig,
    selectTask,
    getTasksByTool,
    getActiveTaskCount
  }
}
