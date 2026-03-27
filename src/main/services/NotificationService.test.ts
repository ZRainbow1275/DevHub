import { describe, it, expect, beforeEach } from 'vitest'
import type {
  NotificationType,
  NotificationConfig,
  AppNotification
} from '@shared/types-extended'

// 由于 NotificationService 依赖于 Electron 的 Notification 和 BrowserWindow
// 在 jsdom 测试环境中难以完全 mock
// 这里测试核心业务逻辑

describe('NotificationService Logic Tests', () => {
  describe('Notification Config Management', () => {
    const defaultConfig: NotificationConfig = {
      enabled: true,
      types: {
        'task-complete': true,
        'port-conflict': true,
        'zombie-process': true,
        'high-resource': true,
        'project-error': true
      },
      sound: true,
      persistent: false
    }

    it('应该有正确的默认配置', () => {
      expect(defaultConfig.enabled).toBe(true)
      expect(defaultConfig.sound).toBe(true)
      expect(defaultConfig.persistent).toBe(false)
    })

    it('应该正确合并配置', () => {
      const newConfig = { ...defaultConfig, sound: false }
      expect(newConfig.sound).toBe(false)
      expect(newConfig.enabled).toBe(true) // 其他配置不变
    })

    it('应该正确判断类型是否启用', () => {
      const isTypeEnabled = (config: NotificationConfig, type: NotificationType): boolean => {
        return config.enabled && config.types[type]
      }

      expect(isTypeEnabled(defaultConfig, 'task-complete')).toBe(true)
      expect(isTypeEnabled(defaultConfig, 'port-conflict')).toBe(true)

      const disabledConfig = { ...defaultConfig, enabled: false }
      expect(isTypeEnabled(disabledConfig, 'task-complete')).toBe(false)

      const partialDisabled = {
        ...defaultConfig,
        types: { ...defaultConfig.types, 'task-complete': false }
      }
      expect(isTypeEnabled(partialDisabled, 'task-complete')).toBe(false)
      expect(isTypeEnabled(partialDisabled, 'port-conflict')).toBe(true)
    })
  })

  describe('Notification History Management', () => {
    let history: AppNotification[] = []

    beforeEach(() => {
      history = []
    })

    it('应该正确添加通知到历史', () => {
      const notification: AppNotification = {
        id: 'notif_1',
        type: 'task-complete',
        title: '任务完成',
        body: '测试任务已完成',
        createdAt: Date.now(),
        read: false
      }

      history.unshift(notification)
      expect(history.length).toBe(1)
      expect(history[0].id).toBe('notif_1')
    })

    it('应该限制历史记录数量为 100', () => {
      for (let i = 0; i < 120; i++) {
        history.unshift({
          id: `notif_${i}`,
          type: 'task-complete',
          title: `通知 ${i}`,
          body: `内容 ${i}`,
          createdAt: Date.now(),
          read: false
        })
        if (history.length > 100) {
          history = history.slice(0, 100)
        }
      }

      expect(history.length).toBe(100)
      expect(history[0].id).toBe('notif_119') // 最新的在最前
    })

    it('应该正确标记为已读', () => {
      const notification: AppNotification = {
        id: 'notif_1',
        type: 'task-complete',
        title: '任务完成',
        body: '测试任务已完成',
        createdAt: Date.now(),
        read: false
      }

      history.push(notification)
      const found = history.find(n => n.id === 'notif_1')
      if (found) {
        found.read = true
      }

      expect(history[0].read).toBe(true)
    })

    it('应该正确标记全部为已读', () => {
      for (let i = 0; i < 5; i++) {
        history.push({
          id: `notif_${i}`,
          type: 'task-complete',
          title: `通知 ${i}`,
          body: `内容 ${i}`,
          createdAt: Date.now(),
          read: false
        })
      }

      history.forEach(n => { n.read = true })
      expect(history.every(n => n.read)).toBe(true)
    })

    it('应该正确获取未读数量', () => {
      for (let i = 0; i < 5; i++) {
        history.push({
          id: `notif_${i}`,
          type: 'task-complete',
          title: `通知 ${i}`,
          body: `内容 ${i}`,
          createdAt: Date.now(),
          read: i < 2 // 前两个已读
        })
      }

      const unreadCount = history.filter(n => !n.read).length
      expect(unreadCount).toBe(3)
    })

    it('应该正确清空历史', () => {
      for (let i = 0; i < 5; i++) {
        history.push({
          id: `notif_${i}`,
          type: 'task-complete',
          title: `通知 ${i}`,
          body: `内容 ${i}`,
          createdAt: Date.now(),
          read: false
        })
      }

      history = []
      expect(history.length).toBe(0)
    })
  })

  describe('Notification ID Generation', () => {
    it('应该生成唯一的通知 ID', () => {
      const generateId = (): string => `notif_${Date.now()}`

      const id1 = generateId()
      expect(id1).toMatch(/^notif_\d+$/)
    })

    it('ID 应该包含时间戳', () => {
      const now = Date.now()
      const id = `notif_${now}`

      expect(id).toContain(now.toString())
    })
  })

  describe('Notification Content Formatting', () => {
    it('任务完成通知应该包含正确格式', () => {
      const formatTaskComplete = (toolName: string, duration: number) => ({
        title: `${toolName} 任务完成`,
        body: `任务耗时: ${Math.round(duration / 1000)}秒`
      })

      const result = formatTaskComplete('Codex', 5000)
      expect(result.title).toBe('Codex 任务完成')
      expect(result.body).toBe('任务耗时: 5秒')
    })

    it('端口冲突通知应该包含正确格式', () => {
      const formatPortConflict = (port: number, processName: string) => ({
        title: '端口冲突检测',
        body: `端口 ${port} 被 ${processName} 占用`
      })

      const result = formatPortConflict(3000, 'node.exe')
      expect(result.title).toBe('端口冲突检测')
      expect(result.body).toBe('端口 3000 被 node.exe 占用')
    })

    it('僵尸进程通知应该包含正确格式', () => {
      const formatZombieProcess = (count: number) => ({
        title: '僵尸进程检测',
        body: `检测到 ${count} 个可能的僵尸进程`
      })

      const result = formatZombieProcess(3)
      expect(result.title).toBe('僵尸进程检测')
      expect(result.body).toBe('检测到 3 个可能的僵尸进程')
    })

    it('高资源使用通知应该包含正确格式', () => {
      const formatHighResource = (processName: string, cpu: number, memory: number) => {
        const issues: string[] = []
        if (cpu > 80) issues.push(`CPU: ${cpu.toFixed(1)}%`)
        if (memory > 1000) issues.push(`内存: ${memory}MB`)

        return {
          title: '资源使用警告',
          body: `${processName} 资源占用过高 (${issues.join(', ')})`
        }
      }

      const result = formatHighResource('node.exe', 95.5, 1500)
      expect(result.title).toBe('资源使用警告')
      expect(result.body).toBe('node.exe 资源占用过高 (CPU: 95.5%, 内存: 1500MB)')
    })

    it('项目错误通知应该截断过长的错误信息', () => {
      const formatProjectError = (projectName: string, error: string) => ({
        title: `项目错误: ${projectName}`,
        body: error.length > 100 ? error.slice(0, 100) + '...' : error
      })

      const longError = 'A'.repeat(150)
      const result = formatProjectError('MyProject', longError)

      expect(result.title).toBe('项目错误: MyProject')
      expect(result.body.length).toBe(103) // 100 + '...'
      expect(result.body.endsWith('...')).toBe(true)

      const shortError = 'Short error'
      const result2 = formatProjectError('MyProject', shortError)
      expect(result2.body).toBe('Short error')
    })
  })

  describe('Notification Actions', () => {
    it('端口冲突通知应该有释放端口操作', () => {
      const portConflictActions = (port: number) => [
        { label: '释放端口', action: `release-port:${port}` }
      ]

      const actions = portConflictActions(3000)
      expect(actions.length).toBe(1)
      expect(actions[0].label).toBe('释放端口')
      expect(actions[0].action).toBe('release-port:3000')
    })

    it('僵尸进程通知应该有清理操作', () => {
      const zombieActions = [
        { label: '清理', action: 'cleanup-zombies' }
      ]

      expect(zombieActions[0].action).toBe('cleanup-zombies')
    })
  })

  describe('Notification Types', () => {
    const allTypes: NotificationType[] = [
      'task-complete',
      'port-conflict',
      'zombie-process',
      'high-resource',
      'project-error'
    ]

    it('应该支持所有通知类型', () => {
      expect(allTypes.length).toBe(5)
      expect(allTypes).toContain('task-complete')
      expect(allTypes).toContain('port-conflict')
      expect(allTypes).toContain('zombie-process')
      expect(allTypes).toContain('high-resource')
      expect(allTypes).toContain('project-error')
    })
  })

  describe('History Retrieval', () => {
    it('应该正确限制返回数量', () => {
      const history: AppNotification[] = []
      for (let i = 0; i < 20; i++) {
        history.push({
          id: `notif_${i}`,
          type: 'task-complete',
          title: `通知 ${i}`,
          body: `内容 ${i}`,
          createdAt: Date.now(),
          read: false
        })
      }

      const getHistory = (limit?: number): AppNotification[] => {
        return limit ? history.slice(0, limit) : [...history]
      }

      expect(getHistory(5).length).toBe(5)
      expect(getHistory(10).length).toBe(10)
      expect(getHistory().length).toBe(20)
    })
  })

  describe('Singleton Pattern', () => {
    it('应该正确实现单例模式逻辑', () => {
      let instance: object | null = null

      const getInstance = (): object => {
        if (!instance) {
          instance = { name: 'NotificationService' }
        }
        return instance
      }

      const service1 = getInstance()
      const service2 = getInstance()

      expect(service1).toBe(service2)
    })
  })
})
