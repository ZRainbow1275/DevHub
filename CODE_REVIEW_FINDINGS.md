# DevHub 代码审查报告

**审查日期:** 2026-04-10  
**审查范围:** src/shared/types.ts, src/shared/types-extended.ts, src/preload/index.ts, src/preload/extended.ts, electron.vite.config.ts, eslint.config.js, tailwind.config.js  
**总问题数:** 12 | **CRITICAL:** 3 | **HIGH:** 3 | **MEDIUM:** 4 | **LOW:** 2

---

## 🔴 CRITICAL 严重级别问题（必须立即修复）

### CRITICAL-1: IPC 通道未在常量中定义 - preload/index.ts

| 属性 | 值 |
|------|-----|
| **文件** | `src/preload/index.ts` |
| **行号** | 32, 34, 38, 42, 127-135, 140, 145, 150 |
| **类别** | IPC 协议不一致 / 运行时错误 |
| **严重性** | CRITICAL |

**问题代码片段:**
```typescript
// 行 31-42：projects API
projects: {
  scan: (scanPath?: string): Promise<...> =>
    ipcRenderer.invoke('projects:scan', scanPath),                    // ❌ 未定义

  scanDirectory: (dirPath: string): Promise<...> =>
    ipcRenderer.invoke('projects:scan-directory', dirPath),          // ❌ 未定义

  discover: (): Promise<...> =>
    ipcRenderer.invoke('projects:discover'),                         // ❌ 未定义

  onAutoDiscovered: (callback: (...) => void) => {
    ipcRenderer.on('projects:auto-discovered', handler)             // ❌ 未定义
  },
}

// 行 127-135：tags & groups
tags: {
  list: (): Promise<string[]> => ipcRenderer.invoke('tags:list'),
  add: (tag: string): Promise<void> => ipcRenderer.invoke('tags:add', tag),
  remove: (tag: string): Promise<void> => ipcRenderer.invoke('tags:remove', tag)
},

groups: {
  list: (): Promise<string[]> => ipcRenderer.invoke('groups:list'),
  add: (group: string): Promise<void> => ipcRenderer.invoke('groups:add', group),
  remove: (group: string): Promise<void> => ipcRenderer.invoke('groups:remove', group)
},

// 行 140, 145, 150
dialog: {
  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-directory')
},

shell: {
  openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:open-path', path)
},

system: {
  getDrives: (): Promise<string[]> => ipcRenderer.invoke('system:get-drives')
}
```

**问题描述:**
- 9 个 IPC 通道（projects:scan, projects:scan-directory, projects:discover, projects:auto-discovered, tags:list, tags:add, tags:remove, groups:list, groups:add, groups:remove, dialog:open-directory, shell:open-path, system:get-drives）在 `IPC_CHANNELS` 常量中没有定义
- 这些通道被硬编码在 preload 代码中
- 运行时渲染进程调用这些 API 会抛出：`Error: Unknown ipc message`
- 主进程没有对应的处理程序，导致应用崩溃

**影响范围:**
- 项目扫描功能不可用（scan, scanDirectory, discover）
- 标签管理不可用（tags:list/add/remove）
- 分组管理不可用（groups:list/add/remove）
- 文件对话框不可用（dialog:open-directory）
- 路径打开功能不可用（shell:open-path）
- 磁盘列表功能不可用（system:get-drives）

**修复建议:**

在 `src/shared/types.ts` 中的 `IPC_CHANNELS` 对象添加所有缺失的通道定义：

```typescript
export const IPC_CHANNELS = {
  // 现有的...
  
  // ✅ 新增：项目扫描相关
  PROJECTS_SCAN: 'projects:scan',
  PROJECTS_SCAN_DIRECTORY: 'projects:scan-directory',
  PROJECTS_DISCOVER: 'projects:discover',
  PROJECTS_AUTO_DISCOVERED: 'projects:auto-discovered',
  
  // ✅ 新增：标签管理
  TAGS_LIST: 'tags:list',
  TAGS_ADD: 'tags:add',
  TAGS_REMOVE: 'tags:remove',
  
  // ✅ 新增：分组管理
  GROUPS_LIST: 'groups:list',
  GROUPS_ADD: 'groups:add',
  GROUPS_REMOVE: 'groups:remove',
  
  // ✅ 新增：对话框和文件系统
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  SHELL_OPEN_PATH: 'shell:open-path',
  SYSTEM_GET_DRIVES: 'system:get-drives',
  
  // ✅ 新增：日志订阅（已使用但未声明）
  LOG_SUBSCRIBE: 'log:subscribe',
  PROCESS_STATUS_CHANGE: 'process:status-change',
} as const
```

然后在 `src/preload/index.ts` 中替换所有硬编码的字符串：

```typescript
// ✅ 修复后的 projects API
projects: {
  scan: (scanPath?: string): Promise<...> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_SCAN, scanPath),

  scanDirectory: (dirPath: string): Promise<...> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_SCAN_DIRECTORY, dirPath),

  discover: (): Promise<...> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_DISCOVER),

  onAutoDiscovered: (callback: (...) => void) => {
    const handler = (_: unknown, projects: ...) => callback(projects)
    ipcRenderer.on(IPC_CHANNELS.PROJECTS_AUTO_DISCOVERED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROJECTS_AUTO_DISCOVERED, handler)
  },
}

// ✅ 修复后的 tags
tags: {
  list: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.TAGS_LIST),
  add: (tag: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.TAGS_ADD, tag),
  remove: (tag: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.TAGS_REMOVE, tag)
}

// ✅ 修复后的 groups
groups: {
  list: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.GROUPS_LIST),
  add: (group: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.GROUPS_ADD, group),
  remove: (group: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.GROUPS_REMOVE, group)
}

// ✅ 修复后的 dialog
dialog: {
  openDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY)
}

// ✅ 修复后的 shell
shell: {
  openPath: (path: string): Promise<string> => 
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, path)
}

// ✅ 修复后的 system
system: {
  getDrives: (): Promise<string[]> => 
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_DRIVES)
}

// ✅ 修复后的 logs（同时改用 IPC_CHANNELS 常量）
logs: {
  subscribe: (projectId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LOG_SUBSCRIBE, projectId),
  
  clear: (projectId: string): Promise<ServiceResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LOG_CLEAR, projectId)
}

// ✅ 修复后的 process 状态监听
process: {
  onStatusChange: (callback: (...) => void) => {
    const handler = (_: unknown, data: {...}) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.PROCESS_STATUS_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROCESS_STATUS_CHANGE, handler)
  }
}
```

---

### CRITICAL-2: preload/extended.ts 中的大量未定义通道

| 属性 | 值 |
|------|-----|
| **文件** | `src/preload/extended.ts` |
| **行号** | 34, 37, 129, 158, 185-194, 198, 205-235 |
| **类别** | IPC 协议不一致 / 运行时错误 |
| **严重性** | CRITICAL |

**问题代码片段:**
```typescript
// 行 34-37：进程 API
export const systemProcessApi = {
  getGroups: (): Promise<ProcessGroup[]> =>
    ipcRenderer.invoke('process:get-groups'),                    // ❌ 未定义

  getProcessTree: (pid: number): Promise<ProcessInfo[]> =>
    ipcRenderer.invoke('process:get-tree', pid),                 // ❌ 未定义
}

// 行 129：窗口事件
export const windowApi = {
  onUpdated: (callback: (windows: WindowInfo[]) => void) => {
    ipcRenderer.on('window:updated', handler)                    // ❌ 未定义
  }
}

// 行 158：AI 任务事件
export const aiTaskApi = {
  onTaskUpdated: (callback: (task: AITask) => void) => {
    ipcRenderer.on('ai-task:updated', handler)                   // ❌ 未定义
  }
}

// 行 185-194：通知 API
export const notificationApi = {
  markRead: (notificationId: string): Promise<void> =>
    ipcRenderer.invoke('notification:mark-read', notificationId),        // ❌

  markAllRead: (): Promise<void> =>
    ipcRenderer.invoke('notification:mark-all-read'),                    // ❌

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('notification:clear-history'),                    // ❌

  getUnreadCount: (): Promise<number> =>
    ipcRenderer.invoke('notification:get-unread-count'),                 // ❌

  onNotification: (callback: (notification: AppNotification) => void) => {
    ipcRenderer.on('notification:new', handler)                          // ❌ 未定义
  }
}

// 行 205-235：任务历史 API
export const taskHistoryApi = {
  add: (record: Omit<TaskRecord, 'id'>): Promise<TaskRecord> =>
    ipcRenderer.invoke('task-history:add', record),                      // ❌

  update: (id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke('task-history:update', id, updates),              // ❌

  complete: (id: string, status?: TaskRecordStatus): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke('task-history:complete', id, status),             // ❌

  get: (id: string): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke('task-history:get', id),                          // ❌

  list: (options?: {...}): Promise<TaskRecord[]> =>
    ipcRenderer.invoke('task-history:list', options),                    // ❌

  getStatistics: (options?: {...}): Promise<TaskStatistics | null> =>
    ipcRenderer.invoke('task-history:statistics', options),              // ❌

  clearOld: (beforeDate: string): Promise<number> =>
    ipcRenderer.invoke('task-history:clear-old', beforeDate),            // ❌

  onRecordAdded: (callback: (record: TaskRecord) => void) => {
    ipcRenderer.on('task-history:record-added', handler)                 // ❌
  },

  onRecordUpdated: (callback: (record: TaskRecord) => void) => {
    ipcRenderer.on('task-history:record-updated', handler)               // ❌
  }
}
```

**问题描述:**
- 19 个通道在 `IPC_CHANNELS_EXT` 中没有定义
- 包括进程管理(2)、窗口事件(1)、AI任务事件(1)、通知(5)、任务历史(9)
- 所有这些通道都被硬编码，无法在运行时匹配

**修复建议:**

在 `src/shared/types-extended.ts` 的 `IPC_CHANNELS_EXT` 对象中添加：

```typescript
export const IPC_CHANNELS_EXT = {
  // 现有的...
  
  // ✅ 新增：进程管理补充
  PROCESS_GET_GROUPS: 'process:get-groups',
  PROCESS_GET_TREE: 'process:get-tree',
  
  // ✅ 新增：窗口事件
  WINDOW_UPDATED: 'window:updated',
  
  // ✅ 新增：AI 任务事件
  AI_TASK_UPDATED: 'ai-task:updated',
  
  // ✅ 新增：通知管理
  NOTIFICATION_MARK_READ: 'notification:mark-read',
  NOTIFICATION_MARK_ALL_READ: 'notification:mark-all-read',
  NOTIFICATION_CLEAR_HISTORY: 'notification:clear-history',
  NOTIFICATION_GET_UNREAD_COUNT: 'notification:get-unread-count',
  NOTIFICATION_NEW: 'notification:new',
  
  // ✅ 新增：任务历史（9 个通道）
  TASK_HISTORY_ADD: 'task-history:add',
  TASK_HISTORY_UPDATE: 'task-history:update',
  TASK_HISTORY_COMPLETE: 'task-history:complete',
  TASK_HISTORY_GET: 'task-history:get',
  TASK_HISTORY_LIST: 'task-history:list',
  TASK_HISTORY_STATISTICS: 'task-history:statistics',
  TASK_HISTORY_CLEAR_OLD: 'task-history:clear-old',
  TASK_HISTORY_RECORD_ADDED: 'task-history:record-added',
  TASK_HISTORY_RECORD_UPDATED: 'task-history:record-updated',
} as const
```

然后在 `src/preload/extended.ts` 中替换所有硬编码的通道字符串：

```typescript
// ✅ 修复后的 systemProcessApi
export const systemProcessApi = {
  getGroups: (): Promise<ProcessGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_GROUPS),

  getProcessTree: (pid: number): Promise<ProcessInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_TREE, pid),
}

// ✅ 修复后的 windowApi
export const windowApi = {
  onUpdated: (callback: (windows: WindowInfo[]) => void) => {
    const handler = (_: unknown, windows: WindowInfo[]) => callback(windows)
    ipcRenderer.on(IPC_CHANNELS_EXT.WINDOW_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.WINDOW_UPDATED, handler)
  }
}

// ✅ 修复后的 aiTaskApi
export const aiTaskApi = {
  onTaskUpdated: (callback: (task: AITask) => void) => {
    const handler = (_: unknown, task: AITask) => callback(task)
    ipcRenderer.on(IPC_CHANNELS_EXT.AI_TASK_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.AI_TASK_UPDATED, handler)
  }
}

// ✅ 修复后的 notificationApi
export const notificationApi = {
  markRead: (notificationId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_MARK_READ, notificationId),

  markAllRead: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_MARK_ALL_READ),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_CLEAR_HISTORY),

  getUnreadCount: (): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_GET_UNREAD_COUNT),

  onNotification: (callback: (notification: AppNotification) => void) => {
    const handler = (_: unknown, notification: AppNotification) => callback(notification)
    ipcRenderer.on(IPC_CHANNELS_EXT.NOTIFICATION_NEW, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.NOTIFICATION_NEW, handler)
  }
}

// ✅ 修复后的 taskHistoryApi
export const taskHistoryApi = {
  add: (record: Omit<TaskRecord, 'id'>): Promise<TaskRecord> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_ADD, record),

  update: (id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_UPDATE, id, updates),

  complete: (id: string, status?: TaskRecordStatus): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_COMPLETE, id, status),

  get: (id: string): Promise<TaskRecord | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_GET, id),

  list: (options?: {...}): Promise<TaskRecord[]> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_LIST, options),

  getStatistics: (options?: {...}): Promise<TaskStatistics | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_STATISTICS, options),

  clearOld: (beforeDate: string): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_CLEAR_OLD, beforeDate),

  onRecordAdded: (callback: (record: TaskRecord) => void) => {
    const handler = (_: unknown, record: TaskRecord) => callback(record)
    ipcRenderer.on(IPC_CHANNELS_EXT.TASK_HISTORY_RECORD_ADDED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.TASK_HISTORY_RECORD_ADDED, handler)
  },

  onRecordUpdated: (callback: (record: TaskRecord) => void) => {
    const handler = (_: unknown, record: TaskRecord) => callback(record)
    ipcRenderer.on(IPC_CHANNELS_EXT.TASK_HISTORY_RECORD_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS_EXT.TASK_HISTORY_RECORD_UPDATED, handler)
  }
}
```

---

### CRITICAL-3: 安全问题 - contextBridge 暴露危险的 Node.js APIs 且缺乏路径验证

| 属性 | 值 |
|------|-----|
| **文件** | `src/preload/index.ts` |
| **行号** | 139-151 |
| **类别** | 安全漏洞 / 上下文隔离 / 输入验证 |
| **严重性** | CRITICAL |

**问题代码片段:**
```typescript
// 行 139-151
dialog: {
  openDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke('dialog:open-directory')  // ❌ 无默认路径限制
},

shell: {
  openPath: (path: string): Promise<string> => 
    ipcRenderer.invoke('shell:open-path', path)  // ❌ 路径未经验证，允许路径遍历
},

system: {
  getDrives: (): Promise<string[]> => 
    ipcRenderer.invoke('system:get-drives')  // ❌ 暴露磁盘配置信息
}
```

**问题描述:**

1. **路径遍历攻击 (Path Traversal)**
   - `shell.openPath()` 接受任意字符串，无验证
   - 恶意脚本可以打开敏感目录：`shell.openPath('../../../Windows/System32')`
   - 可能暴露系统文件或执行未授权操作

2. **信息泄露**
   - `system.getDrives()` 直接暴露所有磁盘列表
   - 泄露本机存储配置信息

3. **无限制文件对话框**
   - `dialog.openDirectory()` 缺乏 `defaultPath` 限制
   - 用户可访问整个文件系统

4. **上下文隔离缺陷**
   - preload 脚本未验证 `contextIsolation` 是否启用
   - 如果主进程配置错误，不会被检测

**Electron 安全最佳实践遵从:**
- Electron 官方文档强调不应直接暴露 `shell.openPath()` 等危险 API
- 所有文件系统操作必须在主进程验证
- preload 应只暴露"最小必要权限"

**修复建议:**

**第一步：** 在 `src/shared/types.ts` 添加常量（已在 CRITICAL-1 中列出）

**第二步：** 修改 `src/preload/index.ts` 为安全版本：

```typescript
// ✅ 安全检查（在文件开头）
if (!process.contextIsolated) {
  throw new Error(
    'Context Isolation must be enabled for security. ' +
    'Please enable contextIsolation: true in the BrowserWindow configuration.'
  )
}

// ✅ 修改后的 API（带客户端验证和权限限制）
dialog: {
  // 只允许在项目目录中打开文件夹
  openProjectDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, { 
      restrictToProjectRoot: true  // 主进程将验证结果
    })
},

shell: {
  // 只允许打开项目内的文件，不允许任意路径
  openProjectFile: (relativePath: string): Promise<string> => {
    // ✅ 客户端验证：确保不包含路径遍历
    if (!relativePath) {
      return Promise.reject(new Error('Path is required'))
    }
    if (relativePath.includes('..')) {
      return Promise.reject(new Error('Path traversal not allowed'))
    }
    if (relativePath.startsWith('/') || /^[a-z]:/i.test(relativePath)) {
      return Promise.reject(new Error('Absolute paths not allowed'))
    }
    return ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, relativePath)
  }
},

system: {
  // ❌ 完全移除 getDrives()，如必须使用则需明确业务需求
  // 如果确实必需（如扫描功能），应在主进程添加权限检查
  // 并且不应直接暴露，而是通过受控的 API 返回
}
```

**第三步：** 在主进程（src/main/ipc.ts）添加防御性验证（伪代码）：

```typescript
// src/main/ipc.ts
import path from 'path'
import { ipcMain, dialog, shell, app } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

// 定义允许的项目根目录
const PROJECT_ROOT = app.getPath('userData')
const MAX_PATH_LENGTH = 1024

ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (event, relativePath) => {
  // 验证 1：确保是字符串且非空
  if (typeof relativePath !== 'string' || !relativePath) {
    throw new Error('Invalid path parameter')
  }

  // 验证 2：长度限制（防止 DOS）
  if (relativePath.length > MAX_PATH_LENGTH) {
    throw new Error('Path exceeds maximum length')
  }

  // 验证 3：禁止路径遍历
  if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
    throw new Error('Path traversal not allowed')
  }

  // 验证 4：解析完整路径并验证在项目目录内
  const fullPath = path.resolve(PROJECT_ROOT, relativePath)
  if (!fullPath.startsWith(PROJECT_ROOT)) {
    throw new Error('Access denied: path outside project root')
  }

  // 验证 5：确保文件存在（可选）
  const fs = require('fs')
  if (!fs.existsSync(fullPath)) {
    throw new Error('File not found')
  }

  // ✅ 安全的操作
  return shell.openPath(fullPath)
})

ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async (event, options?) => {
  // ✅ 添加默认路径限制
  const dialogOptions = {
    defaultPath: PROJECT_ROOT,  // 限制默认打开位置
    properties: ['openDirectory'],
    ...options
  }

  const result = await dialog.showOpenDialog(dialogOptions)
  
  // 验证返回的路径在项目目录内
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0]
    if (!selectedPath.startsWith(PROJECT_ROOT)) {
      throw new Error('Access denied: path outside project root')
    }
  }

  return result.canceled ? null : result.filePaths[0]
})

// 如果必须提供 getDrives()，应做如下处理（但建议完全移除）：
// ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_DRIVES, async () => {
//   // 只返回允许扫描的驱动器列表（不是全部）
//   // 应由用户配置确定
//   return ['C:']  // 示例：只返回 C 盘
// })
```

---

## 🟠 HIGH 高级问题（需在一周内修复）

### HIGH-1: IPC 返回值类型不一致

| 属性 | 值 |
|------|-----|
| **文件** | `src/preload/extended.ts` |
| **行号** | 24-28, 52-66, 85-102, 134-161 |
| **类别** | 类型安全 / API 设计不一致 |
| **严重性** | HIGH |

**问题代码片段:**
```typescript
// 风格 1: Promise<ServiceResult<T>>
export const systemProcessApi = {
  scan: (): Promise<ServiceResult<ProcessInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_SCAN),
}

// 风格 2: Promise<T | null>
export const portApi = {
  check: (port: number): Promise<PortInfo | null> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_CHECK, port),
}

// 风格 3: Promise<T>（无错误处理）
export const systemProcessApi = {
  getGroups: (): Promise<ProcessGroup[]> =>
    ipcRenderer.invoke('process:get-groups'),
}

// 风格 4: Promise<ServiceResult>（无类型参数）
export const windowApi = {
  focus: (hwnd: number): Promise<ServiceResult> =>  // ❌ 类型参数缺失
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_FOCUS, hwnd),
}
```

**问题描述:**
- 四种不同的返回类型模式混合在同一文件
- 渲染进程调用方需要处理多种错误检查方式
- IDE 自动补全无法正确推断类型
- 易于导致调用者遗漏错误处理

**修复建议:**

统一所有 API 返回 `Promise<ServiceResult<T>>` 模式：

```typescript
// src/preload/extended.ts

// ✅ 统一的模式
export const systemProcessApi = {
  scan: (): Promise<ServiceResult<ProcessInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_SCAN),

  kill: (pid: number): Promise<ServiceResult<boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_KILL, pid),

  getGroups: (): Promise<ServiceResult<ProcessGroup[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_GROUPS),

  getProcessTree: (pid: number): Promise<ServiceResult<ProcessInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_TREE, pid),
}

export const portApi = {
  scan: (): Promise<ServiceResult<PortInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_SCAN),

  check: (port: number): Promise<ServiceResult<PortInfo | null>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_CHECK, port),

  release: (port: number): Promise<ServiceResult<boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_RELEASE, port),

  isAvailable: (port: number): Promise<ServiceResult<boolean>> =>
    ipcRenderer.invoke('port:is-available', port),

  findAvailable: (startPort: number): Promise<ServiceResult<number>> =>
    ipcRenderer.invoke('port:find-available', startPort),

  detectConflicts: (ports: number[]): Promise<ServiceResult<PortInfo[]>> =>
    ipcRenderer.invoke('port:detect-conflicts', ports),

  getTopology: (): Promise<ServiceResult<PortTopologyData>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_TOPOLOGY),
}

export const windowApi = {
  scan: (includeSystemWindows?: boolean): Promise<ServiceResult<WindowInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SCAN, includeSystemWindows ?? false),

  focus: (hwnd: number): Promise<ServiceResult<void>> =>  // ✅ 明确类型参数
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_FOCUS, hwnd),

  move: (hwnd: number, x: number, y: number, width: number, height: number): Promise<ServiceResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MOVE, hwnd, x, y, width, height),

  minimize: (hwnd: number): Promise<ServiceResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MINIMIZE, hwnd),

  maximize: (hwnd: number): Promise<ServiceResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MAXIMIZE, hwnd),

  close: (hwnd: number): Promise<ServiceResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CLOSE, hwnd),

  // ... 其他窗口 API ...
}

export const aiTaskApi = {
  scan: (): Promise<ServiceResult<AITask[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_SCAN),

  getActive: (): Promise<ServiceResult<AITask[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_ACTIVE),

  getHistory: (limit?: number): Promise<ServiceResult<AITaskHistory[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_GET_HISTORY, limit),

  startTracking: (pid: number): Promise<ServiceResult<AITask | null>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_START_TRACKING, pid),

  stopTracking: (pid: number): Promise<ServiceResult<boolean>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.AI_TASK_STOP_TRACKING, pid),

  // ... 其他 AI 任务 API ...
}

export const notificationApi = {
  getConfig: (): Promise<ServiceResult<NotificationConfig>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_GET_CONFIG),

  setConfig: (config: Partial<NotificationConfig>): Promise<ServiceResult<NotificationConfig>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_SET_CONFIG, config),

  getHistory: (limit?: number): Promise<ServiceResult<AppNotification[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_GET_HISTORY, limit),

  markRead: (notificationId: string): Promise<ServiceResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_MARK_READ, notificationId),

  markAllRead: (): Promise<ServiceResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_MARK_ALL_READ),

  clearHistory: (): Promise<ServiceResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_CLEAR_HISTORY),

  getUnreadCount: (): Promise<ServiceResult<number>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.NOTIFICATION_GET_UNREAD_COUNT),

  // ... 其他通知 API ...
}

export const taskHistoryApi = {
  add: (record: Omit<TaskRecord, 'id'>): Promise<ServiceResult<TaskRecord>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_ADD, record),

  update: (id: string, updates: Partial<TaskRecord>): Promise<ServiceResult<TaskRecord | undefined>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_UPDATE, id, updates),

  complete: (id: string, status?: TaskRecordStatus): Promise<ServiceResult<TaskRecord | undefined>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_COMPLETE, id, status),

  get: (id: string): Promise<ServiceResult<TaskRecord | undefined>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_GET, id),

  list: (options?: {...}): Promise<ServiceResult<TaskRecord[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_LIST, options),

  getStatistics: (options?: {...}): Promise<ServiceResult<TaskStatistics | null>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_STATISTICS, options),

  clearOld: (beforeDate: string): Promise<ServiceResult<number>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.TASK_HISTORY_CLEAR_OLD, beforeDate),

  // ... 其他任务历史 API ...
}
```

**调用端使用变得一致:**
```typescript
// 所有 API 都遵循相同的模式
const result = await api.systemProcess.scan()
if (!result.success) {
  console.error(result.error)
  return
}
const processes = result.data  // 类型: ProcessInfo[]

const portResult = await api.port.check(3000)
if (!portResult.success) {
  console.error(portResult.error)
  return
}
const portInfo = portResult.data  // 类型: PortInfo | null
```

---

### HIGH-2: 缺少参数验证和防御性编程

| 属性 | 值 |
|------|-----|
| **文件** | `src/preload/extended.ts` |
| **行号** | 27-30, 59-66, 91-92, 106-107 |
| **类别** | 输入验证 / 运行时安全 |
| **严重性** | HIGH |

**问题代码片段:**
```typescript
// ❌ 无验证的 PID
kill: (pid: number): Promise<boolean> =>
  ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_KILL, pid),

// ❌ 无验证的端口号
check: (port: number): Promise<PortInfo | null> =>
  ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_CHECK, port),

release: (port: number): Promise<boolean> =>
  ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_RELEASE, port),

isAvailable: (port: number): Promise<boolean> =>
  ipcRenderer.invoke('port:is-available', port),

findAvailable: (startPort: number): Promise<number> =>
  ipcRenderer.invoke('port:find-available', startPort),

// ❌ 无验证的窗口操作参数
move: (hwnd: number, x: number, y: number, width: number, height: number): Promise<ServiceResult> =>
  ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MOVE, hwnd, x, y, width, height),

// ❌ 无验证的分组操作
createGroup: (name: string, windowHwnds: number[], projectId?: string): Promise<WindowGroup> =>
  ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CREATE_GROUP, name, windowHwnds, projectId),
```

**问题描述:**
- 无效参数被发送到主进程（0, -1, NaN, 99999 等）
- 缺乏客户端验证会增加主进程的防御成本
- 调试困难 - 错误在不可预测的地方出现
- 不符合防御性编程原则

**修复建议:**

添加客户端参数验证：

```typescript
// src/preload/extended.ts

// ✅ 验证工具函数
function validatePid(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid PID: ${pid}. Must be a positive integer.`)
  }
}

function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}. Must be between 1 and 65535.`)
  }
}

function validateWindowHandle(hwnd: number): void {
  if (!Number.isInteger(hwnd) || hwnd <= 0) {
    throw new Error(`Invalid window handle: ${hwnd}. Must be a positive integer.`)
  }
}

function validateCoordinates(x: number, y: number, width: number, height: number): void {
  if (!Number.isInteger(x) || !Number.isInteger(y) || 
      !Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error('Coordinates must be integers.')
  }
  if (width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive.')
  }
}

function validateString(value: string, fieldName: string, minLength: number = 1): void {
  if (typeof value !== 'string' || value.length < minLength) {
    throw new Error(`${fieldName} must be a non-empty string.`)
  }
}

function validateArray<T>(value: unknown, fieldName: string, minLength: number = 1): asserts value is T[] {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new Error(`${fieldName} must be a non-empty array.`)
  }
}

// ✅ 更新后的 systemProcessApi
export const systemProcessApi = {
  scan: (): Promise<ServiceResult<ProcessInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_SCAN),

  kill: (pid: number): Promise<ServiceResult<boolean>> => {
    validatePid(pid)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_KILL, pid)
  },

  cleanupZombies: (): Promise<ServiceResult<number>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_CLEANUP_ZOMBIES),

  getGroups: (): Promise<ServiceResult<ProcessGroup[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_GROUPS),

  getProcessTree: (pid: number): Promise<ServiceResult<ProcessInfo[]>> => {
    validatePid(pid)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.PROCESS_GET_TREE, pid)
  },

  // ... 其他 API ...
}

// ✅ 更新后的 portApi
export const portApi = {
  scan: (): Promise<ServiceResult<PortInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_SCAN),

  scanCommon: (): Promise<ServiceResult<PortInfo[]>> =>
    ipcRenderer.invoke('port:scan-common'),

  check: (port: number): Promise<ServiceResult<PortInfo | null>> => {
    validatePort(port)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_CHECK, port)
  },

  release: (port: number): Promise<ServiceResult<boolean>> => {
    validatePort(port)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_RELEASE, port)
  },

  isAvailable: (port: number): Promise<ServiceResult<boolean>> => {
    validatePort(port)
    return ipcRenderer.invoke('port:is-available', port)
  },

  findAvailable: (startPort: number): Promise<ServiceResult<number>> => {
    validatePort(startPort)
    return ipcRenderer.invoke('port:find-available', startPort)
  },

  detectConflicts: (ports: number[]): Promise<ServiceResult<PortInfo[]>> => {
    validateArray<number>(ports, 'ports')
    ports.forEach(validatePort)
    return ipcRenderer.invoke('port:detect-conflicts', ports)
  },

  getTopology: (): Promise<ServiceResult<PortTopologyData>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.PORT_TOPOLOGY),

  // ... 其他 API ...
}

// ✅ 更新后的 windowApi
export const windowApi = {
  scan: (includeSystemWindows?: boolean): Promise<ServiceResult<WindowInfo[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_SCAN, includeSystemWindows ?? false),

  focus: (hwnd: number): Promise<ServiceResult<void>> => {
    validateWindowHandle(hwnd)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_FOCUS, hwnd)
  },

  move: (hwnd: number, x: number, y: number, width: number, height: number): Promise<ServiceResult<void>> => {
    validateWindowHandle(hwnd)
    validateCoordinates(x, y, width, height)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MOVE, hwnd, x, y, width, height)
  },

  minimize: (hwnd: number): Promise<ServiceResult<void>> => {
    validateWindowHandle(hwnd)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MINIMIZE, hwnd)
  },

  maximize: (hwnd: number): Promise<ServiceResult<void>> => {
    validateWindowHandle(hwnd)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_MAXIMIZE, hwnd)
  },

  close: (hwnd: number): Promise<ServiceResult<void>> => {
    validateWindowHandle(hwnd)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CLOSE, hwnd)
  },

  createGroup: (name: string, windowHwnds: number[], projectId?: string): Promise<ServiceResult<WindowGroup>> => {
    validateString(name, 'Group name')
    validateArray<number>(windowHwnds, 'windowHwnds')
    windowHwnds.forEach(validateWindowHandle)
    return ipcRenderer.invoke(IPC_CHANNELS_EXT.WINDOW_CREATE_GROUP, name, windowHwnds, projectId)
  },

  // ... 其他 API ...
}
```

---

### HIGH-3: 日志 API 设计缺陷 - 混合 send/invoke 导致不可靠

| 属性 | 值 |
|------|-----|
| **文件** | `src/preload/index.ts` |
| **行号** | 88-103 |
| **类别** | IPC 设计 / API 可靠性 |
| **严重性** | HIGH |

**问题代码片段:**
```typescript
logs: {
  subscribe: (projectId: string): void => {
    ipcRenderer.send('log:subscribe', projectId)  // ❌ send 单向，无确认
  },

  onEntry: (callback: (entry: LogEntry) => void) => {
    const handler = (_: unknown, entry: LogEntry) => callback(entry)
    ipcRenderer.on(IPC_CHANNELS.LOG_ENTRY, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_ENTRY, handler)
  },

  clear: (projectId: string): void => {
    ipcRenderer.send(IPC_CHANNELS.LOG_CLEAR, projectId)  // ❌ send 单向，无确认
  }
}
```

**问题描述:**

1. **无确认机制**
   - `send()` 是"火-忘记"模式，无法知道操作是否成功
   - 订阅可能失败但调用者无法得知

2. **竞态条件**
   - 无法保证 `subscribe()` 完成后再注册监听器
   - 可能漏掉日志事件

3. **无错误反馈**
   - 如果项目不存在，调用者无法得知

4. **类型不匹配**
   - `subscribe()` 和 `clear()` 返回 `void` 但应返回 Promise

**修复建议:**

改为 invoke 模式，确保异步完成和错误处理：

```typescript
// src/preload/index.ts

logs: {
  // ✅ 改为 invoke，返回 Promise 并支持错误处理
  subscribe: (projectId: string): Promise<ServiceResult<void>> => {
    if (!projectId) {
      return Promise.resolve({ 
        success: false, 
        error: 'Project ID is required' 
      })
    }
    return ipcRenderer.invoke(IPC_CHANNELS.LOG_SUBSCRIBE, projectId)
  },

  onEntry: (callback: (entry: LogEntry) => void) => {
    const handler = (_: unknown, entry: LogEntry) => callback(entry)
    ipcRenderer.on(IPC_CHANNELS.LOG_ENTRY, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_ENTRY, handler)
  },

  // ✅ 改为 invoke，返回 Promise 并支持错误处理
  clear: (projectId: string): Promise<ServiceResult<void>> => {
    if (!projectId) {
      return Promise.resolve({ 
        success: false, 
        error: 'Project ID is required' 
      })
    }
    return ipcRenderer.invoke(IPC_CHANNELS.LOG_CLEAR, projectId)
  }
}
```

**改进后的使用代码:**

```typescript
// ✅ 正确的使用模式
const subscribeResult = await window.devhub.logs.subscribe(projectId)
if (!subscribeResult.success) {
  console.error('Subscription failed:', subscribeResult.error)
  return
}

// 订阅成功后再注册监听器 - 不会漏掉日志
const unsubscribe = window.devhub.logs.onEntry((entry) => {
  console.log(entry)
})

// 清空日志
const clearResult = await window.devhub.logs.clear(projectId)
if (!clearResult.success) {
  console.error('Clear failed:', clearResult.error)
}

// 取消监听
unsubscribe()
```

还需在 `src/shared/types.ts` 中确保常量存在（CRITICAL-1 已列出）。

---

## 🟡 MEDIUM 中等问题（本周内修复）

### MEDIUM-1: ServiceResult 类型定义不够严格

| 属性 | 值 |
|------|-----|
| **文件** | `src/shared/types-extended.ts` |
| **行号** | 5-9 |
| **类别** | 类型安全 / 运行时检查 |
| **严重性** | MEDIUM |

**问题代码片段:**
```typescript
export interface ServiceResult<T = undefined> {
  success: boolean
  data?: T        // ❌ 当 success=true 时应该是必需的
  error?: string  // ❌ 当 success=false 时应该是必需的
}
```

**问题描述:**
- 类型检查无法强制安全的成功/失败处理
- `success=true` 时调用者可能使用 `undefined` 的 `data`
- `success=false` 时调用者可能不检查 `error`

**示例问题代码:**
```typescript
// ❌ 类型检查不会警告这个错误
const result = await api.scan()
const data = result.data  // 可能是 undefined
data.forEach(...)  // ❌ 运行时错误

// ❌ 也不会警告这个
if (result.success) {
  console.log(result.error)  // 可能是 undefined，但代码不检查
}
```

**修复建议:**

使用受歧视的联合类型（Discriminated Union）：

```typescript
// src/shared/types-extended.ts

// ✅ 替换原有的 interface
export type ServiceResult<T = void> = 
  | {
      success: true
      data: T
      error?: never  // 排除此字段
    }
  | {
      success: false
      error: string
      data?: never   // 排除此字段
    }
```

**改进后的类型安全代码:**

```typescript
const result = await api.scan()

if (result.success) {
  // ✅ 编译器知道 data 一定存在
  result.data.forEach(...)  // ✅ 类型安全
  
  // ❌ 编译器错误：'error' 不存在
  console.log(result.error)  // 类型检查失败
} else {
  // ✅ 编译器知道 error 一定存在
  console.error(result.error)  // ✅ 类型安全
  
  // ❌ 编译器错误：'data' 不存在
  console.log(result.data)  // 类型检查失败
}
```

---

### MEDIUM-2: 缺少保护进程的参数验证

| 属性 | 值 |
|------|-----|
| **文件** | `src/shared/types-extended.ts` |
| **行号** | 368-370 |
| **类别** | 运行时安全 / 防御性编程 |
| **严重性** | MEDIUM |

**问题代码片段:**
```typescript
export function isProtectedProcess(name: string): boolean {
  return PROTECTED_PROCESSES.has(name.toLowerCase())  // ❌ 缺乏参数验证
}
```

**问题描述:**
- 接受空字符串，返回 `false` 而不是抛出错误
- 接受 `null`/`undefined`，运行时报错
- 没有类型检查

**示例问题代码:**
```typescript
// ❌ 这些都会导致问题
isProtectedProcess('')  // 返回 false，应该检查
isProtectedProcess(null as any)  // 运行时报错
isProtectedProcess(undefined as any)  // 运行时报错
```

**修复建议:**

```typescript
export function isProtectedProcess(name: string | null | undefined): boolean {
  // ✅ 显式检查无效输入
  if (!name || typeof name !== 'string') {
    return false
  }
  
  const normalizedName = name.toLowerCase().trim()
  
  // ✅ 检查空字符串
  if (!normalizedName) {
    return false
  }
  
  return PROTECTED_PROCESSES.has(normalizedName)
}
```

---

### MEDIUM-3: IPC 通道命名冲突和风格不一致

| 属性 | 值 |
|------|-----|
| **文件** | `src/shared/types.ts` 行 160-165, `src/shared/types-extended.ts` 行 294-296 |
| **类别** | 代码一致性 / 可维护性 |
| **严重性** | MEDIUM |

**问题代码片段:**
```typescript
// types.ts - 基础窗口控制（主窗口）
export const IPC_CHANNELS = {
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
}

// types-extended.ts - 扩展窗口管理（其他应用窗口）
export const IPC_CHANNELS_EXT = {
  WINDOW_MINIMIZE: 'window:minimize-window',    // ❌ 重名，但值不同
  WINDOW_MAXIMIZE: 'window:maximize-window',    // ❌ 重名，但值不同
  WINDOW_CLOSE: 'window:close-window',          // ❌ 重名，但值不同
}
```

**问题描述:**
- 两个常量对象有相同的 key 名称
- 值不同，容易导致混淆
- preload 代码中混合使用两套常量，难以维护
- 如果都导入，后导入的会覆盖先导入的

**修复建议：** 方案 A（推荐）：合并到单一对象

```typescript
// src/shared/types.ts
export const IPC_CHANNELS = {
  // ... 现有的基础窗口操作（针对应用主窗口）...
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_CLOSE_CONFIRM: 'window:close-confirm',
  WINDOW_HIDE_TO_TRAY: 'window:hide-to-tray',
  WINDOW_FORCE_CLOSE: 'window:force-close',

  // ... 现有的 ...
} as const

// src/shared/types-extended.ts
export const IPC_CHANNELS_EXT = {
  // ... 现有的进程、端口、AI 任务等 ...
  
  // ✅ 窗口扩展操作（针对其他应用窗口）- 使用不同的名称
  WINDOW_SCAN: 'window:scan',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_MOVE: 'window:move',
  WINDOW_MINIMIZE_WINDOW: 'window:minimize-window',
  WINDOW_MAXIMIZE_WINDOW: 'window:maximize-window',
  WINDOW_CLOSE_WINDOW: 'window:close-window',
  WINDOW_CREATE_GROUP: 'window:create-group',
  WINDOW_GET_GROUPS: 'window:get-groups',
  WINDOW_REMOVE_GROUP: 'window:remove-group',
  WINDOW_FOCUS_GROUP: 'window:focus-group',
  WINDOW_SAVE_LAYOUT: 'window:save-layout',
  WINDOW_RESTORE_LAYOUT: 'window:restore-layout',
  WINDOW_GET_LAYOUTS: 'window:get-layouts',
  WINDOW_REMOVE_LAYOUT: 'window:remove-layout',
  WINDOW_UPDATED: 'window:updated',

  // ... 其他 ...
} as const
```

---

### MEDIUM-4: 缺少版本管理和向后兼容性考虑

| 属性 | 值 |
|------|-----|
| **文件** | `src/shared/types.ts`, `src/shared/types-extended.ts` |
| **类别** | 架构 / 长期可维护性 |
| **严重性** | MEDIUM |

**问题描述:**
- 当需要改变 IPC 通道的签名时（如新增参数），无法同时支持旧版本
- 升级应用时可能导致通信失败

**示例：** 当前支持无参扫描，如果未来想支持过滤：
```typescript
// 当前
const result = await api.projects.scan()

// 未来想改为支持过滤
const result = await api.projects.scan({ filter: 'npm' })

// 问题：旧版本客户端无法使用新签名，新版本主进程无法处理旧请求
```

**修复建议:**

在 IPC 通道名称中添加版本前缀：

```typescript
// src/shared/types.ts
export const IPC_CHANNELS = {
  // ✅ v1 通道（当前）
  PROJECTS_LIST: 'projects:list:v1',
  PROJECTS_GET: 'projects:get:v1',
  PROJECTS_ADD: 'projects:add:v1',
  PROJECTS_REMOVE: 'projects:remove:v1',
  PROJECTS_UPDATE: 'projects:update:v1',
  PROJECTS_SCAN: 'projects:scan:v1',
  PROJECTS_SCAN_DIRECTORY: 'projects:scan-directory:v1',
  PROJECTS_DISCOVER: 'projects:discover:v1',
  
  // ✅ 如果未来需要改变签名，可以并行支持 v2
  // PROJECTS_SCAN_V2: 'projects:scan:v2',  // 支持新参数
  
  // ... 其他通道也加上版本 ...
} as const
```

主进程中可以同时监听多个版本：
```typescript
// src/main/ipc.ts (伪代码)
ipcMain.handle('projects:scan:v1', (event, scanPath?) => {
  // v1 处理逻辑
  return handleProjectsScan(scanPath)
})

ipcMain.handle('projects:scan:v2', (event, options) => {
  // v2 处理逻辑，支持过滤
  return handleProjectsScanV2(options)
})
```

---

## 🟢 LOW 低级问题（下周优化）

### LOW-1: Preload 缺少上下文隔离检查

| 属性 | 值 |
|------|-----|
| **文件** | `src/preload/index.ts` |
| **行号** | 1-14 |
| **类别** | 安全 / 防御性编程 |
| **严重性** | LOW |

**问题代码片段:**
```typescript
import { contextBridge, ipcRenderer } from 'electron'
// ... 导入 ...

// ❌ 没有检查上下文隔离是否启用
contextBridge.exposeInMainWorld('devhub', {
  // ...
})
```

**问题描述:**
- 如果主进程配置错误（`contextIsolation: false`），preload 无法检测
- 安全漏洞会被默默忽视，渲染进程可能获得过度权限

**修复建议:**

在 preload 开头添加安全检查：

```typescript
import { contextBridge, ipcRenderer } from 'electron'
// ... 其他导入 ...

// ✅ 安全检查 - 确保上下文隔离已启用
if (!process.contextIsolated) {
  throw new Error(
    '[DevHub Preload] Context Isolation must be enabled for security. ' +
    'Please set contextIsolation: true in the BrowserWindow configuration.'
  )
}

// ✅ 现在可以安全地暴露 API
contextBridge.exposeInMainWorld('devhub', {
  // ...
})
```

---

### LOW-2: 构建配置中 preload extended.ts 依赖不明确

| 属性 | 值 |
|------|-----|
| **文件** | `electron.vite.config.ts` |
| **行号** | 22-43 |
| **类别** | 构建配置 / 可维护性 |
| **严重性** | LOW |

**问题代码片段:**
```typescript
preload: {
  plugins: [externalizeDepsPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs'
    },
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/preload/index.ts')
        // ❌ extended.ts 没有显式列出，虽然会自动包含
      },
      output: {
        entryFileNames: '[name].cjs'
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
}
```

**问题描述:**
- `extended.ts` 被 `index.ts` 导入，会自动包含，但这个关系不明确
- 维护者可能误以为只有 `index.ts` 被打包
- 后续重构时容易出错

**修复建议:**

添加注释说明依赖关系，使构建意图更清晰：

```typescript
preload: {
  plugins: [externalizeDepsPlugin()],
  build: {
    lib: {
      // index.ts 是唯一入口，自动包含其依赖（extended.ts）
      entry: resolve(__dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs'
    },
    rollupOptions: {
      input: {
        // 唯一入口 - extended.ts 和其他依赖通过 index.ts 的 import 语句自动包含
        // 不要在这里添加 extended.ts，它会被自动打包
        index: resolve(__dirname, 'src/preload/index.ts')
      },
      output: {
        entryFileNames: '[name].cjs'
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
}
```

---

## 📊 问题统计

| 严重性 | 数量 | 影响范围 |
|--------|------|----------|
| **CRITICAL** | 3 | 核心功能崩溃、安全漏洞 |
| **HIGH** | 3 | 类型混乱、运行时错误 |
| **MEDIUM** | 4 | 维护困难、长期隐患 |
| **LOW** | 2 | 代码质量优化 |
| **总计** | **12** | — |

---

## ✅ 修复优先级和时间表

| 优先级 | 问题 ID | 工作量 | 建议完成时间 |
|--------|---------|--------|------------|
| **P0 立即** | CRITICAL-1 | 30 min | 今天 |
| **P0 立即** | CRITICAL-2 | 45 min | 今天 |
| **P0 立即** | CRITICAL-3 | 1 hour | 今天 |
| **P1 本周** | HIGH-1 | 1.5 hour | 明天 |
| **P1 本周** | HIGH-2 | 2 hour | 明天 |
| **P1 本周** | HIGH-3 | 1 hour | 本周 |
| **P2 下周** | MEDIUM-1 | 45 min | 下周一 |
| **P2 下周** | MEDIUM-2 | 30 min | 下周一 |
| **P2 下周** | MEDIUM-3 | 1 hour | 下周二 |
| **P2 下周** | MEDIUM-4 | 1 hour | 下周二 |
| **P3 优化** | LOW-1 | 15 min | 下周三 |
| **P3 优化** | LOW-2 | 15 min | 下周三 |

---

## 📋 验证清单

完成所有修复后，请检查：

- [ ] 所有 IPC 通道都在 `IPC_CHANNELS` 或 `IPC_CHANNELS_EXT` 中定义
- [ ] preload 中没有硬编码的通道字符串
- [ ] 所有 extended API 都返回 `Promise<ServiceResult<T>>`
- [ ] 所有关键参数都有客户端验证
- [ ] `shell.openPath()` 和 `dialog.openDirectory()` 有路径验证
- [ ] preload 开头有 `contextIsolation` 检查
- [ ] `ServiceResult` 使用受歧视的联合类型
- [ ] `isProtectedProcess()` 有参数验证
- [ ] 日志 API 使用 `invoke` 代替 `send`
- [ ] 所有通道名称统一使用版本标记
- [ ] ESLint 检查通过（无 `any` 类型）
- [ ] TypeScript 严格模式检查通过
- [ ] 单元测试覆盖 IPC 协议边界

---

**报告完成日期:** 2026-04-10  
**审查人员:** Claude Code 审查助手
