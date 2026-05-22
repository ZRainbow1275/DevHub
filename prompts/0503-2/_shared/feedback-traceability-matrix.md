# 5 大用户反馈 × Spec 完整追踪表

> **生成时间**: 2026-05-03
> **数据源**: 4 PRD + 67 spec（R8.A 11 + R8.B 17 + R8.C 39）
> **目的**: 任一用户反馈点能 1 跳定位到所有相关 spec / GWT / 验收 ASSERT / 影响 LoC
> **机器可解析格式**: YAML 矩阵 + Markdown 表格双轨

> **当前状态（2026-05-14）**: 本文件的反馈映射关系仍作为 R8 需求追踪入口；完成度不再按 2026-05-03 静态估算判断，而是绑定 completion ledger、spec `implementation_status_*`、以及本地验证命令。历史估算 LoC 与阶段描述保留用于追踪，不构成功能完成证明。

## §-1 当前追踪附录（2026-05-14）

```yaml
traceability_source_of_truth:
  current_ledger: .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
  prompt_markdown_files: 81
  feedback_count: 5
  hard_gates:
  - ASSERT_PROCESS_FIELD_PARITY
  - ASSERT_TOPOLOGY_FIRST_GLANCE
  - ASSERT_THEME_NON_COLOR_DELTA
  - ASSERT_ALWAYS_ON_TOP_FUNCTIONAL
  - ASSERT_PORT_PANEL_BREATHING_ROOM

current_gate_status:
  ASSERT_PROCESS_FIELD_PARITY: verified
  ASSERT_TOPOLOGY_FIRST_GLANCE: verified
  ASSERT_THEME_NON_COLOR_DELTA: verified
  ASSERT_ALWAYS_ON_TOP_FUNCTIONAL: verified
  ASSERT_PORT_PANEL_BREATHING_ROOM: verified

current_batch_truth:
  R8.A: all_gate_specs_verified
  R8.B: acceptance_surface_partially_implemented
  R8.C: resilience_and_runtime_surface_partially_implemented
  _shared: current_docs_and_schema_registry_verified_after_2026_05_14_addendum
```

### §-1.1 当前反馈闭环判断规则

- Feedback #1 的主题/收纳/状态栏目标只在 R8.A gate 和已验证 R8.B slices 内可声明完成；R8.B i18n/a11y/theme decoration/statusbar 剩余 checklist 不得由本矩阵代替。
- Feedback #2 的权限、字段一致性、拓扑入口目标以 R8.A gate 为已验证基础；R8.C topology/watchdog/permission 的 partial 项仍按 ledger 保留边界。
- Feedback #3 的端口卡和 popout 目标以 R8.A port breathing-room、R8.B spec-13、R8.B spec-02 已验证 slices 为证据；R8.B spec-01/spec-02 的多屏/RSS/完整双向同步仍不得声称完成。
- Feedback #4 的 AI 监控误报、CSV、SHIM、Watchdog、注入目标必须分别回到 R8.C spec-01..22、27..30、34..39 的行级证据；2026-05-14 已补齐 signal fusion 数学算法、Codex shim reconnect backoff、Python CSV pause/resume control pipe，2026-05-16 已补齐 packaged Codex shim exe，但 direct koffi scanner、真实 inject adapters、watchdog subprocess runtime 仍为边界。
- Feedback #5 的三套图体系已在 R8.A gate 和 R8.C spec-25/spec-26 verified slices 内有证据；R8.C spec-24 全局拓扑仍 partial，不能由本矩阵替代最终拓扑验收。

---

## §0 总览

```yaml
matrix_summary:
  total_user_feedbacks: 5
  total_specs_mapped: 51  # 5 反馈直接关联的 spec 总数
  total_release_gates: 11  # ASSERT_* 数量
  estimated_loc_total: ~85000  # 全 R8 阶段
  acceptance_coverage_pct: 100  # 每反馈至少 1 个 ASSERT
```

---

## §1 Feedback #1 — 显示太不均匀 + 主题切换只换色

### §1.1 用户原话与决策锚点

```yaml
feedback_id: feedback#1
user_quote: "显示太不均匀，思考增加多个收纳 + 主题切换仍只换色"
decision_anchors:
  - V1-Q-2.A.1: "A — 保持三栏（不变栏数）"
  - V1-Q-2.B.1: "A+B+C+D+F — popout/drawer/cmdk/grid/statusbar 全选"
  - V1-Q-3.A.1: "B+C+E — palette + density + radiusFamily 必须联动"
  - V1-Q-3.B.1: "A+C — motionLevel + decoration 主题专属"
  - V2-§14.A..I: 全局/响应式/收纳/主题深化
```

### §1.2 解决 spec 列表（按 batch 排序）

| batch | spec | 标题 | 主要交付 | LoC |
|---|---|---|---|---|
| R8.A | spec-06 | theme-4d-axis-exposure | 4 维主题轴（palette/density/radius/motion）UI 暴露 | ~1100 |
| R8.A | spec-07 | theme-default-distance | 每 palette 自动联动其余 3 轴；非色彩感知差异 | ~800 |
| R8.B | spec-03 | drawer-system-top-right-bot | 5 槽抽屉（top/right/bottom/floating/statusbar） | ~1500 |
| R8.B | spec-05 | dashboard-grid-layout | react-grid-layout 可拖拽仪表盘 | ~1400 |
| R8.B | spec-07 | theme-decorations-extend | 8 种装饰几何 + 用户 SVG 上传 | ~900 |
| R8.B | spec-08 | statusbar-extension | 状态栏 6 类聚合（运行项目/AI 任务/端口/通知等） | ~1200 |

### §1.3 GWT 验收锚点

```yaml
acceptance_gwt_feedback_1:
  - ASSERT_THEME_NON_COLOR_DELTA:  # master §5.1
  test: "切换 4 个 palette，density / radius / motion 视觉上有可测量差异（不仅颜色变化）"
  spec_owner: R8.A.spec-06 + spec-07
  gwt_ref: R8.A.spec-06 GWT-2/3 + spec-07 GWT-1
  - statusbar_six_badges_visible:
  test: "status bar 显示 6 类徽章（项目数/AI 任务数/端口数/通知数/Watchdog 状态/CSV 队列）"
  spec_owner: R8.B.spec-08
  gwt_ref: R8.B.spec-08 GWT-1..3
  - drawer_five_slots_functional:
  test: "5 个抽屉槽位都可通过命令面板触发并显示内容"
  spec_owner: R8.B.spec-03
  gwt_ref: R8.B.spec-03 GWT-1..5
  - grid_drag_persists:
  test: "用户拖动仪表盘卡片位置后重启 DevHub，布局保留"
  spec_owner: R8.B.spec-05
  gwt_ref: R8.B.spec-05 GWT-3
```

### §1.4 影响半径

```yaml
impact_radius_feedback_1:
  total_new_loc: ~6900
  total_modified_loc: ~900
  total_test_loc: ~3500
  cross_layer_impact:
  - main: ThemeService 改造
  - renderer: App.tsx 路由 + Drawer / Grid / StatusBar 挂载
  - shared: ThemeAxisSchema (R8.A.spec-06)
  risk_level: medium
  parallelizable: yes (R8.A.06/07 可与 R8.B.03/05/07/08 并行)
```

---

## §2 Feedback #2 — 进程权限不足 + 卡片/列表字段不一致 + 拓扑入口三端贯通消失

### §2.1 用户原话与决策锚点

```yaml
feedback_id: feedback#2
user_quote: "卡片状态显示权限不足 + 卡片/列表字段不一致 + 拓扑/神经关系图入口在进程/端口/窗口三端贯通消失"
decision_anchors:
  - V1-Q-4.A.2: "C+D — 分层 ViewModel"
  - V1-Q-4.B.1: "B — UAC spawn 子进程提权（main 不提权）"
  - V1-Q-4.B.2: "D — 24h 提权时效（spec-37）"
  - V1-Q-4.H.1: "B+D+E — 顶部按钮 + 卡片角标 + 子 Tab 三端贯通"
  - V2-§14.J..L: 权限呈现策略
```

### §2.2 解决 spec 列表

| batch | spec | 标题 | 主要交付 | LoC |
|---|---|---|---|---|
| R8.A | spec-02 | process-unified-vm | ProcessUnifiedViewModel（Card/List 共用 schema） | ~1500 |
| R8.A | spec-03 | process-uac-elevation | UAC spawn 子进程提权（B 路线） | ~1100 |
| R8.A | spec-04 | process-card-list-parity | Card/List 字段对齐校验 | ~900 |
| R8.A | spec-05 | topology-discoverability | 三端入口贯通（顶部按钮+角标+Tab+Tour） | ~1300 |
| R8.A | spec-11 | permission-prompts | 提权前授权弹窗 | ~700 |
| R8.C | spec-25 | topology-attached-deep10 | 附属拓扑深度 10 + 8-10 层 lazy | ~1600 |
| R8.C | spec-26 | flow-graph-attached-30min | 流程图附属（第三套图） | ~1500 |
| R8.C | spec-37 | permissions-time-bounded | 24h 提权 TTL + 自动回收 | ~1250 |

### §2.3 GWT 验收锚点

```yaml
acceptance_gwt_feedback_2:
  - ASSERT_PROCESS_FIELD_PARITY:
  test: "同 PID 在 Card / List 视图下显示的字段集合完全一致（schema diff = 0）"
  spec_owner: R8.A.spec-02 + spec-04
  gwt_ref: R8.A.spec-04 GWT-1..3
  - ASSERT_TOPOLOGY_FIRST_GLANCE:
  test: "进入任意进程/端口/窗口详情，3s 内可见拓扑入口（顶部按钮 OR 角标 OR Tab 任一）"
  spec_owner: R8.A.spec-05
  gwt_ref: R8.A.spec-05 GWT-1..5
  - uac_elevation_24h_ttl:
  test: "提权 24h 后再次操作需重授；revoke-all 立即生效"
  spec_owner: R8.C.spec-37
  gwt_ref: R8.C.spec-37 GWT-1/2
  - permission_denied_visible:
  test: "权限不足的进程在 Card/List 都明确显示同一标识（褪色 + Badge）"
  spec_owner: R8.A.spec-04 + spec-11
  gwt_ref: R8.A.spec-04 GWT-2 + spec-11 GWT-3
```

### §2.4 影响半径

```yaml
impact_radius_feedback_2:
  total_new_loc: ~9850
  total_modified_loc: ~1200
  total_test_loc: ~4500
  cross_layer_impact:
  - main: ProcessUnifiedVM / UacSpawner / PermissionService / PermissionTtlManager
  - renderer: ProcessCardView / ProcessListView / TopologyEntryPoint x3
  - shared: ProcessUnifiedViewModelSchema (master §7.1) + PermissionGrantSchema
  risk_level: high (UAC 提权 + 三端入口大改)
  parallelizable: 部分（spec-02 必先；spec-03/04/05 可并行）
```

---

## §3 Feedback #3 — 端口卡太小要 popout 悬浮卡

### §3.1 用户原话与决策锚点

```yaml
feedback_id: feedback#3
user_quote: "端口卡片都太小了，能做成摘出来的悬浮卡片就做"
decision_anchors:
  - V1-Q-2.B.3: "D — popout 是必备"
  - V1-Q-5.B.1: "A+B+C+D — hover 1s / click / drag 8px / 右键菜单 4 触发全要"
  - V1-Q-5.B.3: "C — popout 双模（半浮窗 + BrowserWindow）"
  - V2-§14.V..Y: popout 细节
```

### §3.2 解决 spec 列表

| batch | spec | 标题 | 主要交付 | LoC |
|---|---|---|---|---|
| R8.A | spec-09 | port-card-improvement | 间距 + 安全标签 + 字段重排（先不 popout） | ~700 |
| R8.B | spec-01 | port-popout-system | 4 触发 popout 框架（hover/click/drag/menu） | ~1700 |
| R8.B | spec-02 | port-floating-window | popout 升级到 BrowserWindow（可拖第二屏） | ~1500 |
| R8.B | spec-13 | port-security-tier-banner | 4 级安全分级 Banner + 黑名单 | ~1100 |

### §3.3 GWT 验收锚点

```yaml
acceptance_gwt_feedback_3:
  - ASSERT_PORT_PANEL_BREATHING_ROOM:
  test: "端口卡片间距 ≥ 12px；字段不挤压不省略号"
  spec_owner: R8.A.spec-09
  gwt_ref: R8.A.spec-09 GWT-1..3
  - popout_4_triggers_all_work:
  test: "hover 1s + click + drag 8px + 右键菜单 4 种方式都能触发 popout"
  spec_owner: R8.B.spec-01
  gwt_ref: R8.B.spec-01 GWT-1..4
  - popout_browser_window_dual_screen:
  test: "popout 升级为 BrowserWindow 可拖到副屏 + 保持 always-on-top"
  spec_owner: R8.B.spec-02
  gwt_ref: R8.B.spec-02 GWT-1/2
  - port_security_tier_visible:
  test: "高危端口（4444/6666/31337 等）显示红色 Banner + 黑名单可禁"
  spec_owner: R8.B.spec-13
  gwt_ref: R8.B.spec-13 GWT-1..5
```

### §3.4 影响半径

```yaml
impact_radius_feedback_3:
  total_new_loc: ~5000
  total_modified_loc: ~600
  total_test_loc: ~2300
  cross_layer_impact:
  - main: PopoutManager / FloatingWindowManager
  - renderer: PortCard / PopoutHost / FloatingPortView
  - shared: PopoutWindowSchema + SecurityTierSchema
  risk_level: medium
  parallelizable: yes (R8.A.09 与 R8.B 并行)
```

---

## §4 Feedback #4 — AI 任务感测误报 + 监控迟漏 + 缺监控/SKILL/CSV/codex/Watchdog/注入

### §4.1 用户原话与决策锚点

```yaml
feedback_id: feedback#4
user_quote: "感测仍误报/瞎报/错报 + 监控进度迟报漏报 + 缺监控窗口/SKILLS+CSV+codex/Watchdog/自动注入"
decision_anchors:
  - V1-Q-7.A.1: "B+D — 启发式 + 真实 CLI 输出"
  - V1-Q-7.A.4: "C — 三层状态机 system/task/ui"
  - V1-Q-7.A.5: "D — 用户透明度 + 调权"
  - V1-Q-7.B.1: "C — 启发式 + CLI 真实 + 置信度区间"
  - V1-Q-7.B.2: "Codex=D / Claude=C+D / Gemini=C+D / Cursor=B / Copilot=B"
  - V1-Q-7.B.3: "D — 独立 BrowserWindow 监控"
  - V1-Q-7.D.1: "D+E — SKILL YAML + Monaco 编辑器"
  - V1-Q-7.D.5: "D — 云同步占位（spec-38）"
  - V1-Q-7.E.3: "D — UI/Python/CLI 三启动"
  - V1-Q-7.E.5: "F — 默认并发 3"
  - V1-Q-7.F.1: "全选 9 项 — Watchdog 全监控"
  - V1-Q-7.F.3: "D — 默认 2min 心跳"
  - V1-Q-7.G.1: "全选 6 场景 — 自动注入全场景"
  - V1-Q-7.G.3: "D — 3s 倒计时确认"
  - V1-Q-7.J.3: "C — 60s 默认聚合"
  - V2-§15.A..F: AI 0 误报核心
```

### §4.2 解决 spec 列表（29 spec — R8.C 主战场）

```yaml
cli_parser_layer:  # 6 spec
  - R8.C.spec-01: cli-output-parser (4 策略框架)
  - R8.C.spec-02: shim-codex (D 路线)
  - R8.C.spec-03: shim-claude-stream-json (C+D 路线)
  - R8.C.spec-04: shim-gemini-stdout (C+D 路线)
  - R8.C.spec-05: cursor-copilot-detection (B 路线 窗口标题)
  - R8.C.spec-06: cli-detect-init (启动检测)

monitor_window_layer:  # 2 spec
  - R8.C.spec-07: monitor-window (独立 BrowserWindow)
  - R8.C.spec-08: monitor-window-popout (单工具卡浮窗)

skill_layer:  # 3 spec
  - R8.C.spec-09: skill-library-yaml (Anthropic Agent Skills 兼容)
  - R8.C.spec-10: skill-builtin-10 (10 内置)
  - R8.C.spec-11: skill-editor (Monaco)

csv_layer:  # 4 spec
  - R8.C.spec-12: csv-task-driver (papaparse + chokidar)
  - R8.C.spec-13: csv-schema-18cols (严格 18 列)
  - R8.C.spec-14: csv-launch-3way (UI/Python/CLI 三启动)
  - R8.C.spec-15: task-queue-better-queue (并发 3 默认)

watchdog_layer:  # 2 spec
  - R8.C.spec-16: watchdog-engine (9 项监控)
  - R8.C.spec-17: watchdog-subprocess (独立子进程)

inject_layer:  # 2 spec
  - R8.C.spec-18: auto-inject (6 场景 + 3s 倒计时)
  - R8.C.spec-19: auto-inject-targets (alias / ready-pool / csv-row)

dag_recording_layer:  # 4 spec
  - R8.C.spec-20: dag-orchestrator-graphlib
  - R8.C.spec-21: dag-visual-editor
  - R8.C.spec-22: task-recording
  - R8.C.spec-23: task-replay

signal_layer:  # 3 spec (核心 0 误报)
  - R8.C.spec-27: ai-signal-fusion-tuning (6+4 信号 + 透明度)
  - R8.C.spec-28: ai-state-machine-3layer (system/task/ui FSM)
  - R8.C.spec-29: feedback-loop-misreport (用户标定调权)

cross_cutting_supporting:  # 3 spec
  - R8.C.spec-30: notification-system (60s 聚合)
  - R8.C.spec-31: ipc-rate-limit
  - R8.C.spec-37: permissions-time-bounded
```

### §4.3 GWT 验收锚点（feedback#4 占 5/11 release gate）

```yaml
acceptance_gwt_feedback_4:
  - ASSERT_CLI_PROGRESS_REAL:
  test: "对每个 CLI（codex/claude/gemini/cursor）至少能输出一个真实进度数据点 in ≤ 30s"
  spec_owner: R8.C.spec-01..06
  gwt_ref: spec-01 GWT-1 (NDJSON) + spec-02 GWT-2 (codex marker) + spec-03 GWT-1 (claude stream) + spec-04 GWT-1 (gemini regex) + spec-05 GWT-1 (cursor title)
  - ASSERT_AI_DETECT_NO_FALSE_IDLE:
  test: "AI 任务运行中 5 分钟内不会出现 monitor_state == 'idle' 的瞬态误报"
  spec_owner: R8.C.spec-27 + spec-28
  gwt_ref: spec-27 GWT-1 (cli_parse 主导) + spec-28 GWT-2 (层间断言)
  - ASSERT_MONITOR_WINDOW_LIVE:
  test: "监控窗口 2s 默认刷新下，CSV 队列 + 实例进度 + Watchdog 状态 同步显示"
  spec_owner: R8.C.spec-07 + spec-08
  gwt_ref: spec-07 GWT-1/2 + spec-08 GWT-1
  - ASSERT_INJECT_TO_AI_INSTANCE:
  test: "CSV 启动 → DAG 调度 → 注入文本到 alias 实例 → 实例终端可见输入"
  spec_owner: R8.C.spec-12 + spec-15 + spec-18 + spec-19
  gwt_ref: spec-12 GWT-5 + spec-15 GWT-3 + spec-18 GWT-1..6 + spec-19 GWT-1..3
  - ASSERT_WATCHDOG_RESTART:
  test: "kill 一个 AI 实例 → 心跳超时（默认 120s）后重启 + 自动注入上下文"
  spec_owner: R8.C.spec-16 + spec-17 + spec-18
  gwt_ref: spec-16 GWT-1..3 + spec-17 GWT-2 + spec-18 GWT-2 (watchdog-restart-resume)
  - ASSERT_NOTIFICATION_AGGREGATION:
  test: "60s 内同一实例 5 条同级别通知聚合为 1 条"
  spec_owner: R8.C.spec-30
  gwt_ref: spec-30 GWT-2/3
  - misreport_user_correction:
  test: "用户标记误报后单次调权 ≤ 5%；reset 一键回 default"
  spec_owner: R8.C.spec-29
  gwt_ref: spec-29 GWT-1/3/4
```

### §4.4 影响半径

```yaml
impact_radius_feedback_4:
  total_new_loc: ~38000
  total_modified_loc: ~3500
  total_test_loc: ~12000
  cross_layer_impact:
  - main: 29 个新 service（cli-parser/shim/monitor/skill/csv/queue/watchdog/inject/dag/signal/state/feedback/notify）
  - renderer: 监控窗 + popout + skill editor + csv UI + DAG 编辑器 + 信号面板
  - shared: 30+ Zod schema (master §3.1..§3.7)
  risk_level: very high
  parallelizable: 受限（按 spec-dependency-graph 分波）
  release_gate_count: 6/11  # 占大半
```

---

## §5 Feedback #5 — 三套图必须附属 + 全局并存

### §5.1 用户原话与决策锚点

```yaml
feedback_id: feedback#5
user_quote: "原本设计的『打开资源后查看网络拓扑图和神经关系图』的设计消失了，这个设计要在进程、端口、窗口三端都得到应用，作为串联"
decision_anchors:
  - V1-Q-8.H.1: "A — 全局拓扑独立一级入口"
  - V1-Q-8.H.2: "10 — 附属拓扑深度上限"
  - V1-Q-11.A.3: "用户保留全屏拓扑（也保留附属）"
  - V2-§18.B/O/E..N: 三套图细节
  - master_section_7_8: "GRAPH-DUAL-EXISTENCE 硬约束"
```

### §5.2 解决 spec 列表

| batch | spec | 标题 | 主要交付 | LoC |
|---|---|---|---|---|
| R8.A | spec-05 | topology-discoverability | 三端入口贯通（顶部按钮+角标+Tab+Tour） | ~1300 |
| R8.C | spec-24 | topology-global-fullscreen | 全屏拓扑独立一级入口 | ~1700 |
| R8.C | spec-25 | topology-attached-deep10 | 附属拓扑深度 10 + 8-10 层 lazy | ~1600 |
| R8.C | spec-26 | flow-graph-attached-30min | 流程图附属（第三套体系，30min 默认窗口） | ~1500 |

### §5.3 GWT 验收锚点

```yaml
acceptance_gwt_feedback_5:
  - ASSERT_TOPOLOGY_DEPTH_10:
  test: "附属拓扑深度可设 10；8-10 层强制 lazy + 用户主动展开"
  spec_owner: R8.C.spec-25
  gwt_ref: spec-25 GWT-1/2/3 (深度 + lazy)
  - ASSERT_THREE_GRAPH_SYSTEMS:
  test: "网络拓扑 / 神经关系 / 流程图 三套图都有：全局一级入口 + 进程/端口/窗口三端附属嵌入"
  spec_owner: R8.C.spec-24 + spec-25 + spec-26 + master §7.8
  gwt_ref: spec-24 GWT-1/2 (全局) + spec-25 GWT-4 (三端附属) + spec-26 GWT-1/2 (流程图三端)
  - topology_first_glance_3s:  # 共用 feedback#2
  test: "进入任意进程/端口/窗口详情，3s 内可见三套图入口"
  spec_owner: R8.A.spec-05 + R8.C.spec-24/25/26
  gwt_ref: R8.A.spec-05 GWT-1..5
```

### §5.4 影响半径

```yaml
impact_radius_feedback_5:
  total_new_loc: ~6100
  total_modified_loc: ~700
  total_test_loc: ~2800
  cross_layer_impact:
  - main: TopologyGraphService 单例 (master §7.8) + FlowGraphService
  - renderer: 三种 GraphView（network/neural/flow）+ scope 投影
  - shared: GraphKindSchema + NetworkTopologyEdgeSchema + NeuralRelationshipEdgeSchema + FlowEdgeSchema + GraphScopeSchema (master §3.6)
  risk_level: high (双存在性 + 单例投影实现)
  parallelizable: 部分 (R8.A.05 与 R8.C.24/25/26 可并行；24/25/26 共享 schema 必须先冻结)
```

---

## §6 反馈 × ASSERT_* 矩阵（machine-readable）

```yaml
feedback_to_assert_matrix:
  feedback#1:
  - ASSERT_THEME_NON_COLOR_DELTA
  feedback#2:
  - ASSERT_PROCESS_FIELD_PARITY
  - ASSERT_TOPOLOGY_FIRST_GLANCE
  feedback#3:
  - ASSERT_PORT_PANEL_BREATHING_ROOM
  feedback#4:
  - ASSERT_CLI_PROGRESS_REAL
  - ASSERT_AI_DETECT_NO_FALSE_IDLE
  - ASSERT_MONITOR_WINDOW_LIVE
  - ASSERT_INJECT_TO_AI_INSTANCE
  - ASSERT_WATCHDOG_RESTART
  - ASSERT_NOTIFICATION_AGGREGATION
  feedback#5:
  - ASSERT_TOPOLOGY_DEPTH_10
  - ASSERT_THREE_GRAPH_SYSTEMS

shared_horizontal_asserts:  # 不直接对应单一反馈但全局必过
  - ASSERT_NO_TELEMETRY:  # 横切隐私
  spec_owner: R8.C.spec-32 + spec-36
  - ASSERT_ZOD_SINGLE_SOURCE:  # 横切契约
  spec_owner: R8.C.spec-33
  - ASSERT_DIAGNOSTIC_PACK_OPT_IN:  # 横切隐私
  spec_owner: R8.C.spec-36
```

---

## §7 反馈优先级与上线节奏

```yaml
release_priority_per_feedback:
  P0_must_in_first_release:
  - feedback#2: 进程权限 + 字段对齐 + 拓扑入口（R8.A 必过）
  - feedback#4 partial: CLI parser + monitor + 信号融合（R8.C 第一/二波）
  - feedback#5: 三套图体系（R8.A.05 + R8.C.24/25/26）

  P1_in_first_release:
  - feedback#1: 主题 4 维 + drawer + grid（R8.A.06/07 + R8.B.03/05/07/08）
  - feedback#3: popout 系统（R8.B.01/02 + R8.A.09）

  P2_can_defer_to_R8_late:
  - feedback#4 deep: SKILL editor + DAG editor + 任务录像
```

---

## §8 反馈追溯链路（PR 引用规范）

```yaml
pr_reference_chain:
  example_for_feedback_4:
  commit_message: |
  feat(R8.C.spec-27): 加权信号融合（cli_parse 0.8）

  解决 feedback#4 的 4 个子点之一：误报根因
  - 替代旧 6 信号等权融合（V2-§15.A 答案）
  - 输出 SignalContribution 透明度（V1-Q-7.A.5 答 D）
  - 关联 ASSERT_AI_DETECT_NO_FALSE_IDLE
  - 影响 LoC: +750/-150
  pr_body_must_include:
  - 反馈 ID: feedback#4
  - 决策锚点: V1-Q-7.A.5 答 D
  - ASSERT 关联: ASSERT_AI_DETECT_NO_FALSE_IDLE
  - GWT 引用: spec-27 GWT-1/3
  - 依赖 spec: spec-33 (zod sot) / spec-31 (rate limit)
```

---

## §9 反馈未覆盖项（缺口报告）

```yaml
gaps_identified:
  - none_at_present:
  reason: "5 大反馈每条都至少 1 个 ASSERT + ≥ 4 个 spec 直接关联"
  potential_future:
  - performance_under_1000_processes:
  not_in_R8: yes
  defer_to: R9
  spec_placeholder: 待规划
  - mobile_app_remote_control:
  not_in_R8: yes
  defer_to: R10+
  spec_placeholder: 不在路线图
```

---

## §10 Sign-off

```yaml
sign_off:
  produced_by: prd-writer agent
  produced_at: 2026-05-03
  basis_documents:
  - 00-r8-master-prd.md §8 (5 反馈直接回应表)
  - R8.A/prd.md §perception_assertions
  - R8.B/prd.md §perception_assertions
  - R8.C/prd.md §5 ASSERT_* + §6 GWT_R8C
  - 67 spec 的 §6 acceptance_gwt
  cross_check:
  - 每反馈 ≥ 1 ASSERT_*: PASS (5/5)
  - 每反馈 ≥ 4 spec: PASS (min=4 for feedback#5, max=29 for feedback#4)
  - 每 ASSERT 有 spec_owner: PASS (11/11)
  next_action:
  - implementation agents 按本表选 spec
  - QA 按本表设计回归套件
  - team-lead 按 release_priority 节奏分配人力
```
