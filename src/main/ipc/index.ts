import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron'
import { IPC_CHANNELS, Project } from '@shared/types'
import { ProjectWatcher } from '../services/ProjectWatcher'
import { AppStore } from '../store/AppStore'
import { ProcessManager } from '../services/ProcessManager'
import { ToolMonitor } from '../services/ToolMonitor'
import { ProjectScanner } from '../services/ProjectScanner'
import { validatePath, parseProjectConfig } from '../utils/security'
import { guardProtoPollution, validateTagOrGroup, trimTagOrGroup } from '../utils/validation'
import { withRateLimit, RATE_LIMITS } from '../utils/rateLimiter'
import { setupProcessHandlers, cleanupProcessHandlers } from './processHandlers'
import { setupPortHandlers, cleanupPortHandlers } from './portHandlers'
import { setupWindowHandlers, cleanupWindowHandlers } from './windowHandlers'
import { setupAITaskHandlers, cleanupAITaskHandlers } from './aiTaskHandlers'
import { setupNotificationHandlers, cleanupNotificationHandlers } from './notificationHandlers'
import { setupTaskHistoryHandlers, cleanupTaskHistoryHandlers } from './taskHistoryHandlers'

const projectScanner = new ProjectScanner()
const projectWatcher = new ProjectWatcher()

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
      const validation = validatePath(inputPath, settings.scan.allowedPaths)

      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Parse project configuration (multi-ecosystem support)
      const pkgInfo = parseProjectConfig(validation.normalized!)

      if (!pkgInfo.valid) {
        throw new Error(pkgInfo.error)
      }

      // Check for duplicates
      const existing = appStore.getProjects()
      if (existing.some((p) => p.path.toLowerCase() === validation.normalized!.toLowerCase())) {
        throw new Error('Project already exists')
      }

      // Determine default script based on project type
      const scripts = pkgInfo.scripts || []
      let defaultScript = scripts[0] || 'start'
      if (pkgInfo.projectType === 'npm' || pkgInfo.projectType === 'pnpm' || pkgInfo.projectType === 'yarn') {
        defaultScript = scripts.includes('dev') ? 'dev' : scripts[0] || 'start'
      } else if (pkgInfo.projectType === 'rust') {
        defaultScript = 'run'
      } else if (pkgInfo.projectType === 'go') {
        defaultScript = 'run'
      } else if (pkgInfo.projectType === 'java-maven' || pkgInfo.projectType === 'java-gradle') {
        defaultScript = scripts.includes('build') ? 'build' : scripts[0] || 'build'
      }

      // Add project
      const project = appStore.addProject({
        name: pkgInfo.name!,
        path: validation.normalized!,
        projectType: pkgInfo.projectType || 'unknown',
        scripts,
        defaultScript,
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
  // Track active log subscriptions per webContents to prevent leaks on project switch
  const activeLogUnsubscribes = new WeakMap<Electron.WebContents, () => void>()

  ipcMain.on('log:subscribe', (event, projectId: string) => {
    // Clean up previous subscription from the same sender (project switch)
    const prevUnsubscribe = activeLogUnsubscribes.get(event.sender)
    if (prevUnsubscribe) {
      prevUnsubscribe()
    }

    const unsubscribe = processManager.onLog(projectId, (entry) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.LOG_ENTRY, entry)
      }
    })

    activeLogUnsubscribes.set(event.sender, unsubscribe)

    // Clean up on window close
    event.sender.on('destroyed', () => {
      unsubscribe()
      activeLogUnsubscribes.delete(event.sender)
    })
  })

  // ==================== Settings Handlers ====================

  // 允许更新的顶级设置分类白名单
  const ALLOWED_SETTINGS_CATEGORIES = [
    'appearance', 'scan', 'process', 'notification', 'window', 'advanced', 'firstLaunchDone'
  ] as const

  // 每个分类允许的字段白名单
  const ALLOWED_CATEGORY_FIELDS: Record<string, readonly string[]> = {
    appearance: ['theme', 'fontSize', 'sidebarPosition', 'compactMode', 'enableAnimations'],
    scan: ['scanDrives', 'allowedPaths', 'excludePaths', 'checkInterval', 'maxScanDepth', 'fileTypeFilters'],
    process: ['enabled', 'scanInterval', 'autoCleanZombies', 'zombieThresholdMinutes', 'cpuWarningThreshold', 'memoryWarningThresholdMB', 'whitelist', 'blacklist'],
    notification: ['enabled', 'typeToggles', 'sound', 'persistent', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd'],
    window: ['enabled', 'autoGroupStrategy', 'saveLayoutOnExit', 'snapToEdges'],
    advanced: ['autoStartOnBoot', 'minimizeToTray', 'dataStoragePath', 'logLevel', 'developerMode'],
  }

  /**
   * Recursively filter settings object through the whitelist.
   * Only allows known categories and known fields within each category.
   */
  function sanitizeSettingsUpdate(updates: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    for (const key of Object.keys(updates)) {
      if (!ALLOWED_SETTINGS_CATEGORIES.includes(key as typeof ALLOWED_SETTINGS_CATEGORIES[number])) {
        continue
      }
      if (key === 'firstLaunchDone') {
        if (typeof updates[key] === 'boolean') {
          sanitized[key] = updates[key]
        }
        continue
      }
      const categoryValue = updates[key]
      if (typeof categoryValue !== 'object' || categoryValue === null || Array.isArray(categoryValue)) {
        continue
      }
      guardProtoPollution(categoryValue)
      const allowedFields = ALLOWED_CATEGORY_FIELDS[key]
      if (!allowedFields) continue
      const sanitizedCategory: Record<string, unknown> = {}
      for (const field of Object.keys(categoryValue as Record<string, unknown>)) {
        if (allowedFields.includes(field)) {
          sanitizedCategory[field] = (categoryValue as Record<string, unknown>)[field]
        }
      }
      if (Object.keys(sanitizedCategory).length > 0) {
        sanitized[key] = sanitizedCategory
      }
    }
    return sanitized
  }

  /**
   * Validate specific field types within settings categories.
   */
  function validateSettingsFields(sanitized: Record<string, unknown>): void {
    const appearance = sanitized.appearance as Record<string, unknown> | undefined
    if (appearance) {
      if ('theme' in appearance && !['constructivism', 'modern-light', 'warm-light', 'dark', 'light'].includes(appearance.theme as string)) {
        throw new Error('theme must be a valid theme name')
      }
      if ('fontSize' in appearance && !['small', 'medium', 'large'].includes(appearance.fontSize as string)) {
        throw new Error('fontSize must be small, medium, or large')
      }
      if ('sidebarPosition' in appearance && !['left', 'right'].includes(appearance.sidebarPosition as string)) {
        throw new Error('sidebarPosition must be left or right')
      }
    }
    const scan = sanitized.scan as Record<string, unknown> | undefined
    if (scan) {
      if ('checkInterval' in scan && (typeof scan.checkInterval !== 'number' || scan.checkInterval < 500 || scan.checkInterval > 60000)) {
        throw new Error('checkInterval must be a number between 500 and 60000')
      }
      if ('scanDrives' in scan && !Array.isArray(scan.scanDrives)) {
        throw new Error('scanDrives must be an array')
      }
      if ('maxScanDepth' in scan && (typeof scan.maxScanDepth !== 'number' || scan.maxScanDepth < 1 || scan.maxScanDepth > 20)) {
        throw new Error('maxScanDepth must be a number between 1 and 20')
      }
    }
    const process = sanitized.process as Record<string, unknown> | undefined
    if (process) {
      if ('scanInterval' in process && (typeof process.scanInterval !== 'number' || process.scanInterval < 1000 || process.scanInterval > 120000)) {
        throw new Error('scanInterval must be a number between 1000 and 120000')
      }
      if ('cpuWarningThreshold' in process && (typeof process.cpuWarningThreshold !== 'number' || process.cpuWarningThreshold < 10 || process.cpuWarningThreshold > 100)) {
        throw new Error('cpuWarningThreshold must be a number between 10 and 100')
      }
      if ('memoryWarningThresholdMB' in process && (typeof process.memoryWarningThresholdMB !== 'number' || process.memoryWarningThresholdMB < 64 || process.memoryWarningThresholdMB > 32768)) {
        throw new Error('memoryWarningThresholdMB must be a number between 64 and 32768')
      }
    }
    const advanced = sanitized.advanced as Record<string, unknown> | undefined
    if (advanced) {
      if ('logLevel' in advanced && !['debug', 'info', 'warn', 'error'].includes(advanced.logLevel as string)) {
        throw new Error('logLevel must be debug, info, warn, or error')
      }
    }
    const windowSettings = sanitized.window as Record<string, unknown> | undefined
    if (windowSettings) {
      if ('autoGroupStrategy' in windowSettings && !['none', 'by-project', 'by-type'].includes(windowSettings.autoGroupStrategy as string)) {
        throw new Error('autoGroupStrategy must be none, by-project, or by-type')
      }
    }
  }

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

      // 白名单过滤 + 字段验证
      const sanitized = sanitizeSettingsUpdate(updates as Record<string, unknown>)
      validateSettingsFields(sanitized)

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
      const validation = validatePath(inputPath, settings.scan.allowedPaths)

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
        const validation = validatePath(scanPath, settings.scan.allowedPaths)
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid scan path')
        }
        return projectScanner.scanDirectory(validation.normalized!)
      }

      return projectScanner.scanCommonLocations(settings.scan.scanDrives)
    }
  ))

  ipcMain.handle('projects:scan-directory', withRateLimit(
    'projects:scan-directory', RATE_LIMITS.SCAN,
    async (_, dirPath: unknown) => {
      if (typeof dirPath !== 'string') {
        throw new Error('Directory path must be a string')
      }

      const settings = appStore.getSettings()
      const validation = validatePath(dirPath, settings.scan.allowedPaths)

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
      return projectScanner.discoverProjectsIntelligently(settings.scan.scanDrives)
    }
  ))

  // 获取系统可用盘符
  ipcMain.handle('system:get-drives', withRateLimit(
    'system:get-drives', RATE_LIMITS.SCAN,
    async () => {
      return projectScanner.getAvailableDrives()
    }
  ))

  // ==================== Project Watcher ====================

  // Set up watcher event forwarding to renderer
  projectWatcher.onChange((events) => {
    const mainWin = getMainWindow()
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.PROJECTS_WATCHER_DETECTED, events)
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_WATCHER_START, withRateLimit(
    IPC_CHANNELS.PROJECTS_WATCHER_START, RATE_LIMITS.ACTION,
    async (_, watchPaths?: unknown) => {
      const settings = appStore.getSettings()

      let paths: string[]
      if (watchPaths !== undefined) {
        // Validate user-supplied paths
        if (!Array.isArray(watchPaths)) {
          throw new Error('watchPaths must be an array')
        }
        const validated: string[] = []
        for (const p of watchPaths) {
          if (typeof p !== 'string') {
            throw new Error('Each watchPath must be a string')
          }
          const result = validatePath(p, settings.scan.allowedPaths)
          if (!result.valid) {
            throw new Error(`Invalid watch path "${p}": ${result.error}`)
          }
          validated.push(result.normalized!)
        }
        paths = validated
      } else {
        paths = settings.scan.scanDrives.map(d => `${d}:\\`)
      }

      await projectWatcher.start(paths)
      return { running: true }
    }
  ))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_WATCHER_STOP, withRateLimit(
    IPC_CHANNELS.PROJECTS_WATCHER_STOP, RATE_LIMITS.ACTION,
    async () => {
      await projectWatcher.stop()
      return { running: false }
    }
  ))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_WATCHER_STATUS, withRateLimit(
    IPC_CHANNELS.PROJECTS_WATCHER_STATUS, RATE_LIMITS.QUERY,
    () => {
      return { running: projectWatcher.isRunning }
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

export async function cleanupIpcHandlers(): Promise<void> {
  projectWatcher.clearChangeCallback()
  await projectWatcher.stop()
  cleanupProcessHandlers()
  cleanupPortHandlers()
  cleanupWindowHandlers()
  cleanupAITaskHandlers()
  cleanupNotificationHandlers()
  cleanupTaskHistoryHandlers()
}
