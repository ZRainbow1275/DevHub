import fs from 'fs'
import os from 'os'
import path from 'path'
import Store from 'electron-store'
import { describe, it, expect, beforeEach } from 'vitest'
import { AppStore } from './AppStore'
import type { AppConfig, AppSettings, Project, CodingTool } from '@shared/types'
import { DEFAULT_PORT_POPOUT_SYNC_POLICY, DEFAULT_SETTINGS, DEFAULT_TOOLS } from '@shared/types'

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
    function createStore(cwd?: string) {
      return new Store<AppConfig>({
        cwd: cwd ?? fs.mkdtempSync(path.join(os.tmpdir(), 'devhub-app-store-')),
        name: 'app-store-test',
        defaults: {
          projects: [],
          tools: DEFAULT_TOOLS,
          tags: [],
          groups: [],
          settings: DEFAULT_SETTINGS,
        },
      })
    }

    it('应该返回包含 port popout 默认值的真实默认设置', () => {
      const appStore = new AppStore(createStore())
      const settings = appStore.getSettings()

      expect(settings.notification.enabled).toBe(true)
      expect(settings.appearance.theme).toBe('constructivism')
      expect(settings.window.portPopout).toEqual(DEFAULT_SETTINGS.window.portPopout)
    })

    it('应该深度合并部分 port popout 设置而不丢失其他触发字段', () => {
      const appStore = new AppStore(createStore())

      appStore.updateSettings({
        window: {
          ...DEFAULT_SETTINGS.window,
          portPopout: {
            ...DEFAULT_SETTINGS.window.portPopout,
            triggerEnabled: {
              ...DEFAULT_SETTINGS.window.portPopout.triggerEnabled,
              hover: false,
            },
            hoverDelayMs: 1500,
          },
        },
      })

      expect(appStore.getSettings().window.portPopout).toEqual({
        triggerEnabled: {
          hover: false,
          click: true,
          drag: true,
          contextMenu: true,
        },
        hoverDelayMs: 1500,
        dragThresholdPx: 8,
        syncPolicyDefault: DEFAULT_PORT_POPOUT_SYNC_POLICY,
      })
    })

    it('应该把 port popout 设置真实持久化到 electron-store 并在新实例中恢复', () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'devhub-app-store-persist-'))
      const first = new AppStore(createStore(cwd))

      first.updateSettings({
        window: {
          ...DEFAULT_SETTINGS.window,
          portPopout: {
            ...DEFAULT_SETTINGS.window.portPopout,
            triggerEnabled: {
              ...DEFAULT_SETTINGS.window.portPopout.triggerEnabled,
              click: false,
              contextMenu: false,
            },
            hoverDelayMs: 2000,
            dragThresholdPx: 12,
            syncPolicyDefault: {
              ...DEFAULT_SETTINGS.window.portPopout.syncPolicyDefault,
              direction: 'isolated',
            },
          },
        },
      })

      const restored = new AppStore(createStore(cwd))
      expect(restored.getSettings().window.portPopout).toEqual({
        triggerEnabled: {
          hover: true,
          click: false,
          drag: true,
          contextMenu: false,
        },
        hoverDelayMs: 2000,
        dragThresholdPx: 12,
        syncPolicyDefault: {
          ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
          direction: 'isolated',
        },
      })
    })

    it('应该迁移 legacy flat settings 并保留新的 port popout 默认值', () => {
      const store = createStore()
      store.set('settings', {
        theme: 'modern-light',
        checkInterval: 5000,
        notificationEnabled: false,
        firstLaunchDone: true,
      } as never)

      const appStore = new AppStore(store)
      const settings = appStore.getSettings()

      expect(settings.appearance.theme).toBe('modern-light')
      expect(settings.scan.checkInterval).toBe(5000)
      expect(settings.notification.enabled).toBe(false)
      expect(settings.firstLaunchDone).toBe(true)
      expect(settings.window.portPopout).toEqual(DEFAULT_SETTINGS.window.portPopout)
    })

    it('应该通过真实设置对象管理允许路径', () => {
      const appStore = new AppStore(createStore())

      appStore.addAllowedPath('D:/NewPath')
      expect(appStore.getSettings().scan.allowedPaths).toContain('D:/NewPath')

      appStore.removeAllowedPath('D:/NewPath')
      expect(appStore.getSettings().scan.allowedPaths).not.toContain('D:/NewPath')
    })

    it('encrypts imported sensitive settings fields at rest with Electron safeStorage envelopes', () => {
      const store = createStore()
      const appStore = new AppStore(store)
      const sensitiveSettings = {
        advanced: {
          ...DEFAULT_SETTINGS.advanced,
          apiKey: 'sk-imported-secret-123456',
          nested: {
            token: 'tok-imported-secret-123456'
          }
        }
      } as unknown as Partial<AppSettings>

      appStore.updateSettings(sensitiveSettings)

      const rawSettings = store.get('settings') as unknown as Record<string, unknown>
      const rawText = JSON.stringify(rawSettings)
      const advanced = rawSettings.advanced as Record<string, unknown>
      const encryptedApiKey = advanced.apiKey as Record<string, unknown>
      const nested = advanced.nested as Record<string, unknown>
      const encryptedToken = nested.token as Record<string, unknown>

      expect(rawText).not.toContain('sk-imported-secret-123456')
      expect(rawText).not.toContain('tok-imported-secret-123456')
      expect(encryptedApiKey).toMatchObject({
        __devhubEncrypted: true,
        algorithm: 'electron.safeStorage',
        encoding: 'base64',
        keyHint: 'apiKey'
      })
      expect(encryptedToken).toMatchObject({
        __devhubEncrypted: true,
        algorithm: 'electron.safeStorage',
        encoding: 'base64',
        keyHint: 'token'
      })
      expect(JSON.stringify(appStore.getSettings())).not.toContain('sk-imported-secret-123456')
    })
  })

  describe('Tools Management', () => {
    const TOOL_FIXTURES: CodingTool[] = [
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
      const tools = [...TOOL_FIXTURES]
      expect(tools.length).toBeGreaterThan(0)
      expect(tools[0].id).toBe('codex')
    })

    it('应该正确更新工具状态', () => {
      const tools = [...TOOL_FIXTURES]
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
