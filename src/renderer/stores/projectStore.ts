import { create } from 'zustand'
import { Project, LogEntry } from '@shared/types'

interface ProjectState {
  projects: Project[]
  selectedProjectId: string | null
  logs: Map<string, LogEntry[]>
  filter: {
    tag: string | null
    group: string | null
    search: string
  }

  // Actions
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  removeProject: (id: string) => void
  selectProject: (id: string | null) => void

  // Logs
  addLog: (entry: LogEntry) => void
  clearLogs: (projectId: string) => void

  // Filter
  setTagFilter: (tag: string | null) => void
  setGroupFilter: (group: string | null) => void
  setSearchFilter: (search: string) => void

  // Computed
  getFilteredProjects: () => Project[]
}

const MAX_LOGS_PER_PROJECT = 5000

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  logs: new Map(),
  filter: {
    tag: null,
    group: null,
    search: ''
  },

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project]
    })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      )
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProjectId:
        state.selectedProjectId === id ? null : state.selectedProjectId
    })),

  selectProject: (id) => set({ selectedProjectId: id }),

  addLog: (entry) =>
    set((state) => {
      const logs = state.logs
      const projectLogs = logs.get(entry.projectId) || []

      // 原地修改数组避免整个数组复制
      if (projectLogs.length >= MAX_LOGS_PER_PROJECT) {
        projectLogs.shift()
      }
      projectLogs.push(entry)
      logs.set(entry.projectId, projectLogs)

      // 仍需创建新 Map 引用以触发 React 重渲染
      return { logs: new Map(logs) }
    }),

  clearLogs: (projectId) =>
    set((state) => {
      const logs = new Map(state.logs)
      logs.delete(projectId)
      return { logs }
    }),

  setTagFilter: (tag) =>
    set((state) => ({
      filter: { ...state.filter, tag }
    })),

  setGroupFilter: (group) =>
    set((state) => ({
      filter: { ...state.filter, group }
    })),

  setSearchFilter: (search) =>
    set((state) => ({
      filter: { ...state.filter, search }
    })),

  getFilteredProjects: () => {
    const { projects, filter } = get()

    return projects.filter((project) => {
      // Tag filter
      if (filter.tag && !project.tags.includes(filter.tag)) {
        return false
      }

      // Group filter
      if (filter.group && project.group !== filter.group) {
        return false
      }

      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        const nameMatch = project.name.toLowerCase().includes(searchLower)
        const pathMatch = project.path.toLowerCase().includes(searchLower)
        if (!nameMatch && !pathMatch) {
          return false
        }
      }

      return true
    })
  }
}))
