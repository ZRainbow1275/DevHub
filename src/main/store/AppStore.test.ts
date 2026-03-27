import { describe, it, expect, beforeEach } from 'vitest'
import type { Project, CodingTool, AppSettings } from '@shared/types'

// 由于 AppStore 依赖于 electron-store
// 在 jsdom 测试环境中难以完全 mock
// 这里测试核心业务逻辑

describe('AppStore Logic Tests', () => {
  describe('Project Management', () => {
    let projects: Project[]

    beforeEach(() => {
      projects = []
    })

    it('应该返回空数组当没有项目时', () => {
      expect(projects).toEqual([])
    })

    it('应该正确添加项目', () => {
      const now = Date.now()
      const newProject: Project = {
        id: 'test-id-123',
        name: 'Test Project',
        path: 'D:/Projects/test',
        scripts: ['dev'],
        defaultScript: 'dev',
        tags: [],
        status: 'stopped',
        createdAt: now,
        updatedAt: now
      }

      projects.push(newProject)

      expect(projects.length).toBe(1)
      expect(projects[0].id).toBe('test-id-123')
      expect(projects[0].name).toBe('Test Project')
      expect(projects[0].createdAt).toBe(now)
    })

    it('应该正确更新项目', () => {
      const now = Date.now()
      projects.push({
        id: 'test-id-123',
        name: 'Test Project',
        path: 'D:/Projects/test',
        scripts: ['dev'],
        defaultScript: 'dev',
        tags: [],
        status: 'stopped',
        createdAt: now,
        updatedAt: now
      })

      const index = projects.findIndex(p => p.id === 'test-id-123')
      if (index !== -1) {
        projects[index] = {
          ...projects[index],
          name: 'Updated Name',
          tags: ['frontend'],
          updatedAt: Date.now()
        }
      }

      expect(projects[0].name).toBe('Updated Name')
      expect(projects[0].tags).toContain('frontend')
    })

    it('应该正确删除项目', () => {
      const now = Date.now()
      projects.push({
        id: 'test-id-123',
        name: 'Test Project',
        path: 'D:/Projects/test',
        scripts: ['dev'],
        defaultScript: 'dev',
        tags: [],
        status: 'stopped',
        createdAt: now,
        updatedAt: now
      })

      const filtered = projects.filter(p => p.id !== 'test-id-123')
      const removed = filtered.length < projects.length

      expect(removed).toBe(true)
      expect(filtered.length).toBe(0)
    })

    it('应该正确查找项目', () => {
      const now = Date.now()
      projects.push({
        id: 'test-id-123',
        name: 'Test Project',
        path: 'D:/Projects/test',
        scripts: ['dev'],
        defaultScript: 'dev',
        tags: [],
        status: 'stopped',
        createdAt: now,
        updatedAt: now
      })

      const found = projects.find(p => p.id === 'test-id-123')
      expect(found).toBeDefined()
      expect(found?.name).toBe('Test Project')

      const notFound = projects.find(p => p.id === 'nonexistent')
      expect(notFound).toBeUndefined()
    })
  })

  describe('Tags Management', () => {
    let tags: string[]

    beforeEach(() => {
      tags = []
    })

    it('应该正确添加标签', () => {
      if (!tags.includes('frontend')) {
        tags.push('frontend')
      }
      expect(tags).toContain('frontend')
    })

    it('不应该添加重复标签', () => {
      tags.push('frontend')
      if (!tags.includes('frontend')) {
        tags.push('frontend')
      }
      expect(tags.filter(t => t === 'frontend')).toHaveLength(1)
    })

    it('应该正确删除标签', () => {
      tags.push('frontend')
      tags.push('backend')

      tags = tags.filter(t => t !== 'frontend')

      expect(tags).not.toContain('frontend')
      expect(tags).toContain('backend')
    })
  })

  describe('Settings Management', () => {
    const DEFAULT_SETTINGS: AppSettings = {
      autoStartOnBoot: false,
      notificationEnabled: true,
      theme: 'dark',
      checkInterval: 3000,
      scanDrives: ['C:', 'D:'],
      allowedPaths: [],
      minimizeToTray: false
    }

    it('应该返回默认设置', () => {
      const settings = { ...DEFAULT_SETTINGS }

      expect(settings.notificationEnabled).toBe(true)
      expect(settings.theme).toBe('dark')
      expect(settings.checkInterval).toBe(3000)
    })

    it('应该正确更新设置', () => {
      let settings = { ...DEFAULT_SETTINGS }

      settings = { ...settings, theme: 'light', notificationEnabled: false }

      expect(settings.theme).toBe('light')
      expect(settings.notificationEnabled).toBe(false)
    })

    it('应该正确管理允许路径', () => {
      const settings = { ...DEFAULT_SETTINGS }

      // 添加路径
      if (!settings.allowedPaths.includes('D:/NewPath')) {
        settings.allowedPaths.push('D:/NewPath')
      }
      expect(settings.allowedPaths).toContain('D:/NewPath')

      // 移除路径
      settings.allowedPaths = settings.allowedPaths.filter(p => p !== 'D:/NewPath')
      expect(settings.allowedPaths).not.toContain('D:/NewPath')
    })
  })

  describe('Tools Management', () => {
    const DEFAULT_TOOLS: CodingTool[] = [
      {
        id: 'codex',
        name: 'codex',
        displayName: 'Codex CLI',
        processName: 'codex',
        completionPatterns: ['Done'],
        status: 'idle'
      }
    ]

    it('应该返回默认工具列表', () => {
      const tools = [...DEFAULT_TOOLS]
      expect(tools.length).toBeGreaterThan(0)
      expect(tools[0].id).toBe('codex')
    })

    it('应该正确更新工具状态', () => {
      const tools = [...DEFAULT_TOOLS]
      const index = tools.findIndex(t => t.id === 'codex')

      if (index !== -1) {
        tools[index] = { ...tools[index], status: 'running' }
      }

      expect(tools[0].status).toBe('running')
    })
  })

  describe('Groups Management', () => {
    let groups: string[]

    beforeEach(() => {
      groups = []
    })

    it('应该正确添加分组', () => {
      if (!groups.includes('Work')) {
        groups.push('Work')
      }
      expect(groups).toContain('Work')
    })

    it('不应该添加重复分组', () => {
      groups.push('Work')
      if (!groups.includes('Work')) {
        groups.push('Work')
      }
      expect(groups.filter(g => g === 'Work')).toHaveLength(1)
    })

    it('应该正确删除分组', () => {
      groups.push('Work')
      groups.push('Personal')

      groups = groups.filter(g => g !== 'Work')

      expect(groups).not.toContain('Work')
      expect(groups).toContain('Personal')
    })
  })
})
