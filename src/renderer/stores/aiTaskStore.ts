import { create } from 'zustand'
import { AITask, AITaskHistory, AIToolType } from '@shared/types-extended'

interface AITaskStatistics {
  totalTasks: number
  completedTasks: number
  errorTasks: number
  avgDuration: number
  byTool: Record<AIToolType, number>
}

interface AITaskState {
  activeTasks: AITask[]
  history: AITaskHistory[]
  statistics: AITaskStatistics | null
  selectedTaskId: string | null

  // Actions
  setActiveTasks: (tasks: AITask[]) => void
  updateTask: (task: AITask) => void
  addToHistory: (entry: AITaskHistory) => void
  setHistory: (history: AITaskHistory[]) => void
  setStatistics: (stats: AITaskStatistics) => void
  selectTask: (taskId: string | null) => void

  // Computed
  getTasksByTool: (toolType: AIToolType) => AITask[]
  getActiveTaskCount: () => number
}

export const useAITaskStore = create<AITaskState>((set, get) => ({
  activeTasks: [],
  history: [],
  statistics: null,
  selectedTaskId: null,

  setActiveTasks: (activeTasks) => set({ activeTasks }),

  updateTask: (updatedTask) =>
    set((state) => ({
      activeTasks: state.activeTasks.map((t) =>
        t.id === updatedTask.id ? updatedTask : t
      )
    })),

  addToHistory: (entry) =>
    set((state) => ({
      history: [entry, ...state.history],
      activeTasks: state.activeTasks.filter((t) => t.id !== entry.id)
    })),

  setHistory: (history) => set({ history }),

  setStatistics: (statistics) => set({ statistics }),

  selectTask: (selectedTaskId) => set({ selectedTaskId }),

  getTasksByTool: (toolType) => {
    return get().activeTasks.filter((t) => t.toolType === toolType)
  },

  getActiveTaskCount: () => {
    return get().activeTasks.filter((t) =>
      ['running', 'waiting'].includes(t.status.state)
    ).length
  }
}))
