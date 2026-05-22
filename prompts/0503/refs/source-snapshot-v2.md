# DevHub R8 源码现状快照 (master branch, 2026-05-03)

## 维度 1: MonitorPanel 的 4-Tab 与右侧详情

### 已落地代码
- **MonitorPanel.tsx:10-30** — 4-Tab 结构定义 (process|port|window|ai-task)，顶级 TABS 常量及标签图标
- **MonitorPanel.tsx:33-45** — Tab 导航事件监听 (devhub:monitor-navigate 自定义事件)
- **ProcessView.tsx** — 进程 Tab 左侧列表实现
- **PortView.tsx:363** — 端口 Tab 视图模式切换: 'cards'|'list'|'relationship'
- **WindowView.tsx** — 窗口 Tab 实现
- **AITaskView.tsx** — AI 任务 Tab 实现

### 右侧详情面板
- **ProcessDetailPanel.tsx** — 进程卡片详情 (5-Tab: 基础/资源/网络/环境/模块)
- **ProcessDetailDrawer.tsx** — 进程列表行抽屉详情
- **PortFocusPanel.tsx** — 端口焦点详情面板，支持 AttachedGraphView 关系视图嵌入

### 关系视图入口
- **PortView.tsx:550, 620-683** — 端口 Tab 中 viewMode='relationship' 切换关系图入口
- **PortFocusPanel.tsx:534** — 端口详情内嵌 AttachedGraphView (scope: {kind:'port', targetId, depth:2})
- **ProcessDetailPanel.tsx:674-733** — 进程详情中 "关联" Tab 显示端口/子进程/窗口列表 (但无嵌入图表)
- **TopologyView.tsx** — 独立全局拓扑视图 (图表引擎 NeuralGraphWithControls + TopologyDetailPanel)

### 与 R7 对比变化
用户说"拓扑功能消失"→ 实现真相：
1. 关系视图入口从显眼位置下沉至各详情面板内部的"关系图"子菜单
2. 全局拓扑在 TopologyView.tsx 独立实现，但在 MonitorPanel 中没有直接 Tab 菜单入口
3. 用户若要看全局拓扑必须从其他位置导航进入

**判定**: 入口隐藏，非代码未实现。功能完整，UX 路径不直观。

---

## 维度 2: Process 模块的卡片 vs 列表双线问题

### ProcessDetailPanel (卡片路径)
- **文件**: src/renderer/components/monitor/ProcessDetailPanel.tsx
- **调用链**: ProcessView → 点击进程卡片 → ProcessDetailPanel 侧滑出
- **实现**: 行 168 state `relationship: ProcessRelationship | null`; 行 314-346 fallback 逻辑; 行 674-733 关联信息展示

### ProcessDetailDrawer (列表路径)
- **文件**: src/renderer/components/monitor/ProcessDetailDrawer.tsx
- **调用链**: ProcessView (列表模式) → 点击行 → ProcessDetailDrawer 打开
- **结构**: 同样 5-Tab (基础/资源/网络/环境/模块)

### IPC 字段差异
- ProcessDetailPanel 通过 relationship 获取完整关系数据
- ProcessDetailDrawer 通过 ProcessDeepDetail 接收数据
- 数据来源不同，结构差异需文档化

---

## 维度 3: Port 模块当前布局 + popout 雏形

### PortView.tsx 布局
- **行 363**: viewMode 切换 ('cards'|'list'|'relationship')
- **行 630+**: PanelSplitter 实现左列表 + 右详情面板可调整分割
- **布局**: flex-based responsive，无固定尺寸

### PortFocusPanel 特性
- **文件**: src/renderer/components/monitor/PortFocusPanel.tsx
- **特性**: 缓存优先渐进式渲染、skeleton loading、stale data warning、内嵌 AttachedGraphView (line 534)
- **浮动卡片**: 无专门 Floating Card，仅通过 PanelSplitter 分割

---

## 维度 4: Window 模块的 IPC 全清单

### windowHandlers.ts 完整 channel 列表 (src/main/ipc/windowHandlers.ts:103-530)

基础操作: WINDOW_SCAN | WINDOW_FOCUS | WINDOW_FOCUS_GROUP | WINDOW_MOVE | WINDOW_MINIMIZE | WINDOW_MAXIMIZE | WINDOW_CLOSE

窗口组: WINDOW_CREATE_GROUP | WINDOW_GET_GROUPS | WINDOW_REMOVE_GROUP | WINDOW_RENAME_GROUP | WINDOW_ADD_TO_GROUP

布局快照: WINDOW_SAVE_LAYOUT | WINDOW_RESTORE_LAYOUT | WINDOW_GET_LAYOUTS | WINDOW_REMOVE_LAYOUT | WINDOW_APPLY_LAYOUT | WINDOW_SAVE_SNAPSHOT | WINDOW_UPDATE_SNAPSHOT | WINDOW_DELETE_SNAPSHOT | WINDOW_RESTORE_SNAPSHOT | WINDOW_LIST_SNAPSHOTS | WINDOW_PREVIEW_LAYOUT | WINDOW_RESTORE_PREVIOUS

高级功能: WINDOW_GET_MONITOR_INFO | WINDOW_TILE_GROUP | WINDOW_RESTORE | **WINDOW_SET_TOPMOST (行 424) [DONE]** | WINDOW_SET_OPACITY | WINDOW_SET_TITLE | **WINDOW_SEND_KEYS (行 463) [实现]** | WINDOW_TILE_LAYOUT | WINDOW_CASCADE_LAYOUT | WINDOW_MINIMIZE_ALL | WINDOW_RESTORE_ALL

### Always-on-Top & Inject Text
- **Always-on-Top**: WINDOW_SET_TOPMOST (行 424) 已实现，Zod 验证 + 速率限制
- **Inject Text**: WINDOW_SEND_KEYS (行 463) 已实现，仅支持键盘按键，非文本注入

---

## 维度 5: AI 任务感测 6 信号融合

### AITaskTracker.ts
- **文件**: src/main/services/AITaskTracker.ts
- **信号常量**: COMPILE_PATTERNS | COMPLETION_PATTERNS | ERROR_PATTERNS | PROMPT_PATTERNS (行 1-100)

### 状态机 (行 11-98)
- taskStateForMonitorState(state: AIMonitorState) → AITaskState
- phaseForMonitorState(state: AIMonitorState) → AITaskPhase
- progressPercentageForMonitorState(state: AIMonitorState) → number
  - idle: 0%, thinking: 30%, coding: 68%, compiling: 78%, validating: 92%, waiting-input: 98%, completed: 100%
- cpuHistoryForMonitorState(state: AIMonitorState) → number[]

### 进度估算
- 启发式阶段映射，未实现真实 stdout 读取
- monitorState 细粒度用于 UI，taskState 粗粒度用于业务逻辑

---

## 维度 6: Theme 4 维 token 系统

### 核心文件
- src/renderer/hooks/useTheme.ts — 主题切换逻辑
- src/renderer/hooks/useDensity.ts — 密度管理
- src/renderer/theme/theme-language.ts — 预设与规范化
- src/renderer/styles/tokens/theme-tokens.css — CSS token 定义

### 4 维轴
| 维度 | 默认 | 可选 | 说明 |
|-----|-----|-----|-----|
| Palette | constructivism | modern-light/warm-light/cyberpunk/swiss/dark/light | 色系 |
| Density | standard | compact/standard/comfortable | 信息密度 |
| RadiusFamily | sharp (constructivism) / soft (modern-light) | sharp/soft/round | 圆角族系 |
| MotionLevel | balanced | reduced/balanced/expressive | 动效级别 |

### Modern-Light vs Constructivism 量化差异
- 色系: 完全不同
- 边框: constructivism 2px solid，modern-light 推断 1px
- 阴影: constructivism 3px 3px 0 硬offset，modern-light 推断柔和
- 圆角: constructivism 0/2px，modern-light 推断 8px+
- 动效: 150ms balanced (相同持续，easing 可能不同)
- 空间: constructivism --spacing-base: 4px，modern-light 未定义
- 字体: Oswald/Bebas vs Inter

### "切换只换色"的真相
- 代码证据: theme-language.ts 行 80-81 仅定义 radiusFamily/motionLevel 默认关联
- 推断: 密度、圆角、动效无自动协调
- UX 缺陷: 切换色系时应自动推荐其他 3 维，但当前逻辑仅在 THEME_PRESETS 定义，不在切换时触发

---

## 维度 7: 拓扑 / 流程图引擎

### NeuralGraphEngine (d3-force)
- **文件**: src/renderer/components/monitor/topology/NeuralGraphEngine.ts
- **配置**: centerStrength=0.03, chargeStrength=-100, linkDistance=80~120
- **节点类型**: process|port|window|project|external|port-listening|port-established|port-timewait

### 详情面板内关系视图
- **ProcessDetailPanel**: 文字列表无图表
- **PortFocusPanel**: AttachedGraphView scope={{kind:'port', targetId, depth:2}}
- **PortView**: viewMode='relationship' 切换

### 全局拓扑
- **文件**: src/renderer/components/monitor/TopologyView.tsx (行 1-100)
- **入口**: 不在 MonitorPanel 4-Tab 中，推断侧边栏或路由级别

### 缺陷
- 全局拓扑在 MonitorPanel 一级 4-Tab 无直接入口

---

## 维度 8: Skill / CSV / Watchdog / 自动注入

### 各模块实现状态
| 功能 | 状态 | 覆盖率 | 备注 |
|-----|-----|-----|-----|
| Skill | 0% | 未实现 | 无相关代码 |
| CSV | 50% | 仅导入 | SystemProcessScanner 集成，WMIC/Get-Process CSV 解析 |
| Watchdog | 0% | 未实现 | 推断由 Scanner 定时扫描替代 |
| Auto-Inject | 70% | 键盘模拟 | WINDOW_SEND_KEYS 键盘按键，无文本注入 |
| SHIM | 0% | 未实现 | 直接调用 IPC handler |

---

## 总体评估

| 维度 | 完成度 | 备注 |
|-----|-----|-----|
| 4-Tab MonitorPanel | 100% | [DONE] |
| Process 双线 (卡片+列表) | 100% | [DONE] |
| Port 模块 + popout | 90% | 缺浮窗 detach |
| Window IPC | 95% | always-on-top [DONE]，text-inject 限键盘 |
| AI 任务感测 | 70% | 启发式进度，非真实 stdout |
| Theme 4 维 | 100% 代码 | UX 协调缺失 |
| 拓扑引擎 | 100% 代码 | 全局入口隐藏 |
| Skill/CSV/Watchdog | 30% | 仅 CSV 部分实现 |

---

快照生成时间: 2026-05-03
扫描分支: master
扫描工具: Serena + mcp__metamcp
