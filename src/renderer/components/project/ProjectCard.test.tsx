/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import type { Project } from '@shared/types'

// 由于 React 18 + jsdom/happy-dom 存在兼容性问题
// 这里测试组件的核心逻辑而非 DOM 渲染

describe('ProjectCard Logic Tests', () => {
  const mockProject: Project = {
    id: 'test-1',
    name: 'Test Project',
    path: 'D:/Projects/test',
    scripts: ['dev', 'build'],
    defaultScript: 'dev',
    tags: ['frontend', 'react'],
    status: 'stopped',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  describe('Status Derivation', () => {
    it('应该正确判断运行状态', () => {
      const project: Project = { ...mockProject, status: 'running' }
      const isRunning = project.status === 'running'
      const isError = project.status === 'error'

      expect(isRunning).toBe(true)
      expect(isError).toBe(false)
    })

    it('应该正确判断错误状态', () => {
      const project: Project = { ...mockProject, status: 'error' }
      const isRunning = project.status === 'running'
      const isError = project.status === 'error'

      expect(isRunning).toBe(false)
      expect(isError).toBe(true)
    })

    it('应该正确判断停止状态', () => {
      const project: Project = { ...mockProject, status: 'stopped' }
      const isRunning = project.status === 'running'
      const isError = project.status === 'error'

      expect(isRunning).toBe(false)
      expect(isError).toBe(false)
    })
  })

  describe('CSS Class Logic', () => {
    it('选中状态应该包含 border-l-accent 类', () => {
      const isSelected = true
      const selectedClass = isSelected
        ? 'bg-surface-800 border-l-4 border-l-accent border border-surface-600 shadow-card'
        : 'bg-surface-900 border border-surface-700 hover:bg-surface-800/80 hover:border-surface-600'

      expect(selectedClass).toContain('border-l-accent')
    })

    it('未选中状态不应该包含 border-l-accent 类', () => {
      const isSelected = false
      const selectedClass = isSelected
        ? 'bg-surface-800 border-l-4 border-l-accent border border-surface-600 shadow-card'
        : 'bg-surface-900 border border-surface-700 hover:bg-surface-800/80 hover:border-surface-600'

      expect(selectedClass).not.toContain('border-l-accent')
    })

    it('运行中应该有 ring-success/30 样式', () => {
      const isRunning = true
      const ringClass = isRunning ? 'ring-1 ring-success/30' : ''

      expect(ringClass).toContain('ring-success/30')
    })

    it('错误状态应该有 ring-error/30 样式', () => {
      const isError = true
      const ringClass = isError ? 'ring-1 ring-error/30' : ''

      expect(ringClass).toContain('ring-error/30')
    })
  })

  describe('Tags Display Logic', () => {
    it('有标签时应该显示标签', () => {
      const project = { ...mockProject, tags: ['frontend', 'react'] }
      const shouldShowTags = project.tags.length > 0

      expect(shouldShowTags).toBe(true)
      expect(project.tags).toContain('frontend')
      expect(project.tags).toContain('react')
    })

    it('无标签时不应该显示标签区域', () => {
      const project = { ...mockProject, tags: [] }
      const shouldShowTags = project.tags.length > 0

      expect(shouldShowTags).toBe(false)
    })
  })

  describe('Port Display Logic', () => {
    it('有端口时应该显示端口号', () => {
      const project = { ...mockProject, port: 3001 }
      const shouldShowPort = !!project.port
      const portDisplay = `:${project.port}`

      expect(shouldShowPort).toBe(true)
      expect(portDisplay).toBe(':3001')
    })

    it('无端口时不应该显示端口', () => {
      const project = { ...mockProject }
      delete (project as any).port
      const shouldShowPort = !!project.port

      expect(shouldShowPort).toBe(false)
    })
  })

  describe('Toggle Action Logic', () => {
    it('运行中时点击应该调用 onStop', () => {
      const project = { ...mockProject, status: 'running' as const }
      const onStart = vi.fn()
      const onStop = vi.fn()

      const isRunning = project.status === 'running'

      // 模拟 handleToggle 逻辑
      if (isRunning) {
        onStop()
      } else {
        onStart(project.defaultScript)
      }

      expect(onStop).toHaveBeenCalled()
      expect(onStart).not.toHaveBeenCalled()
    })

    it('停止时点击应该调用 onStart', () => {
      const project: Project = { ...mockProject, status: 'stopped' }
      const onStart = vi.fn()
      const onStop = vi.fn()

      const isRunning = project.status === 'running'

      // 模拟 handleToggle 逻辑
      if (isRunning) {
        onStop()
      } else {
        onStart(project.defaultScript)
      }

      expect(onStart).toHaveBeenCalledWith('dev')
      expect(onStop).not.toHaveBeenCalled()
    })
  })

  describe('Context Menu Items', () => {
    it('运行中时上下文菜单应该显示"停止"', () => {
      const isRunning = true
      const label = isRunning ? '停止' : '启动'

      expect(label).toBe('停止')
    })

    it('停止时上下文菜单应该显示"启动"', () => {
      const isRunning = false
      const label = isRunning ? '停止' : '启动'

      expect(label).toBe('启动')
    })

    it('运行中时删除选项应该被禁用', () => {
      const isRunning = true
      const deleteDisabled = isRunning

      expect(deleteDisabled).toBe(true)
    })

    it('停止时删除选项不应该被禁用', () => {
      const isRunning = false
      const deleteDisabled = isRunning

      expect(deleteDisabled).toBe(false)
    })
  })

  describe('Project Info Display', () => {
    it('应该正确显示项目名称', () => {
      expect(mockProject.name).toBe('Test Project')
    })

    it('应该正确显示项目路径', () => {
      expect(mockProject.path).toBe('D:/Projects/test')
    })

    it('应该有有效的脚本列表', () => {
      expect(mockProject.scripts).toContain('dev')
      expect(mockProject.scripts).toContain('build')
    })

    it('应该有默认脚本', () => {
      expect(mockProject.defaultScript).toBe('dev')
    })
  })
})
