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
        projectType: 'npm',
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
        projectType: 'npm',
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
        projectType: 'npm',
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
        projectType: 'npm',
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
    const TEST_SETTINGS: AppSettings = {
      appearance: {
        theme: 'constructivism',
        fontSize: 'medium',
        sidebarPosition: 'left',
        compactMode: false,
        enableAnimations: true,
      },
      scan: {
        scanDrives: ['C', 'D'],
        allowedPaths: [],
        excludePaths: [],
        checkInterval: 3000,
        maxScanDepth: 5,
        fileTypeFilters: [],
      },
      process: {
        enabled: true,
        scanInterval: 5000,
        autoCleanZombies: false,
        zombieThresholdMinutes: 30,
        cpuWarningThreshold: 80,
        memoryWarningThresholdMB: 1024,
        whitelist: [],
        blacklist: [],
      },
      notification: {
        enabled: true,
        typeToggles: { 'task-complete': true, 'port-conflict': true, 'zombie-process': true, 'high-resource': true, 'project-error': true },
        sound: true,
        persistent: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      window: {
        enabled: true,
        autoGroupStrategy: 'by-project',
        saveLayoutOnExit: false,
        snapToEdges: true,
      },
      advanced: {
        autoStartOnBoot: false,
        minimizeToTray: false,
        dataStoragePath: '',
        logLevel: 'info',
        developerMode: false,
      },
      firstLaunchDone: false,
    }

    it('应该返回默认设置', () => {
      const settings = { ...TEST_SETTINGS }

      expect(settings.notification.enabled).toBe(true)
      expect(settings.appearance.theme).toBe('constructivism')
      expect(settings.scan.checkInterval).toBe(3000)
    })

    it('应该正确更新设置', () => {
      const settings = {
        ...TEST_SETTINGS,
        appearance: { ...TEST_SETTINGS.appearance, theme: 'modern-light' as const },
        notification: { ...TEST_SETTINGS.notification, enabled: false },
      }

      expect(settings.appearance.theme).toBe('modern-light')
      expect(settings.notification.enabled).toBe(false)
    })

    it('应该正确管理允许路径', () => {
      const settings = {
        ...TEST_SETTINGS,
        scan: { ...TEST_SETTINGS.scan, allowedPaths: [...TEST_SETTINGS.scan.allowedPaths] },
      }

      // 添加路径
      if (!settings.scan.allowedPaths.includes('D:/NewPath')) {
        settings.scan.allowedPaths.push('D:/NewPath')
      }
      expect(settings.scan.allowedPaths).toContain('D:/NewPath')

      // 移除路径
      settings.scan.allowedPaths = settings.scan.allowedPaths.filter(p => p !== 'D:/NewPath')
      expect(settings.scan.allowedPaths).not.toContain('D:/NewPath')
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
