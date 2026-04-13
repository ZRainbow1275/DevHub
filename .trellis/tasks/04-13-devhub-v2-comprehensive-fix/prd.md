# DevHub v2 -- 全面修复与功能增强 PRD

## 概述

DevHub 桌面应用（Electron + React + TypeScript）经历首轮开发后，存在9大类严重问题。本 PRD 详细定义每个问题域的需求、验收标准和技术方案，目标是达到100%的可用性、丰富性和完善性。

**核心原则**：
- 不进行大重构，基于现有架构增量修复
- 绝不删除任何现有功能/模块/组件
- 禁止 Mock 数据，所有功能真实跑通
- 禁止 Emoji 图标，使用已安装的图标库
- 冗余开发，杜绝"傻瓜使用"

---

## T1: AI 工具识别增强

### 1.1 现状问题

- `ToolMonitor.ts` 仅检测 codex/claude-code/gemini-cli 三种工具
- 检测依赖 PowerShell 获取 node 命令行参数，对原生二进制(claude.exe/codex.exe)支持不足
- 缺少窗口标题辅助检测策略
- `AITaskTracker.ts` 完成检测 COMPLETION_PATTERNS 太粗糙，频繁误报

### 1.2 需求

#### 1.2.1 扩展工具检测范围

| 工具 | 进程名 | 命令行特征 | 窗口标题特征 |
|------|--------|-----------|------------|
| Claude Code | claude.exe, node.exe | @anthropic-ai/claude-code, /claude-code/cli.js | "Claude Code", "claude>" |
| Codex CLI | codex.exe, node.exe | @openai/codex, /codex/bin/codex.js | "Codex", "codex>" |
| Gemini CLI | gemini.exe, node.exe | @google/gemini-cli, gemini-cli | "Gemini", "gemini>" |
| OpenCode | opencode.exe, node.exe | opencode | "OpenCode", "opencode>" |
| Aider | python.exe, aider.exe | aider | "aider", "aider>" |
| Cursor | Cursor.exe | - | "Cursor" |
| Windsurf | Windsurf.exe | - | "Windsurf" |
| Continue.dev | node.exe | continue | - (VSCode 扩展) |
| Cline | node.exe | cline | - (VSCode 扩展) |

#### 1.2.2 多层检测策略

```
Layer 1: 进程名精确匹配 (最快，优先级最高)
  -> claude.exe, codex.exe, gemini.exe, aider.exe 等原生二进制
  
Layer 2: 命令行参数模式匹配 (针对 node.exe 托管的工具)
  -> 一次性获取所有 node.exe 命令行，批量匹配
  -> 排除 MCP server、语言服务器等非 CLI 实例
  
Layer 3: 窗口标题辅助匹配 (用于确认和补充)
  -> 扫描窗口标题包含工具特征的终端窗口
  -> 与 Layer 1/2 结果交叉验证
  
Layer 4: 父进程链分析 (兜底策略)
  -> 追溯 node.exe 的父进程链
  -> 如果父进程是 cmd.exe/powershell.exe/WindowsTerminal.exe，
     且同一终端窗口标题包含工具名，则判定
```

#### 1.2.3 运行状态精细分类

| 状态 | 判定条件 | 显示 |
|------|---------|------|
| thinking | CPU > 5% 且 I/O 写入速率低 | "思考中" |
| writing | I/O 写入速率 > 阈值 | "生成中" |
| reading | I/O 读取速率 > 阈值且写入低 | "读取中" |
| idle | CPU < 2% 且无 I/O | "空闲" |
| waiting | 检测到提示符模式 | "等待输入" |
| error | 检测到错误模式 | "出错" |
| completed | 多信号融合确认完成 | "已完成" |

#### 1.2.4 完成检测改进

**问题**：当前 `AITaskTracker` 完成检测误报率高

**改进方案**：
- 将确认窗口期从 3秒 延长到 8秒
- 增加 "二次确认" 机制：首次触发完成后，等待确认窗口期再次验证
- 增加工具特定的完成模式（每个AI CLI有不同的完成输出格式）
- 对于 Claude Code：检测 ">" 提示符回显 + CPU 降至 < 1%
- 对于 Codex CLI：检测 "Ready" 或返回提示符
- 对于 Gemini CLI：检测 ">" 提示符
- 记录误报历史，动态调整阈值

#### 1.2.5 通知增强

- 完成通知必须包含：工具名 + 窗口别名（如果已设置）
- 通知格式：`"[MyProject] Claude Code 任务完成"` 而非 `"Claude Code 任务完成"`
- 支持通知声音自定义
- 支持通知历史查看

### 1.3 验收标准

- [ ] 至少支持检测上述9种 AI 工具
- [ ] 多实例同时运行时能正确区分每个实例
- [ ] 完成检测误报率降低到 5% 以下
- [ ] 通知包含窗口别名标识
- [ ] 工具状态变化在 2 秒内反映到 UI

### 1.4 涉及文件

**后端**:
- `src/main/services/ToolMonitor.ts` -- 核心检测逻辑重写
- `src/main/services/AITaskTracker.ts` -- 完成检测算法改进
- `src/main/services/AIAliasManager.ts` -- 别名管理增强
- `src/main/services/NotificationService.ts` -- 通知格式改进
- `src/main/ipc/aiTaskHandlers.ts` -- IPC 接口扩展
- `src/shared/types-extended.ts` -- 类型定义扩展

**前端**:
- `src/renderer/components/monitor/AITaskView.tsx` -- AI 任务视图增强
- `src/renderer/components/monitor/AIWindowAlias.tsx` -- 别名编辑增强
- `src/renderer/components/monitor/AIProgressTimeline.tsx` -- 进度时间线增强
- `src/renderer/stores/aiTaskStore.ts` -- 状态管理增强
- `src/renderer/stores/toolStore.ts` -- 工具状态 Store 增强
- `src/renderer/hooks/useAITasks.ts` -- Hook 增强
- `src/renderer/hooks/useToolStatus.ts` -- 工具状态 Hook 增强

---

## T2: UI 布局美化和响应式

### 2.1 现状问题

- 顶部 HeroStats 数字过大，标签被截断（"错误"不可见）
- 项目列表名称被截断到只显示 1-2 个字符
- 整体布局在窄窗口下严重挤压
- 缺少密度自适应
- 组件间距不均匀

### 2.2 需求

#### 2.2.1 HeroStats 重新设计

```
当前问题：
┌─────────────────────────────────┐
│  0   20243   1   0_             │  <- 数字巨大，标签被截断
│ 运行  进   端   AI  错          │
│ 中    程   口   工具 误          │
└─────────────────────────────────┘

目标设计（宽屏）：
┌──────────────────────────────────────────────────────┐
│  ▪ 0 运行中   ▪ 206 进程   ▪ 178 端口   ▪ 2 AI   ▪ 0 错误  │
└──────────────────────────────────────────────────────┘

目标设计（窄屏）：
┌────────────────────────┐
│  0 运行中  │  206 进程  │
│  178 端口  │  2 AI工具  │
│          0 错误         │
└────────────────────────┘
```

**实现要点**：
- 数值和标签在同一行显示，避免垂直堆叠过高
- 使用 CSS Grid auto-fit + minmax 实现自适应换行
- 数值字体大小根据位数自适应缩小
- 标签永不截断

#### 2.2.2 项目列表优化

- 项目名称最少显示 8 个字符，只在确实不够时才截断
- 卡片最小宽度 220px，使用 CSS Grid 自适应列数
- 卡片内信息层级：名称(大) > 类型标签 > 路径(小)
- 增加列表/卡片视图切换

#### 2.2.3 全局密度系统

| 密度级别 | 基础间距 | 字体缩放 | 适用场景 |
|---------|---------|---------|---------|
| compact | 4px | 0.85x | 小屏/大量数据 |
| normal | 8px | 1.0x | 默认 |
| comfortable | 12px | 1.1x | 大屏/展示 |

通过 CSS 变量 `--density-factor` 控制，所有组件自动适配。

#### 2.2.4 侧边栏改进

- 可折叠侧边栏（折叠后只显示图标）
- 侧边栏宽度可拖拽调整（最小 200px，最大 400px）
- 记住用户的宽度偏好

#### 2.2.5 面板分割器

- 监控面板左右分割支持拖拽调整比例
- 记住用户的分割比例偏好
- 双击重置为默认比例

### 2.3 验收标准

- [ ] HeroStats 在任何窗口宽度下标签不被截断
- [ ] 项目名称至少显示 8 个可见字符
- [ ] 侧边栏可折叠和宽度可调
- [ ] 3 种密度级别可切换
- [ ] 面板分割器可拖拽

### 2.4 涉及文件

- `src/renderer/components/ui/HeroStats.tsx`
- `src/renderer/components/ui/ResponsiveMetric.tsx`
- `src/renderer/components/ui/StatCard.tsx`
- `src/renderer/components/ui/PanelSplitter.tsx`
- `src/renderer/components/ui/ResizeHandle.tsx`
- `src/renderer/components/layout/Sidebar.tsx`
- `src/renderer/components/project/ProjectCard.tsx`
- `src/renderer/components/project/ProjectList.tsx`
- `src/renderer/hooks/useDensity.ts`
- `src/renderer/hooks/useBreakpoint.ts`
- `src/renderer/hooks/useWindowSize.ts`
- `src/renderer/styles/` -- CSS 变量

---

## T3: 进程详情修复

### 3.1 现状问题

- 绝大部分进程点击查看详情时报错 "无法获取进程信息 (PID: XXXXX)"
- `ProcessDetailPanel.tsx` 在 `fetchRelationship` 返回 null 时直接显示错误
- 后端 `SystemProcessScanner.getFullRelationship()` 的 PowerShell 查询频繁超时或权限不足
- 进程列表中的 PID 可能在查询时已失效

### 3.2 需求

#### 3.2.1 优雅降级策略

```
Level 1 (必须成功): 基本信息 — 从已有的进程列表缓存获取
  -> PID, 名称, CPU, 内存, 状态
  -> 不需要额外 PowerShell 查询，直接从 processStore 读取

Level 2 (可选): 扩展信息 — 单独 PowerShell 查询
  -> 命令行, 工作目录, 用户名, 优先级, 线程数, 句柄数
  -> 超时 3 秒后跳过，显示 "部分信息不可用"

Level 3 (可选): 关系信息 — 批量查询
  -> 父子进程关系, 端口绑定, 关联窗口
  -> 超时 5 秒后跳过

Level 4 (可选): 深度详情 — 按需加载
  -> 环境变量, 加载模块, 网络连接
  -> 仅在用户点击对应 Tab 时才查询
```

#### 3.2.2 ProcessDetailPanel 多 Tab 重新设计

```
┌──────────────────────────────────────────┐
│  ✦ node.exe                   PID: 21560 │
│  ├ 命令: node C:\Users\...                │
│  └ 目录: D:\Projects\myapp               │
├──────────────────────────────────────────┤
│  [基础] [资源] [网络] [环境] [模块]       │
├──────────────────────────────────────────┤
│  (基础 Tab 内容)                          │
│  PID: 21560        PPID: 1234            │
│  状态: 运行中       类型: 开发服务         │
│  启动时间: 2小时前   用户: SYSTEM          │
│  ...                                      │
├──────────────────────────────────────────┤
│  [结束进程] [结束进程树] [打开目录] [复制命令] │
└──────────────────────────────────────────┘
```

- 基础 Tab: PID, PPID, 状态, 类型, 时间, 用户, 命令行, 工作目录
- 资源 Tab: CPU 使用率(含历史图表), 内存使用(含历史图表), I/O 统计
- 网络 Tab: 绑定端口列表, 网络连接列表
- 环境 Tab: 环境变量表（可搜索过滤）
- 模块 Tab: 已加载的 DLL/模块列表

#### 3.2.3 后端查询优化

- `SystemProcessScanner.getFullRelationship()` 增加超时控制（每个 PowerShell 查询最多 3 秒）
- 增加结果缓存（LRU，容量 50，TTL 10 秒）
- 对于系统进程(PID < 10)，直接返回精简信息，不做深度查询
- 对于受保护进程(System, svchost 等)，标注"需要管理员权限"
- 批量查询优化：合并多个 PID 的查询为单次 PowerShell 调用

### 3.3 验收标准

- [ ] 任何进程点击后至少能显示基本信息（PID, 名称, CPU, 内存）
- [ ] 详情面板不再出现"无法获取进程信息"的空白错误
- [ ] 5 个 Tab 页面均可正常加载，按需延迟加载
- [ ] 受保护进程有明确的权限提示
- [ ] 查询超时时显示已有信息 + "部分信息不可用"提示

### 3.4 涉及文件

**后端**:
- `src/main/services/SystemProcessScanner.ts` -- 查询优化+缓存
- `src/main/services/ProcessManager.ts` -- 进程管理增强
- `src/main/ipc/processHandlers.ts` -- IPC 接口优化

**前端**:
- `src/renderer/components/monitor/ProcessDetailPanel.tsx` -- 多 Tab 重写
- `src/renderer/components/monitor/ProcessView.tsx` -- 列表交互改进
- `src/renderer/hooks/useSystemProcesses.ts` -- Hook 优化
- `src/renderer/stores/processStore.ts` -- Store 增强

---

## T4: 端口面板国际化 + 性能优化

### 4.1 现状问题

- `PortFocusPanel.tsx` 所有标签硬编码英文: "BASIC INFO", "Port", "Protocol", "State" 等
- `StaleWarning` 消息英文: "Query timed out - showing cached data"
- 按钮文本英文: "Focus Process", "View in Graph", "Retry"
- 端口冲突警告英文: "Port conflict: X processes listening on :PORT"
- 查询频繁超时

### 4.2 需求

#### 4.2.1 完整中文化

将 `PortFocusPanel.tsx` 中所有英文替换为中文：

| 英文 | 中文 |
|------|------|
| BASIC INFO | 基本信息 |
| Port | 端口 |
| Protocol | 协议 |
| State | 状态 |
| Local | 本地地址 |
| Process | 进程 |
| PID | 进程 ID |
| Service | 服务 |
| PROCESS DETAILS | 进程详情 |
| CPU | CPU |
| Memory | 内存 |
| Threads | 线程数 |
| Handles | 句柄数 |
| User | 用户 |
| Command | 命令 |
| SIBLING PORTS | 关联端口 |
| CONNECTIONS | 网络连接 |
| CHILD PROCESSES | 子进程 |
| CONFLICTING PROCESSES | 冲突进程 |
| Query timed out - showing cached data | 查询超时 - 显示缓存数据 |
| Showing cached data | 显示缓存数据 |
| Port conflict: X processes | 端口冲突: X 个进程 |
| Focus Process | 聚焦进程 |
| View in Graph | 在图中查看 |
| Retry | 重试 |
| Refresh | 刷新 |

#### 4.2.2 端口标签增强

扩展 `portLabels.ts` 的常见端口标签：

| 端口 | 标签 |
|------|------|
| 80 | HTTP 服务 |
| 443 | HTTPS 服务 |
| 3000 | 开发服务 (Vite/CRA) |
| 3001 | 开发服务 (备用) |
| 4200 | Angular 开发 |
| 5173 | Vite 开发服务 |
| 5174 | Vite HMR |
| 8080 | HTTP 代理 |
| 8443 | HTTPS 代理 |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 27017 | MongoDB |
| 9200 | Elasticsearch |
| 9090 | Prometheus |
| 9092 | Kafka |

#### 4.2.3 查询性能优化

- 增量查询策略：先返回缓存数据，后台异步刷新
- PowerShell 查询添加 -TimeoutSec 参数（最大 3 秒）
- 缓存 TTL 从当前值优化为分层：
  - 基本端口信息: TTL 5 秒
  - 进程详情: TTL 15 秒
  - 连接列表: TTL 10 秒
- 批量查询优化：一次 PowerShell 调用获取所有端口的进程信息

#### 4.2.4 端口安全提示

- 对外暴露的端口(非 127.0.0.1/localhost) 标注安全警告
- 高端口(>= 49152) 标注为"临时端口"
- 知名端口(< 1024) 标注为"特权端口"

### 4.3 验收标准

- [ ] PortFocusPanel 所有可见文本为中文
- [ ] 端口标签覆盖常见的 20+ 种服务
- [ ] 首次打开详情面板在 500ms 内显示基本信息
- [ ] 超时时显示中文提示 + 缓存数据
- [ ] 安全端口标注正确

### 4.4 涉及文件

- `src/renderer/components/monitor/PortFocusPanel.tsx` -- 国际化
- `src/renderer/components/monitor/PortView.tsx` -- 端口视图增强
- `src/renderer/utils/portLabels.ts` -- 标签扩展
- `src/main/ipc/portHandlers.ts` -- 查询优化
- `src/main/services/PortScanner.ts` -- 扫描器优化

---

## T5: 窗口管理全面增强

### 5.1 现状问题

- AI 窗口不能自命名，通知不带窗口标识
- AI 任务完成检测误报/漏报频繁
- 窗口分组和布局功能按钮存在但不可用
- 监控进度功能不够好
- 窗口可执行的操作太少

### 5.2 需求

#### 5.2.1 AI 窗口自命名系统

```
窗口标题: "Claude Code - Coding"
用户别名: "MyProject 前端开发"

通知显示: "[MyProject 前端开发] Claude Code 任务完成"
状态栏显示: "▪ Claude Code (MyProject 前端开发) - 思考中"
```

**实现要点**：
- 在窗口列表中，AI 窗口卡片上增加"编辑名称"按钮
- 点击后内联编辑框，支持快速输入
- 别名存储在 `AIAliasManager` 中，与 HWND 绑定
- HWND 失效后自动清理别名（但保留 PID 级别的映射备份）
- 自动命名建议：基于窗口工作目录自动推断项目名

#### 5.2.2 AI 任务完成检测改进

**当前6信号加权模型的问题**：
- `outputPatternWeight: 0.20` -- 窗口标题匹配不可靠
- `cpuIdleWeight: 0.25` -- CPU 降低不一定代表完成
- `cursorWaitWeight: 0.20` -- 光标状态检测不准确
- `timeThresholdWeight: 0.10` -- 时间因素太弱
- `promptDetectionWeight: 0.25` -- 提示符检测依赖窗口标题
- `childProcessWeight: 0.10` -- 子进程退出不代表主任务完成

**改进方案**：

```
新的 8 信号模型:
Signal 1: CPU 归零检测 (权重 0.20)
  - 主进程 + 所有子进程的总 CPU 降至 < 1% 持续 5 秒

Signal 2: I/O 静默检测 (权重 0.15)
  - 磁盘写入速率降至 < 1KB/s 持续 3 秒

Signal 3: 提示符检测 (权重 0.25)
  - 工具特定的提示符模式匹配（基于窗口标题或控制台输出）
  - Claude Code: 检测 ">" 或 "$" 返回
  - Codex: 检测 "codex>" 或 "Ready"
  - Gemini: 检测 "gemini>"

Signal 4: 子进程树变化 (权重 0.10)
  - 编译/测试子进程全部退出

Signal 5: 窗口标题变化 (权重 0.10)
  - 标题不再包含 "running"/"building"/"compiling"

Signal 6: 内存稳定检测 (权重 0.05)
  - 内存使用趋于稳定（波动 < 1MB/5秒）

Signal 7: 工具特定完成标志 (权重 0.10)
  - 每个工具的专属完成模式

Signal 8: 时间衰减因子 (权重 0.05)
  - 运行超过30分钟后，完成置信度逐步增加

确认窗口期: 8 秒 (从 3 秒延长)
二次确认: 首次触发后再等 5 秒，二次验证信号
```

#### 5.2.3 窗口分组管理

- 创建分组：选择多个窗口 -> "加入分组" -> 输入组名
- 分组操作：批量最小化/恢复/关闭/排列
- 分组持久化：保存到 electron-store
- 分组视图：按组折叠/展开显示窗口
- 拖拽排序：窗口可拖拽进出分组
- 预设分组：自动按进程名分组、按窗口类型分组

#### 5.2.4 布局快照管理

```
布局快照 = {
  name: "开发布局",
  windows: [
    { hwnd, x, y, width, height, isMaximized, isMinimized }
  ],
  createdAt, updatedAt
}
```

- 保存当前布局：记录所有窗口位置和大小
- 恢复布局：将窗口移动到保存的位置
- 布局预览：小窗口预览布局示意图
- 常用布局模板：左右分屏、四分屏、主从布局

#### 5.2.5 窗口批量操作

| 操作 | 说明 |
|------|------|
| 全选/取消全选 | 复选框批量选择 |
| 批量最小化 | 选中窗口全部最小化 |
| 批量恢复 | 选中窗口全部恢复 |
| 批量关闭 | 选中窗口全部关闭(需确认) |
| 批量置顶 | 选中窗口全部置顶 |
| 批量取消置顶 | 取消置顶 |
| 级联排列 | 阶梯式排列 |
| 平铺排列 | 均分屏幕 |
| 堆叠排列 | 同位置堆叠 |

#### 5.2.6 窗口高级功能

- 窗口透明度调节（0-100% 滑块）
- 窗口置顶切换（图钉按钮）
- 窗口截图（保存为 PNG）
- 窗口最前方时间统计
- 窗口实时缩略图预览

#### 5.2.7 AI 监控进度增强

- 实时进度条：基于多信号估算的进度百分比
- 时间线视图：显示 AI 工具的状态变化历史
- 阶段标签：思考/编码/编译/测试 各阶段的时间分配
- 资源消耗图表：CPU/内存的实时曲线
- 输出速率图表：文件写入速率曲线

### 5.3 验收标准

- [ ] AI 窗口可自定义别名，别名显示在通知和状态栏
- [ ] 完成检测误报率降低到 5% 以下
- [ ] 窗口分组可创建/编辑/删除/操作
- [ ] 布局可保存/恢复至少 5 个快照
- [ ] 批量操作所有功能可用
- [ ] 透明度调节和置顶功能正常

### 5.4 涉及文件

**后端**:
- `src/main/services/WindowManager.ts` -- 全面增强
- `src/main/services/AITaskTracker.ts` -- 完成检测改进
- `src/main/services/AIAliasManager.ts` -- 别名系统增强
- `src/main/services/NotificationService.ts` -- 通知格式改进
- `src/main/ipc/windowHandlers.ts` -- IPC 接口扩展
- `src/main/ipc/aiTaskHandlers.ts` -- AI 任务接口扩展

**前端**:
- `src/renderer/components/monitor/WindowView.tsx` -- 全面重写
- `src/renderer/components/monitor/AIWindowAlias.tsx` -- 别名编辑增强
- `src/renderer/components/monitor/AIProgressTimeline.tsx` -- 进度增强
- `src/renderer/components/monitor/AITaskView.tsx` -- AI 视图增强
- `src/renderer/components/monitor/LayoutPreview.tsx` -- 布局预览增强
- `src/renderer/stores/windowStore.ts` -- Store 增强
- `src/renderer/stores/aiTaskStore.ts` -- AI Store 增强
- `src/renderer/hooks/useWindows.ts` -- Hook 增强
- `src/renderer/hooks/useAITasks.ts` -- Hook 增强

---

## T6: 拓扑图修复与增强

### 6.1 现状问题

- 拓扑图页面完全空白，只显示 "PROCESS TOPOLOGY" 标题和统计栏
- NeuralGraphEngine 的 SVG 可能未正确初始化
- 数据可能为空（processStore/portStore/windowStore 未同步到 TopologyView）
- d3-force 模拟可能未正确启动

### 6.2 需求

#### 6.2.1 拓扑图修复

**调查清单**：
1. 确认 NeuralGraphEngine.ts 的 `setData()` 被正确调用
2. 确认 SVG 容器有正确的宽高（非 0x0）
3. 确认 d3-force 的 simulation 正确 tick
4. 确认 nodes/edges 数据非空（从 stores 获取）
5. 检查 CSS `h-full` 在父容器中是否有高度约束

**修复要点**：
- 确保容器使用 `ref` 获取 clientWidth/clientHeight
- 在 ResizeObserver 中监听容器尺寸变化
- 当数据为空时显示明确的"暂无数据"提示（非空白）
- 添加加载状态指示器

#### 6.2.2 拓扑图增强

**节点类型和视觉映射**：
| 节点类型 | 形状 | 颜色 | 大小依据 |
|---------|------|------|---------|
| 项目 | 大圆 | 主题强调色 | 固定大 |
| 进程 | 圆形 | 按 CPU 使用率渐变(绿->黄->红) | CPU + 内存 |
| 端口(LISTENING) | 菱形 | 金色 | 固定中 |
| 端口(ESTABLISHED) | 菱形 | 蓝色 | 连接数 |
| 端口(TIME_WAIT) | 菱形 | 灰色 | 固定小 |
| 窗口 | 矩形 | 绿色 | 固定中 |
| 外部连接 | 虚线圆 | 灰色 | 固定小 |

**交互增强**：
- 点击节点：高亮该节点及其直接连接
- 双击节点：以该节点为中心缩放
- 右键菜单：跳转到对应的详情面板
- 搜索框：按名称/PID/端口号筛选节点
- 图例面板：显示所有节点类型的含义
- 迷你地图：右下角显示全局视图
- 节点标签：鼠标悬停显示完整信息

**性能优化**：
- 节点数量 > 200 时自动启用简化模式
- 使用 Canvas 渲染替代 SVG（大量节点时）
- 只渲染视口内的节点和边

### 6.3 验收标准

- [ ] 拓扑图正确显示所有进程/端口/窗口节点
- [ ] 节点交互（点击、悬停、拖拽）正常
- [ ] 搜索框可以筛选节点
- [ ] 图例清晰标注所有节点类型
- [ ] 空数据时显示友好提示
- [ ] 200+ 节点时性能流畅（> 30fps）

### 6.4 涉及文件

- `src/renderer/components/monitor/TopologyView.tsx`
- `src/renderer/components/monitor/topology/NeuralGraph.tsx`
- `src/renderer/components/monitor/topology/NeuralGraphEngine.ts`
- `src/renderer/components/monitor/topology/ProcessNode.tsx`
- `src/renderer/components/monitor/topology/PortNode.tsx`
- `src/renderer/components/monitor/topology/WindowNode.tsx`
- `src/renderer/components/monitor/topology/TopologyEdge.tsx`
- `src/renderer/components/monitor/topology/TopologyDetailPanel.tsx`
- `src/renderer/hooks/useProcessTopology.ts`
- `src/renderer/stores/processStore.ts`
- `src/renderer/stores/portStore.ts`
- `src/renderer/stores/windowStore.ts`

---

## T7: 端口-进程-窗口流程图

### 7.1 现状问题

- 原本设计的从端口到进程到窗口的清晰流程图功能未落实
- `PortRelationshipGraph.tsx` 使用 NeuralGraph 力导向图，但不够直观
- 缺少层次化的数据流展示

### 7.2 需求

#### 7.2.1 基于 ReactFlow 的层次流程图

使用已安装的 `@xyflow/react` 实现三层流程图：

```
Layer 0 (左侧): 端口层
  ┌──────────┐
  │ :3000    │──┐
  │ LISTENING │  │
  └──────────┘  │    Layer 1 (中间): 进程层     Layer 2 (右侧): 窗口层
  ┌──────────┐  │   ┌──────────────┐          ┌──────────────┐
  │ :3001    │──┼──>│ node.exe     │─────────>│ Terminal #1   │
  │ LISTENING │  │   │ PID: 1234    │          │ 窗口标题       │
  └──────────┘  │   │ CPU: 2.1%    │          └──────────────┘
                │   └──────────────┘
  ┌──────────┐  │   ┌──────────────┐          ┌──────────────┐
  │ :8080    │──┴──>│ vite.exe     │─────────>│ Browser       │
  │ LISTENING │      │ PID: 5678    │          │ localhost:3000│
  └──────────┘      └──────────────┘          └──────────────┘
```

**节点设计**：
- 端口节点：显示端口号、协议、状态
- 进程节点：显示进程名、PID、CPU/内存迷你条
- 窗口节点：显示标题（截断）、进程名

**边设计**：
- 端口→进程：实线，标注 "绑定"
- 进程→窗口：实线，标注 "拥有"
- 进程→子进程：虚线，标注 "fork"
- 端口↔外部：点线，标注连接数

**布局**：
- 使用 dagre 自动布局，方向从左到右
- 支持手动拖拽调整节点位置

#### 7.2.2 流程图交互

- 点击节点：联动到对应的详情面板（ProcessDetailPanel/PortFocusPanel）
- 悬停节点：高亮所有关联路径
- 右键菜单：跳转/聚焦/关闭
- 搜索过滤：按 PID/端口号/窗口标题过滤
- 支持导出为 PNG/SVG

#### 7.2.3 流程图集成

- 在 MonitorPanel 中增加 "流程图" Tab/视图
- 与拓扑视图并列，提供不同的可视化角度
- 数据源共享 processStore/portStore/windowStore

### 7.3 验收标准

- [ ] 流程图正确展示端口→进程→窗口的关系
- [ ] dagre 自动布局清晰不重叠
- [ ] 点击节点联动到详情面板
- [ ] 搜索过滤功能可用
- [ ] 支持缩放和平移

### 7.4 涉及文件

- `src/renderer/components/monitor/PortRelationshipGraph.tsx` -- 重写为 ReactFlow
- `src/renderer/components/monitor/MonitorPanel.tsx` -- 增加流程图视图
- 新建自定义 ReactFlow 节点组件
- `src/renderer/hooks/useProcessTopology.ts` -- 数据转换增强

---

## T8: 项目功能丰富化

### 8.1 现状问题

- ProjectCard 只有基本操作：启动/停止、打开文件夹、复制路径、管理标签、删除
- 没有项目详情面板
- 没有 Git 信息
- 没有依赖分析
- 没有构建/运行日志查看
- 没有端口/进程关联显示

### 8.2 需求

#### 8.2.1 ProjectCard 增强

**卡片信息扩展**：
```
┌──────────────────────────────────────┐
│  ▪ legalmind-caselist  │ npm │ v1.2.3│
│  D:\Desktop\CaseList\prototype       │
│                                      │
│  [git] main (+2 ahead)  [port] :3000 │
│  [cpu] 1.2%  [mem] 128MB             │
│                                      │
│  [▶ dev]  [☐ test]  [☐ build]  [...]│
└──────────────────────────────────────┘
```

- 显示 Git 分支和状态
- 显示关联端口
- 显示 CPU/内存使用
- 快速脚本按钮（不仅是下拉选择）
- 版本号显示（来自 package.json）

#### 8.2.2 项目详情面板

点击项目卡片后打开的详情面板：

```
[概览] [脚本] [依赖] [端口] [日志] [Git] [配置]

概览 Tab:
- 项目名称、路径、类型（npm/yarn/pnpm/cargo/go/python）
- 版本号、许可证
- 运行状态、运行时长
- 最近活动时间
- 健康度评分（基于运行状态+错误频率+依赖更新）

脚本 Tab:
- 列出所有可用脚本（来自 package.json scripts）
- 每个脚本一键运行
- 显示上次运行时间和结果
- 支持自定义脚本参数

依赖 Tab:
- 列出 dependencies 和 devDependencies
- 显示版本号
- 标注过时的依赖（基于 latest 版本比较）
- 依赖数量统计

端口 Tab:
- 该项目关联的所有端口
- 端口状态
- 点击端口跳转到端口详情

日志 Tab:
- 项目运行日志（stdout/stderr）
- 日志级别过滤
- 日志搜索
- 自动滚动到最新

Git Tab:
- 当前分支
- 未提交修改数
- 最近提交历史（最近 10 条）
- ahead/behind 远程的提交数

配置 Tab:
- 默认脚本设置
- 自动启动设置
- 标签管理
- 项目备注
```

#### 8.2.3 后端支持

**Git 信息获取**：
- 使用 `git rev-parse --abbrev-ref HEAD` 获取分支
- 使用 `git status --porcelain` 获取修改状态
- 使用 `git log --oneline -10` 获取最近提交
- 缓存 10 秒，避免频繁调用

**依赖分析**：
- 解析 package.json 的 dependencies/devDependencies
- 支持 npm/yarn/pnpm（检查 lockfile 类型）
- 统计依赖数量

**端口关联**：
- 从 ProcessScanner 获取该项目 PID 绑定的端口

#### 8.2.4 项目搜索增强

- 支持按名称、路径、类型、标签搜索
- 模糊匹配
- 搜索结果高亮
- 最近搜索历史

#### 8.2.5 项目排序

- 按名称（字母序）
- 按最近运行时间
- 按状态（运行中优先）
- 按类型
- 支持正序/倒序

#### 8.2.6 项目统计看板

在项目列表顶部显示：
- 总项目数
- 运行中项目数
- 错误项目数
- 总端口占用数
- 总 CPU/内存使用

### 8.3 验收标准

- [ ] ProjectCard 显示 Git 分支和端口信息
- [ ] 项目详情面板 7 个 Tab 全部可用
- [ ] Git 信息在 2 秒内加载
- [ ] 依赖列表正确解析 package.json
- [ ] 项目搜索支持模糊匹配
- [ ] 排序功能 5 种维度全部可用

### 8.4 涉及文件

**后端**:
- `src/main/services/ProjectScanner.ts` -- Git/依赖分析
- `src/main/services/ProjectWatcher.ts` -- 项目监听增强
- `src/main/ipc/scannerHandlers.ts` -- IPC 接口扩展
- `src/main/services/projectDetectors.ts` -- 项目检测增强

**前端**:
- `src/renderer/components/project/ProjectCard.tsx` -- 卡片增强
- `src/renderer/components/project/ProjectList.tsx` -- 列表增强
- 新建 `src/renderer/components/project/ProjectDetailPanel.tsx` -- 详情面板
- `src/renderer/stores/projectStore.ts` -- Store 增强
- `src/renderer/hooks/useProjects.ts` -- Hook 增强

---

## T9: 主题系统深度设计

### 9.1 现状问题

- 当前主题切换只改变颜色变量
- 5 个主题在布局、组件形状、装饰风格上完全相同
- 缺乏真正的"视觉传达"差异

### 9.2 需求

#### 9.2.1 主题设计规范

每个主题必须在以下维度有明显差异：

| 维度 | Constructivism | Cyberpunk | Swiss | Modern Light | Warm Light |
|------|---------------|-----------|-------|-------------|-----------|
| **圆角** | 0-2px (直角) | 8-12px (大圆角) | 0px (纯直角) | 12-16px (超大圆角) | 4-8px (温和圆角) |
| **边框** | 2-3px 粗实线 | 1px 渐变发光线 | 1px 细实线 | 无边框/阴影替代 | 1px 虚线 |
| **阴影** | 无(扁平) | 彩色发光 | 无 | 多层柔和阴影 | 暖色柔和阴影 |
| **字体-标题** | Bebas Neue (粗) | Orbitron (科幻) | Inter (无衬线) | Inter (现代) | Playfair Display (衬线) |
| **字体-正文** | Oswald | Exo 2 | Inter | Inter | Georgia/serif |
| **字体-代码** | JetBrains Mono | Share Tech Mono | JetBrains Mono | Fira Code | Courier |
| **装饰** | 对角线条纹/几何 | 网格线/霓虹光效 | 无装饰(极简) | 渐变背景/毛玻璃 | 纸质纹理/水印 |
| **动画** | 硬切(无渐变) | 快速闪烁/扫描线 | 无动画 | 弹性缓动 | 淡入淡出 |
| **密度** | 紧凑 | 标准 | 宽松(大留白) | 标准 | 舒适(大间距) |
| **分隔线** | 粗色块分隔 | 发光线分隔 | 细灰线 | 浅灰阴影 | 双线/花纹 |
| **按钮** | 矩形/实色填充 | 梯形/渐变/发光 | 矩形/轮廓线 | 药丸形/柔和填充 | 圆角/暖色调 |
| **卡片** | 直角/厚边框/色块 | 圆角/毛玻璃/暗色 | 无边框/极简 | 大圆角/浮起阴影 | 纸片质感/暖底色 |

#### 9.2.2 CSS 变量体系

每个主题需要定义完整的变量集：

```css
[data-theme="constructivism"] {
  /* 颜色 (已有) */
  --surface-900: #1a1a1a;
  --surface-800: #252525;
  /* ...更多颜色... */

  /* 形状 (新增) */
  --radius-sm: 0px;
  --radius-md: 2px;
  --radius-lg: 2px;
  --radius-xl: 2px;
  --radius-card: 2px;
  --radius-button: 2px;
  --radius-input: 2px;

  /* 边框 (新增) */
  --border-width: 2px;
  --border-style: solid;
  --border-card: 2px solid var(--surface-600);

  /* 阴影 (新增) */
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: none;
  --shadow-card: none;

  /* 间距密度 (新增) */
  --spacing-unit: 4px;
  --density-factor: 0.9;

  /* 字体 (已有，确认完整) */
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'Oswald Variable', sans-serif;
  --font-mono: 'JetBrains Mono Variable', monospace;

  /* 动画 (新增) */
  --transition-default: none;
  --animation-card-enter: slideInHard 0.1s step-end;

  /* 装饰 (新增) */
  --deco-pattern: url("data:image/svg+xml,..."); /* 对角线条纹 */
  --deco-opacity: 0.05;
}

[data-theme="cyberpunk"] {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-card: 8px;
  --radius-button: 20px;

  --border-width: 1px;
  --border-card: 1px solid rgba(0, 255, 255, 0.2);

  --shadow-card: 0 0 10px rgba(0, 255, 255, 0.1), inset 0 0 10px rgba(0, 255, 255, 0.05);

  --transition-default: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  --animation-card-enter: fadeInGlow 0.4s ease-out;

  --deco-pattern: url("data:image/svg+xml,..."); /* 网格线 */
  --deco-opacity: 0.03;
}

/* ...其他主题... */
```

#### 9.2.3 组件主题适配

所有组件必须使用 CSS 变量，而非硬编码值：

```css
/* 通用卡片样式 */
.monitor-card {
  border-radius: var(--radius-card);
  border: var(--border-card);
  box-shadow: var(--shadow-card);
  transition: var(--transition-default);
}

/* 按钮样式 */
.btn-primary {
  border-radius: var(--radius-button);
  /* ...主题色通过变量引用... */
}
```

#### 9.2.4 主题预览

在设置对话框中：
- 每个主题显示一个 Live 预览卡片
- 预览卡片包含：颜色采样、字体样本、组件示例
- 切换主题时有过渡动画

### 9.3 验收标准

- [ ] 5 个主题在视觉上有明显的风格差异（不仅是颜色）
- [ ] 切换主题时圆角、边框、阴影、字体、装饰都会变化
- [ ] 所有组件使用 CSS 变量，无硬编码样式
- [ ] 主题切换流畅无闪烁
- [ ] 设置对话框有主题预览

### 9.4 涉及文件

- `src/renderer/styles/themes/` -- 所有主题 CSS 文件
- `src/renderer/hooks/useTheme.ts` -- 主题 Hook 增强
- `src/renderer/utils/theme-tokens.ts` -- Token 工具
- `src/renderer/components/settings/SettingsDialog.tsx` -- 主题预览
- `src/renderer/components/ui/DecorationSet.tsx` -- 装饰组件
- `src/renderer/components/ui/ThemeDecoration.tsx` -- 主题装饰

---

## Agent Team 任务分配

### Team 1: Backend-Core (后端核心修复)
- T1: AI 工具识别增强 (ToolMonitor, AITaskTracker)
- T3: 进程详情修复 (SystemProcessScanner, processHandlers)

### Team 2: Port-Window (端口窗口面板)
- T4: 端口面板国际化+性能
- T5: 窗口管理全面增强

### Team 3: Topology-Flow (图形可视化)
- T6: 拓扑图修复+增强
- T7: 端口-进程-窗口流程图

### Team 4: Project-UX (项目功能+布局)
- T2: UI 布局美化和响应式
- T8: 项目功能丰富化

### Team 5: Theme-Design (主题系统)
- T9: 主题系统深度设计

---

## 技术约束

1. **不得删除任何现有组件/模块**
2. **禁止 Mock 数据** -- 所有数据必须来自真实系统调用
3. **禁止 Emoji** -- 所有图标使用 `src/renderer/components/icons/` 中的 SVG 图标
4. **保持类型安全** -- TypeScript strict mode，禁止 `any`
5. **性能要求** -- 主进程 PowerShell 调用不超过 3 秒超时
6. **兼容性** -- 支持 Windows 10/11
7. **现有架构** -- Electron + React + TypeScript + Zustand + TailwindCSS + d3/ReactFlow
