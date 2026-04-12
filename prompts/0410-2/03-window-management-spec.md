# 窗口管理 — 技术设计 Spec（第二轮增补）

> 对应 PRD: 2.2 窗口管理三大功能 (P0 — 重中之重)
> 基于: `prompts/0410/03-window-management-spec.md` 增补
> 变更: 强调"仍不可用"，细化排查路径与实现要求

---

## 0. 核心问题陈述

经过两轮手动测试，窗口管理的 **三大功能全部不可用**：

| 功能 | 期望 | 现实 |
|------|------|------|
| AI 窗口自命名 | 用户可为 AI CLI 窗口设别名 | 无法命名，无入口 |
| 分组/布局 | 窗口可分组、可按布局排列 | 按钮存在但功能异常 |
| 监控进度 | 细粒度状态检测+时间线 | 仅"活跃/空闲"两态 |

这些是 **用户明确标注的"重中之重"**，下一轮开发必须优先解决。

---

## 1. AI 窗口自命名系统

### 1.1 为什么重要

用户同时运行多个 AI CLI 实例：
- Claude Code × 3（分别做前端重构、API 开发、测试修复）
- Codex CLI × 1
- OpenCode × 1
- Gemini CLI × 1

当某个实例发出"任务完成"通知时，用户 **无法区分是哪个实例完成了什么任务**。自命名 + 通知携带名称是解决这个问题的唯一途径。

### 1.2 检测 AI CLI 窗口

```typescript
// AI 工具识别规则
const AI_TOOL_SIGNATURES: Array<{
  type: AIToolType
  processMatch: RegExp        // 进程名匹配
  titleMatch?: RegExp         // 窗口标题匹配（补充判断）
  defaultNamePrefix: string   // 默认命名前缀
}> = [
  {
    type: 'claude-code',
    processMatch: /^(claude|claude-code|claude\.exe)$/i,
    titleMatch: /claude\s*code/i,
    defaultNamePrefix: 'Claude Code',
  },
  {
    type: 'codex-cli',
    processMatch: /^(codex|codex-cli)$/i,
    titleMatch: /codex/i,
    defaultNamePrefix: 'Codex CLI',
  },
  {
    type: 'opencode',
    processMatch: /^opencode$/i,
    defaultNamePrefix: 'OpenCode',
  },
  {
    type: 'gemini-cli',
    processMatch: /^(gemini|gemini-cli)$/i,
    titleMatch: /gemini/i,
    defaultNamePrefix: 'Gemini CLI',
  },
  {
    type: 'cursor',
    processMatch: /^cursor$/i,
    defaultNamePrefix: 'Cursor',
  },
  {
    type: 'aider',
    processMatch: /^aider$/i,
    defaultNamePrefix: 'Aider',
  },
]

// 检测逻辑
function detectAITool(processName: string, windowTitle: string): AIToolType | null {
  for (const sig of AI_TOOL_SIGNATURES) {
    if (sig.processMatch.test(processName)) return sig.type
    if (sig.titleMatch?.test(windowTitle)) return sig.type
  }
  // 启发式检测: 终端窗口 + 含 AI 关键词
  if (/\b(ai|llm|copilot|assistant)\b/i.test(windowTitle)) return 'unknown-ai'
  return null
}
```

### 1.3 命名与持久化

```typescript
interface AIWindowAlias {
  // 匹配键 (组合匹配，容忍 PID 变化)
  matchKey: {
    toolType: AIToolType
    titlePrefix: string       // 窗口标题前 50 字符
    executablePath: string    // 可执行文件路径
    workingDirectory?: string // CWD (如果可获取)
  }
  // 用户数据
  customName: string
  createdAt: string  // ISO
  lastSeenAt: string // ISO
}

// 持久化到 electron-store
// Key: 'ai-window-aliases'
// Value: AIWindowAlias[]

// 匹配算法: 优先精确匹配(toolType+titlePrefix+execPath)，
// 次优匹配(toolType+execPath)，最后回退到序号命名
```

### 1.4 命名 UI 交互

```
命名入口 (三种方式，择一即可触发):
├── 双击窗口卡片标题文字 → 内联编辑（input 替换 span）
├── 卡片右上角 ✏️ 图标 → 内联编辑
└── 右键菜单 → "重命名" → 内联编辑

内联编辑行为:
├── 点击/触发后: 标题文字变为 input 框，自动选中全部文字
├── 回车 / 失焦: 保存名称
├── ESC: 取消编辑，恢复原名
├── 空字符串: 恢复为默认自动命名
└── 保存后: 立即推送到 main process，写入 electron-store
```

### 1.5 AI 窗口列表 UI

AI 窗口应在窗口列表中 **置顶显示**，并与普通窗口有明确的视觉分隔：

```
┌─────────────────────────────────────────────────────────────────┐
│ 🤖 AI 工具 (3)                                  [全部折叠/展开] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ 🟢 Claude-前端重构 ─────────── claude-code ── PID:1234 ──┐  │
│ │  状态: 编码中 (已持续 5min)    CPU: 34%    MEM: 280MB     │  │
│ │  [✏️ 重命名] [👁 聚焦] [📌 置顶] [⏹ 停止追踪]            │  │
│ └────────────────────────────────────────────────────────────┘  │
│ ┌─ 🟡 Codex-API开发 ──────────── codex-cli ─── PID:5678 ──┐  │
│ │  状态: 等待输入 (3分钟前)      CPU: 2%     MEM: 150MB     │  │
│ │  [✏️ 重命名] [👁 聚焦] [📌 置顶] [⏹ 停止追踪]            │  │
│ └────────────────────────────────────────────────────────────┘  │
│ ┌─ ⚪ Gemini CLI-3 ────────────── gemini-cli ── PID:9012 ──┐  │
│ │  状态: 空闲                    CPU: 0%     MEM: 80MB      │  │
│ │  [✏️ 重命名] [👁 聚焦] [📌 置顶] [⏹ 停止追踪]            │  │
│ └────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│ 📋 其他窗口 (39)                                                │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘

状态颜色:
  🟢 绿色: 活跃 (thinking/coding/compiling)
  🟡 黄色: 等待输入
  ⚪ 灰色: 空闲/不活跃
  🔴 红色: 错误
  ✅ 蓝色: 完成
```

---

## 2. 通知系统增强

### 2.1 通知格式

```
系统原生通知 (Windows Toast):
┌────────────────────────────────────────────┐
│ DevHub                                  ×  │
├────────────────────────────────────────────┤
│ [Claude-前端重构] 任务完成                  │
│                                            │
│ claude-code • PID: 1234 • 用时: 12分30秒   │
│                                            │
│ [聚焦窗口]          [忽略]                  │
└────────────────────────────────────────────┘
```

### 2.2 通知触发条件

```typescript
// 在 AITaskTracker 的状态机中触发
function onStatusChange(window: AIWindowConfig, oldStatus: AIWindowStatus, newStatus: AIWindowStatus) {
  // 任务完成通知
  if (newStatus === 'completed' && oldStatus !== 'completed') {
    sendNotification({
      title: `[${window.customName}] 任务完成`,
      body: `${window.toolType} • PID: ${window.hwnd} • 用时: ${formatDuration(window.lastActivityAt, now())}`,
      actions: [
        { type: 'button', text: '聚焦窗口', action: () => focusWindow(window.hwnd) },
        { type: 'button', text: '忽略' },
      ],
    })
  }

  // 错误通知
  if (newStatus === 'error') {
    sendNotification({
      title: `[${window.customName}] 检测到错误`,
      body: `${window.toolType} • PID: ${window.hwnd}`,
      urgency: 'critical',
    })
  }

  // 等待输入通知（可选，用户可配置）
  if (newStatus === 'waiting-input' && window.notificationPreference === 'all') {
    sendNotification({
      title: `[${window.customName}] 等待输入`,
      body: `${window.toolType} 需要你的操作`,
    })
  }
}
```

### 2.3 Windows Toast 实现

```typescript
import { Notification } from 'electron'

function sendNotification(opts: {
  title: string
  body: string
  urgency?: 'normal' | 'critical'
  actions?: Array<{ type: string; text: string; action?: () => void }>
}) {
  const notification = new Notification({
    title: opts.title,
    body: opts.body,
    urgency: opts.urgency ?? 'normal',
    silent: false,
    // Windows Toast 不支持自定义 action buttons，但支持点击事件
  })

  notification.on('click', () => {
    // 点击通知 → 聚焦到 DevHub 窗口，并高亮对应 AI 窗口卡片
    if (opts.actions?.[0]?.action) {
      opts.actions[0].action()
    }
  })

  notification.show()
}
```

---

## 3. 分组/布局功能修复

### 3.1 排查清单

在开发时 **必须逐一排查** 以下路径：

```
□ 1. IPC 通道注册检查
  □ ipcMain.handle('window:createGroup', ...) 是否存在？
  □ ipcMain.handle('window:saveLayout', ...) 是否存在？
  □ ipcMain.handle('window:restoreLayout', ...) 是否存在？
  □ ipcMain.handle('window:applyLayout', ...) 是否存在？

□ 2. Handler 实现检查
  □ createGroup handler 内部逻辑是否完整？
  □ saveLayout 是否正确读取了窗口位置/大小？
  □ restoreLayout 是否正确调用了 Win32 MoveWindow/SetWindowPos？

□ 3. PowerShell/C# 兼容性检查
  □ 是否有类似 focusWindow 的 C# 7+ 语法问题？
  □ out _ / out var 是否存在？
  □ 其他 C# 7+ 语法（pattern matching, tuple, etc.）是否存在？

□ 4. Win32 API 调用检查
  □ MoveWindow 参数是否考虑了 DPI 缩放？
  □ SetWindowPos 的 hwnd 是否有效（窗口可能已关闭）？
  □ 多显示器场景下坐标是否正确？

□ 5. 前端事件绑定检查
  □ "创建分组" 按钮 onClick 是否绑定到 IPC 调用？
  □ "保存布局" 按钮 onClick 是否绑定到 IPC 调用？
  □ "恢复布局" 按钮 onClick 是否绑定到 IPC 调用？
  □ 调用后是否有 UI 反馈（成功/失败 toast）？

□ 6. 状态同步检查
  □ 前端 UI 状态（按钮 active/disabled）是否与后端实际状态同步？
  □ 分组创建后，分组列表是否刷新？
  □ 布局恢复后，窗口列表位置信息是否更新？
```

### 3.2 分组功能修复后验证流程

```
验证用例:
1. 创建分组 "前端组"
   → 选择 3 个窗口加入
   → 验证: 分组列表显示 "前端组 (3个窗口)"

2. 分组操作
   → 全部最小化 → 验证: 3 个窗口均最小化
   → 全部恢复 → 验证: 3 个窗口均恢复
   → 平铺排列 → 验证: 3 个窗口均匀平铺屏幕

3. 修改分组
   → 从分组移除 1 个窗口 → 验证: 分组变为 "前端组 (2个窗口)"
   → 添加 1 个窗口 → 验证: 分组变为 "前端组 (3个窗口)"

4. 删除分组
   → 删除 "前端组" → 验证: 分组列表移除，窗口不受影响

5. 异常场景
   → 分组中的窗口被用户手动关闭 → 验证: 分组自动移除该窗口，不报错
   → 分组中所有窗口都关闭 → 验证: 分组自动删除或标记为空
```

### 3.3 布局功能修复后验证流程

```
验证用例:
1. 保存布局 "工作模式"
   → 当前 5 个窗口各有特定位置和大小
   → 保存 → 验证: 布局列表显示 "工作模式 (5个窗口)"

2. 打乱后恢复
   → 手动拖拽窗口到随机位置
   → 恢复 "工作模式" → 验证: 所有窗口回到保存时的位置和大小

3. 窗口减少后恢复
   → 关闭 2 个窗口 → 恢复 "工作模式"
   → 验证: 剩余 3 个窗口正确定位，不报错

4. 删除布局
   → 删除 "工作模式" → 验证: 布局列表移除

5. 多显示器
   → 在双屏环境保存布局 → 切换到单屏 → 恢复
   → 验证: 窗口不超出可见屏幕范围
```

---

## 4. 监控进度状态机

### 4.1 状态转移图

```
                  ┌──────────┐
                  │  idle    │ ←─ 初始状态 / 长时间无活动
                  └────┬─────┘
                       │ 检测到 CPU 上升 / 窗口标题变化
                       ▼
                  ┌──────────┐
         ┌───────│ thinking  │
         │       └────┬─────┘
         │            │ 检测到终端输出 / 文件写入
         │            ▼
         │       ┌──────────┐
         │  ┌────│  coding   │────┐
         │  │    └────┬─────┘    │
         │  │         │          │ 检测到 npm/tsc/vite/pytest 命令
         │  │         │          ▼
         │  │         │    ┌───────────┐
         │  │         │    │ compiling  │
         │  │         │    └─────┬─────┘
         │  │         │          │
         │  │         ▼          ▼
         │  │    ┌──────────────────┐
         │  │    │  waiting-input    │ ←─ 终端输出停止 + CPU 低 + 提示符出现
         │  │    └────┬────────┬───┘
         │  │         │        │
         │  │         │        │ 检测到完成关键词
         │  │         │        ▼
         │  │         │   ┌──────────┐
         │  └─────────┘   │ completed │
         │                └──────────┘
         │
         │  检测到错误关键词 (任何状态均可触发)
         ▼
    ┌──────────┐
    │  error    │
    └──────────┘
```

### 4.2 检测信号矩阵

| 状态 | 主要信号 | 辅助信号 | 置信度 |
|------|---------|---------|--------|
| idle | 终端无输出 > 30s + CPU < 5% | 窗口标题不变 | 高 |
| thinking | CPU > 20% + 无终端输出 | 窗口标题含 "thinking"/"analyzing" | 中 |
| coding | 有持续终端输出 | 文件系统有写入事件 | 高 |
| compiling | 终端输出含 tsc/vite/npm/pytest | CPU 波动 | 高 |
| waiting-input | 终端输出停止 + CPU < 5% | 窗口标题含 "?" / ">" | 中 |
| completed | 关键词: Done/Complete/✓/finished | CPU 降低 + 输出停止 | 中 |
| error | 关键词: Error/Failed/✗/panic | CPU 可能突降 | 高 |

### 4.3 进度时间线数据

```typescript
interface AIProgressTimeline {
  windowId: string
  entries: TimelineEntry[]
}

interface TimelineEntry {
  timestamp: string    // ISO
  status: AIWindowStatus
  duration: number     // 秒，该状态持续时间
  detail?: string      // 可选描述（如 "修改 App.tsx"）
}

// 示例
const timeline: TimelineEntry[] = [
  { timestamp: '2026-04-10T12:30:00Z', status: 'idle', duration: 0 },
  { timestamp: '2026-04-10T12:30:05Z', status: 'thinking', duration: 120 },
  { timestamp: '2026-04-10T12:32:05Z', status: 'coding', duration: 300, detail: '修改 App.tsx' },
  { timestamp: '2026-04-10T12:37:05Z', status: 'compiling', duration: 45, detail: 'tsc --noEmit' },
  { timestamp: '2026-04-10T12:37:50Z', status: 'coding', duration: 180, detail: '修改 utils.ts' },
  { timestamp: '2026-04-10T12:40:50Z', status: 'waiting-input', duration: 0 },
]
```

### 4.4 时间线 UI

```
┌────────────────────────────────────────────────────────────────┐
│ Claude-前端重构 进度时间线                              [刷新]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ 12:30  ●━━━ idle                                       [0s]   │
│ 12:30  ●━━━━━━━━━ thinking                            [2m]    │
│ 12:32  ●━━━━━━━━━━━━━━━━━ coding (App.tsx)            [5m]    │
│ 12:37  ●━━━━ compiling (tsc)                          [45s]   │
│ 12:38  ●━━━━━━━━━━━━ coding (utils.ts)                [3m]    │
│ 12:41  ●━━━ waiting-input                             [now]   │
│        └── "是否继续修改样式?"                                   │
│                                                                │
│ 总用时: 11min 50s   活跃编码: 8min   等待: 0min               │
└────────────────────────────────────────────────────────────────┘

颜色编码:
  ━━━ idle:          灰色
  ━━━ thinking:      蓝色
  ━━━ coding:        绿色
  ━━━ compiling:     橙色
  ━━━ waiting-input: 黄色
  ━━━ completed:     青色
  ━━━ error:         红色
```

---

## 5. 验收标准

### AI 窗口自命名
- [ ] 新检测到的 AI 窗口自动分配默认名称 `{工具类型}-{序号}`
- [ ] 双击标题可内联编辑名称
- [ ] 名称保存后持久化，重启应用后恢复
- [ ] AI 窗口在列表中置顶显示，与普通窗口分隔

### 通知
- [ ] 任务完成通知格式：`[自定义名称] 任务完成`
- [ ] 通知包含工具类型、PID、持续时间
- [ ] 点击通知聚焦到对应窗口
- [ ] 使用 Electron Notification API（Windows Toast）

### 分组/布局
- [ ] 创建分组 → 分组操作（最小化/恢复/排列）→ 删除分组 全链路正常
- [ ] 保存布局 → 打乱窗口 → 恢复布局 全链路正常
- [ ] 异常场景（窗口关闭、多显示器切换）不报错

### 监控进度
- [ ] 至少识别 5 种状态（idle/thinking/coding/waiting-input/completed）
- [ ] 状态变化记录时间戳，可在 UI 中展示时间线
- [ ] 完成状态触发通知
