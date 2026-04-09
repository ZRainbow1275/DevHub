# DevHub 主进程代码审查报告

**审查日期**：2026-04-10  
**审查范围**：`src/main/` 所有 .ts 文件（排除 .test.ts）  
**审查模式**：完整代码审查  
**总问题数**：11 个

---

## 🔴 严重问题（CRITICAL）

### #1: ProjectWatcher 监听器内存泄漏

**文件**：`src/main/ipc/index.ts`  
**行号**：504-509  
**分类**：Memory Leak  
**严重级别**：CRITICAL

#### 问题代码
```typescript
projectWatcher.onChange((events) => {
  const mainWin = getMainWindow()
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(IPC_CHANNELS.PROJECTS_WATCHER_DETECTED, events)
  }
})
```

#### 问题描述
在模块级别注册的 `onChange` 回调在 `cleanupIpcHandlers()` 中无对应清理。多次初始化 IPC 处理器会累积监听器，导致内存泄漏和重复的事件派发。

#### 修复建议
**步骤 1**：修改 `ProjectWatcher` 类添加清理方法

```typescript
// src/main/services/ProjectWatcher.ts

export class ProjectWatcher {
  private watcher: FSWatcher | null = null
  private watchPaths: string[] = []
  private onChangeCallback: WatcherCallback | null = null  // 改为单个回调
  // ... 其他字段 ...

  /**
   * Register callback for project change events.
   */
  onChange(callback: WatcherCallback): void {
    this.onChangeCallback = callback
  }

  /**
   * Clear the change callback.
   */
  clearChangeCallback(): void {
    this.onChangeCallback = null
  }

  // ... 在现有的 emitChanges 方法中修改为 ...
  private emitChanges(events: WatcherEvent[]): void {
    if (this.onChangeCallback) {
      this.onChangeCallback(events)
    }
  }
}
```

**步骤 2**：修改 IPC 初始化代码

```typescript
// src/main/ipc/index.ts

export function registerIpcHandlers(
  appStore: AppStore,
  processManager: ProcessManager,
  toolMonitor: ToolMonitor,
  getMainWindow: () => BrowserWindow | null
): void {
  // ... 现有代码 ...

  // ==================== Project Watcher ====================

  // Set up watcher event forwarding to renderer
  projectWatcher.onChange((events) => {
    const mainWin = getMainWindow()
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.PROJECTS_WATCHER_DETECTED, events)
    }
  })

  // ... IPC 处理器 ...
}

export async function cleanupIpcHandlers(): Promise<void> {
  projectWatcher.clearChangeCallback()  // 添加此行
  await projectWatcher.stop()
  cleanupProcessHandlers()
  // ... 其他清理 ...
}
```

---

## 🔴 严重问题（HIGH）

### #2: AITaskTracker PowerShell 命令注入风险

**文件**：`src/main/services/AITaskTracker.ts`  
**行号**：298-305  
**分类**：Command Injection  
**严重级别**：HIGH

#### 问题代码
```typescript
const script = `
  Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    using System.Text;

    public class WindowTitle {
      [DllImport("user32.dll")]
      private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

      [DllImport("user32.dll")]
      private static extern int GetWindowTextLength(IntPtr hWnd);

      public static string GetTitle(IntPtr hWnd) {
        int length = GetWindowTextLength(hWnd);
        if (length == 0) return "";
        StringBuilder title = new StringBuilder(length + 1);
        GetWindowText(hWnd, title, title.Capacity);
        return title.ToString();
      }
    }
"@
  [WindowTitle]::GetTitle([IntPtr]${task.windowHwnd})  // ⚠️ 直接字符串插值
`

const psCommand = script.replace(/\n/g, ' ')
const { stdout } = await execFileAsync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
  { windowsHide: true }
)
```

#### 问题描述
虽然有 `validateHwnd()` 检查确保 `hwnd` 是整数，但 PowerShell 字符串插值和特殊字符处理不够完善。应该使用参数传递而非字符串插值。此外，PowerShell 命令在长字符串中可能包含特殊字符，增加注入风险。

#### 修复建议

```typescript
// src/main/services/AITaskTracker.ts

async detectWindowTitlePattern(task: AITask): Promise<{ isComplete: boolean; isError: boolean }> {
  if (!task.windowHwnd) {
    return { isComplete: false, isError: false }
  }

  // 验证 hwnd 防止命令注入
  if (!validateHwnd(task.windowHwnd)) {
    console.warn(`Invalid hwnd for detectWindowTitlePattern: ${task.windowHwnd}`)
    return { isComplete: false, isError: false }
  }

  try {
    // 改进：使用安全的整数转换，避免浮点数
    const hwndInt = Math.floor(task.windowHwnd)
    
    // 改进：将 C# 代码分离到常量，避免多行字符串复杂性
    const csharpCode = `
      using System;
      using System.Runtime.InteropServices;
      using System.Text;

      public class WindowTitle {
        [DllImport("user32.dll")]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        public static string GetTitle(IntPtr hWnd) {
          int length = GetWindowTextLength(hWnd);
          if (length == 0) return "";
          StringBuilder title = new StringBuilder(length + 1);
          GetWindowText(hWnd, title, title.Capacity);
          return title.ToString();
        }
      }
    `

    const psScript = `
      Add-Type @"
${csharpCode}
"@
      [WindowTitle]::GetTitle([IntPtr]${hwndInt})
    `

    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        psScript.replace(/\n/g, ' ')
      ],
      { windowsHide: true }
    )

    const title = stdout.trim()
    task.status.currentAction = title

    const isComplete = COMPLETION_PATTERNS.some(p => p.test(title))
    const isError = ERROR_PATTERNS.some(p => p.test(title))

    return { isComplete, isError }
  } catch (error) {
    console.warn('detectWindowTitlePattern failed:', error instanceof Error ? error.message : 'Unknown error')
    return { isComplete: false, isError: false }
  }
}
```

---

### #3: ProcessManager 启停竞态条件

**文件**：`src/main/services/ProcessManager.ts`  
**行号**：116-222  
**分类**：Race Condition  
**严重级别**：HIGH

#### 问题代码
```typescript
async start(project: Project, script: string): Promise<void> {
  // Validate script name
  if (!validateScriptName(script)) {
    throw new Error('Invalid script name')
  }

  // Check if script exists in project
  if (!project.scripts.includes(script)) {
    throw new Error(`Script "${script}" not found in project configuration`)
  }

  // Check if already running or starting (race condition guard)
  if (this.processes.has(project.id) || this._startingProjects.has(project.id)) {
    throw new Error('Project is already running')
  }

  // Mark as starting to prevent concurrent starts
  this._startingProjects.add(project.id)  // ← 标记点

  return new Promise((resolve, reject) => {
    try {
      // ... 长时间操作 ...
      const proc = spawn(cmd, args, { ... })

      // Handle process exit
      proc.on('exit', (code, signal) => {
        this.processes.delete(project.id)
        // 问题：此处无 _startingProjects.delete
        if (!this._stoppingProjects.has(project.id)) {
          // ...
        }
      })

      // Handle errors
      proc.on('error', (error) => {
        this._startingProjects.delete(project.id)  // ← 可能重复删除
        this.processes.delete(project.id)
        // ...
        reject(error)
      })

      // Resolve once spawned
      proc.on('spawn', () => {
        this.processes.set(project.id, proc)
        this._startingProjects.delete(project.id)  // ← 延后清理
        this.emitStatus(project.id, 'running', proc.pid)
        resolve()
      })
    } catch (error) {
      this._startingProjects.delete(project.id)
      reject(error)
    }
  })
}
```

#### 问题描述
标记和清理之间存在窗口期，可能导致：
1. `_startingProjects` 中的项目永不清理（如果 `exit` 事件先触发）
2. 多个事件处理器都尝试删除同一项，导致状态不一致
3. 并发调用可能在这个间隙中绕过检查

#### 修复建议

```typescript
// src/main/services/ProcessManager.ts

async start(project: Project, script: string): Promise<void> {
  // Validate script name
  if (!validateScriptName(script)) {
    throw new Error('Invalid script name')
  }

  // Check if script exists in project
  if (!project.scripts.includes(script)) {
    throw new Error(`Script "${script}" not found in project configuration`)
  }

  // Check if already running or starting (race condition guard)
  if (this.processes.has(project.id) || this._startingProjects.has(project.id)) {
    throw new Error('Project is already running')
  }

  // Mark as starting to prevent concurrent starts
  this._startingProjects.add(project.id)

  // 添加超时保险：防止 _startingProjects 中的项目永不清理
  const START_TIMEOUT_MS = 30000
  const startTimeout = setTimeout(() => {
    console.warn(`Start timeout for project ${project.id}, cleaning up`)
    this._startingProjects.delete(project.id)
  }, START_TIMEOUT_MS)

  return new Promise((resolve, reject) => {
    // 定义清理函数，防止重复删除
    let cleaned = false
    const cleanup = () => {
      if (!cleaned) {
        clearTimeout(startTimeout)
        this._startingProjects.delete(project.id)
        cleaned = true
      }
    }

    try {
      // Filter environment variables to only safe, necessary ones
      const SAFE_ENV_KEYS = [
        'PATH', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP',
        'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ComSpec',
        'GOPATH', 'GOROOT', 'CARGO_HOME', 'RUSTUP_HOME',
        'JAVA_HOME', 'MAVEN_HOME', 'GRADLE_HOME',
        'CONDA_PREFIX', 'VIRTUAL_ENV'
      ]
      const filteredEnv: Record<string, string> = {}
      for (const key of SAFE_ENV_KEYS) {
        if (process.env[key]) {
          filteredEnv[key] = process.env[key]!
        }
      }
      filteredEnv['FORCE_COLOR'] = '1'
      filteredEnv['NODE_ENV'] = 'development'

      // Resolve command based on project type
      const projectType = project.projectType || 'npm'
      const { cmd, args } = resolveCommand(projectType, script)

      const isWin = process.platform === 'win32'
      const proc = spawn(cmd, args, {
        cwd: project.path,
        shell: isWin,
        env: filteredEnv,
        windowsHide: false
      })

      // Log system message
      this.emitLog(project.id, 'system', `Starting: ${cmd} ${args.join(' ')}`)

      // Handle stdout
      proc.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        lines.forEach((line) => {
          this.emitLog(project.id, 'stdout', line)
        })
      })

      // Handle stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        lines.forEach((line) => {
          this.emitLog(project.id, 'stderr', line)
        })
      })

      // Handle process exit
      proc.on('exit', (code, signal) => {
        cleanup()  // 调用统一的清理函数
        this.processes.delete(project.id)
        // If we're stopping this project, skip duplicate status emit
        if (!this._stoppingProjects.has(project.id)) {
          const exitMessage = signal
            ? `Process killed with signal: ${signal}`
            : `Process exited with code: ${code}`
          this.emitLog(project.id, 'system', exitMessage)
          this.emitStatus(project.id, code === 0 ? 'stopped' : 'error')
        }
      })

      // Handle errors
      proc.on('error', (error) => {
        cleanup()  // 调用统一的清理函数
        this.processes.delete(project.id)
        this.emitLog(project.id, 'system', `Error: ${error.message}`)
        this.emitStatus(project.id, 'error')
        reject(error)
      })

      // Resolve once spawned
      proc.on('spawn', () => {
        cleanup()  // 清理启动超时
        this.processes.set(project.id, proc)
        this.emitStatus(project.id, 'running', proc.pid)
        resolve()
      })
    } catch (error) {
      cleanup()  // 异常时清理
      reject(error)
    }
  })
}
```

---

### #4: ToolMonitor 错误吞没和状态不一致

**文件**：`src/main/services/ToolMonitor.ts`  
**行号**：169-248  
**分类**：Error Handling / Logic Bug  
**严重级别**：HIGH

#### 问题代码
```typescript
private async checkTools(): Promise<void> {
  if (this.isStopped) return

  let hasActiveTools = false

  let allProcessNames: Set<string>
  try {
    allProcessNames = await this.getAllProcessNames()
  } catch (error) {
    console.warn(
      'Failed to get process list:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    // 问题：清除状态导致下次成功检查时虚假状态转变
    this.previousStatus.clear()
    this.tools.forEach((tool) => {
      this.previousStatus.set(tool.id, false)
    })
    this.adjustPollingInterval(false)
    return
  }

  if (this.isStopped) return

  let commandLines: string[] | null = null
  if (allProcessNames.has('node.exe')) {
    commandLines = await this.getNodeCommandLines()
  }

  for (const tool of this.tools) {
    if (this.isStopped) return

    try {
      const isRunning = this.isToolDetected(tool.id, allProcessNames, commandLines)
      const wasRunning = this.previousStatus.get(tool.id) ?? false

      if (isRunning) {
        hasActiveTools = true
      }

      // Update tool status
      if (isRunning) {
        tool.status = 'running'
        tool.lastRunAt = Date.now()
      } else if (wasRunning && !isRunning) {
        tool.status = 'completed'
        tool.lastCompletedAt = Date.now()

        if (this.shouldSendNotification(tool.id)) {
          this.lastNotificationTime.set(tool.id, Date.now())
          this.onCompletion?.(tool)
        }

        this.scheduleStatusReset(tool.id)
      } else {
        tool.status = 'idle'
      }

      this.previousStatus.set(tool.id, isRunning)
    } catch (error) {
      // 问题：单个工具失败时，其状态保留前次值，可能导致虚假通知
      console.warn(
        `Tool detection failed for ${tool.id}:`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  this.adjustPollingInterval(hasActiveTools)
}
```

#### 问题描述
1. 获取进程列表失败时，清除所有状态，导致下次成功检查时所有工具都显示从"stopped"转为"running"
2. 单个工具检测失败时，其状态保留前次值，可能导致虚假的"completed"通知
3. 无法追踪哪些工具检测持续失败

#### 修复建议

```typescript
// src/main/services/ToolMonitor.ts

private async checkTools(): Promise<void> {
  // 已停止时不做任何检查
  if (this.isStopped) return

  let hasActiveTools = false
  const failedToolDetections: Map<string, string> = new Map()

  // 一次性获取所有进程列表，避免为每个工具单独调用 tasklist
  let allProcessNames: Set<string>
  try {
    allProcessNames = await this.getAllProcessNames()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Critical: Failed to get process list: ${errorMsg}`)
    // 改进：当进程列表获取失败时，不更新任何状态，保持当前状态
    // 这样下次成功时才能正确判断状态转变
    this.adjustPollingInterval(false)
    return
  }

  // 二次检查：获取进程列表期间可能已被 stop()
  if (this.isStopped) return

  // 预先获取命令行信息（仅在有 node 进程时才需要）
  let commandLines: string[] | null = null
  if (allProcessNames.has('node.exe')) {
    try {
      commandLines = await this.getNodeCommandLines()
    } catch (error) {
      console.warn(
        'Failed to get node command lines:',
        error instanceof Error ? error.message : 'Unknown error'
      )
      // 如果无法获取详细命令行，则 node 进程检测会失败
      // 这是可接受的，至少进程列表是可用的
    }
  }

  for (const tool of this.tools) {
    // 检查是否已停止
    if (this.isStopped) return

    try {
      const isRunning = this.isToolDetected(tool.id, allProcessNames, commandLines)
      const wasRunning = this.previousStatus.get(tool.id) ?? false

      if (isRunning) {
        hasActiveTools = true
      }

      // Update tool status
      if (isRunning) {
        tool.status = 'running'
        tool.lastRunAt = Date.now()
      } else if (wasRunning && !isRunning) {
        // Transition from running to stopped = completed
        tool.status = 'completed'
        tool.lastCompletedAt = Date.now()

        // 通知去重：检查是否在去重时间窗口内
        if (this.shouldSendNotification(tool.id)) {
          this.lastNotificationTime.set(tool.id, Date.now())
          this.onCompletion?.(tool)
        }

        // 使用安全的状态重置方法
        this.scheduleStatusReset(tool.id)
      } else {
        tool.status = 'idle'
      }

      this.previousStatus.set(tool.id, isRunning)
    } catch (error) {
      // 改进：单个工具检测失败，记录但不中断其他工具检测
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      failedToolDetections.set(tool.id, errorMsg)
      console.warn(`Tool detection failed for ${tool.id}: ${errorMsg}`)
      
      // 改进：失败时保留原有状态，不更新
      // 这样多次失败也不会造成虚假状态转变
    }
  }

  // 改进：在循环结束后统一日志输出失败信息
  if (failedToolDetections.size > 0) {
    const failedList = Array.from(failedToolDetections.entries())
      .map(([id, err]) => `${id}(${err})`)
      .join('; ')
    console.warn(`Tool detection batch had ${failedToolDetections.size} failures: ${failedList}`)
  }

  // 根据活跃状态调整下次轮询间隔
  this.adjustPollingInterval(hasActiveTools)
}
```

---

### #5: NotificationService 去重记录内存泄漏

**文件**：`src/main/services/NotificationService.ts`  
**行号**：62-72  
**分类**：Memory Leak  
**严重级别**：HIGH

#### 问题代码
```typescript
private recordNotification(dedupKey: string): void {
  this.recentNotifications.set(dedupKey, Date.now())

  // 清理过期的去重记录
  const now = Date.now()
  for (const [key, time] of this.recentNotifications) {
    if (now - time >= NotificationService.DEDUP_WINDOW_MS) {
      this.recentNotifications.delete(key)
    }
  }
}
```

#### 问题描述
清理逻辑只在 `recordNotification()` 被调用时触发。如果有 20+ 个唯一的 `dedupKey` 值且后续停止发送通知，这些键永远不会被清理，导致内存泄漏。

#### 修复建议

```typescript
// src/main/services/NotificationService.ts

export class NotificationService {
  private config: NotificationConfig = {
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
  private history: AppNotification[] = []
  private mainWindow: BrowserWindow | null = null

  // 通知去重：基于 dedup key + 时间窗口
  private recentNotifications = new Map<string, number>()
  private static readonly DEDUP_WINDOW_MS = 30000 // 30秒去重窗口
  
  // 改进：添加定期清理机制
  private cleanupInterval: NodeJS.Timeout | null = null
  private static readonly CLEANUP_INTERVAL_MS = 30000  // 每 30 秒清理一次

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null
    this.startCleanupTimer()
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupRecentNotifications()
    }, NotificationService.CLEANUP_INTERVAL_MS)
    
    // 设置 unref 避免定时器阻止进程退出
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  private cleanupRecentNotifications(): void {
    const now = Date.now()
    let cleaned = 0
    for (const [key, time] of this.recentNotifications) {
      if (now - time >= NotificationService.DEDUP_WINDOW_MS) {
        this.recentNotifications.delete(key)
        cleaned++
      }
    }
    if (cleaned > 0) {
      console.debug(`Cleaned ${cleaned} expired dedup entries`)
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  setConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): NotificationConfig {
    return { ...this.config }
  }

  isTypeEnabled(type: NotificationType): boolean {
    return this.config.enabled && this.config.types[type]
  }

  /**
   * 检查通知是否在去重窗口内（防止 ToolMonitor 和 AITaskTracker 重复发送）
   * @param dedupKey 去重键（例如 toolId 或 toolType）
   * @returns true 表示应该被去重（跳过），false 表示可以发送
   */
  isDuplicate(dedupKey: string): boolean {
    const lastTime = this.recentNotifications.get(dedupKey)
    if (lastTime === undefined) return false
    return (Date.now() - lastTime) < NotificationService.DEDUP_WINDOW_MS
  }

  /**
   * 记录已发送的通知用于去重
   */
  private recordNotification(dedupKey: string): void {
    this.recentNotifications.set(dedupKey, Date.now())
    // 改进：删除内联清理逻辑，改为定期清理
  }

  async notify(
    type: NotificationType,
    title: string,
    body: string,
    options?: {
      icon?: string
      actions?: { label: string; action: string }[]
      dedupKey?: string  // 可选的去重键
    }
  ): Promise<void> {
    if (!this.isTypeEnabled(type)) return

    // 去重检查
    if (options?.dedupKey) {
      if (this.isDuplicate(options.dedupKey)) {
        return
      }
      this.recordNotification(options.dedupKey)
    }

    // Create notification record
    const notification: AppNotification = {
      id: `notif_${Date.now()}`,
      type,
      title,
      body,
      icon: options?.icon,
      actions: options?.actions,
      createdAt: Date.now(),
      read: false
    }

    this.history.unshift(notification)
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100)
    }

    // Send to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('notification:new', notification)
    }

    // Show system notification
    if (Notification.isSupported()) {
      const systemNotif = new Notification({
        title,
        body,
        silent: !this.config.sound
      })

      systemNotif.on('click', () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show()
          this.mainWindow.focus()
        }
      })

      systemNotif.show()
    }
  }

  notifyTaskComplete(toolName: string, duration: number, alias?: string): void {
    const displayName = alias ?? toolName
    this.notify(
      'task-complete',
      `[${displayName}] 任务完成`,
      `${toolName} · 耗时: ${Math.round(duration / 1000)}秒`,
      { dedupKey: `task-complete:${toolName}` }
    )
  }

  notifyPortConflict(port: number, processName: string): void {
    this.notify(
      'port-conflict',
      '端口冲突检测',
      `端口 ${port} 被 ${processName} 占用`,
      {
        actions: [
          { label: '释放端口', action: `release-port:${port}` }
        ]
      }
    )
  }

  notifyZombieProcess(count: number): void {
    this.notify(
      'zombie-process',
      '僵尸进程检测',
      `检测到 ${count} 个可能的僵尸进程`,
      {
        actions: [
          { label: '清理', action: 'cleanup-zombies' }
        ]
      }
    )
  }

  notifyHighResource(processName: string, cpu: number, memory: number): void {
    const issues: string[] = []
    if (cpu > 80) issues.push(`CPU: ${cpu.toFixed(1)}%`)
    if (memory > 1000) issues.push(`内存: ${memory}MB`)

    this.notify(
      'high-resource',
      '资源使用警告',
      `${processName} 资源占用过高 (${issues.join(', ')})`
    )
  }

  notifyProjectError(projectName: string, error: string): void {
    this.notify(
      'project-error',
      `项目错误: ${projectName}`,
      error.length > 100 ? error.slice(0, 100) + '...' : error
    )
  }

  getHistory(limit?: number): AppNotification[] {
    return limit ? this.history.slice(0, limit) : [...this.history]
  }

  markAsRead(notificationId: string): void {
    const notification = this.history.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
    }
  }

  markAllAsRead(): void {
    this.history.forEach(n => { n.read = true })
  }

  clearHistory(): void {
    this.history = []
  }

  getUnreadCount(): number {
    return this.history.filter(n => !n.read).length
  }

  // 改进：添加销毁方法用于清理资源
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.recentNotifications.clear()
  }
}

let notificationService: NotificationService | null = null

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService()
  }
  return notificationService
}

export function initNotificationService(mainWindow: BrowserWindow): NotificationService {
  notificationService = new NotificationService(mainWindow)
  return notificationService
}
```

**应用退出时清理**：
```typescript
// src/main/index.ts

app.on('before-quit', (event) => {
  if (isQuitting) return
  isQuitting = true
  event.preventDefault()

  // 关键：先停止 toolMonitor，避免 processManager.stopAll() 终止进程时
  // 被 toolMonitor 误判为"任务正常完成"而发出虚假通知
  toolMonitor.stop()

  // 清理 NotificationService
  const notificationService = getNotificationService()
  notificationService.destroy()

  Promise.all([
    processManager.stopAll(),
    cleanupIpcHandlers()
  ]).finally(() => {
    app.exit(0)
  })
})
```

---

## 🟡 中等问题（MEDIUM）

### #6: 类型不安全的强制转换

**文件**：`src/main/ipc/aiTaskHandlers.ts`  
**行号**：145-146  
**分类**：Type Safety  
**严重级别**：MEDIUM

#### 问题代码
```typescript
ipcMain.handle(IPC_CHANNELS_EXT.AI_ALIAS_SET, withRateLimit(
  IPC_CHANNELS_EXT.AI_ALIAS_SET, RATE_LIMITS.ACTION,
  async (_, alias: unknown): Promise<boolean> => {
    if (!aliasManager) return false
    validateObject(alias, 'alias')
    const a = alias as unknown as AIWindowAlias  // ⚠️ 双重强制转换
    guardProtoPollution(alias)
    validateString(a.id, 'alias.id')
    validateString(a.alias, 'alias.alias', 100)
    if (!a.matchCriteria || typeof a.matchCriteria !== 'object') {
      throw new Error('Invalid alias: matchCriteria must be an object')
    }
    return aliasManager.set(a)
  }
))
```

#### 问题描述
双重 `as unknown as` 转换规避了 TypeScript 类型检查。虽然后续有运行时验证，但这是不安全的模式，可能导致运行时错误。

#### 修复建议

```typescript
// src/main/ipc/aiTaskHandlers.ts

ipcMain.handle(IPC_CHANNELS_EXT.AI_ALIAS_SET, withRateLimit(
  IPC_CHANNELS_EXT.AI_ALIAS_SET, RATE_LIMITS.ACTION,
  async (_, alias: unknown): Promise<boolean> => {
    if (!aliasManager) return false
    
    // Step 1: 验证基本结构
    validateObject(alias, 'alias')
    guardProtoPollution(alias)
    
    const aliasObj = alias as Record<string, unknown>
    
    // Step 2: 逐字段验证和提取
    validateString(aliasObj.id as string, 'alias.id')
    validateString(aliasObj.alias as string, 'alias.alias', 100)
    
    if (!aliasObj.matchCriteria || typeof aliasObj.matchCriteria !== 'object') {
      throw new Error('Invalid alias: matchCriteria must be an object')
    }
    
    guardProtoPollution(aliasObj.matchCriteria)
    
    // Step 3: 构造类型安全的对象
    const validAlias: AIWindowAlias = {
      id: aliasObj.id as string,
      alias: aliasObj.alias as string,
      matchCriteria: aliasObj.matchCriteria as AIWindowAlias['matchCriteria'],
      color: typeof aliasObj.color === 'string' ? aliasObj.color : undefined,
      lastMatchedAt: typeof aliasObj.lastMatchedAt === 'number' ? aliasObj.lastMatchedAt : undefined
    }
    
    return aliasManager.set(validAlias)
  }
))
```

---

### #7: 未验证的日期字符串解析

**文件**：`src/main/ipc/taskHistoryHandlers.ts`  
**行号**：123-127  
**分类**：Error Handling  
**严重级别**：MEDIUM

#### 问题代码
```typescript
const parsedOptions = {
  ...options,
  startDate: options?.startDate ? new Date(options.startDate) : undefined,
  endDate: options?.endDate ? new Date(options.endDate) : undefined
}

return taskHistoryStore.getRecords(parsedOptions)
```

#### 问题描述
如果 `options.startDate` 是无效的日期字符串（如 `"invalid-date"`），`new Date()` 会返回一个 `Invalid Date` 对象。这可能导致静默失败或在 `getRecords()` 中产生意外行为。

#### 修复建议

```typescript
// src/main/ipc/taskHistoryHandlers.ts

ipcMain.handle('task-history:list', withRateLimit(
  'task-history:list', RATE_LIMITS.QUERY,
  async (_, options?: {
    type?: TaskType
    projectId?: string
    status?: TaskRecordStatus
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
  }): Promise<TaskRecord[]> => {
    if (!taskHistoryStore) return []

    if (options !== undefined) {
      validateObject(options, 'options')
      guardProtoPollution(options)
    }

    // 改进：验证和解析日期
    const parseDate = (dateStr?: string): Date | undefined => {
      if (!dateStr) return undefined
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: "${dateStr}". Expected ISO 8601 format (e.g., 2026-04-10T00:00:00Z)`)
      }
      return date
    }

    const parsedOptions = {
      ...options,
      startDate: parseDate(options?.startDate),
      endDate: parseDate(options?.endDate)
    }

    // 改进：验证 startDate 不晚于 endDate
    if (parsedOptions.startDate && parsedOptions.endDate) {
      if (parsedOptions.startDate > parsedOptions.endDate) {
        throw new Error('startDate must be before or equal to endDate')
      }
    }

    return taskHistoryStore.getRecords(parsedOptions)
  }
))
```

---

### #8: PortScanner CSV 解析的边界检查缺陷

**文件**：`src/main/services/PortScanner.ts`  
**行号**：196-214  
**分类**：Input Validation  
**严重级别**：MEDIUM

#### 问题代码
```typescript
private parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {  // ⚠️ 无边界检查
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}
```

#### 问题描述
在访问 `line[i + 1]` 前没有检查 `i + 1 < line.length`。虽然在此特定上下文中不太可能出现越界，但这是防御性编程的遗漏。

#### 修复建议

```typescript
// src/main/services/PortScanner.ts

private parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // 改进：添加边界检查
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}
```

---

### #9: 可选链访问的类型检查不明确

**文件**：`src/main/services/PortScanner.ts`  
**行号**：170-178  
**分类**：Type Safety  
**严重级别**：MEDIUM

#### 问题代码
```typescript
const fields = this.parseCsvLine(line)
if (fields.length < 2) continue

const pidStr = fields[0]?.trim()   // 可能是 undefined
const name = fields[1]?.trim()     // 可能是 undefined

if (name && pidStr) {
  const pid = parseInt(pidStr, 10)  // pidStr 在类型系统中可能是 string | undefined
  if (!isNaN(pid)) {
    this.processNameCache.set(pid, name)
  }
}
```

#### 问题描述
虽然代码在运行时是安全的（有 `if (name && pidStr)` 检查），但从类型安全的角度，`pidStr?.trim()` 返回 `string | undefined`。TypeScript 类型检查需要更明确的守卫。

#### 修复建议

```typescript
// src/main/services/PortScanner.ts

const fields = this.parseCsvLine(line)
if (fields.length < 2) continue

const pidStr = fields[0]?.trim()
const name = fields[1]?.trim()

// 改进：更明确的类型守卫
if (name && pidStr && typeof pidStr === 'string' && typeof name === 'string') {
  const pid = parseInt(pidStr, 10)
  if (!isNaN(pid) && pid > 0) {
    this.processNameCache.set(pid, name)
  }
}
```

或者使用类型断言更严格：

```typescript
const pidField = fields[0]
const nameField = fields[1]

if (!pidField || !nameField) continue

const pidStr = pidField.trim()
const name = nameField.trim()

if (pidStr && name) {
  const pid = parseInt(pidStr, 10)
  if (!isNaN(pid) && pid > 0) {
    this.processNameCache.set(pid, name)
  }
}
```

---

## 🔵 低优先级问题（LOW）

### #10: ProcessManager 错误日志缺乏堆栈跟踪

**文件**：`src/main/services/ProcessManager.ts`  
**行号**：202-208  
**分类**：Logging / Debugging  
**严重级别**：LOW

#### 问题代码
```typescript
proc.on('error', (error) => {
  this._startingProjects.delete(project.id)
  this.processes.delete(project.id)
  this.emitLog(project.id, 'system', `Error: ${error.message}`)  // ⚠️ 无堆栈信息
  this.emitStatus(project.id, 'error')
  reject(error)
})
```

#### 问题描述
仅记录错误消息，不记录堆栈跟踪。对于生产环境中的故障排查困难，尤其是当错误信息不够详细时。

#### 修复建议

```typescript
// src/main/services/ProcessManager.ts

proc.on('error', (error) => {
  this._startingProjects.delete(project.id)
  this.processes.delete(project.id)
  
  // 改进：记录完整的错误信息包括堆栈
  const errorDetails = error instanceof Error 
    ? `${error.message}\nStack: ${error.stack || 'no stack trace'}`
    : `Unknown error: ${String(error)}`
  
  this.emitLog(project.id, 'system', `Error: ${errorDetails}`)
  this.emitStatus(project.id, 'error')
  reject(error)
})
```

或者为了避免日志过长，可以添加日志级别控制：

```typescript
proc.on('error', (error) => {
  this._startingProjects.delete(project.id)
  this.processes.delete(project.id)
  
  const errorMsg = error instanceof Error ? error.message : String(error)
  this.emitLog(project.id, 'system', `Error: ${errorMsg}`)
  
  // 仅在调试模式下记录堆栈
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    console.error(`[${project.id}] Error stack:`, error.stack)
  }
  
  this.emitStatus(project.id, 'error')
  reject(error)
})
```

---

### #11: WindowManager C# 代码重复编译

**文件**：`src/main/services/WindowManager.ts`  
**行号**：56-58  
**分类**：Performance / Code Quality  
**严重级别**：LOW

#### 问题代码
```typescript
private static readonly HELPER_ADD_TYPE = `Add-Type @"
using System; using System.Runtime.InteropServices; public class WindowHelper { ... }
"@`

// 每次调用都使用这个常量
const psScript = `${WindowManager.HELPER_ADD_TYPE}\n[WindowHelper]::Focus([IntPtr]${hwnd})`
```

#### 问题描述
每次 PowerShell 调用都必须重新解析和编译 C# 代码。虽然代码是硬编码的（非用户输入），但这会增加每次调用的延迟。在高频调用时，这是性能浪费。

#### 修复建议

**方案 A：使用 PowerShell 会话缓存（推荐）**

```typescript
// src/main/services/WindowManager.ts

export class WindowManager {
  private windows = new Map<number, WindowInfo>()
  private groups = new Map<string, WindowGroup>()
  private layouts: WindowLayout[] = []
  private store: Store<WindowLayoutData>
  private saveTimeout: NodeJS.Timeout | null = null
  
  // 改进：缓存 C# 代码是否已编译
  private static csharpCompiled = false
  
  // 改进：提取 C# 代码到常量
  private static readonly CSHARP_CODE = `
    using System;
    using System.Runtime.InteropServices;
    public class WindowHelper {
      [DllImport("user32.dll")]
      public static extern bool SetForegroundWindow(IntPtr hWnd);
      // ... 其他方法 ...
    }
  `

  constructor() {
    this.store = new Store<WindowLayoutData>({
      name: 'devhub-window-layouts',
      schema: layoutSchema
    })
    this.loadFromDisk()
  }

  // 改进：确保 C# 代码已编译
  private static async ensureCSharpCompiled(): Promise<void> {
    if (WindowManager.csharpCompiled) return
    
    try {
      const psCmd = `Add-Type @"${WindowManager.CSHARP_CODE}"@`
      await execFileAsync('powershell', ['-NoProfile', '-Command', psCmd], {
        windowsHide: true
      })
      WindowManager.csharpCompiled = true
      console.debug('C# WindowHelper compiled successfully')
    } catch (error) {
      console.error('Failed to compile C# WindowHelper:', error)
      // 不抛出异常，后续调用时会再试
    }
  }

  async focusWindow(hwnd: number): Promise<ServiceResult> {
    validateHwnd(hwnd)
    
    try {
      // 确保 C# 已编译
      await WindowManager.ensureCSharpCompiled()
      
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-Command', `[WindowHelper]::Focus([IntPtr]${hwnd})`],
        { windowsHide: true }
      )
      
      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`focusWindow(${hwnd}) failed:`, msg)
      return { success: false, error: msg }
    }
  }

  // ... 其他方法类似修改 ...
}
```

**方案 B：提取到单独的初始化文件（备选）**

```typescript
// src/main/services/WindowHelperManager.ts

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const CSHARP_CODE = `
  using System;
  using System.Runtime.InteropServices;
  public class WindowHelper {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    // ... 其他方法 ...
  }
`

let isInitialized = false

export async function initializeWindowHelper(): Promise<void> {
  if (isInitialized) return
  
  try {
    const psCmd = `Add-Type @"${CSHARP_CODE}"@`
    await execFileAsync('powershell', ['-NoProfile', '-Command', psCmd], {
      windowsHide: true
    })
    isInitialized = true
    console.debug('WindowHelper initialized')
  } catch (error) {
    console.error('Failed to initialize WindowHelper:', error)
    throw error
  }
}
```

然后在应用启动时调用：

```typescript
// src/main/index.ts

app.whenReady().then(async () => {
  // ... 现有代码 ...
  
  // 预初始化 WindowHelper
  try {
    await initializeWindowHelper()
  } catch (error) {
    console.warn('WindowHelper initialization failed, will retry on first use')
  }
  
  // ... 创建窗口等 ...
})
```

---

## 问题总结统计

| 级别 | 数量 | 分类 |
|------|------|------|
| 🔴 CRITICAL | 1 | Memory Leak |
| 🔴 HIGH | 4 | Command Injection (1), Race Condition (1), Error Handling (1), Memory Leak (1) |
| 🟡 MEDIUM | 4 | Type Safety (2), Error Handling (1), Input Validation (1) |
| 🔵 LOW | 2 | Logging (1), Performance (1) |
| **总计** | **11** |  |

---

## 修复优先级建议

### 立即修复（P0 - 本周）
1. **#1 ProjectWatcher 监听器泄漏** - 导致内存泄漏
2. **#3 ProcessManager 竞态条件** - 导致进程状态不一致
3. **#5 NotificationService 去重泄漏** - 导致内存占用增加

### 本周修复（P1 - 本周内）
4. **#2 PowerShell 命令注入** - 安全风险
5. **#4 ToolMonitor 错误吞没** - 导致虚假通知

### 近期修复（P2 - 本月）
6. **#6 类型不安全转换** - 运行时错误风险
7. **#7 未验证日期解析** - 静默失败风险
8. **#8 CSV 边界检查** - 潜在越界（低概率）
9. **#9 可选链类型检查** - 可维护性

### 改进（P3 - 计划）
10. **#10 错误日志堆栈** - 改进调试体验
11. **#11 C# 代码编译** - 性能优化

---

## 验证检查清单

修复完成后，请按以下检查清单验证：

- [ ] 所有编译错误已解决
- [ ] TypeScript strict mode 通过
- [ ] 单元测试覆盖率 >= 80%
- [ ] 内存泄漏测试（长时间运行 > 2 小时）
- [ ] 竞态条件测试（并发启停进程 10+ 次）
- [ ] PowerShell 命令注入测试（特殊字符输入）
- [ ] 日期解析测试（各种日期格式）
- [ ] CSV 解析测试（边界情况）

---

**报告完成时间**：2026-04-10 UTC  
**审查者**：Claude Code  
**下一步**：请根据优先级开始修复，每个修复完成后运行相应的测试。
