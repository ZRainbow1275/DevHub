import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron'
import { IPC_CHANNELS, Project } from '@shared/types'
import { AppStore } from '../store/AppStore'
import { ProcessManager } from '../services/ProcessManager'
import { ToolMonitor } from '../services/ToolMonitor'
import { ProjectScanner } from '../services/ProjectScanner'
import { validatePath, parsePackageJson } from '../utils/security'
import { guardProtoPollution, validateTagOrGroup, trimTagOrGroup } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { setupProcessHandlers, cleanupProcessHandlers } from './processHandlers'
import { setupPortHandlers, cleanupPortHandlers } from './portHandlers'
import { setupWindowHandlers, cleanupWindowHandlers } from './windowHandlers'
import { setupAITaskHandlers, cleanupAITaskHandlers } from './aiTaskHandlers'
import { setupNotificationHandlers, cleanupNotificationHandlers } from './notificationHandlers'
import { setupTaskHistoryHandlers, cleanupTaskHistoryHandlers } from './taskHistoryHandlers'

const projectScanner = new ProjectScanner()

export function registerIpcHandlers(
  appStore: AppStore,
  processManager: ProcessManager,
  toolMonitor: ToolMonitor,
  getMainWindow: () => BrowserWindow | null
): void {
  // ==================== Project Handlers ====================

  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, withRateLimit(
    IPC_CHANNELS.PROJECTS_LIST, RATE_LIMITS.QUERY,
    () => {
      return appStore.getProjects()
    }
  ))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_GET, withRateLimit(
    IPC_CHANNELS.PROJECTS_GET, RATE_LIMITS.QUERY,
    (_, id: string) => {
      return appStore.getProject(id)
    }
  ))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_ADD, withRateLimit(
    IPC_CHANNELS.PROJECTS_ADD, RATE_LIMITS.ACTION,
    async (_, inputPath: string) => {
      // Validate path security
      const settings = appStore.getSettings()
      const validation = validatePath(inputPath, settings.allowedPaths)

      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Parse package.json
      const pkgInfo = parsePackageJson(validation.normalized!)

      if (!pkgInfo.valid) {
        throw new Error(pkgInfo.error)
      }

      // Check for duplicates
      const existing = appStore.getProjects()
      if (existing.some((p) => p.path.toLowerCase() === validation.normalized!.toLowerCase())) {
        throw new Error('Project already exists')
      }

      // Add project
      const project = appStore.addProject({
        name: pkgInfo.name!,
        path: validation.normalized!,
        scripts: pkgInfo.scripts || [],
        defaultScript: pkgInfo.scripts?.includes('dev') ? 'dev' : pkgInfo.scripts?.[0] || 'start',
        tags: [],
        status: 'stopped'
      })

      return project
    }
  ))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_REMOVE, withRateLimit(
    IPC_CHANNELS.PROJECTS_REMOVE, RATE_LIMITS.ACTION,
    async (_, id: string) => {
      // Stop if running
      if (processManager.isRunning(id)) {
        await processManager.stop(id)
      }

      return appStore.removeProject(id)
    }
  ))

  ipcMain.handle(
    IPC_CHANNELS.PROJECTS_UPDATE,
    withRateLimit(
      IPC_CHANNELS.PROJECTS_UPDATE, RATE_LIMITS.ACTION,
      (_, id: string, updates: Partial<Project>) => {
        // Only allow safe updates
        const safeUpdates: Partial<Project> = {}

        if (updates.name !== undefined) safeUpdates.name = updates.name
        if (updates.tags !== undefined) safeUpdates.tags = updates.tags
        if (updates.group !== undefined) safeUpdates.group = updates.group
        if (updates.defaultScript !== undefined) safeUpdates.defaultScript = updates.defaultScript

        return appStore.updateProject(id, safeUpdates)
      }
    )
  )

  // ==================== Process Handlers ====================

  ipcMain.handle(
    IPC_CHANNELS.PROCESS_START,
    withRateLimit(
      IPC_CHANNELS.PROCESS_START, RATE_LIMITS.ACTION,
      async (_, projectId: string, script: string) => {
        const project = appStore.getProject(projectId)
        if (!project) {
          throw new Error('Project not found')
        }

        await processManager.start(project, script)

        // Update project status in store
        appStore.updateProject(projectId, { status: 'running' })

        return true
      }
    )
  )

  ipcMain.handle(IPC_CHANNELS.PROCESS_STOP, withRateLimit(
    IPC_CHANNELS.PROCESS_STOP, RATE_LIMITS.ACTION,
    async (_, projectId: string) => {
      await processManager.stop(projectId)
      appStore.updateProject(projectId, { status: 'stopped' })
      return true
    }
  ))

  ipcMain.handle(IPC_CHANNELS.PROCESS_STATUS, withRateLimit(
    IPC_CHANNELS.PROCESS_STATUS, RATE_LIMITS.QUERY,
    (_, projectId: string) => {
      return processManager.isRunning(projectId)
    }
  ))

  // Set up process manager callbacks
  processManager.setStatusCallback((projectId, status, pid) => {
    appStore.updateProject(projectId, { status, pid })
    getMainWindow()?.webContents.send('process:status-change', { projectId, status, pid })
  })

  // Forward logs to renderer
  ipcMain.on('log:subscribe', (event, projectId: string) => {
    const unsubscribe = processManager.onLog(projectId, (entry) => {
      event.sender.send(IPC_CHANNELS.LOG_ENTRY, entry)
    })

    // Clean up on window close
    event.sender.on('destroyed', unsubscribe)
  })

  // ==================== Settings Handlers ====================

  // 允许更新的设置字段白名单
  const ALLOWED_SETTINGS_FIELDS = [
    'autoStartOnBoot',
    'minimizeToTray',
    'notificationEnabled',
    'checkInterval',
    'allowedPaths',
    'scanDrives',
    'theme'
  ] as const

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, withRateLimit(
    IPC_CHANNELS.SETTINGS_GET, RATE_LIMITS.QUERY,
    () => {
      return appStore.getSettings()
    }
  ))

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, withRateLimit(
    IPC_CHANNELS.SETTINGS_UPDATE, RATE_LIMITS.ACTION,
    (_, updates: unknown) => {
      // 类型验证
      if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) {
        throw new Error('Invalid settings format')
      }

      // 防止原型污染
      guardProtoPollution(updates)

      // 字段白名单过滤
      const sanitized: Record<string, unknown> = {}
      for (const key of Object.keys(updates)) {
        if (ALLOWED_SETTINGS_FIELDS.includes(key as typeof ALLOWED_SETTINGS_FIELDS[number])) {
          sanitized[key] = (updates as Record<string, unknown>)[key]
        }
      }

      // 验证具体字段类型
      if ('checkInterval' in sanitized && typeof sanitized.checkInterval !== 'number') {
        throw new Error('checkInterval must be a number')
      }
      if ('theme' in sanitized && !['dark', 'light'].includes(sanitized.theme as string)) {
        throw new Error('theme must be "dark" or "light"')
      }
      if ('scanDrives' in sanitized && !Array.isArray(sanitized.scanDrives)) {
        throw new Error('scanDrives must be an array')
      }

      appStore.updateSettings(sanitized)
      return appStore.getSettings()
    }
  ))

  // ==================== Tool Handlers ====================

  ipcMain.handle(IPC_CHANNELS.TOOL_STATUS, withRateLimit(
    IPC_CHANNELS.TOOL_STATUS, RATE_LIMITS.QUERY,
    () => {
      return toolMonitor.getAllToolStatus()
    }
  ))

  // ==================== Window Controls ====================

  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    getMainWindow()?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  // 请求关闭 - 发送确认事件到渲染进程
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    const win = getMainWindow()
    if (win) {
      // 发送确认事件到渲染进程，让用户选择
      win.webContents.send(IPC_CHANNELS.WINDOW_CLOSE_CONFIRM)
    }
  })

  // 最小化到托盘
  ipcMain.on(IPC_CHANNELS.WINDOW_HIDE_TO_TRAY, () => {
    getMainWindow()?.hide()
  })

  // 强制关闭
  ipcMain.on(IPC_CHANNELS.WINDOW_FORCE_CLOSE, () => {
    const win = getMainWindow()
    if (win) {
      win.destroy()
    }
    app.quit()
  })

  // ==================== Dialog Handlers ====================

  ipcMain.handle('dialog:open-directory', withRateLimit(
    'dialog:open-directory', RATE_LIMITS.ACTION,
    async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled || !result.filePaths[0]) {
        return null
      }

      return result.filePaths[0]
    }
  ))

  // ==================== Tag/Group Handlers ====================

  ipcMain.handle('tags:list', withRateLimit(
    'tags:list', RATE_LIMITS.QUERY,
    () => appStore.getTags()
  ))

  ipcMain.handle('tags:add', withRateLimit(
    'tags:add', RATE_LIMITS.ACTION,
    (_, tag: unknown) => {
      validateTagOrGroup(tag)
      return appStore.addTag(trimTagOrGroup(tag))
    }
  ))

  ipcMain.handle('tags:remove', withRateLimit(
    'tags:remove', RATE_LIMITS.ACTION,
    (_, tag: unknown) => {
      validateTagOrGroup(tag)
      return appStore.removeTag(trimTagOrGroup(tag))
    }
  ))

  ipcMain.handle('groups:list', withRateLimit(
    'groups:list', RATE_LIMITS.QUERY,
    () => appStore.getGroups()
  ))

  ipcMain.handle('groups:add', withRateLimit(
    'groups:add', RATE_LIMITS.ACTION,
    (_, group: unknown) => {
      validateTagOrGroup(group)
      return appStore.addGroup(trimTagOrGroup(group))
    }
  ))

  ipcMain.handle('groups:remove', withRateLimit(
    'groups:remove', RATE_LIMITS.ACTION,
    (_, group: unknown) => {
      validateTagOrGroup(group)
      return appStore.removeGroup(trimTagOrGroup(group))
    }
  ))

  // ==================== Shell Handlers ====================

  ipcMain.handle('shell:open-path', withRateLimit(
    'shell:open-path', RATE_LIMITS.ACTION,
    async (_, inputPath: unknown) => {
      // 类型验证
      if (typeof inputPath !== 'string') {
        throw new Error('Path must be a string')
      }

      // 路径安全验证
      const settings = appStore.getSettings()
      const validation = validatePath(inputPath, settings.allowedPaths)

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid path')
      }

      return shell.openPath(validation.normalized!)
    }
  ))

  // ==================== Project Scanning ====================

  ipcMain.handle('projects:scan', withRateLimit(
    'projects:scan', RATE_LIMITS.SCAN,
    async (_, scanPath?: unknown) => {
      const settings = appStore.getSettings()

      if (scanPath !== undefined) {
        // 验证扫描路径
        if (typeof scanPath !== 'string') {
          throw new Error('Scan path must be a string')
        }
        const validation = validatePath(scanPath, settings.allowedPaths)
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid scan path')
        }
        return projectScanner.scanDirectory(validation.normalized!)
      }

      return projectScanner.scanCommonLocations(settings.scanDrives)
    }
  ))

  ipcMain.handle('projects:scan-directory', withRateLimit(
    'projects:scan-directory', RATE_LIMITS.SCAN,
    async (_, dirPath: unknown) => {
      if (typeof dirPath !== 'string') {
        throw new Error('Directory path must be a string')
      }

      const settings = appStore.getSettings()
      const validation = validatePath(dirPath, settings.allowedPaths)

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid directory path')
      }

      return projectScanner.scanDirectory(validation.normalized!)
    }
  ))

  // 智能项目发现
  ipcMain.handle('projects:discover', withRateLimit(
    'projects:discover', RATE_LIMITS.SCAN,
    async () => {
      const settings = appStore.getSettings()
      return projectScanner.discoverProjectsIntelligently(settings.scanDrives)
    }
  ))

  // 获取系统可用盘符
  ipcMain.handle('system:get-drives', withRateLimit(
    'system:get-drives', RATE_LIMITS.SCAN,
    async () => {
      return projectScanner.getAvailableDrives()
    }
  ))

  // ==================== Extended Handlers ====================
  // 扩展处理器初始化 - 使用重试机制代替固定延迟
  let extendedHandlersInitialized = false
  const MAX_INIT_RETRIES = 10
  const INIT_RETRY_DELAY = 50

  const initExtendedHandlers = (retryCount = 0): void => {
    if (extendedHandlersInitialized) return

    const mainWin = getMainWindow()
    if (mainWin) {
      try {
        setupProcessHandlers(mainWin, appStore)
        setupPortHandlers(mainWin)
        setupWindowHandlers(mainWin)
        setupAITaskHandlers(mainWin)
        setupNotificationHandlers(mainWin)
        setupTaskHistoryHandlers(mainWin)
        extendedHandlersInitialized = true
      } catch (error) {
        console.error('Failed to initialize extended handlers:', error)
      }
    } else if (retryCount < MAX_INIT_RETRIES) {
      // 使用指数退避重试
      const delay = INIT_RETRY_DELAY * Math.pow(2, retryCount)
      setTimeout(() => initExtendedHandlers(retryCount + 1), delay)
    } else {
      console.warn('Extended handlers initialization failed: window not available after max retries')
    }
  }

  // 立即尝试初始化
  initExtendedHandlers()
}

export function cleanupIpcHandlers(): void {
  cleanupProcessHandlers()
  cleanupPortHandlers()
  cleanupWindowHandlers()
  cleanupAITaskHandlers()
  cleanupNotificationHandlers()
  cleanupTaskHistoryHandlers()
}
