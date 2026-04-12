# Spec-04: 窗口管理核心增强

> **关联 PRD**: prd-master.md → G5
> **优先级**: P0 (重中之重) | **预估复杂度**: High

---

## 1. 问题分析

### 1.1 AI 窗口命名缺失

**痛点场景**:
用户同时运行 3 个 Claude Code + 2 个 Codex CLI + 1 个 Gemini CLI，任务完成通知弹出：
> "Claude Code 任务完成 (12分钟)"

用户：**到底是哪个 Claude Code 完成了？**

**当前状态**:
- `AITaskTracker.ts` 通过 PID 追踪任务
- `NotificationService.notifyTaskComplete(toolName, duration)` 仅传递工具名
- 窗口标题通常为 `claude` 或终端标题，缺乏区分度
- 无用户自定义别名机制

### 1.2 分组/布局功能异常

**WindowView.tsx** 代码审查发现:
- `createGroup` 调用 `useWindows().createGroup(name, selectedHwnds)` — 依赖正确的 hwnd 选择
- 多选状态 `selectedForGroup` 是局部 state，与 `showSystemWindows` toggle 交互时有竞态
- `saveLayout` 基于当前 groups，但 groups 可能未加载
- `restoreLayout` 的标题匹配策略（前20字符）过于脆弱
- 无操作反馈 — 用户不知道创建是否成功

### 1.3 进度监控粗糙

**AITaskTracker.ts** 完成检测:
- 依赖窗口标题正则匹配 COMPLETION_PATTERNS
- CPU 空闲检测（avgCpu < 2 && currentCpu < 1）
- 权重评分阈值 0.7
- 无中间阶段检测（只有 running → completed）
- 无进度百分比估算

---

## 2. 设计方案

### 2.1 模块 A: AI 窗口自命名系统

#### A.1 数据模型

```typescript
// 新增类型 (types-extended.ts)
interface AIWindowAlias {
  id: string                      // alias_${timestamp}
  alias: string                   // 用户设定的别名，如 "前端重构"
  matchCriteria: {
    pid?: number                  // 当前 PID (进程存活时优先匹配)
    commandHash?: string          // 命令行 hash (重启后匹配)
    titlePrefix?: string          // 窗口标题前缀 (备用匹配)
    toolType: AIToolType          // 工具类型
    workingDir?: string           // 工作目录 (强匹配因子)
  }
  createdAt: number
  lastMatchedAt: number           // 最后匹配时间 (用于清理过期别名)
  color?: string                  // 可选: 别名颜色标识
  icon?: string                   // 可选: 自定义图标
}
```

#### A.2 匹配策略 (多因子加权)

```typescript
function matchAlias(window: WindowInfo, process: ProcessInfo, aliases: AIWindowAlias[]): AIWindowAlias | null {
  const scores = aliases.map(alias => {
    let score = 0
    
    // PID 精确匹配 (进程存活时最可靠)
    if (alias.matchCriteria.pid === process.pid) score += 50
    
    // 工作目录匹配 (跨重启稳定)
    if (alias.matchCriteria.workingDir === process.workingDir) score += 30
    
    // 命令行 hash 匹配 (跨重启稳定)
    if (alias.matchCriteria.commandHash === hashCommand(process.command)) score += 15
    
    // 标题前缀匹配 (最弱)
    if (window.title.startsWith(alias.matchCriteria.titlePrefix || '')) score += 5
    
    // 工具类型必须匹配
    if (alias.matchCriteria.toolType !== detectToolType(process)) score = 0
    
    return { alias, score }
  })
  
  const best = scores.sort((a, b) => b.score - a.score)[0]
  return best && best.score >= 30 ? best.alias : null
}
```

#### A.3 用户交互

**设置别名入口** (WindowView.tsx):

```
AI 窗口卡片:
┌────────────────────────────────────────────────┐
│ 🤖 Claude Code                    [✏️ 命名]   │
│ PID: 12345 · D:\Projects\frontend              │
│ 别名: 前端重构-Claude  (⬤ 蓝色)               │
│                                                 │
│ 运行中 · 15分钟 · CPU 23%                      │
└────────────────────────────────────────────────┘

点击 [✏️ 命名] → 弹出 inline 编辑:
┌────────────────────────────────────────────────┐
│ 别名: [前端重构-Claude          ]  [🎨] [✓]   │
│ 颜色: ⬤红 ⬤蓝 ⬤绿 ⬤紫 ⬤橙                  │
└────────────────────────────────────────────────┘
```

**持久化**: electron-store `aiWindowAliases` 键，与 settings 同级。

#### A.4 后端集成

```typescript
// AITaskTracker.ts 修改
class AITaskTracker {
  private aliasStore: AIWindowAlias[]
  
  // 扫描时自动匹配别名
  async scanForAITasks(): Promise<AITask[]> {
    const tasks = await this.detectAIProcesses()
    for (const task of tasks) {
      const alias = matchAlias(task.window, task.process, this.aliasStore)
      if (alias) {
        task.alias = alias.alias       // 注入别名
        task.aliasColor = alias.color  // 注入颜色
        // 更新 lastMatchedAt
        alias.lastMatchedAt = Date.now()
      }
    }
    return tasks
  }
}
```

---

### 2.2 模块 B: 通知增强

#### B.1 通知格式改进

```typescript
// NotificationService.ts 修改
notifyTaskComplete(task: AITask): void {
  const displayName = task.alias || truncate(task.windowTitle, 30) || task.toolType
  const toolLabel = AI_TOOL_LABELS[task.toolType]  // "Claude Code" / "Codex" etc.
  
  const title = `[${displayName}] 任务完成`
  const body = `${toolLabel} · ${formatDuration(task.duration)}`
  
  // 通知携带 task ID，用于点击跳转
  this.notify({
    type: 'task-complete',
    title,
    body,
    metadata: {
      taskId: task.id,
      windowHwnd: task.windowHwnd,
      aliasColor: task.aliasColor
    },
    dedupKey: `task-complete-${task.pid}`
  })
}
```

#### B.2 通知点击行为

```typescript
// 通知点击 → 聚焦到对应窗口
notification.on('click', () => {
  const { windowHwnd, taskId } = notification.metadata
  
  // 1. 聚焦 AI 窗口
  if (windowHwnd) {
    windowManager.focusWindow(windowHwnd)
  }
  
  // 2. DevHub 窗口切换到 AI 任务 Tab，选中该任务
  mainWindow.webContents.send('navigate-to-task', taskId)
})
```

#### B.3 通知历史增强

```
通知历史列表:
┌────────────────────────────────────────────────────────┐
│ 🟢 [前端重构-Claude] 任务完成                    2m ago│
│    Claude Code · 15分钟                                │
│    [聚焦窗口] [查看详情]                               │
├────────────────────────────────────────────────────────┤
│ 🟢 [API开发-Codex] 任务完成                      8m ago│
│    Codex · 7分钟                                       │
│    [聚焦窗口] [查看详情]                               │
├────────────────────────────────────────────────────────┤
│ ⚠️ 端口冲突: :3000                              12m ago│
│    node.exe (PID: 12345) 占用                          │
│    [释放端口]                                          │
└────────────────────────────────────────────────────────┘
```

---

### 2.3 模块 C: 分组/布局修复

#### C.1 问题根因分析与修复

**问题 1: 分组创建失败**

根因: `selectedForGroup` 是 `useState<number[]>` (hwnd 列表)，但窗口扫描更新后 hwnd 可能变化（窗口重新枚举时 hwnd 一般不变，但列表引用变了），导致提交时 hwnd 与当前窗口列表不匹配。

修复:
```typescript
// 创建分组时验证 hwnd 有效性
const createGroup = async (name: string, hwnds: number[]) => {
  // 1. 过滤掉已失效的 hwnd
  const validHwnds = hwnds.filter(hwnd => 
    windows.some(w => w.hwnd === hwnd)
  )
  
  if (validHwnds.length === 0) {
    toast.error('所选窗口已关闭，请重新选择')
    return
  }
  
  // 2. 调用 IPC
  const result = await window.devhub.windowManager.createGroup(name, validHwnds)
  
  // 3. 操作反馈
  if (result) {
    toast.success(`分组 "${name}" 创建成功 (${validHwnds.length} 个窗口)`)
    await fetchGroups()  // 刷新列表
  } else {
    toast.error('分组创建失败')
  }
}
```

**问题 2: 布局恢复失败**

根因: `WindowManager.restoreLayout` 使用 `processName + title前20字符` 匹配，匹配率低。

修复: 增强匹配策略
```typescript
interface LayoutWindowMatcher {
  processName: string          // 必须匹配
  titlePattern: string         // 标题子串匹配 (放宽)
  className?: string           // 窗口类名匹配 (新增)
  workingDir?: string          // 工作目录匹配 (新增)
  matchScore: number           // 匹配置信度
}

// 使用加权匹配替代精确匹配
function matchWindowForLayout(saved: LayoutWindowMatcher, current: WindowInfo): number {
  let score = 0
  if (saved.processName === current.processName) score += 40
  if (current.title.includes(saved.titlePattern)) score += 30
  if (saved.className === current.className) score += 20
  if (saved.workingDir && current.workingDir?.includes(saved.workingDir)) score += 10
  return score
}
// 匹配阈值: score >= 40 (至少进程名匹配)
```

**问题 3: 操作无反馈**

修复: 所有分组/布局操作添加 toast 反馈
```typescript
// 统一操作反馈模式
const withFeedback = async (
  operation: () => Promise<any>,
  successMsg: string,
  errorMsg: string
) => {
  try {
    const result = await operation()
    if (result !== false && result !== null) {
      toast.success(successMsg)
    } else {
      toast.error(errorMsg)
    }
    return result
  } catch (err) {
    toast.error(`${errorMsg}: ${err.message}`)
    return null
  }
}
```

#### C.2 布局预览

保存布局时显示 mini-map 预览:

```
┌─ 保存布局 ─────────────────────────────────────┐
│                                                   │
│  名称: [开发布局-双屏              ]             │
│  描述: [左屏IDE+终端 右屏浏览器      ]           │
│                                                   │
│  ┌─ 预览 ─────────────────────────────────┐     │
│  │ ┌──────┐┌──────┐  ┌──────────────────┐ │     │
│  │ │ VS   ││Term  │  │ Chrome           │ │     │
│  │ │ Code ││inal │  │                  │ │     │
│  │ │      ││      │  │                  │ │     │
│  │ └──────┘└──────┘  └──────────────────┘ │     │
│  │  ← 显示器1 →       ← 显示器2 →         │     │
│  └─────────────────────────────────────────┘     │
│                                                   │
│  包含 5 个窗口, 2 个分组                          │
│                                                   │
│  [取消]                              [保存布局]  │
└──────────────────────────────────────────────────┘
```

---

### 2.4 模块 D: 进度监控增强

#### D.1 阶段检测系统

```typescript
// AI 任务阶段定义
type AITaskPhase = 
  | 'initializing'    // 启动中 (进程刚创建, CPU 初始化)
  | 'thinking'        // 思考中 (API 调用, 等待响应, 低 CPU)
  | 'coding'          // 编码中 (文件写入检测, 中等 CPU)
  | 'validating'      // 验证中 (测试/lint 运行, 高 CPU 爆发)
  | 'completed'       // 完成 (CPU 降至空闲, 输出完成标志)
  | 'error'           // 错误

// 阶段检测信号
interface PhaseSignals {
  phase: AITaskPhase
  confidence: number       // 0-1 置信度
  indicators: string[]     // 检测到的指标
}

function detectPhase(task: AITask): PhaseSignals {
  const signals: PhaseSignals = { phase: 'thinking', confidence: 0, indicators: [] }
  
  const { cpuHistory, idleDuration } = task.metrics
  const avgCpu = average(cpuHistory.slice(-5))
  const cpuVariance = variance(cpuHistory.slice(-10))
  const titlePatterns = analyzeWindowTitle(task.windowTitle)
  
  // 初始化阶段: 进程刚启动 (<10秒)
  if (Date.now() - task.startTime < 10000) {
    return { phase: 'initializing', confidence: 0.9, indicators: ['process_young'] }
  }
  
  // 编码阶段: CPU 中等 + 标题变化频繁
  if (avgCpu > 5 && avgCpu < 60 && cpuVariance > 2) {
    signals.phase = 'coding'
    signals.confidence = 0.7
    signals.indicators.push('moderate_cpu', 'cpu_variance')
  }
  
  // 验证阶段: CPU 突然升高 (测试/编译)
  if (avgCpu > 60 || (cpuHistory[cpuHistory.length - 1] > 50 && cpuVariance > 10)) {
    signals.phase = 'validating'
    signals.confidence = 0.6
    signals.indicators.push('high_cpu_burst')
  }
  
  // 思考阶段: 低 CPU + 稳定
  if (avgCpu < 5 && cpuVariance < 1 && idleDuration < 30000) {
    signals.phase = 'thinking'
    signals.confidence = 0.8
    signals.indicators.push('low_cpu', 'stable', 'not_idle_long')
  }
  
  // 窗口标题模式增强
  if (titlePatterns.hasCompletionKeyword) {
    signals.phase = 'completed'
    signals.confidence = 0.9
    signals.indicators.push('title_completion_pattern')
  }
  if (titlePatterns.hasErrorKeyword) {
    signals.phase = 'error'
    signals.confidence = 0.9
    signals.indicators.push('title_error_pattern')
  }
  
  return signals
}
```

#### D.2 进度估算

```typescript
interface ProgressEstimate {
  percentage: number           // 0-100 (估算值)
  phase: AITaskPhase
  phaseLabel: string           // "思考中..." / "编码中..." / etc.
  elapsed: number              // 已用时间
  estimatedRemaining?: number  // 预估剩余 (基于历史同类任务)
  confidence: number           // 估算置信度
}

function estimateProgress(task: AITask, history: AITaskHistory[]): ProgressEstimate {
  const phase = detectPhase(task)
  const elapsed = Date.now() - task.startTime
  
  // 基于历史同类工具任务的平均时长
  const sameToolHistory = history.filter(h => h.toolType === task.toolType)
  const avgDuration = sameToolHistory.length > 0
    ? average(sameToolHistory.map(h => h.duration))
    : null
  
  // 进度 = 阶段权重 + 时间占比
  const phaseWeights = {
    initializing: 0.05,
    thinking: 0.30,
    coding: 0.70,
    validating: 0.90,
    completed: 1.00,
    error: null,
  }
  
  let percentage = (phaseWeights[phase.phase] ?? 0.5) * 100
  
  // 如果有历史数据，混合时间估算
  if (avgDuration) {
    const timeProgress = Math.min(elapsed / avgDuration, 0.95) * 100
    percentage = percentage * 0.6 + timeProgress * 0.4  // 60% 阶段, 40% 时间
  }
  
  return {
    percentage: Math.round(clamp(percentage, 0, 99)),  // 未明确完成不到100
    phase: phase.phase,
    phaseLabel: PHASE_LABELS[phase.phase],
    elapsed,
    estimatedRemaining: avgDuration ? Math.max(0, avgDuration - elapsed) : undefined,
    confidence: phase.confidence,
  }
}

const PHASE_LABELS: Record<AITaskPhase, string> = {
  initializing: '启动中...',
  thinking: '思考中...',
  coding: '编码中...',
  validating: '验证中...',
  completed: '已完成',
  error: '出错',
}
```

#### D.3 进度 UI

```
AI 任务卡片 (增强版):
┌────────────────────────────────────────────────────────┐
│ 🤖 Claude Code                                        │
│ 别名: 前端重构-Claude  (⬤ 蓝色)                       │
│                                                        │
│ 阶段: 编码中...                           15:32       │
│ ████████████████░░░░░░░░ 68%                           │
│ 预估剩余: ~7分钟 (基于历史平均)                        │
│                                                        │
│ CPU [▁▂▃▅▇█▇▅▃▅▇█]  平均: 23%                        │
│                                                        │
│ [聚焦窗口] [查看详情] [取消追踪]                       │
└────────────────────────────────────────────────────────┘
```

进度条使用主题色:
- 构成主义: 红色工业进度条 + 斜线纹理
- 现代光明: 蓝色渐变进度条 + 圆角
- 温暖光明: 橙色柔和进度条 + 脉动

---

## 3. 文件修改清单

| 文件 | 修改类型 | 内容 |
|------|----------|------|
| `types-extended.ts` | 修改 | 新增 AIWindowAlias, AITaskPhase, ProgressEstimate |
| `AITaskTracker.ts` | 修改 | 集成别名匹配、阶段检测、进度估算 |
| `NotificationService.ts` | 修改 | 通知格式包含别名/窗口标识, 点击跳转 |
| `WindowManager.ts` | 修改 | 增强布局匹配策略 |
| `windowHandlers.ts` | 修改 | 新增别名 CRUD IPC 通道 |
| `aiTaskHandlers.ts` | 修改 | 暴露阶段/进度数据 |
| `WindowView.tsx` | 修改 | 分组/布局修复 + toast 反馈 + 布局预览 |
| `AITaskView.tsx` | **重写** | 增强卡片含别名/进度条/阶段指示 |
| `processStore.ts` 或新建 `aliasStore.ts` | 新增 | AI 窗口别名状态管理 |
| 新建 `AIWindowAlias.tsx` | 新增 | 别名编辑组件 |
| 新建 `ProgressBar.tsx` | 新增 | 主题感知进度条组件 |
| 新建 `LayoutPreview.tsx` | 新增 | 布局迷你预览组件 |
| 新建 `phaseDetector.ts` | 新增 | AI 任务阶段检测逻辑 |

---

## 4. IPC 通道新增

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `ai-alias:get-all` | renderer→main | 无 | AIWindowAlias[] |
| `ai-alias:set` | renderer→main | AIWindowAlias | boolean |
| `ai-alias:remove` | renderer→main | aliasId: string | boolean |
| `ai-task:get-progress` | renderer→main | taskId: string | ProgressEstimate |
| `ai-task:get-phase` | renderer→main | taskId: string | PhaseSignals |
| `navigate-to-task` | main→renderer | taskId: string | void (导航指令) |

---

## 5. 验收标准

### AI 窗口命名
- [ ] 可为 AI CLI 窗口设置别名
- [ ] 别名持久化，app 重启后保留
- [ ] 进程重启后通过工作目录+命令行 hash 自动重新匹配
- [ ] 窗口卡片优先显示别名
- [ ] 别名支持颜色标识

### 通知
- [ ] 任务完成通知格式: `[别名] 任务完成`
- [ ] 无别名时显示窗口标题前30字符
- [ ] 通知点击聚焦到对应窗口
- [ ] 通知历史中显示别名和快捷操作

### 分组/布局
- [ ] 创建分组成功有 toast 提示
- [ ] 创建分组失败有错误提示
- [ ] 保存布局显示迷你预览
- [ ] 恢复布局使用增强匹配策略
- [ ] 窗口关闭后选择自动清理

### 进度监控
- [ ] AI 任务显示阶段标签 (启动中/思考中/编码中/验证中)
- [ ] 进度条基于阶段+时间混合估算
- [ ] 有历史数据时显示预估剩余时间
- [ ] 进度条样式随主题变化
