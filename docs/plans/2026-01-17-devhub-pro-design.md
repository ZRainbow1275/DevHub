# DevHub Pro 设计文档

> 开发者的统一控制中心

**日期**: 2026-01-17
**版本**: 1.0
**状态**: 设计阶段

---

## 一、产品定位

### 1.1 核心定位

**DevHub Pro** — 通用开发环境管理中心 + AI 编程工具监控

```
┌─────────────────────────────────────────────────────────────┐
│                      DevHub Pro                              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   项目管理    │   进程监控    │   窗口管理    │   AI 任务追踪   │
│  (现有能力)   │ (参考DJ重写)  │   (创新)     │    (创新)      │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

### 1.2 与 Dev-Janitor 的关系

| 方面 | Dev-Janitor | DevHub Pro |
|------|-------------|------------|
| 定位 | 开发环境清理工具 | 开发工作流控制中心 |
| 项目管理 | ❌ 无 | ✅ 核心功能 |
| 进程监控 | ✅ 基础监控 | ✅ 增强 + 项目关联 |
| 端口检测 | ✅ 有 | ✅ 参考重写 |
| 窗口管理 | ❌ 无 | ✅ 分组 + 布局记忆 |
| AI 工具监控 | ❌ 无 | ✅ 任务完成检测 |
| 实时通知 | ❌ 无 | ✅ Windows 通知 |

### 1.3 核心价值主张

| 痛点 | 传统方式 | DevHub Pro 解决方案 |
|------|---------|-------------------|
| 窗口混乱 | 开 10 个终端找不到 | 按项目分组，一键定位 |
| 端口冲突 | 手动 netstat 查找 | 提前检测，一键释放 |
| 遗忘进程 | 不知道后台跑了什么 | 后台进程警告 + 批量清理 |
| 状态不透明 | 切窗口看进度 | 实时状态 + 完成通知推送 |

---

## 二、技术架构

### 2.1 整体架构

```
┌────────────────────────────────────────────────────────────┐
│                    Renderer Process (React)                 │
├────────────────────────────────────────────────────────────┤
│  ProjectView │ ProcessView │ WindowView │ AITaskView       │
│  SettingsView │ StatusBar │ NotificationCenter             │
└────────────────────────────────────────────────────────────┘
                              │ IPC
┌────────────────────────────────────────────────────────────┐
│                    Main Process (Electron)                  │
├────────────────────────────────────────────────────────────┤
│  ProjectManager      (现有 - 项目管理)                       │
│  ProcessManager      (现有 - 增强)                          │
│  PortScanner         (新增 - 端口检测)                       │
│  WindowManager       (新增 - 窗口分组/布局)                   │
│  AITaskTracker       (新增 - AI 工具监控)                    │
│  NotificationService (新增 - Windows 通知)                   │
│  TaskHistoryStore    (新增 - 任务历史)                       │
└────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────┐
│                    System Layer                             │
├────────────────────────────────────────────────────────────┤
│  Windows API │ tasklist │ netstat │ wmic │ PowerShell      │
└────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 |
|------|---------|
| 框架 | Electron 30+ |
| 前端 | React 18 + TypeScript |
| 状态管理 | Zustand |
| UI 组件 | 自定义 + Tailwind CSS |
| 构建工具 | Vite + electron-builder |
| 进程管理 | tree-kill, tasklist |
| 通知 | electron Notification API |

---

## 三、功能模块详细设计

### 3.1 模块 1：进程监控 (ProcessMonitor)

**参考 Dev-Janitor 的 `serviceMonitor.ts`，重写实现**

#### 数据结构

```typescript
interface ProcessInfo {
  pid: number
  name: string
  command: string
  port?: number
  cpu: number          // CPU 使用率 (%)
  memory: number       // 内存占用 (MB)
  status: 'running' | 'idle' | 'waiting'
  projectId?: string   // 关联的项目
  startTime: Date
  type: 'dev-server' | 'ai-tool' | 'build' | 'other'
}

interface ProcessGroup {
  projectId: string
  projectName: string
  processes: ProcessInfo[]
  totalCpu: number
  totalMemory: number
}
```

#### 核心功能

| 功能 | 实现方式 | 说明 |
|------|---------|------|
| 进程扫描 | `tasklist /FO CSV /V` | 获取所有进程详情 |
| 端口关联 | `netstat -ano` | 解析端口-PID 映射 |
| 资源监控 | `wmic process` | 获取 CPU/内存使用 |
| 进程终止 | `tree-kill` | 终止进程树 |
| 自动刷新 | 5 秒轮询 | 可配置间隔 |
| 项目关联 | 工作目录匹配 | 自动关联到项目 |

#### 关键实现

```typescript
class ProcessMonitor {
  private refreshInterval: number = 5000
  private processes: Map<number, ProcessInfo> = new Map()

  // 扫描所有开发相关进程
  async scanDevProcesses(): Promise<ProcessInfo[]> {
    const tasks = await this.execTasklist()
    const ports = await this.execNetstat()
    return this.mergeProcessData(tasks, ports)
  }

  // 按项目分组
  groupByProject(processes: ProcessInfo[]): ProcessGroup[] {
    // 通过工作目录、命令行参数匹配项目
  }

  // 检测僵尸进程 (CPU=0, 运行时间>1h)
  findZombieProcesses(): ProcessInfo[] {
    return [...this.processes.values()].filter(p =>
      p.cpu === 0 &&
      Date.now() - p.startTime.getTime() > 3600000
    )
  }

  // 终止进程
  async killProcess(pid: number, force: boolean = false): Promise<boolean>

  // 批量清理
  async cleanupZombies(): Promise<number>
}
```

---

### 3.2 模块 2：端口管理 (PortScanner)

#### 数据结构

```typescript
interface PortInfo {
  port: number
  pid: number
  processName: string
  state: 'LISTENING' | 'ESTABLISHED' | 'TIME_WAIT'
  protocol: 'TCP' | 'UDP'
  localAddress: string
  projectId?: string   // 自动关联项目
}

// 常用开发端口
const COMMON_DEV_PORTS = [
  3000,  // React/Next.js 默认
  3001,  // 备用
  4000,  // 常用 API
  5000,  // Flask/ASP.NET
  5173,  // Vite 默认
  5174,  // Vite 备用
  8000,  // Django/uvicorn
  8080,  // 常用 HTTP
  8888,  // Jupyter
  9000,  // PHP-FPM
]
```

#### 核心功能

```typescript
class PortScanner {
  // 扫描所有端口
  async scanAll(): Promise<PortInfo[]> {
    const output = await exec('netstat -ano -p TCP')
    return this.parseNetstatOutput(output)
  }

  // 检查特定端口
  async checkPort(port: number): Promise<PortInfo | null>

  // 检查端口是否可用
  async isPortAvailable(port: number): Promise<boolean>

  // 释放端口 (终止占用进程)
  async releasePort(port: number): Promise<boolean> {
    const info = await this.checkPort(port)
    if (info) {
      return await this.processMonitor.killProcess(info.pid)
    }
    return true
  }

  // 获取下一个可用端口
  async findAvailablePort(startPort: number): Promise<number>

  // 端口冲突检测 (启动项目前调用)
  async detectConflicts(projectPorts: number[]): Promise<PortInfo[]>
}
```

---

### 3.3 模块 3：窗口管理 (WindowManager)

#### 数据结构

```typescript
interface WindowInfo {
  hwnd: number          // Windows 窗口句柄
  title: string
  processName: string
  pid: number
  className: string
  rect: { x: number, y: number, width: number, height: number }
  isVisible: boolean
  isMinimized: boolean
}

interface WindowGroup {
  id: string
  name: string          // 项目名称
  projectId?: string
  windows: WindowInfo[]
  createdAt: Date
}

interface WindowLayout {
  id: string
  name: string          // 如 "前端开发布局"
  description?: string
  groups: {
    groupId: string
    windows: {
      processName: string
      titlePattern: string  // 正则匹配
      rect: { x: number, y: number, width: number, height: number }
    }[]
  }[]
  createdAt: Date
  updatedAt: Date
}
```

#### 核心功能

```typescript
class WindowManager {
  private groups: Map<string, WindowGroup> = new Map()
  private layouts: Map<string, WindowLayout> = new Map()

  // 扫描所有窗口
  async scanAllWindows(): Promise<WindowInfo[]> {
    // 使用 PowerShell 或 node-ffi 调用 Windows API
    // EnumWindows + GetWindowText + GetWindowRect
  }

  // 过滤开发相关窗口
  filterDevWindows(windows: WindowInfo[]): WindowInfo[] {
    const devProcesses = [
      'node.exe', 'python.exe', 'code.exe', 'idea64.exe',
      'WindowsTerminal.exe', 'cmd.exe', 'powershell.exe',
      'chrome.exe', 'msedge.exe', 'firefox.exe'
    ]
    return windows.filter(w => devProcesses.includes(w.processName))
  }

  // 按项目自动分组
  autoGroupByProject(windows: WindowInfo[], projects: Project[]): WindowGroup[]

  // 创建手动分组
  createGroup(name: string, windowHwnds: number[]): WindowGroup

  // 聚焦窗口
  async focusWindow(hwnd: number): Promise<void> {
    // SetForegroundWindow API
  }

  // 聚焦整个分组
  async focusGroup(groupId: string): Promise<void>

  // 保存当前布局
  async saveLayout(name: string): Promise<WindowLayout>

  // 恢复布局
  async restoreLayout(layoutId: string): Promise<void> {
    // 移动窗口到保存的位置
    // SetWindowPos API
  }

  // 最小化分组
  async minimizeGroup(groupId: string): Promise<void>

  // 关闭分组所有窗口
  async closeGroup(groupId: string): Promise<void>
}
```

#### Windows API 调用方式

```typescript
// 方案 1: PowerShell (简单但较慢)
async function getWindowsViaPowerShell(): Promise<WindowInfo[]> {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        // ... 其他 API
      }
    "@
    # 枚举窗口并返回 JSON
  `
  const output = await exec(`powershell -Command "${script}"`)
  return JSON.parse(output)
}

// 方案 2: node-ffi-napi (快速但需要原生模块)
import ffi from 'ffi-napi'
const user32 = ffi.Library('user32', {
  'EnumWindows': ['bool', ['pointer', 'int32']],
  'GetWindowTextW': ['int', ['int32', 'pointer', 'int']],
  'SetForegroundWindow': ['bool', ['int32']],
  'SetWindowPos': ['bool', ['int32', 'int32', 'int', 'int', 'int', 'int', 'uint']]
})
```

---

### 3.4 模块 4：AI 任务追踪 (AITaskTracker)

#### 数据结构

```typescript
type AIToolType = 'codex' | 'claude-code' | 'gemini-cli' | 'cursor' | 'other'

interface AITaskStatus {
  state: 'running' | 'waiting' | 'completed' | 'error' | 'idle'
  progress?: number     // 0-100, 如果可检测
  lastActivity: Date
  currentAction?: string
}

interface AITask {
  id: string
  toolType: AIToolType
  pid: number
  windowHwnd?: number
  startTime: Date
  endTime?: Date
  status: AITaskStatus
  projectId?: string

  // 检测指标
  metrics: {
    cpuHistory: number[]      // 最近 N 次采样
    outputLineCount: number   // 输出行数
    lastOutputTime: Date
    idleDuration: number      // 空闲时长 (ms)
  }
}

interface AITaskHistory {
  id: string
  toolType: AIToolType
  projectId?: string
  startTime: Date
  endTime: Date
  duration: number      // 耗时 (ms)
  status: 'completed' | 'error' | 'cancelled'
  summary?: string      // 可选的任务摘要
}
```

#### 完成检测策略 (组合策略)

```typescript
interface CompletionDetector {
  // 策略权重
  weights: {
    outputPattern: 0.4,    // 输出模式匹配
    cpuIdle: 0.25,         // CPU 空闲检测
    cursorWaiting: 0.2,    // 等待输入状态
    timeThreshold: 0.15    // 时间阈值
  }

  // 检测阈值
  thresholds: {
    cpuIdlePercent: 5,           // CPU 使用率 < 5%
    cpuIdleDuration: 10000,      // 持续 10 秒
    noOutputDuration: 15000,     // 无输出 15 秒
    confidenceThreshold: 0.75    // 置信度阈值
  }
}

class AITaskTracker {
  private tasks: Map<string, AITask> = new Map()
  private history: AITaskHistory[] = []
  private detector: CompletionDetector

  // 注册 AI 工具进程
  registerAIProcess(pid: number, toolType: AIToolType): AITask

  // 检测任务完成 (核心算法)
  async detectCompletion(task: AITask): Promise<{
    isCompleted: boolean
    confidence: number
    signals: {
      outputPattern: boolean
      cpuIdle: boolean
      cursorWaiting: boolean
      timeThreshold: boolean
    }
  }> {
    const signals = {
      outputPattern: await this.checkOutputPattern(task),
      cpuIdle: this.checkCpuIdle(task),
      cursorWaiting: await this.checkCursorWaiting(task),
      timeThreshold: this.checkTimeThreshold(task)
    }

    const confidence =
      (signals.outputPattern ? this.detector.weights.outputPattern : 0) +
      (signals.cpuIdle ? this.detector.weights.cpuIdle : 0) +
      (signals.cursorWaiting ? this.detector.weights.cursorWaiting : 0) +
      (signals.timeThreshold ? this.detector.weights.timeThreshold : 0)

    return {
      isCompleted: confidence >= this.detector.thresholds.confidenceThreshold,
      confidence,
      signals
    }
  }

  // 输出模式匹配
  private async checkOutputPattern(task: AITask): Promise<boolean> {
    const patterns: Record<AIToolType, RegExp[]> = {
      'codex': [/✓|Done|Completed|finished/i, /waiting for input/i],
      'claude-code': [/✓|Done|Task completed/i, /\$ $/],
      'gemini-cli': [/Complete|Finished|Done/i],
      'cursor': [/Applied|Done/i],
      'other': [/done|complete|finish/i]
    }
    // 读取终端输出并匹配
  }

  // CPU 空闲检测
  private checkCpuIdle(task: AITask): boolean {
    const recentCpu = task.metrics.cpuHistory.slice(-5)
    const avgCpu = recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length
    return avgCpu < this.detector.thresholds.cpuIdlePercent &&
           task.metrics.idleDuration > this.detector.thresholds.cpuIdleDuration
  }

  // 光标等待检测 (检测命令提示符)
  private async checkCursorWaiting(task: AITask): Promise<boolean> {
    // 通过终端模拟器 API 或窗口标题检测
  }

  // 时间阈值检测
  private checkTimeThreshold(task: AITask): boolean {
    return Date.now() - task.metrics.lastOutputTime.getTime() >
           this.detector.thresholds.noOutputDuration
  }

  // 任务完成回调
  onTaskComplete(taskId: string, callback: (task: AITask) => void): void

  // 保存到历史
  saveToHistory(task: AITask): void

  // 获取历史统计
  getStatistics(projectId?: string): {
    totalTasks: number
    avgDuration: number
    byTool: Record<AIToolType, number>
    successRate: number
  }
}
```

#### AI 工具识别规则

```typescript
const AI_TOOL_SIGNATURES: Record<AIToolType, {
  processPatterns: string[]
  windowTitlePatterns: RegExp[]
  commandPatterns: RegExp[]
}> = {
  'codex': {
    processPatterns: ['node.exe', 'codex'],
    windowTitlePatterns: [/codex/i, /openai/i],
    commandPatterns: [/codex\s+/i]
  },
  'claude-code': {
    processPatterns: ['node.exe', 'claude'],
    windowTitlePatterns: [/claude/i, /anthropic/i],
    commandPatterns: [/claude\s+/i]
  },
  'gemini-cli': {
    processPatterns: ['node.exe', 'gemini'],
    windowTitlePatterns: [/gemini/i, /google/i],
    commandPatterns: [/gemini\s+/i]
  },
  'cursor': {
    processPatterns: ['Cursor.exe'],
    windowTitlePatterns: [/cursor/i],
    commandPatterns: []
  }
}
```

---

### 3.5 模块 5：通知服务 (NotificationService)

#### 数据结构

```typescript
type NotificationType =
  | 'task-complete'      // AI 任务完成
  | 'port-conflict'      // 端口冲突
  | 'zombie-process'     // 僵尸进程警告
  | 'high-resource'      // 资源使用过高
  | 'project-error'      // 项目错误

interface NotificationConfig {
  enabled: boolean
  types: Record<NotificationType, boolean>
  sound: boolean
  persistent: boolean    // 是否保持通知直到用户处理
}

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  icon?: string
  actions?: { label: string, action: string }[]
  createdAt: Date
  read: boolean
}
```

#### 核心功能

```typescript
class NotificationService {
  private config: NotificationConfig
  private history: Notification[] = []

  // 发送 Windows 通知
  async send(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<void> {
    const n = new Notification({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || path.join(__dirname, 'icon.png'),
      silent: !this.config.sound
    })

    // 添加操作按钮
    if (notification.actions) {
      // Windows Toast 支持操作按钮
    }

    n.show()
    this.saveToHistory(notification)
  }

  // 快捷通知方法
  notifyTaskComplete(task: AITask): void {
    this.send({
      type: 'task-complete',
      title: `${task.toolType} 任务完成`,
      body: `任务已完成，耗时 ${this.formatDuration(task)}`,
      actions: [
        { label: '查看', action: 'focus-window' },
        { label: '忽略', action: 'dismiss' }
      ]
    })
  }

  notifyPortConflict(port: number, processName: string): void {
    this.send({
      type: 'port-conflict',
      title: `端口 ${port} 被占用`,
      body: `进程 ${processName} 正在使用此端口`,
      actions: [
        { label: '释放端口', action: 'release-port' },
        { label: '忽略', action: 'dismiss' }
      ]
    })
  }

  notifyZombieProcesses(count: number): void {
    this.send({
      type: 'zombie-process',
      title: `检测到 ${count} 个僵尸进程`,
      body: '这些进程可能已不再需要，建议清理',
      actions: [
        { label: '查看详情', action: 'show-zombies' },
        { label: '一键清理', action: 'cleanup-zombies' }
      ]
    })
  }
}
```

---

### 3.6 模块 6：任务历史 (TaskHistoryStore)

#### 数据结构

```typescript
interface TaskRecord {
  id: string
  type: 'ai-task' | 'dev-server' | 'build' | 'test'
  toolOrCommand: string
  projectId?: string
  projectName?: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'running' | 'completed' | 'error' | 'cancelled'
  metadata?: Record<string, any>
}

interface TaskStatistics {
  totalTasks: number
  totalDuration: number
  avgDuration: number
  byType: Record<string, { count: number, avgDuration: number }>
  byProject: Record<string, { count: number, avgDuration: number }>
  byDay: { date: string, count: number }[]
}
```

#### 核心功能

```typescript
class TaskHistoryStore {
  private dbPath: string
  private records: TaskRecord[] = []

  // 使用 SQLite 或 JSON 文件存储
  async init(): Promise<void>

  // 添加记录
  async addRecord(record: Omit<TaskRecord, 'id'>): Promise<TaskRecord>

  // 更新记录
  async updateRecord(id: string, updates: Partial<TaskRecord>): Promise<void>

  // 查询记录
  async query(options: {
    projectId?: string
    type?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }): Promise<TaskRecord[]>

  // 获取统计信息
  async getStatistics(options?: {
    projectId?: string
    days?: number
  }): Promise<TaskStatistics>

  // 清理旧记录
  async cleanup(olderThan: Date): Promise<number>
}
```

---

## 四、UI 设计

### 4.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] DevHub Pro              [─] [□] [×]                 │
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│  项目   │   [项目列表 / 进程监控 / 窗口管理 / AI 任务]        │
│         │                                                   │
│  进程   │   ┌─────────────────────────────────────────────┐ │
│         │   │                                             │ │
│  窗口   │   │              主内容区域                      │ │
│         │   │                                             │ │
│  AI任务 │   │                                             │ │
│         │   │                                             │ │
│  设置   │   └─────────────────────────────────────────────┘ │
│         │                                                   │
├─────────┴───────────────────────────────────────────────────┤
│  状态栏: CPU: 45% | 内存: 8.2GB | 进程: 12 | 端口: 5       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 新增视图

#### 4.2.1 进程监控视图 (ProcessView)

```
┌─────────────────────────────────────────────────────────────┐
│  进程监控                           [刷新] [清理僵尸进程]    │
├─────────────────────────────────────────────────────────────┤
│  按项目分组 ▼                                               │
├─────────────────────────────────────────────────────────────┤
│  ▼ 项目A (3 个进程, CPU: 15%, 内存: 512MB)                  │
│    ├─ node dev-server    :3000   CPU: 10%  512MB  [停止]   │
│    ├─ node vite          :5173   CPU: 3%   128MB  [停止]   │
│    └─ chrome             :--     CPU: 2%   256MB  [停止]   │
│                                                             │
│  ▼ 项目B (2 个进程, CPU: 5%, 内存: 256MB)                   │
│    ├─ python manage.py   :8000   CPU: 5%   256MB  [停止]   │
│    └─ redis-server       :6379   CPU: 0%   32MB   [停止]   │
│                                                             │
│  ▼ 未分组 (1 个进程)                                        │
│    └─ docker             :--     CPU: 1%   128MB  [停止]   │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 端口管理视图 (PortView)

```
┌─────────────────────────────────────────────────────────────┐
│  端口管理                           [扫描] [检查冲突]        │
├─────────────────────────────────────────────────────────────┤
│  ┌─ 常用开发端口 ──────────────────────────────────────────┐ │
│  │ :3000  ● 占用  node.exe (项目A)           [释放]       │ │
│  │ :3001  ○ 空闲                                          │ │
│  │ :5173  ● 占用  node.exe (项目A)           [释放]       │ │
│  │ :8000  ● 占用  python.exe (项目B)         [释放]       │ │
│  │ :8080  ○ 空闲                                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 其他活跃端口 ──────────────────────────────────────────┐ │
│  │ :6379  redis-server.exe                   [释放]       │ │
│  │ :27017 mongod.exe                         [释放]       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.3 窗口管理视图 (WindowView)

```
┌─────────────────────────────────────────────────────────────┐
│  窗口管理                    [刷新] [保存布局] [恢复布局 ▼]  │
├─────────────────────────────────────────────────────────────┤
│  ▼ 项目A 窗口组 (4 个窗口)                     [聚焦] [最小化] │
│    ├─ VS Code - project-a          [聚焦]                  │
│    ├─ Terminal - npm run dev       [聚焦]                  │
│    ├─ Chrome - localhost:3000      [聚焦]                  │
│    └─ Chrome DevTools              [聚焦]                  │
│                                                             │
│  ▼ 项目B 窗口组 (2 个窗口)                     [聚焦] [最小化] │
│    ├─ PyCharm - project-b          [聚焦]                  │
│    └─ Terminal - python manage.py  [聚焦]                  │
│                                                             │
│  ▼ AI 工具 (3 个窗口)                          [聚焦] [最小化] │
│    ├─ Terminal - codex             [聚焦] 🔄 运行中         │
│    ├─ Terminal - claude            [聚焦] ✓ 已完成         │
│    └─ Terminal - gemini            [聚焦] ⏳ 等待中         │
├─────────────────────────────────────────────────────────────┤
│  已保存布局: [前端开发] [后端调试] [全栈开发] [+ 新建]       │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.4 AI 任务追踪视图 (AITaskView)

```
┌─────────────────────────────────────────────────────────────┐
│  AI 任务追踪                                    [刷新]      │
├─────────────────────────────────────────────────────────────┤
│  ┌─ 当前运行中 ────────────────────────────────────────────┐ │
│  │ 🤖 Codex      项目A    运行中 ████████░░ 80%   15分钟   │ │
│  │ 🔵 Claude     项目B    等待输入            ⏳   3分钟    │ │
│  │ 🟢 Gemini     --       空闲                             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 今日历史 ──────────────────────────────────────────────┐ │
│  │ 10:30  Codex   项目A   ✓ 完成   12分钟                  │ │
│  │ 09:15  Claude  项目B   ✓ 完成   8分钟                   │ │
│  │ 08:45  Codex   项目A   ✗ 错误   3分钟                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ 统计 ──────────────────────────────────────────────────┐ │
│  │ 今日任务: 5    平均耗时: 9分钟    成功率: 80%           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 五、IPC 通信接口

### 5.1 新增 IPC 接口

```typescript
// Main -> Renderer 事件
interface MainToRendererEvents {
  'process:updated': ProcessInfo[]
  'process:zombie-detected': ProcessInfo[]
  'port:conflict': PortInfo
  'window:updated': WindowInfo[]
  'ai-task:status-changed': AITask
  'ai-task:completed': AITask
  'notification:action': { notificationId: string, action: string }
}

// Renderer -> Main 调用
interface RendererToMainHandlers {
  // 进程管理
  'process:scan': () => Promise<ProcessInfo[]>
  'process:kill': (pid: number) => Promise<boolean>
  'process:cleanup-zombies': () => Promise<number>

  // 端口管理
  'port:scan': () => Promise<PortInfo[]>
  'port:check': (port: number) => Promise<PortInfo | null>
  'port:release': (port: number) => Promise<boolean>

  // 窗口管理
  'window:scan': () => Promise<WindowInfo[]>
  'window:focus': (hwnd: number) => Promise<void>
  'window:focus-group': (groupId: string) => Promise<void>
  'window:save-layout': (name: string) => Promise<WindowLayout>
  'window:restore-layout': (layoutId: string) => Promise<void>
  'window:get-layouts': () => Promise<WindowLayout[]>

  // AI 任务追踪
  'ai-task:get-all': () => Promise<AITask[]>
  'ai-task:get-history': (options: QueryOptions) => Promise<AITaskHistory[]>
  'ai-task:get-statistics': () => Promise<TaskStatistics>

  // 通知
  'notification:get-config': () => Promise<NotificationConfig>
  'notification:set-config': (config: NotificationConfig) => Promise<void>
  'notification:get-history': () => Promise<Notification[]>
}
```

---

## 六、实现计划

### 6.1 阶段划分

| 阶段 | 内容 | 预计文件变更 |
|------|------|-------------|
| Phase 1 | 进程监控 + 端口管理 | ~8 个文件 |
| Phase 2 | 窗口管理 (分组 + 布局) | ~6 个文件 |
| Phase 3 | AI 任务追踪 + 完成检测 | ~8 个文件 |
| Phase 4 | 通知服务 + 历史记录 | ~5 个文件 |
| Phase 5 | UI 集成 + 测试优化 | ~10 个文件 |

### 6.2 文件结构

```
src/
├── main/
│   ├── services/
│   │   ├── ProcessManager.ts      (增强)
│   │   ├── PortScanner.ts         (新增)
│   │   ├── WindowManager.ts       (新增)
│   │   ├── AITaskTracker.ts       (新增)
│   │   ├── NotificationService.ts (新增)
│   │   └── TaskHistoryStore.ts    (新增)
│   └── ipc/
│       ├── process.ts             (新增)
│       ├── port.ts                (新增)
│       ├── window.ts              (新增)
│       ├── ai-task.ts             (新增)
│       └── notification.ts        (新增)
├── renderer/
│   ├── components/
│   │   ├── process/
│   │   │   ├── ProcessView.tsx    (新增)
│   │   │   ├── ProcessCard.tsx    (新增)
│   │   │   └── ProcessGroup.tsx   (新增)
│   │   ├── port/
│   │   │   ├── PortView.tsx       (新增)
│   │   │   └── PortCard.tsx       (新增)
│   │   ├── window/
│   │   │   ├── WindowView.tsx     (新增)
│   │   │   ├── WindowGroup.tsx    (新增)
│   │   │   └── LayoutManager.tsx  (新增)
│   │   └── ai-task/
│   │       ├── AITaskView.tsx     (新增)
│   │       ├── TaskCard.tsx       (新增)
│   │       └── TaskHistory.tsx    (新增)
│   └── stores/
│       ├── processStore.ts        (新增)
│       ├── portStore.ts           (新增)
│       ├── windowStore.ts         (新增)
│       └── aiTaskStore.ts         (新增)
└── shared/
    └── types.ts                   (增强)
```

---

## 七、关键技术挑战

### 7.1 Windows API 调用

**挑战**: Electron 原生不支持直接调用 Windows API

**解决方案**:
1. 使用 `node-ffi-napi` 调用 user32.dll
2. 或使用 PowerShell 脚本作为中间层
3. 或使用 `edge-js` 调用 C# 代码

### 7.2 终端输出捕获

**挑战**: 如何读取其他终端窗口的输出

**解决方案**:
1. 如果是 DevHub 启动的进程: 直接捕获 stdout/stderr
2. 外部进程: 通过窗口标题变化 + CPU 使用率推断
3. 高级方案: 使用 Windows Terminal 的 API (如果可用)

### 7.3 进程-项目关联

**挑战**: 如何准确关联进程到项目

**解决方案**:
1. 通过进程工作目录匹配项目路径
2. 通过命令行参数解析
3. 用户手动关联 + 记忆学习

---

## 八、配置项

```typescript
interface DevHubProConfig {
  // 进程监控
  process: {
    refreshInterval: number      // 刷新间隔 (ms), 默认 5000
    zombieThreshold: number      // 僵尸进程阈值 (ms), 默认 3600000
    showSystemProcesses: boolean // 显示系统进程, 默认 false
  }

  // 端口管理
  port: {
    commonPorts: number[]        // 常用端口列表
    autoDetectConflict: boolean  // 自动检测冲突
  }

  // 窗口管理
  window: {
    autoGroup: boolean           // 自动分组
    rememberLayout: boolean      // 记住布局
  }

  // AI 任务追踪
  aiTask: {
    enabled: boolean
    detectCompletion: boolean    // 自动检测完成
    notifyOnComplete: boolean    // 完成时通知
    historyDays: number          // 历史保留天数
  }

  // 通知
  notification: {
    enabled: boolean
    sound: boolean
    types: Record<NotificationType, boolean>
  }
}
```

---

## 九、总结

### 核心创新点

1. **统一的开发工作流控制中心** - 不仅仅是工具检测，而是项目全生命周期管理
2. **AI 编程工具任务完成检测** - 市场空白，组合策略实现高准确率
3. **窗口分组 + 布局记忆** - 解决开发者窗口混乱的痛点
4. **进程-项目关联** - 自动将进程归属到项目，提供项目级视图
5. **智能通知系统** - 不打扰但及时，支持快捷操作

### 与 Dev-Janitor 的差异化

| 维度 | Dev-Janitor | DevHub Pro |
|------|-------------|-----------|
| 核心价值 | 清理/检测 | 控制/监控 |
| 项目感知 | 无 | 核心特性 |
| 实时性 | 手动刷新为主 | 自动监控 |
| AI 支持 | OpenAI 分析 | 任务追踪 |
| 通知 | 无 | Windows 原生 |
