# 99 — 当前源码状态快照（佐证用，无需填写）

> 生成方式: Claude Explore subagent 真实代码核查（2026-05-03）
> 用途: 让用户在填写需求表时知道"哪些已经做了 / 哪些只是没暴露 / 哪些真没做"
> 重要警示: **R7 大部分代码已落地，用户感知"消失/未做"多半为 UX 可见性问题，而非源码缺失**

---

## 一、八大模块现状一览

| 编号 | 模块 | 状态 | 关键发现 |
|------|------|------|----------|
| 1 | 主题系统深度 |  已实现 | 4 维独立设置（density / radiusFamily / motionLevel / palette）+ 7 主题 + 运行时 token 访问 |
| 2 | 拓扑/流程附属化 |  已实现 | 进程/端口/窗口三处详情面板均已挂"关系视图"子 Tab；**但无引导徽章/Tooltip/空态提示** |
| 3 | 进程卡片/列表一致性 | 注意 部分实现 | 卡片走 `ProcessDetailPanel + ProcessRelationship`，列表走 `ProcessDetailDrawer + ProcessDeepDetail`，**两套 API 字段不一致** |
| 4 | 端口面板布局/悬浮 |  实现（无悬浮）| 固定 420px 右面板（min 360 / max 560），通过 `PanelSplitter` 内嵌，**无 detachable / popout** |
| 5 | AI 任务感测引擎 |  已实现（6 信号融合）| CPU variance + I/O write rate + 子进程 + 终端 title 模式 + 输出速率 + 时间阈值；含信号贡献权重；动态阈值调整 |
| 6 | AI 进度监控 |  启发式（无 CLI 集成）| Phase-weight 映射 + 历史时长融合（60/40），**未读取 CLI 工具的 stdout/json**，纯估算 |
| 7 | 通知 metadata（R7 P4.2-a）|  修复 | `AppNotification.metadata` 已携带 taskId / windowHwnd / alias / displayName；点击跳转已联动 |
| 8 | 窗口操作 IPC |  5/6 实现 | focus / close / set-title / screenshot / rename-group 全联通；**always-on-top 缺失** |

---

## 二、用户痛点与源码事实的对照表（关键！）

| 用户痛点（2026-05-03） | 源码事实 | 真相 | 应在 R8 解决的方向 |
|----------------------|----------|------|------------------|
| "全局显示太不均匀，需要多个收纳" | 当前主面板为单页 + 右侧监控固定栏，**无 Drawer / Floating Card / Command Palette** | 用户痛点为真：没有"收纳"机制 | 引入 Drawer/Pop-out/CmdK |
| "主题切换还是只换色" | 4 维 token 已存在，且每 palette 默认 `radiusFamily / motionLevel / density` 不同 | **可能为真**：默认轴差异不够大；**也可能为假**：用户没在设置面板看到 4 维选择器 | 设置面板暴露 4 维 + 加大默认轴差异 + 加可视化预览 |
| "卡片状态资源详情显示权限不足" | Card 用 `ProcessRelationship` API，List 用 `ProcessDeepDetail`，权限路径不同 | 卡片/列表底层 API 分裂 | 统一 detail fetcher，权限提升流程统一化 |
| "卡片/列表显示内容不一致" | ProcessDetailPanel vs ProcessDetailDrawer 是两个组件 | 完全为真 | 合并或共享 viewmodel |
| "原本的拓扑/神经关系图设计消失" | 关系视图子 Tab 挂在三处详情面板 | **入口隐藏**（无徽章/无 Tooltip/无空态引导）| 引导徽章 + 首屏 Hint + 可选首屏即展开 |
| "端口卡片太小，要悬浮卡片" | 当前固定 420px PanelSplitter，无 popout | 真痛点未做 | 引入 detach API + Floating Card 系统 |
| "AI 编程窗口感测无效" | 6 信号融合实现存在，含动态阈值；但用户仍报误报 | 信号源/权重/阈值需要校准 + 增加 CLI stdout 信号源 | 引入 CLI JSON 输出解析 + 屏幕 OCR 兜底 |
| "监控进度功能做的不够好" | 进度全为启发式，不读 CLI 输出 | 这是主要原因 | 接入 codex/claude/gemini 的 stdout/event-stream，结合启发式做置信度融合 |
| "可执行功能太少（监控窗口/SKILLS/CSV/Watchdog/自动注入）" | 当前完全没有 CSV 任务驱动 / Skill Library / Watchdog / Inject | 真为新增需求 | R8 重大新增模块（详 `07-ai-task-orchestration-survey.md`） |

---

## 三、R7 已落地、R8 不需重做的部分（避免重复劳动）

- 主题 4 维 token 系统、useTheme / useDensity / 7 主题
- 关系视图（AttachedGraphView / AttachedFlowView）+ ScopeControls
- 拓扑/流程图 IPC（topology:build-scoped-graph / flow:build-scoped-flow / topology:warm-scope）
- AppNotification.metadata 字段
- 5 个窗口操作 IPC（focus / close / set-title / screenshot / rename-group）
- AI 任务 6 信号感测引擎 + 信号贡献权重 + 动态阈值

R8 应在这些已实现基础上做**调优、暴露、引导、扩展**，而非重做。

---

## 四、R8 必须新做或大改的部分

1. **Process Card/List Parity**：合并双 API 或共享 viewmodel
2. **Port Detachable Pop-out**：从零设计 Floating Card 框架
3. **AI Detection Calibration**：信号阈值/权重重调 + 加入 CLI JSON / Output OCR 信号
4. **AI Progress 真实 CLI 集成**：codex / claude / gemini 的 stdout 解析或 event-stream 接入
5. **AI Task Orchestration**：CSV 驱动 + SKILL Library + Watchdog + 自动注入（全新）
6. **Topology Discoverability**：徽章 + Tooltip + 首屏 Hint + 可选首屏展开
7. **Theme Visual Differentiation**：拉大默认轴差异 + 设置面板暴露 4 维选择器
8. **Window always-on-top**：补齐缺失 IPC channel
9. **多个收纳机制**：Drawer / Floating Card / Command Palette / 仪表板

---

## 五、关键源码定位（实现 Agent 后续可直接索引）

| 主题 | 关键文件 |
|------|----------|
| 主题 4 维 | `useTheme.ts:127-143` / `useDensity.ts` / `theme-language.ts:14-16,79-87` / `theme-tokens.css` |
| 关系视图入口 | `ProcessDetailPanel.tsx:399` / `PortFocusPanel.tsx:534-535` / `WindowView.tsx:2214-2215` |
| AttachedGraphView | `AttachedGraphView.tsx:74` / `AttachedFlowView.tsx` |
| AI 6 信号融合 | `AITaskTracker.ts:215-224, 599-649, 639-649` |
| AI 进度估算 | `AIProgressTimeline.tsx:176-200` / `AITaskTracker.ts:1468-1504, 75-93` |
| 通知 metadata | `NotificationService.ts:123-133, 156-169, 204-209, 230-234` |
| 窗口 IPC | `windowHandlers.ts:117-126, 128, 203-210, 231-242, 274-287, 346-357` |
| 进程 Detail 双线 | `ProcessDetailPanel.tsx`（card 路径）/ `ProcessDetailDrawer.tsx`（list 路径）|
| 端口面板 | `PortView.tsx:630-647, 670-679` / `PortFocusPanel.tsx` |
| 监控 4-Tab | `MonitorPanel.tsx:10-33` |

---

## 六、给需求表填写者的"先看这里"

- **不必再勾选**: 主题 4 维存在 / 关系视图存在 / 通知带名 / 6 信号感测 — 这些已有，仅需调优
- **必须决策**: 收纳机制选哪种 / 悬浮卡片框架 / CLI 集成方式 / SKILL Library 范围 / Watchdog 行为
- **可选拓展**: 命令面板 / 仪表板 / 任务录像 / 任务编排 DAG
