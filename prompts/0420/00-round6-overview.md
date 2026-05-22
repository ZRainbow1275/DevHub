# DevHub v2 — Round 6 手动测试总览

> 日期: 2026-04-20（测试）/ 2026-04-21（归档）
> 测试人: ZRainbow
> 测试方式: `pnpm dev` 启动后立即进入手测
> 前序轮次: R1 (0410) / R2 (0410-2) / R3-R4 (0411) / Code Review (0413) / R5 (0415)
> 本轮归档: `prompts/0420/` (本目录)

---

## 一、本轮测试背景与结论

第 6 轮手动测试。核心目的：验证 Round 5 归档后陆续落地的 5 个 v2 修复任务的实际效果。

**涉及的 R5 修复批次**（均已 archive 并合并到 devhub 子模块）：

| 任务 | 主要意图 | archive commit |
|------|---------|---------------|
| `04-13-devhub-v2-comprehensive-fix` | 跨 9 个问题域综合修复 | `3104863` |
| `04-14-v2-backend-core` | AITaskTracker / ToolMonitor / AIAliasManager / NotificationService / SystemProcessScanner | `c72f52e` |
| `04-14-v2-port-window` | PortScanner / WindowManager / AIAliasManager + 别名/进度时间线/布局预览 UI | `90dd851` |
| `04-14-v2-topology-flow` | TopologyView / PortRelationshipGraph / MonitorPanel / topology+flow 子目录 | `c79500d` |
| `04-14-v2-theme-design` | theme-tokens / useTheme / DecorationSet / ThemeDecoration | `30b8a1f` |
| `04-14-v2-project-ux` | ProjectCard / ProjectList / ProjectDetailPanel / StatCard / Sidebar / StatusBar | `700938a` |

**结论**：**修复未达手测通过标准**。R5 所有 P0-Blocker/P0-Critical/P0-Design 均以"看似改过"形式再次复现，部分新暴露了更具体的症状。

- R5 N1（Runtime 资源爆炸）**未修复** — 与"整个监控模块长时间开启后占据大量内存/CPU 导致系统极其卡顿"高度一致
- R5 N4（PID 9148 详情获取失败）**未修复** — 相同文案相同截图重现
- R5 N3（项目卡片下拉遮挡）**未修复** — 相同截图重现
- R5 C1（拓扑/流程图附属化）**未执行** — 拓扑仍是独立顶级 Tab，且渲染错乱
- R5 O1（AI 窗口自命名 + 通知携带名称）**第 6 次反馈，仍未实现**
- R5 O2（分组 / 布局真正可用）**第 6 次反馈，仍不可用**
- R5 O3（AI 感测误报/漏报/迟报）**第 6 次反馈，仍存在**
- R5 O4（小尺寸不缩放只挤压）**第 6 次反馈，仍存在**
- R5 O5（主题仅换色，缺视觉体系深度）**第 6 次反馈，仍存在**
- R5 O6（端口滚动/布局/查询超时三大症状）**未修复**
- R5 AI-2（AI 任务图标应用 Logo 替代 Emoji）**未修复**

---

## 二、问题分类总索引（按用户提出的 8 大板块）

### 板块 1 — 项目

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P1.1 | `01-project-card-dropdown-overlay-revisit.md` | 项目卡片 `npm` 运行下拉菜单被下一张卡片遮挡，功能残缺 | R5-N3（重现） | P1 |
| P1.2 | `02-project-ux-polish.md` | 项目模块需继续打磨 UI/UX（无具体 bug，用户持续要求） | — | P2 |

### 板块 2 — 进程

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P2.1 | `03-monitor-memory-cpu-killer.md` | **整个监控模块长时间开启后占据大量内存以及 CPU，导致系统极其卡顿** | R5-N1（重现并泛化） | **P0-Blocker** |
| P2.2 | `04-process-detail-unavailable-revisit.md` | PID 9148 可见列表但详情面板报"无法获取进程信息" | R5-N4（重现） | P1 |

### 板块 3 — 端口

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P3.1 | `05-port-scroll-layout-timeout-revisit.md` | 端口窗口无滚动条/布局挤压/查询超时三症状并存 | R5-O6（重现） | P1 |

### 板块 4 — 窗口

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P4.1 | `06-window-layout-overflow.md` | 进程显示因窗口名溢出 → 布局溢出 + 不美观 + 无滚动 | R5-O4 局部 | P1 |
| P4.2 | `07-window-unmet-5-demands-revisit.md` | 5 个用户反复要求的窗口能力（AI 自命名/AI 感测/分组/布局/监控进度/可用功能数） | R5-O1/O2/O3（**第 6 次反馈**） | **P0-Critical** |

### 板块 5 — AI 任务

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P5.1 | `08-ai-progress-tracker-broken.md` | AI 任务进度监控失效（并发于窗口 P4.2-监控进度） | R5-O3 | P0-Critical |
| P5.2 | `09-ai-icons-emoji-not-logo.md` | AI 任务卡片仍用 Emoji（🤖/🧠）而非工具原生 Logo | R5-AI-2 | P2 |

### 板块 6 — 拓扑

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P6.1 | `10-topology-broken-rendering.md` | 拓扑无法正常显示（节点全挤左上角 + 连线虚化散开） | 新症状 | P1 |
| P6.2 | `11-topology-flow-scope-violation.md` | **拓扑被独立成顶级 Tab，违背"进程/端口/窗口附属功能"设计意图** | R5-C1（**未执行**） | **P0-Design** |

### 板块 7 — 流程图

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P7.1 | `11-topology-flow-scope-violation.md` （合并） | 流程图同拓扑，必须也是进程/端口/窗口的附属查询功能 | R5-C1 | P0-Design |

### 板块 8 — 视觉交互

| # | 文档 | 症状 | R5 锚点 | 严重性 |
|---|------|------|---------|--------|
| P8.1 | `12-responsive-no-scaling.md` | 窗口过小时仍是原尺寸挤压，而非缩放重排 | R5-O4（重现） | P2 |
| P8.2 | `13-theme-still-only-color.md` | 主题切换仍只换 palette，布局/组件/动效无差异 | R5-O5（重现） | P2 |

---

## 三、R6 优先级矩阵（覆盖 R5 原有排序）

```
═════════════════════════════════════════════════════════════
批次 0 — Runtime 救火（比 R5 更紧迫，症状已泛化为"整个监控模块"）
═════════════════════════════════════════════════════════════
  P2.1  监控模块长时间运行内存/CPU 爆炸              [P0-Blocker]
         ↑ R5 N1 未修复 + 泛化 — 现在不只是 PowerShell
         ↑ 必须审计所有扫描器（进程/端口/窗口/AI）的生命周期、缓存、IPC 频率

═════════════════════════════════════════════════════════════
批次 1 — 需求校准（R5 C1 未执行，先对齐再动手）
═════════════════════════════════════════════════════════════
  P6.2  拓扑/流程图必须降为进程/端口/窗口的附属查询  [P0-Design]
         ↑ 需要信息架构（IA）重构：删除顶级"拓扑"/"流程图"Tab
         ↑ 改为：列表中点选任一对象 → 弹出以该对象为中心的关系视图

═════════════════════════════════════════════════════════════
批次 2 — 六次反馈未实现的核心需求（已反复 archive，需从失败原因入手）
═════════════════════════════════════════════════════════════
  P4.2-a  AI 窗口自命名 + 通知携带窗口名              [P0-Critical]
  P4.2-b  AI 窗口任务感测准确性（多实例识别）         [P0-Critical]
  P4.2-c  分组 + 布局功能真正可用                     [P0-Critical]
  P4.2-d  监控进度与实际 AI 任务对齐                  [P0-Critical]
  P4.2-e  窗口可操作功能增加（不只是显示列表）       [P1]

═════════════════════════════════════════════════════════════
批次 3 — 显性 Bug
═════════════════════════════════════════════════════════════
  P1.1  项目卡片下拉遮挡                             [P1]
  P2.2  PID 9148 详情获取失败                        [P1]
  P3.1  端口滚动 + 布局 + 查询超时                   [P1]
  P4.1  窗口名溢出 + 无滚动                          [P1]
  P6.1  拓扑渲染错乱                                 [P1]
  P5.1  AI 进度监控失效（与 P4.2-d 高度重合）        [P0-Critical]

═════════════════════════════════════════════════════════════
批次 4 — 视觉与细节
═════════════════════════════════════════════════════════════
  P8.1  响应式缩放（不仅是挤压）                      [P2]
  P8.2  主题从"换色"到"完整设计语言"                  [P2]
  P5.2  AI 工具图标用 Logo 替代 Emoji                 [P2]
  P1.2  项目模块 UI/UX 继续打磨                       [P2]
```

---

## 四、为什么 R5 的 archive 修复未达效果（元分析）

用户已经在 R6 明确提出：多次反复反馈的问题（AI 自命名/感测/分组/布局/主题深度）依然无改善。从 R5 到 R6 之间至少执行了 5 个 feature 任务 + 1 个综合修复任务，但用户感知无变化。可能的失败路径：

1. **P4.2 类需求缺乏可验收契约** — PRD 中只有"支持自命名"、"通知携带名称"这样的愿望描述，没有：
   - 具体的 IPC channel 合同（如 `window:rename` 的完整 schema）
   - 通知文案模板与触发点清单
   - 自动化可观测信号（比如 Toast 截图、Zustand store 断言）
   → 实现 Agent 写了一半就以为对了，没有 smoke test 保证端到端闭环。

2. **P6.2 C1 拓扑附属化未被执行** — archive 中 `v2-topology-flow` 仍在扩充 `TopologyView` / 独立 `flow` 子目录，说明 R5 需求校准的 IA 重构**被误读为"把拓扑做得更强"**，而不是"把拓扑从顶级删除、改挂在进程/端口/窗口的详情面板中"。

3. **P2.1 Runtime 爆炸泛化** — R5 的 N1 聚焦 PowerShell CIM 调用，v2-backend-core commit 改了 SystemProcessScanner / ToolMonitor / AITaskTracker，但用户现在反馈的是"**整个监控模块**在长时间开启后"爆炸，提示：
   - 可能某个扫描器仍在 tight loop 里调 child_process
   - 可能 IPC 高频调用（R5 N2）根本没改
   - 可能 React Flow/xyflow 拓扑订阅每次 poll 都重建了 node/edge 集

4. **P8.2 主题深度未落地** — `v2-theme-design` commit 体现为 `ThemeDecoration` / `DecorationSet` / `theme-tokens`，但用户截图显示两个不同主题**布局完全一致**，只是颜色变了。`ThemeDecoration` 这个命名暗示当时做的是"主题装饰物"叠加而非"主题驱动完整设计语言"。

**给下一轮对话的元建议**：在具体动手前，对每个未达效果的需求先写"为什么 R5 没能修好"的一页纸根因分析，再开实现任务。否则 R7 会出现同样的"看似改过"。

---

## 五、源码定位（用于下一轮对话快速进入）

| 问题域 | 关键源码 | 切入点建议 |
|-------|----------|-----------|
| P2.1 Runtime 爆炸 | `src/main/services/SystemProcessScanner.ts`, `ToolMonitor.ts`, `AITaskTracker.ts`, `WindowManager.ts`, `PortScanner.ts`, `BackgroundScannerManager*` | `gitnexus_impact({target:"BackgroundScannerManager"})` + `serena.search_for_pattern({pattern:"setInterval|Get-CimInstance|powershell\\.exe"})` |
| P4.2 窗口六次未实现 | `WindowManager.ts`, `AIAliasManager.ts`, `NotificationService.ts`, `windowStore.ts`, `aliasStore.ts`, `AIWindowAlias.tsx`, `AIProgressTimeline.tsx`, `LayoutPreview.tsx` | 先做：`serena.find_symbol({name_path:"window:rename"})` 确认 IPC 是否真的接通。读 `AIAliasManager` 源码，对照截图 Toast 文案是否真的带名称 |
| P6.2 拓扑附属化 | `src/renderer/components/monitor/TopologyView.tsx`, `MonitorPanel.tsx`, `topology/`, `flow/` 子目录, `useProcessTopology.ts` | **先问需求**：顶级 Tab 是否要删除？保留但改为"选中对象后才显示图"？附属图应放在详情面板内还是弹窗？此问题不先对齐不能下手 |
| P8.2 主题深度 | `src/renderer/utils/theme-tokens.ts`, `src/renderer/hooks/useTheme.ts`, `src/renderer/styles/`, `DecorationSet.tsx`, `ThemeDecoration.tsx`, `tailwind.config.js` | 审计当前 useTheme 是否只切 CSS 变量，还是真的切换 layout/density/typography 的 tokens |
| P1.1 下拉遮挡 | `src/renderer/components/project/ProjectCard.tsx`, `ProjectList.tsx`, portal 实现缺失 | 查找当前下拉菜单是否用 `position: absolute` 挂在 ProjectCard 内部 DOM（必遮挡）而非使用 Portal 挂到 body |
| P5.2 AI 图标 | `src/renderer/components/monitor/ProcessView.tsx` 中的图标选择逻辑 | 搜索 Emoji Unicode 出处（🤖 = U+1F916, 🧠 = U+1F9E0） |

---

## 六、证据锚点（截图）

| # | 截图文件 | 用户描述 | 映射问题 |
|---|---------|---------|----------|
| 1 | `屏幕截图 2026-04-15 194903.png` | 项目卡片下拉显示不全受到遮盖 | P1.1 |
| 2 | `屏幕截图 2026-04-15 195107.png` | PID 9148 无法获取进程信息 | P2.2 |
| 3 | `屏幕截图 2026-04-15 195159.png` | 端口窗口没有滑动栏 | P3.1-a |
| 4 | `屏幕截图 2026-04-15 195211.png` | 端口挤占布局不均 + 查询超时 | P3.1-b/c |
| 5 | `屏幕截图 2026-04-15 195332.png` | 窗口名溢出、布局不美观、无上下滚 | P4.1 |
| 6 | `屏幕截图 2026-04-15 195527.png` | AI 任务卡片 Emoji（🤖🧠🧠）而非 Logo | P5.2 + P5.1 |
| 7 | `屏幕截图 2026-04-15 195547.png` | 拓扑节点挤在左上角、连线虚散 | P6.1 |
| 8 | `屏幕截图 2026-04-15 195806.png` | 流程图布局溢出 + 右下 minimap 黑块 | P6.1 + P7 |
| 9 | `屏幕截图 2026-04-15 195855.png` | 主题 A 全屏截图（布局 A） | P8.2 |
| 10 | `屏幕截图 2026-04-15 195904.png` | 主题 B 全屏截图（布局完全同 A，仅换色） | P8.2 |

> **注意**：截图拍摄日期仍为 2026-04-15（R5 相同来源），R6 测试中用户再次手测后确认**问题悉数重现**，因此截图复用。下一轮测试前应要求用户提供带 R6 修复差异的新截图作为对比证据。

---

## 七、给下一个对话的建议流程

1. **读完** `prompts/0420/00-round6-overview.md`（本文件）
2. **先做元分析** — 对 P4.2 六次反馈未实现的问题，写"为什么 R5 v2-backend-core + v2-port-window archive 后仍未生效"的根因一页纸
3. **先对齐 P6.2** — 和用户敲定拓扑/流程图附属化的具体 IA：
   - [ ] 顶级 Tab 是保留为"空/提示选中对象"，还是直接删除？
   - [ ] 附属图入口放在哪里（进程卡片/详情面板/弹窗/抽屉）？
   - [ ] 以对象为中心展开时，图的数据源与深度限制？
4. **再做 P2.1 Runtime 救火** — 这次范围放大到整个监控模块，不只是 PowerShell；先加扫描器生命周期/缓存/频率的观测与压力测试，再动 fix
5. **然后做 P4.2** — 把每个需求变成可验收契约（IPC schema + Toast 模板 + E2E 断言），再交给 implement agent
6. **其他 Bug（P1.1 / P2.2 / P3.1 / P4.1 / P6.1）** 按批次 3 推进
7. **视觉细节（P8.x / P5.2 / P1.2）** 放最后批次

> **强烈建议**：R6 之后不要一次性批处理 9 个问题域。R5 的失败证明"综合修复"无法保证每项都真落地。改为每批 1-2 个问题，完成后用户当场手测通过再推进。

---

## 八、文档清单

```
prompts/0420/
├── 00-round6-overview.md                    （本文件）
├── 01-project-card-dropdown-overlay-revisit.md
├── 02-project-ux-polish.md
├── 03-monitor-memory-cpu-killer.md          [P0-Blocker]
├── 04-process-detail-unavailable-revisit.md
├── 05-port-scroll-layout-timeout-revisit.md
├── 06-window-layout-overflow.md
├── 07-window-unmet-5-demands-revisit.md     [P0-Critical × 5]
├── 08-ai-progress-tracker-broken.md
├── 09-ai-icons-emoji-not-logo.md
├── 10-topology-broken-rendering.md
├── 11-topology-flow-scope-violation.md      [P0-Design]
├── 12-responsive-no-scaling.md
└── 13-theme-still-only-color.md
```
