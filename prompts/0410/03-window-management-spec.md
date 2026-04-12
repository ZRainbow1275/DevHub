# 窗口管理改进 — 技术设计 Spec

> 对应 PRD: 2.1 AI 窗口自命名 / 2.2 分组布局修复 / 2.3 监控进度 / 2.4 focusWindow Bug

---

## 1. AI 窗口自命名与通知标识（P0）

### 1.1 数据模型

```typescript
interface AIWindowConfig {
  hwnd: number                    // 窗口句柄
  processName: string             // 进程名 (claude-code, codex, etc.)
  customName: string              // 用户自定义名称
  toolType: AIToolType            // 工具类型
  createdAt: Date                 // 首次检测时间
  lastActivityAt: Date            // 最后活动时间
  status: AIWindowStatus          // 当前状态
  notificationPreference: 'all' | 'complete_only' | 'none'
}

type AIToolType = 
  | 'claude-code' 
  | 'codex-cli' 
  | 'opencode' 
  | 'gemini-cli' 
  | 'cursor'
  | 'unknown-ai'

type AIWindowStatus =
  | 'idle'           // 空闲
  | 'thinking'       // 思考中
  | 'coding'         // 编码中
  | 'waiting-input'  // 等待用户输入
  | 'completed'      // 任务完成
  | 'error'          // 出错
```

### 1.2 命名交互流程

```
新 AI 窗口被检测到
  │
  ▼
自动分配默认名称: "{toolType}-{序号}"
  例: "Claude Code-1", "Codex CLI-2"
  │
  ▼
用户可通过以下方式自定义:
  ├── 窗口卡片上的 [✏️ 重命名] 按钮
  ├── 双击卡片标题直接编辑
  └── 右键菜单 → 重命名
  │
  ▼
名称持久化到 AppStore
  └── 下次打开相同路径的窗口时自动恢复名称
```

### 1.3 通知格式

```
当前通知: "AI 任务已完成"
改进通知: "[Claude-前端重构] 任务已完成 — claude-code (PID: 12345)"

通知内容结构:
├── 标题: "[{customName}] 任务已完成"  
├── 正文: "{toolType} • PID: {pid} • 用时: {duration}"
└── 操作: [聚焦窗口] [忽略]
```

### 1.4 AI 窗口列表 UI

```
┌─────────────────────────────────────────────────────┐
│ 🤖 AI 工具监控                      [+ 手动添加]    │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🟢 Claude-前端重构        claude-code  PID:1234 │ │
│ │ 状态: 编码中 (12:30 开始)  [✏️] [👁] [📌] [×]   │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🟡 Codex-API开发          codex-cli    PID:5678 │ │
│ │ 状态: 等待输入 (3分钟前)   [✏️] [👁] [📌] [×]   │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ⚪ Gemini-测试修复         gemini-cli   PID:9012 │ │
│ │ 状态: 空闲                 [✏️] [👁] [📌] [×]   │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

图标说明:
  ✏️ = 重命名
  👁 = 聚焦窗口
  📌 = 置顶/固定
  × = 停止追踪
```

---

## 2. 分组与布局功能修复（P0）

### 2.1 调查方向

```
排查路径:
├── WindowManager.ts 中的分组/布局实现
│   ├── groupWindows() — 检查分组逻辑是否正确获取窗口句柄
│   ├── layoutWindows() — 检查 MoveWindow API 调用参数
│   └── 屏幕分辨率/DPI 缩放适配
├── IPC 通道
│   └── 检查 renderer → main 的参数传递是否正确
├── PowerShell 调用
│   └── 与 focusWindow 同类的 C# 编译问题？
└── UI 状态
    └── 按钮状态是否与 backend 实际行为同步
```

### 2.2 分组功能设计

```
分组方式:
├── 按类型自动分组: AI 工具 / 浏览器 / 编辑器 / 终端 / 其他
├── 按项目分组: 相同工作目录的窗口归为一组
├── 自定义分组: 用户拖拽创建分组
└── 标签分组: 用户为窗口打标签，按标签分组

分组操作:
├── 全部最小化/恢复
├── 一键排列（平铺/层叠）
├── 一键关闭整组
└── 组内窗口拖拽排序
```

### 2.3 布局功能设计

```
布局模式:
├── 网格平铺: 等分屏幕（2/3/4/6/9 格）
├── 主从布局: 一个主窗口 + 侧边多个小窗口
├── 层叠排列: 窗口按等距偏移层叠
├── 自由布局: 用户手动拖拽定位
└── 预设布局: 保存/加载用户自定义的窗口排列方案
```

---

## 3. 监控进度增强（P0）

### 3.1 状态检测增强

```typescript
// 当前: 仅检测 "忙碌" vs "空闲"
// 改进: 细粒度状态机

enum AITaskPhase {
  IDLE = 'idle',              // 无活动
  THINKING = 'thinking',      // 大模型在思考（无输出，CPU 高）
  CODING = 'coding',          // 正在写代码（有输出流）
  WAITING_INPUT = 'waiting',  // 等待用户输入（光标闪烁）
  COMPILING = 'compiling',    // 在编译/运行测试
  COMPLETED = 'completed',    // 任务完成标记
  ERROR = 'error'             // 检测到错误输出
}
```

### 3.2 检测方法

| 状态 | 检测信号 |
|------|---------|
| THINKING | 窗口标题变化 + CPU 波动 + 无终端输出 |
| CODING | 终端有持续输出 + 文件系统有写入 |
| WAITING_INPUT | 终端输出停止 + 光标位于输入行 + CPU 平稳 |
| COMPLETED | 关键词检测（"Done", "Complete", "✓"）+ 输出停止 |
| ERROR | 关键词检测（"Error", "Failed", "✗"）|

### 3.3 进度时间线

```
┌────────────────────────────────────────────────┐
│ Claude-前端重构 进度时间线                       │
├────────────────────────────────────────────────┤
│ 12:30 ●─── 开始任务                             │
│ 12:31 ●─── 思考中 (读取文件)          [2分钟]   │
│ 12:33 ●─── 编码中 (修改 App.tsx)      [5分钟]   │
│ 12:38 ●─── 编码中 (修改 utils.ts)     [3分钟]   │
│ 12:41 ●─── 等待输入                   [当前]     │
│       └──  提示: "是否继续修改样式?"              │
└────────────────────────────────────────────────┘
```

---

## 4. focusWindow Bug 修复（P0）

### 4.1 问题根因

```
Windows PowerShell 5.1 使用 .NET Framework 编译器 (Roslyn 之前)
  └── 仅支持 C# 5 语法
      └── 不支持 `out _` (discard syntax, C# 7.0+)
      └── 不支持 `out var` (C# 7.0+)

错误信息 (乱码解码后):
  1. "当前上下文中不存在名称 '_'"
  2. "与 GetWindowThreadProcessId(IntPtr, out uint) 最匹配的方法有一些无效参数"
  3. "参数 2: 无法从 'out _' 转换为 'out uint'"
```

### 4.2 修复方案

```csharp
// 修复前 (C# 7+):
uint targetThread = GetWindowThreadProcessId(h, out _);
uint fgThread = (fg != IntPtr.Zero) ? GetWindowThreadProcessId(fg, out _) : 0;

// 修复后 (C# 5 兼容):
uint pid1 = 0;
uint targetThread = GetWindowThreadProcessId(h, out pid1);
uint pid2 = 0;
uint fgThread = (fg != IntPtr.Zero) ? GetWindowThreadProcessId(fg, out pid2) : 0;
```

### 4.3 编码修复

```typescript
// Node.js child_process 调用 PowerShell 时指定编码
execSync(command, {
  encoding: 'buffer',  // 获取原始 buffer
  // 然后用 iconv 或 TextDecoder 以系统 ANSI 编码解码
})

// 或者在 PowerShell 命令前设置输出编码
const psCommand = `
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
  ${originalCommand}
`
```
