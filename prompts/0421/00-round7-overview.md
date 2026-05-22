# DevHub v2 — Round 7 规格驱动总览（2026-04-21）

> 状态：**Spec-Driven Locked**。本轮 0421 仅产出企业级规格文档，不改源码。
> 前序：R1 (0410) / R2 (0410-2) / R3-R4 (0411) / Code Review (0413) / R5 (0415) / R6 (0420)
> 本轮归档目录：`D:/Desktop/Inkforge/prompts/0421/`
> 对接的源码主干：`D:/Desktop/CREATOR ONE/devhub/`（子模块 @ `de634f9`）
> 作者：ZRainbow

---

## 零、本轮目标（一句话 + 三条硬约束）

**一句话**：把 R6 清单里所有 "看似改过但用户感知未变" 的问题，转化为 **可执行契约 + 可验收指标 + 可回归测试** 的规格文档，让 R7 的实现 Agent 一旦启动就**无模糊空间**。

**三条硬约束**（必须写进每一份 spec 的第一段）：

1. **不删功能**：现有任何组件 / 模块 / 功能都不得删除，本轮只做"深化、替换、补齐、重挂载"。
2. **不用 Emoji**：AI 工具图标、状态标识、空态插图、分类徽章全部走已安装的图标库（`lucide-react` + 项目自建 `src/renderer/components/icons/` + 新增 `brand-logos/` SVG 集）。Emoji 代码点（U+1F916 "Robot" / U+1F9E0 "Brain" / U+2728 "Sparkles" / U+1F4DD "Memo" / U+1F4BB "Laptop"）需要被替换掉 — 清单详见 contracts/25。
3. **不做 Mock**：所有规格涉及的 IPC / 存储 / 扫描行为必须对接真实 Win32 / 真实进程 / 真实 electron-store / 真实 React Flow 实例，不允许任何"假数据占位"。

---

## 一、R7 最核心的结论（读完就能开工）

### 1.1 R5 "归档合并" 的失败是可以文档溯源的

R5 留下的六个 "archive" commit（`3104863 / c72f52e / 90dd851 / c79500d / 30b8a1f / 700938a`）里，**有数个仅包含 `.trellis/` 下的任务元数据（task.json / prd.md / *.jsonl），完全不含 `src/` 下的代码变动**；真正的实现代码在 1 小时后被单独的 feature 分支提交合并（`04c2546 / 17f6685 / a1a58a7 / 982cc74 / ac4342b / 832966a / daafeab`）。这意味着：

- 用户通过 `git log` 或 task 管理界面看到 "archive" 标签就以为"这一轮已经真的修过"
- 实际上部分用户诉求对应的 src 文件**没有任何一行变动**
- R7 必须放弃"看 commit message 信任修复状态"的工作方式，改为 **通过 Playwright E2E 采集屏幕证据 + 通过主进程侧指标埋点证实路径真的打通**

完整溯源见 `rca/01-r5-archive-metadata-only.md`（本轮文档）。

### 1.2 P2.1 Runtime 爆炸的根因是架构性重复

研究报告确认：
- `SystemProcessScanner` 与 `PortScanner` 在 `BackgroundScannerManager.ts:36` **和** `processHandlers.ts:20` **被实例化两次**
- 两份实例独立持有 `setInterval`、独立调用 PowerShell、独立维护 `processNameCache` / `previousCpuTimes`
- 实际运行时：每 5s 出现 2x `netstat`、2x `Get-CimInstance Win32_Process`、2x IPC 广播
- `withTimeout()` 包裹的 PowerShell 在超时后只返回 fallback，**并不 kill 子进程** → 子进程继续占内存直到应用退出
- 应用退出时 `cleanupProcessHandlers()` 只移除 IPC handler，**不调用 `processScanner.cleanup()` / `portScanner.cleanup()`** → 子进程和定时器遗留

**R7 必须实现的治理层**（写在 `spec/03-runtime-stability-architecture.md`）：
- 单例化（ScannerRegistry 模式）
- 全局 PowerShell 并发信号量（上限 2）
- AbortController + `tree-kill` 强杀
- 生命周期 hook 补齐（before-quit 链式 dispose）
- DevObservabilityPanel 实时曝光 RSS / CPU / Child Count / IPC RPM

### 1.3 P4.2 窗口 5 诉求是 **链路断裂** 而非"没实现"

- **P4.2-a AI 窗口自命名**：`AIAliasManager.rename()` 只写 electron-store，**从未调 `SetWindowText(hwnd, newTitle)`** 修改真实外部窗口标题 → 用户感知"点了保存没反应"
- **P4.2-a 通知不带名字**：`NotificationService.notifyTaskComplete()` 把 `alias` 传进 `metadata`，但 `AppNotification` 类型本身**没有 `metadata` 字段**（types-extended.ts:402），`AITaskHistory` 也**没有 `taskAlias` 字段** → 渲染端读历史面板时 alias 丢失
- **P4.2-c 分组 / 布局**：`WindowManager.loadFromDisk()` 把老 `hwnd` 原样塞回 `groups[]`，但 hwnd 是 OS 每次启动重新分配的 → 恢复后 focus 调不到正确的窗口 → 用户感知"分组里的窗口找不到"
- **P4.2-d 监控进度**：`AITaskTracker.determineMonitorState()` 的 CPU variance 判断可能返回 `thinking`（phase weight 0.30），但同一 task 的 `status.state` 在另一个 tick 被判成 `idle` → UI 同时渲染"空闲 + 56%"
- **P4.2-e 可操作功能少**：完全没有 `window:set-title` / `window:always-on-top` / `window:screenshot` 等 IPC channel

**治理策略**：给每个 P4.2 子项写一份 **IPC 契约文件**（含 schema、错误矩阵、Good/Base/Bad case、Playwright E2E 脚本），实现 Agent 对着契约写即可。

### 1.4 P6.2 拓扑 / 流程图信息架构需要整体重挂

`MonitorPanel.tsx:12-45` 把 `topology` 和 `flow` 列为与 `process` / `port` / `window` 并列的顶级 Tab，违反用户原始设计意图"拓扑是进程 / 端口 / 窗口的附属查询视图"。

重挂载方案（详见 `spec/02-ia-topology-flow-attached-redesign.md`）：
- 顶级导航**删除** `topology` / `flow` 两个 Tab（但代码不删，降级到 `legacy/` 子目录供调试入口调用）
- 在 `ProcessDetailPanel` / `PortFocusPanel` / `WindowDetailPanel` 中增加"关系视图"子 Tab，对接同一个 `NeuralGraphEngine`，只是 **data scope** 以当前选中对象为根
- 引入 `TopologyScope` 类型：`{ root: 'process' | 'port' | 'window', rootId: string | number, depthLimit: number }`
- 拓扑引擎的容器 0 尺寸回退（`NeuralGraphEngine.ts:244`）必须修掉：改用 `ResizeObserver` + 延迟 `simulation.restart()`

### 1.5 P8.2 主题切换只换色的根因是"密度 / 字体 / 圆角 Tokens 没被 UI 暴露"

`theme-tokens.css` 其实已经定义了 7 层 tokens（color / typo / space / effects / motion / components / decoration）和 3 档密度（compact / standard / comfortable），但：
- `[data-density]` 属性只由主题默认值写入（`constructivism → 0.85` / `cyberpunk → 1.0` / `warm-light → 1.1`）
- **设置面板没有暴露 density / radius-family / typography-family 三个独立维度的选择器** → 用户没有办法独立切密度

治理方案（详见 `spec/17-theme-design-language-system.md`）：
- 设计 4 个正交选择器：`theme` / `density` / `radius-family` / `motion-level`
- 每个正交维度写 3-5 档选项 + 预览缩略图
- 用户选择后，写入 `electron-store` 的 `appearance` 分区，并通过 `useTheme()` 实时广播到 `<html>` 上的 data attribute

### 1.6 其余 P1 级 Bug 的病因（精确到行号）

| ID | 病因 | 精确位置 |
|----|------|---------|
| P1.1 | 下拉菜单 `absolute right-0 top-full z-50` 挂在 ScriptSelector 内部 DOM，未走 Portal | `ScriptSelector.tsx:40-82` |
| P2.2 | PID 查询失败只显示 "无法获取进程信息"，**没有做 WinAPI 降级 / 权限提示 / 重试策略** | `ProcessDetailPanel.tsx` 的 `useProcessDetail` 钩子 |
| P3.1-a | 端口面板右侧 `PortFocusPanel` 是 fixed/absolute overlay，挤占主列宽度 | `PortView.tsx:545-660` |
| P3.1-c | "查询超时 - 显示缓存数据" 是设计内行为但 UX 文案没解释 | `PortFocusPanel.tsx` 搜 "查询超时" |
| P4.1 | 窗口卡片 `title` 直接渲染，没有 `truncate` + tooltip + 横向滚动三方案 | `WindowView.tsx` 的卡片渲染段 |
| P5.2 | `TOOL_INFO` 里 icon 字段是 Emoji 字符串（`🤖 🧠 ✨ 📝 💻`） | `AITaskView.tsx:10-21` |
| P6.1 | `NeuralGraphEngine.init()` 容器 0 尺寸回退 800x600，之后仅更新 viewBox 不重启 simulation | `NeuralGraphEngine.ts:233-259` |
| P8.1 | Sidebar 在 < 1000px 强制折叠到 `localStorage`，但 **MainLayout 本身没有 reflow 到小屏布局** | `Sidebar.tsx:44-49` |

---

## 二、R7 文档产出清单（30 份企业级规格）

本目录树：

```
0421/
├── 00-round7-overview.md                   ← 本文件
├── 00-master-spec-plan.md                  ← 30 份文档的依赖图 + 阅读顺序
├── 00-acceptance-matrix.md                 ← 全部验收条目的矩阵视图
├── README.md                               ← 入口索引
│
├── rca/
│   ├── 01-r5-archive-metadata-only.md      ← R5 为什么失败（commit 溯源）
│   ├── 02-user-pain-map.md                 ← 用户六轮反馈映射表
│   └── 03-architecture-debt-ledger.md      ← 技术债账本
│
├── spec/
│   ├── 02-ia-topology-flow-attached-redesign.md    [P0-Design P6.2/P7.1]
│   ├── 03-runtime-stability-architecture.md        [P0-Blocker P2.1]
│   ├── 04-scanner-lifecycle-contract.md            [P0-Blocker P2.1]
│   ├── 05-ipc-throttling-backpressure-spec.md      [P0-Blocker P2.1]
│   ├── 06-observability-dev-panel-spec.md          [P0-Blocker accompanying]
│   ├── 07-ai-window-alias-contract.md              [P0-Critical P4.2-a]
│   ├── 08-ai-task-detection-engine-spec.md         [P0-Critical P4.2-b]
│   ├── 09-window-groups-contract.md                [P0-Critical P4.2-c]
│   ├── 10-window-layout-engine-spec.md             [P0-Critical P4.2-c]
│   ├── 11-ai-progress-tracker-contract.md          [P0-Critical P4.2-d / P5.1]
│   ├── 12-window-operations-catalog.md             [P1 P4.2-e]
│   ├── 13-project-card-dropdown-portal-fix.md      [P1 P1.1]
│   ├── 14-process-detail-fallback-spec.md          [P1 P2.2]
│   ├── 15-port-scroll-layout-timeout-spec.md       [P1 P3.1]
│   ├── 16-window-layout-overflow-fix.md            [P1 P4.1]
│   ├── 17-topology-rendering-fix.md                [P1 P6.1]
│   ├── 18-responsive-scaling-system.md             [P2 P8.1]
│   ├── 19-theme-design-language-system.md          [P2 P8.2]
│   ├── 20-ai-tool-icons-logo-system.md             [P2 P5.2]
│   └── 21-project-ux-polish-roadmap.md             [P2 P1.2]
│
├── contracts/
│   ├── 22-data-model-consistency-spec.md           ← 全部数据模型（AITaskHistory / WindowInfo / AIWindowAlias ...）
│   ├── 23-ipc-contracts-master.md                  ← 全部 IPC channel 的权威契约
│   ├── 24-permission-control-spec.md               ← 哪些操作需要用户确认 / 审计日志
│   └── 25-icon-library-inventory-no-emoji.md       ← 图标清单 + Emoji 替换映射表
│
├── references/
│   └── 26-integration-library-inventory.md         ← 可复用的库 / 参考项目（React Flow、elkjs、wmi、active-win、tree-kill 等）
│
├── tests/
│   ├── 27-e2e-test-plan.md                         ← Playwright 用例
│   └── 28-performance-benchmark-plan.md            ← 内存 / CPU / IPC 压力测试
│
└── playbooks/
    ├── 29-rollout-phasing-plan.md                  ← R7 → R8 → R9 分批交付
    └── 30-r7-daily-verification-checklist.md       ← 每日手测 + 每日指标
```

---

## 三、阅读顺序（给 R7 实现 Agent）

1. **先读**: 本文件（`00-round7-overview.md`） + `rca/01-r5-archive-metadata-only.md` + `rca/03-architecture-debt-ledger.md`
2. **再读**: `00-master-spec-plan.md` 的依赖图，确认批次顺序
3. **按批次读**:
   - **批次 0（对齐）**: `spec/02-ia-topology-flow-attached-redesign.md` — 信息架构必须先敲定
   - **批次 1（救火）**: `spec/03` / `spec/04` / `spec/05` / `spec/06` — Runtime 四件套
   - **批次 2（窗口核心）**: `spec/07` / `spec/08` / `spec/09` / `spec/10` / `spec/11` / `spec/12`
   - **批次 3（显性 Bug）**: `spec/13` / `spec/14` / `spec/15` / `spec/16` / `spec/17`
   - **批次 4（视觉 / 响应式 / 主题）**: `spec/18` / `spec/19` / `spec/20` / `spec/21`
   - **批次 5（横切关注点）**: `contracts/22` / `contracts/23` / `contracts/24` / `contracts/25`
   - **批次 6（参考 + 测试 + 发布）**: `references/26` / `tests/27` / `tests/28` / `playbooks/29` / `playbooks/30`

---

## 四、R7 每一批次的验收条件（最粗粒度）

| 批次 | 最粗粒度验收 |
|------|------------|
| 批次 0 | 信息架构图（Mermaid）被用户确认；`MonitorPanel.tsx` 的 Tab 枚举变化已写进契约；拓扑引擎的 scope 参数定义清晰 |
| 批次 1 | 应用长跑 60 分钟后，主进程 RSS 不超过 10 分钟基线的 1.5x；`powershell.exe` 子进程在应用退出后数量为 0；IPC 调用频率 Top 10 全部 ≤ 10 calls/min |
| 批次 2 | 两个并发 Claude Code 实例分别改名为"前端 / 后端"，触发完成信号时 Toast 文案精确等于 `[Claude Code-前端] 任务完成`；重启应用后别名仍在 |
| 批次 3 | 六个 P1 Bug 的 Playwright 脚本全绿；用户手测复现率 = 0 |
| 批次 4 | 设置面板可独立选 `theme / density / radius-family / motion-level`；选 compact 后卡片高度从 100px 缩到 52px；Cyberpunk + Compact 组合确实呈现"赛博朋克紧凑风" |
| 批次 5 | 所有数据模型 TypeScript 类型导出自 `contracts/` 目录；所有 IPC channel 的 handler 存在性单测通过 |
| 批次 6 | 所有 Emoji 被替换为 SVG / Icon 组件；长跑压测自动化脚本跑通 |

---

## 五、重要的"不做"清单

- **[DONT]** **不做"一次性综合修复"任务** — R5 的失败证明这条路走不通
- **[DONT]** **不做"批处理 9 个问题域"** — 每批最多 3-5 个相关子项
- **[DONT]** **不写"看上去很像做过"的 UI 组件** — 必须打通 IPC + store + 持久化三条链路
- **[DONT]** **不删任何现有文件** — legacy 降级到 `legacy/` 子目录即可
- **[DONT]** **不用 `any` / `unknown as X` 绕过类型** — R5 代码审计已发现 4 处此类违规
- **[DONT]** **不在 spec 里留 TODO** — 每一个条目要么写清楚要么标注"留待 R8 处理"并说明原因

---

## 六、本轮的 "完成定义"（Definition of Done for R7 Spec）

R7 **仅为 spec 轮**，完成定义如下：

- [x] 30 份文档全部产出
- [x] 每份 spec 都包含：动机 / 受影响源码 / 数据契约 / IPC 契约 / 错误矩阵 / 验收条件 / E2E 脚本草案 / 参考实现 / 预计 LoC
- [x] `00-master-spec-plan.md` 的依赖图通过 linter 检查（无循环依赖）
- [x] `00-acceptance-matrix.md` 覆盖用户 8 大板块下的每一个子诉求
- [x] `contracts/23-ipc-contracts-master.md` 列出的每一个 channel 都在至少一份 spec 里被引用
- [x] `tests/27-e2e-test-plan.md` 的每一条用例都对应一份 spec 的 "E2E 脚本草案" 段落
- [x] `README.md` 可以让任何外部 Agent 在 10 分钟内建立对全局的认知

---

> **给 R7 实现阶段的话**：你接到这套 spec 后，任何时候产生"这个需求我自己再设计一下"的念头时，先停下来，回到对应的 spec 文档，按 **契约 → E2E → 实现** 的顺序走；如果 spec 有遗漏，先在 `playbooks/30-r7-daily-verification-checklist.md` 里写一个 delta，再改 spec，再写代码。
>
> R6 告诉我们：**没有契约就没有实现，只有错觉**。
