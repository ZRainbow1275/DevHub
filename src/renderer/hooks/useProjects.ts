import { useEffect, useCallback, useRef, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectStore } from '../stores/projectStore'
import { Project } from '@shared/types'

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function useProjects() {
  const {
    projects,
    selectedProjectId,
    setProjects,
    addProject,
    updateProject,
    removeProject,
    selectProject
  } = useProjectStore(
    useShallow(s => ({
      projects: s.projects,
      selectedProjectId: s.selectedProjectId,
      setProjects: s.setProjects,
      addProject: s.addProject,
      updateProject: s.updateProject,
      removeProject: s.removeProject,
      selectProject: s.selectProject
    }))
  )

  const filter = useProjectStore((s) => s.filter)

  // 追踪正在进行的操作，防止竞态条件
  const pendingOperations = useRef<Set<string>>(new Set())

  // Load projects on mount
  useEffect(() => {
    if (isElectron) {
      window.devhub?.projects?.list()
        ?.then(setProjects)
        ?.catch((error: Error) => {
          console.warn('Failed to load projects:', error.message)
        })
    }
  }, [setProjects])

  // Subscribe to status changes
  useEffect(() => {
    if (!isElectron) return

    const unsubscribe = window.devhub?.process?.onStatusChange?.(({ projectId, status }) => {
      updateProject(projectId, { status: status as Project['status'] })
    })

    return () => { unsubscribe?.() }
  }, [updateProject])

  // Subscribe to watcher events (auto-detected project changes)
  useEffect(() => {
    if (!isElectron) return

    // 防御性检查：watcher 对象可能在运行时不存在
    const watcher = window.devhub?.projects?.watcher
    if (!watcher?.onDetected) return

    const unsubscribe = watcher.onDetected((events) => {
      // Refresh the full project list when watcher detects changes
      // This is simpler and safer than trying to incrementally update
      window.devhub?.projects?.list()
        .then(setProjects)
        .catch((error: Error) => {
          console.warn('Failed to refresh projects after watcher event:', error.message)
        })

      // Log for debugging (use console.warn since info is restricted)
      if (events.length > 0) {
        console.warn(`[ProjectWatcher] Detected ${events.length} change(s), refreshing project list`)
      }
    })

    return unsubscribe
  }, [setProjects])

  const handleAddProject = useCallback(async (path: string) => {
    if (!isElectron) return null
    const project = await window.devhub.projects.add(path)
    addProject(project)
    return project
  }, [addProject])

  const handleRemoveProject = useCallback(async (id: string) => {
    if (!isElectron) return
    await window.devhub.projects.remove(id)
    removeProject(id)
  }, [removeProject])

  const handleUpdateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    if (!isElectron) return null
    const updated = await window.devhub.projects.update(id, updates)
    if (updated) {
      updateProject(id, updates)
    }
    return updated
  }, [updateProject])

  const handleStartProject = useCallback(async (id: string, script: string) => {
    if (!isElectron) return

    // 防止重复操作
    if (pendingOperations.current.has(id)) {
      console.warn(`Operation already in progress for project: ${id}`)
      return
    }

    pendingOperations.current.add(id)
    updateProject(id, { status: 'running' })

    try {
      await window.devhub.process.start(id, script)
    } catch (error) {
      updateProject(id, { status: 'error' })
      throw error
    } finally {
      pendingOperations.current.delete(id)
    }
  }, [updateProject])

  const handleStopProject = useCallback(async (id: string) => {
    if (!isElectron) return

    // 防止重复操作
    if (pendingOperations.current.has(id)) {
      console.warn(`Operation already in progress for project: ${id}`)
      return
    }

    pendingOperations.current.add(id)

    try {
      await window.devhub.process.stop(id)
      updateProject(id, { status: 'stopped' })
    } finally {
      pendingOperations.current.delete(id)
    }
  }, [updateProject])

  // 批量启动分组内的所有项目
  const handleStartGroup = useCallback(async (group: string) => {
    if (!isElectron) return

    const currentProjects = useProjectStore.getState().projects
    const groupProjects = currentProjects.filter(
      p => p.group === group && p.status !== 'running'
    )

    const results = await Promise.allSettled(
      groupProjects.map(p => {
        const script = p.defaultScript || p.scripts[0]
        if (script) {
          return window.devhub.process.start(p.id, script).then(() => {
            updateProject(p.id, { status: 'running' })
          })
        }
        return Promise.resolve()
      })
    )

    return results
  }, [updateProject])

  // 批量停止分组内的所有项目
  const handleStopGroup = useCallback(async (group: string) => {
    if (!isElectron) return

    const currentProjects = useProjectStore.getState().projects
    const groupProjects = currentProjects.filter(
      p => p.group === group && p.status === 'running'
    )

    const results = await Promise.allSettled(
      groupProjects.map(p =>
        window.devhub.process.stop(p.id).then(() => {
          updateProject(p.id, { status: 'stopped' })
        })
      )
    )

    return results
  }, [updateProject])

  // 批量启动标签内的所有项目
  const handleStartByTag = useCallback(async (tag: string) => {
    if (!isElectron) return

    const currentProjects = useProjectStore.getState().projects
    const tagProjects = currentProjects.filter(
      p => p.tags.includes(tag) && p.status !== 'running'
    )

    const results = await Promise.allSettled(
      tagProjects.map(p => {
        const script = p.defaultScript || p.scripts[0]
        if (script) {
          return window.devhub.process.start(p.id, script).then(() => {
            updateProject(p.id, { status: 'running' })
          })
        }
        return Promise.resolve()
      })
    )

    return results
  }, [updateProject])

  // 批量停止标签内的所有项目
  const handleStopByTag = useCallback(async (tag: string) => {
    if (!isElectron) return

    const currentProjects = useProjectStore.getState().projects
    const tagProjects = currentProjects.filter(
      p => p.tags.includes(tag) && p.status === 'running'
    )

    const results = await Promise.allSettled(
      tagProjects.map(p =>
        window.devhub.process.stop(p.id).then(() => {
          updateProject(p.id, { status: 'stopped' })
        })
      )
    )

    return results
  }, [updateProject])

  // 获取分组/标签的运行状态统计
  const getGroupStats = useCallback((group: string) => {
    const groupProjects = projects.filter(p => p.group === group)
    const running = groupProjects.filter(p => p.status === 'running').length
    return { total: groupProjects.length, running }
  }, [projects])

  const getTagStats = useCallback((tag: string) => {
    const tagProjects = projects.filter(p => p.tags.includes(tag))
    const running = tagProjects.filter(p => p.status === 'running').length
    return { total: tagProjects.length, running }
  }, [projects])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (filter.tag && !project.tags.includes(filter.tag)) return false
      if (filter.group && project.group !== filter.group) return false
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        if (!project.name.toLowerCase().includes(searchLower) && !project.path.toLowerCase().includes(searchLower)) {
          return false
        }
      }
      return true
    })
  }, [projects, filter])

  return {
    projects,
    filteredProjects,
    selectedProject,
    selectedProjectId,
    selectProject,
    addProject: handleAddProject,
    removeProject: handleRemoveProject,
    updateProject: handleUpdateProject,
    startProject: handleStartProject,
    stopProject: handleStopProject,
    startGroup: handleStartGroup,
    stopGroup: handleStopGroup,
    startByTag: handleStartByTag,
    stopByTag: handleStopByTag,
    getGroupStats,
    getTagStats
  }
}
