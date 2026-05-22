# R8 测试策略矩阵（testing-strategy.md）

> **生成时间**: 2026-05-03
> **数据源**: 4 PRD（master + R8.A/B/C）+ 67 spec 全量提取（§6 acceptance_gwt + §7 e2e_playwright_draft + §13 performance_budget）
> **范围**: 71 文件 = 4 PRD + 11 R8.A spec + 17 R8.B spec + 39 R8.C spec
> **目标**: 单一来源说明 R8 整批"如何验收"，CI/CD 直接消费
> **签名**: ZRainbow 2026-05-03

---

## §0 文档地位与读法

```yaml
position: 跨 batch 的 SoT（Source of Truth）—— 任何测试代码、CI 配置、PR review 必须以本文为准
machine_actionable: yes
naming_convention:
  - 验收断言 ID: ASSERT_<UPPER_SNAKE>  # 来自 master §11
  - 单条 GWT: <SPEC_ID>-GWT-<N>  # 例：R8.C.spec-15-GWT-2
  - 性能门禁: <SPEC_ID>-PERF-<METRIC>  # 例：R8.A.spec-02-PERF-light_p95_ms
referenced_specs: 4 PRD + 67 spec
authoritative_for:
  - CI/CD 的 release-gate（§5）
  - 单元/集成/e2e 覆盖率目标（§1）
  - 性能基线监控点（§4）
  - GWT/Scenario 索引（§2）
  - Playwright 场景导出（§3）
  - 夹具与 mock 数据（§6）

read_priorities:
  ci_engineer: §5 + §3 + §4
  qa: §2 + §3 + §6
  dev: §1 + §6 + §2 限定本 spec
  release_manager: §5 + §7
```

---

## §1 测试覆盖率目标（test-pyramid）

```yaml
pyramid:
  unit_test:
  framework: vitest@1.x
  threshold:
  lines_pct: 80  # R8 整批
  branches_pct: 75
  functions_pct: 85
  statements_pct: 80
  scope:
  - main process services（services/**/*.ts，每文件配套 *.test.ts）
  - shared schemas（Zod 派生 + 边界值）
  - renderer pure logic（hooks / utils / store）
  excludes:
  - "*.tsx UI render"  # 走 storybook + playwright
  - "**/index.ts barrel"
  - "**/types-only.ts"
  fail_fast: yes  # Zod schema 校验失败 → 进程退出码 != 0
  estimated_count: ~2400 cases
  integration_test:
  framework: vitest + electron mock + better-sqlite3 in-memory
  scope:
  - IPC channel 完整链路（renderer ↔ main，mock electron.ipcRenderer）
  - SQLite repository（spec-15 task / spec-19 whitelist / spec-22 recording 等 8 处持久化）
  - 跨 service 协同（如 spec-15 task-queue → spec-18 inject → spec-22 recording）
  threshold:
  ipc_channels_covered_pct: 100  # master §7.2 列出的所有 channel
  schema_round_trips_pct: 100  # spec-33 Zod SoT 双向校验
  estimated_count: ~600 cases
  e2e_test:
  framework: '@playwright/test@1.49 + electron driver'
  scope:
  - 11 ASSERT 断言（master §11）
  - 每 spec §7 e2e_playwright_draft 派生用例
  - 5 句人话端到端旅程（master §11 + R8.A/B/C §5.2）
  threshold:
  assert_pass_rate: 100  # 24 断言（5 R8.A + 8 R8.B + 11 R8.C）必过
  flake_rate_max_pct: 1
  runtime_budget_minutes:
  smoke: 8
  regression_full: 45
  24h_long_run: 1440
  estimated_count: ~280 cases
  smoke_test:
  framework: playwright tagged @smoke
  scope: 启动 + 三大模块（process/port/window）首屏 + 命令面板 + 监控窗口
  runtime_budget_minutes: 8
  triggered_on: [PR push, nightly]
  estimated_count: 32
  regression_test:
  framework: playwright tagged @regression
  scope: R7 既有功能 + 5 大反馈断言（master §8）
  fail_action: BLOCK_MERGE
  estimated_count: 64
  perf_test:
  framework: playwright + @playwright/test perf API + clinic.js
  scope: master §7.4 + 各 spec §13 性能预算所有监控点
  schedule: nightly + PR if files in performance-sensitive paths
  estimated_count: 120 metrics
  long_run_test:
  framework: bash + electron 自启动 + audit log 解析
  scope: V1-Q-1.D.4 24h 长跑基线
  threshold:
  main_rss_mb_warn: 600
  main_rss_mb_fatal: 800
  memory_growth_24h_pct: 5  # 主进程 RSS 24h 增长 ≤ 5%
  no_zombie_subprocess: yes
  no_unhandled_rejection: yes
  triggered_on: [release-candidate, weekly]
```

---

## §2 GWT/Scenario 验收清单（按 spec 索引）

> 67 spec 的 §6 acceptance_gwt 全量索引。R8.A 用 Gherkin Scenario，R8.B 用编号 A1..AN，R8.C 用 GWT-1..N，统一以 `<SPEC_ID>-GWT-<N>` 命名。

### §2.1 R8.A（11 spec / ~70 scenarios）

| spec | scenarios | 必过断言 | 核心验收点 |
|---|---|---|---|
| spec-01-integration-libs | 8 | — | 30+ 库 license MIT/ISC/BSD/Apache-2.0/MPL-2.0 通过；adapter 启用 + flag OFF 退化 |
| spec-02-process-unified-vm | 6 | — | light/deep envelope；source 字段记录每字段降级 |
| spec-03-process-uac-elevation | 6 | — | 单次 UAC + sha256(exe_path+field_category) 缓存；24h 失效 |
| spec-04-process-card-list-parity | 6 | **ASSERT_PROCESS_FIELD_PARITY** | 卡片/列表 [data-vm-field] 集合完全一致 |
| spec-05-topology-discoverability | 7 | **ASSERT_TOPOLOGY_FIRST_GLANCE** | 三端入口（顶部按钮 + 子 Tab + 卡片角标）≥ 2 入口可见 |
| spec-06-theme-4d-axis-exposure | 6 | **ASSERT_THEME_NON_COLOR_DELTA** | 4 维轴（palette/density/radius/motion）独立可调；切换 < 250ms |
| spec-07-theme-default-distance | 5 | — | 21 主题对加权距离 ≥ 0.4，启动 fail-fast |
| spec-08-window-always-on-top | 6 | **ASSERT_ALWAYS_ON_TOP_FUNCTIONAL** | UI 调用 windowHandlers:424 真生效；多屏 fallback |
| spec-09-port-card-improvement | 6 | **ASSERT_PORT_PANEL_BREATHING_ROOM** | height ≥ 96px，gap ≥ 8px |
| spec-10-audit-log | 7 | — | append-only + AES-256-GCM 可选；REDACT_PATTERNS 全过 |
| spec-11-permission-prompts | 7 | — | 16 dangerous actions 矩阵；critical 必输 'yes'；24h/permanent 选项 |

### §2.2 R8.B（17 spec / ~340 scenarios）

| spec | scenarios | 必过断言 | 核心验收点 |
|---|---|---|---|
| spec-01-port-popout-system | 33 | **ASSERT_PORT_POPOUT_TRIGGERS_4** | 4 入口（hover/click/cmdk/快捷键）触发 popout |
| spec-02-port-floating-window | 20 | **ASSERT_BROWSERWINDOW_SECOND_DISPLAY** | BrowserWindow 跨屏在第二显示器内 |
| spec-03-drawer-system-top-right-bot | 20 | **ASSERT_DRAWER_5_SLOTS** | 5 槽（top/right/bot/left/center）布局齐全 |
| spec-04-command-palette-cmdk | 21 | **ASSERT_COMMAND_PALETTE_5_SCOPES** | 5 组（最近/命令/跳转/AI/设置）+ fuzzy < 16ms |
| spec-05-dashboard-grid-layout | 21 | — | grid 布局保存/恢复；持久化 P95 < 50ms |
| spec-06-process-treemap-tree | 20 | **ASSERT_PROCESS_TREEMAP_RSS_PROPORTIONAL** | treemap 节点面积与 RSS 成正比 |
| spec-07-theme-decorations-extend | 20 | **ASSERT_THEME_DECORATION_8_PLUS_CUSTOM** | 8 内置装饰 + 用户上传 SVG（DOMPurify 过滤） |
| spec-08-statusbar-extension | 20 | **ASSERT_STATUSBAR_AGGREGATE_BADGES** | 状态栏聚合徽章合计 < 200ms 渲染 |
| spec-09-window-thumbnail-wall | 20 | **ASSERT_THUMBNAIL_WALL_GROUP_KEY** | 缩略图按 group_key（cwd/exe/title）正确分组 |
| spec-10-window-batch-ops | 20 | — | 多选 + 批量关 + 二次确认 |
| spec-11-window-virtual-desktop | 20 | — | IVirtualDesktopManager 可用时显示 vd ID |
| spec-12-process-batch-ops | 20 | — | 多选 PID + 每条单独二次确认（防误杀） |
| spec-13-port-security-tier-banner | 23 | — | Local/LAN/WAN/Suspicious 4 档配色一致 |
| spec-14-process-tags-history | 20 | — | 标签持久化 + 历史曲线（最近 24h） |
| spec-15-i18n-scaffold | 21 | — | i18next 仅作用新模块，hardcoded 中文保留 |
| spec-16-a11y-full | 20 | — | WCAG AA 对比度 + 键盘导航 + screen reader |
| spec-17-icon-library-mix | 25 | — | 4 套图标 tree-shake 后总 bundle ≤ 8MB |

### §2.3 R8.C（39 spec / ~265 GWT）

| spec | gwts | 必过断言 | 核心验收点 |
|---|---|---|---|
| spec-01-cli-output-parser | 5 | **ASSERT_CLI_PROGRESS_REAL** | 4 策略（NDJSON/SHIM/line/SSE）+ CliEvent 5 类 |
| spec-02-shim-codex | 5 | (同上) | DevHub 控制 codex 进程 stdio |
| spec-03-shim-claude-stream-json | 5 | (同上) | --output-format=stream-json + SHIM 双路 |
| spec-04-shim-gemini-stdout | 5 | (同上) | gemini stdout + SHIM 双信号 |
| spec-05-cursor-copilot-detection | 5 | (同上) | 窗口标题 + chokidar 文件监听互补 |
| spec-06-cli-detect-init | 5 | (同上) | CLI 自动检测 + 引导初始化 |
| spec-07-monitor-window | 5 | **ASSERT_MONITOR_WINDOW_LIVE** | Tab 子面板 + popout，2s 默认刷新 |
| spec-08-monitor-window-popout | 5 | (同上) | 独立 BrowserWindow + reconnect backoff |
| spec-09-skill-library-yaml | 5 | — | 兼容 Anthropic Agent Skills frontmatter |
| spec-10-skill-builtin-10 | 5 | — | 10 内置 SKILL（评审/测试/重构/...） |
| spec-11-skill-editor | 5 | — | Monaco + 实时预览 + 变量校验 |
| spec-12-csv-task-driver | 5 | **ASSERT_INJECT_TO_AI_INSTANCE** | CSV 主框架 |
| spec-13-csv-schema-18cols | 5 | (同上) | 18 列 Zod schema |
| spec-14-csv-launch-3way | 6 | (同上) | UI/Python/CLI 三路启动；metadata runner 字段 |
| spec-15-task-queue-better-queue | 8 | (同上) | better-queue + DAG 拓扑 + parallel_group + resume |
| spec-16-watchdog-engine | 8 | **ASSERT_WATCHDOG_RESTART** | 9 项功能 + 多通道心跳 + 风暴防护 |
| spec-17-watchdog-subprocess | 6 | (同上) | InnerWatchdog 子进程 + sessionToken 握手 + 三通道 |
| spec-18-auto-inject | 8 | **ASSERT_INJECT_TO_AI_INSTANCE** | 6 场景 × 4 mode；mode fallback 链 |
| spec-19-auto-inject-targets | 9 | (同上) | 4 selector + 白名单 + 倒计时 + 严格模式 |
| spec-20-dag-orchestrator-graphlib | 9 | — | 拓扑分层 + Tarjan 环检测 + CPM 关键路径 |
| spec-21-dag-visual-editor | 8 | — | 4 视图同步 + cytoscape + immer undo/redo |
| spec-22-task-recording | 9 | — | 5 类 stream + LRU 50GB + asciinema 兼容 |
| spec-23-task-replay | 8 | — | 5 轨同步游标 + speed 0.25-8x |
| spec-24-topology-global-fullscreen | 8 | **ASSERT_THREE_GRAPH_SYSTEMS** | 5 入口 + 三 graphKind 平级 |
| spec-25-topology-attached-deep10 | 9 | **ASSERT_TOPOLOGY_DEPTH_10** | 三端附属 + 10 层 + 8-10 lazy |
| spec-26-flow-attached | 9 | **ASSERT_THREE_GRAPH_SYSTEMS** | 30min 默认 + 时间游标 |
| spec-27-ai-signal-fusion-tuning | 5 | **ASSERT_AI_DETECT_NO_FALSE_IDLE** | 6+4 信号源 + 权重透明度 |
| spec-28-ai-state-machine-3layer | 5 | (同上) | 系统/任务/UI 三层 + 跨层断言 |
| spec-29-feedback-loop-misreport | 5 | (同上) | V2-§13 6 类误报分类 |
| spec-30-notification-system | 5 | **ASSERT_NOTIFICATION_AGGREGATION** | 60s 默认聚合 + 5s-10min 可调 |
| spec-31-ipc-rate-limit | 5 | — | 4 桶 token bucket（high/medium/low/meta） |
| spec-32-observability-panel | 5 | — | snapshot p95 < 200ms + ringBuffer |
| spec-33-zod-source-of-truth | 5 | **ASSERT_ZOD_SINGLE_SOURCE** | schema → TS 推导 + migration 字段 |
| spec-34-crash-recovery | 5 | — | 脏状态检测 + 10 状态保存 |
| spec-35-backup-restore | 5 | — | 整体 + 分类备份 |
| spec-36-diagnostic-pack-export | 5 | **ASSERT_DIAGNOSTIC_PACK_OPT_IN** | 用户主动一键 + 脱敏预览 |
| spec-37-permissions-time-bounded | 5 | — | 24h/permanent 时效 + scope 范围 |
| spec-38-skill-cloud-sync-deferred | 5 | — | 占位（R9 实现），调用必返回 deferred |
| spec-39-ocr-interface-disabled | 5 | — | 接口必返回 E_OCR_DISABLED；CI grep 禁止 import |

### §2.4 必过断言索引（24 项 = 5 R8.A + 8 R8.B + 11 R8.C）

```yaml
must_pass_R8A_before_R8B:
  - ASSERT_PROCESS_FIELD_PARITY  # spec-04
  - ASSERT_TOPOLOGY_FIRST_GLANCE  # spec-05
  - ASSERT_THEME_NON_COLOR_DELTA  # spec-06
  - ASSERT_ALWAYS_ON_TOP_FUNCTIONAL  # spec-08
  - ASSERT_PORT_PANEL_BREATHING_ROOM  # spec-09

must_pass_R8B_before_R8C:
  - ASSERT_PORT_POPOUT_TRIGGERS_4  # R8.B spec-01
  - ASSERT_BROWSERWINDOW_SECOND_DISPLAY  # R8.B spec-02
  - ASSERT_DRAWER_5_SLOTS  # R8.B spec-03
  - ASSERT_COMMAND_PALETTE_5_SCOPES  # R8.B spec-04
  - ASSERT_THUMBNAIL_WALL_GROUP_KEY  # R8.B spec-09
  - ASSERT_PROCESS_TREEMAP_RSS_PROPORTIONAL # R8.B spec-06
  - ASSERT_THEME_DECORATION_8_PLUS_CUSTOM  # R8.B spec-07
  - ASSERT_STATUSBAR_AGGREGATE_BADGES  # R8.B spec-08

must_pass_R8C_before_release:
  - ASSERT_CLI_PROGRESS_REAL  # R8.C spec-01..06
  - ASSERT_AI_DETECT_NO_FALSE_IDLE  # R8.C spec-27..29
  - ASSERT_MONITOR_WINDOW_LIVE  # R8.C spec-07/08
  - ASSERT_INJECT_TO_AI_INSTANCE  # R8.C spec-12+15+18+19
  - ASSERT_WATCHDOG_RESTART  # R8.C spec-16/17/18
  - ASSERT_TOPOLOGY_DEPTH_10  # R8.C spec-25
  - ASSERT_THREE_GRAPH_SYSTEMS  # R8.C spec-24/25/26
  - ASSERT_NOTIFICATION_AGGREGATION  # R8.C spec-30
  - ASSERT_NO_TELEMETRY  # R8.C spec-32/36
  - ASSERT_ZOD_SINGLE_SOURCE  # R8.C spec-33
  - ASSERT_DIAGNOSTIC_PACK_OPT_IN  # R8.C spec-36

fail_protection:
  on_any_assertion_fail:
  action: PAUSE_NEXT_BATCH
  follow_up: RCA + 用户对话重新评审需求表
  rollback: feature_flag_OFF preferred over git revert（V1-Q-11.D.2 答 C）
```

---

## §3 Playwright e2e 测试导出（按场景分组）

> 每个 spec 的 §7 e2e_playwright_draft 已含起步代码；本节按 5 个用户旅程分组，CI 用 tag 选择性运行。

### §3.1 旅程 J1 — "我跑一次 AI CSV 批次"（R8.C 主线）

```yaml
journey: J1-csv-task-end-to-end
tag: '@journey-csv'
steps:
  - 启动 DevHub（R8.A spec-01 集成库 boot）
  - 命令面板（R8.B spec-04）→ "新建 CSV 批次"
  - DAG 编辑器（R8.C spec-21）打开模板 + 拖入 5 任务
  - 检查 cycle 高亮（spec-20 + spec-21 GWT-3）
  - 保存 → CSV launch wizard（spec-14）选 runner=devhub
  - task-queue（spec-15）按 DAG 调度
  - 自动注入（spec-18/19）到 alias='claude-devhub'
  - 监控窗口（spec-07）2s 内显示真实进度
  - 录像（spec-22）5 类 stream 启动
  - 任务完成 → 通知聚合（spec-30）
  - 回放（spec-23）5 轨同步
must_pass_assertions:
  - ASSERT_INJECT_TO_AI_INSTANCE
  - ASSERT_MONITOR_WINDOW_LIVE
  - ASSERT_CLI_PROGRESS_REAL
expected_runtime_minutes: 12
```

### §3.2 旅程 J2 — "我手动 kill AI 实例，看 Watchdog 自愈"

```yaml
journey: J2-watchdog-self-heal
tag: '@journey-watchdog'
steps:
  - 启动 codex 实例 alias='codex-1'
  - InnerWatchdog（spec-16/17）注册 instance
  - taskkill /F /PID <pid>
  - 三通道（pipe/tcp/marker）检测心跳超时
  - 120s ± 5s 内 actionPolicy='restart'
  - 重启实例 + InjectScenario='watchdog-restart-resume'
  - 通知 WARN "Watchdog 介入"
  - 状态机三层（spec-28）记录 state-flip
  - 反馈循环（spec-29）记一条事件
must_pass_assertions:
  - ASSERT_WATCHDOG_RESTART
expected_runtime_minutes: 4
```

### §3.3 旅程 J3 — "我看进程的三套关系图"

```yaml
journey: J3-three-graph-systems
tag: '@journey-topology'
steps:
  - 打开 PID=1234 详情面板
  - 点击"关系图" Tab（spec-25）
  - 切 graphKind: network-topology / neural-relationship / flow（spec-25/26）
  - depth=3 → 拖到 10（lazy 模式启动）
  - 双击节点 lazy expand（spec-25 GWT-4）
  - 顶级"全局拓扑"入口（spec-24 一级图标 / cmdk / Ctrl+T）
  - 全局视图选中节点 → 跳回详情面板（双向同步）
must_pass_assertions:
  - ASSERT_TOPOLOGY_DEPTH_10
  - ASSERT_THREE_GRAPH_SYSTEMS
expected_runtime_minutes: 6
```

### §3.4 旅程 J4 — "我导出诊断包"

```yaml
journey: J4-diagnostic-pack
tag: '@journey-diagnostic'
steps:
  - 打开设置面板 → 诊断包导出（spec-36）
  - 预览脱敏内容
  - 一键导出 ZIP
  - 内容校验：logs/ + audit/ + settings.redacted.json + screenshots/ + system-info.json
  - API_KEY/TOKEN/PASSWORD 全部 *** 替换
  - 跑 30min 抓包验证（无任何外部域名出站）
must_pass_assertions:
  - ASSERT_DIAGNOSTIC_PACK_OPT_IN
  - ASSERT_NO_TELEMETRY
expected_runtime_minutes: 35
```

### §3.5 旅程 J5 — "我换主题 / 收纳 popout / 用命令面板"

```yaml
journey: J5-experience-shell
tag: '@journey-shell'
steps:
  - 4 维主题轴（R8.A spec-06）切换；motion=high → 启用 view-transition
  - 主题距离断言（spec-07）≥ 0.4
  - cmdk 命令面板 5 组 + URI 跳转 devhub://port/3000（R8.B spec-04）
  - drawer 5 槽（R8.B spec-03）切换
  - port popout 4 触发器（R8.B spec-01）
  - BrowserWindow 第二屏（R8.B spec-02）
must_pass_assertions:
  - ASSERT_THEME_NON_COLOR_DELTA
  - ASSERT_DRAWER_5_SLOTS
  - ASSERT_COMMAND_PALETTE_5_SCOPES
  - ASSERT_PORT_POPOUT_TRIGGERS_4
  - ASSERT_BROWSERWINDOW_SECOND_DISPLAY
expected_runtime_minutes: 10
```

### §3.6 通用 Playwright 配置

```yaml
config:
  electron_driver: '@playwright/test 1.49 + electronApp.evaluate'
  timeout_ms_default: 30000
  workers: 4  # 并行 e2e
  retries_on_ci: 2
  fixtures_path: 'tests/e2e/fixtures/'
  artifacts_path: 'tests/e2e/artifacts/'
  trace: 'on-first-retry'
  video: 'retain-on-failure'
  screenshot: 'only-on-failure'
tagging:
  '@smoke': 启动 + 三大模块首屏（5 case）
  '@regression': 5 大反馈断言（24 case）
  '@journey-*': 5 个用户旅程
  '@critical': 11 release-gate 断言子集
  '@long-run': 24h 基线
```

---

## §4 性能预算监控点（按 spec §13 汇总）

> 67 spec 各自的 §13 performance_budget + master §7.4 全局预算合并。CI 必须在 nightly perf 中校验所有监控点。

### §4.1 全局预算（master §7.4 引用）

```yaml
global:
  main_process_rss_mb: { warn: 600, fatal: 800 }  # V1-Q-1.D.1
  main_process_cpu_idle_pct: { warn: 5, fatal: 10 }  # V1-Q-1.D.3
  renderer_rss_mb: { warn: 800, fatal: 1024 }  # V1-Q-1.D.2
  renderer_cpu_active_pct: { warn: 15, fatal: 30 }
  ipc_rpm:
  high_freq_scan: 30
  medium_query: 60
  low_freq_op: 120
  meta: 600
  long_run_hours: 24  # V1-Q-1.D.4
  child_process_max: 10  # V1-Q-1.D.5
  scanner_cache_ttl_minutes: 60  # V1-Q-1.E.1
```

### §4.2 R8.A 预算监控点（11 spec）

| spec | metric | warn | fatal |
|---|---|---|---|
| spec-01 | bundle_size_mb_total | 24 | 32 |
| spec-02 | process:vm:get-light_p95_ms | 80 | 200 |
| spec-02 | process:vm:get-deep_p95_ms | 400 | 1500 |
| spec-03 | uac_spawn_p95_seconds | 3 | 8 |
| spec-04 | view_swap_p95_ms | 80 | 300 |
| spec-05 | topology_entry_first_glance_ms | 200 | 800 |
| spec-06 | theme_axis_switch_p95_ms | 80 | 250 |
| spec-07 | theme_distance_min | ≥ 0.4 | < 0.4 fail-fast |
| spec-08 | aot_toggle_p95_ms | 30 | 100 |
| spec-09 | port_card_render_p95_ms_per_50_cards | 80 | 200 |
| spec-10 | audit_write_p99_ms | 5 | 20 |
| spec-11 | permission_prompt_render_p95_ms | 50 | 200 |

### §4.3 R8.B 预算监控点（17 spec）

| spec | metric | warn | fatal |
|---|---|---|---|
| spec-01 | popout_open_p95_ms | 80 | 250 |
| spec-02 | browserwindow_handoff_p95_ms | 200 | 800 |
| spec-03 | drawer_animate_p95_ms | 100 | 400 |
| spec-04 | cmdk_first_result_p99_ms | 16 | 80 |
| spec-05 | grid_save_p95_ms | 50 | 200 |
| spec-06 | treemap_render_p95_ms_per_500 | 200 | 800 |
| spec-07 | decoration_apply_p95_ms | 80 | 250 |
| spec-08 | statusbar_aggregate_render_p95_ms | 50 | 200 |
| spec-09 | thumbnail_wall_render_p95_ms_per_100 | 300 | 1000 |
| spec-10/12 | batch_op_confirm_dialog_p95_ms | 100 | 300 |
| spec-11 | virtual_desktop_query_p95_ms | 80 | 300 |
| spec-13 | port_tier_classify_p99_ms | 5 | 20 |
| spec-14 | tag_history_write_p99_ms | 8 | 30 |
| spec-15 | i18n_load_p95_ms | 50 | 200 |
| spec-16 | a11y_screenreader_announce_p95_ms | 100 | 400 |
| spec-17 | icon_bundle_total_mb | 8 | 12 |

### §4.4 R8.C 预算监控点（39 spec）

| spec | metric | warn | fatal |
|---|---|---|---|
| spec-01 | parse_lines_per_sec | 1000 | 200 (反向) |
| spec-01 | parse_chunk_p99_ms | 5 | 20 |
| spec-02..05 | shim_overhead_p95_ms | 20 | 80 |
| spec-06 | cli_detect_p95_seconds | 5 | 15 |
| spec-07 | monitor_window_refresh_ms | 2000 default | 5000 |
| spec-08 | popout_reconnect_p95_seconds | 5 | 30 |
| spec-09..11 | skill_load_p95_ms | 100 | 500 |
| spec-12..15 | csv_parse_p95_ms_per_100_rows | 200 | 1000 |
| spec-14 | launch_to_first_task_start_ms (devhub) | 800 | 2500 |
| spec-14 | launch_to_first_task_start_ms (python) | 2500 | 8000 |
| spec-15 | enqueue_p95_ms_per_row | 5 | 30 |
| spec-15 | sqlite_write_p95_ms | 3 | 20 |
| spec-15 | topo_sort_p95_ms_per_500_nodes | 80 | 300 |
| spec-16 | heartbeat_collect_p95_ms_per_instance | 30 | 100 |
| spec-16 | watchdog_default_timeout_ms | 120000 | — |
| spec-16 | restart_storm_max_per_hour | 5 | — |
| spec-17 | spawn_inner_watchdog_p95_ms | 1500 | 4000 |
| spec-17 | mutual_heartbeat_interval_ms | 5000 | — |
| spec-18 | inject_csv_to_terminal_p95_ms | 800 | 2500 |
| spec-18 | inject_chunk_size_bytes | 8192 | — |
| spec-19 | target_resolve_p95_ms | 50 | 200 |
| spec-20 | dag_build_p95_ms_per_100_nodes | 30 | 200 |
| spec-20 | cycle_detect_p95_ms_per_500_nodes | 50 | 200 |
| spec-21 | canvas_render_p95_ms_per_100_nodes | 200 | 800 |
| spec-22 | recording_start_p95_ms | 200 | 1000 |
| spec-22 | screenshot_default_interval_ms | 10000 | — |
| spec-23 | cursor_seek_p95_ms | 200 | 800 |
| spec-23 | speed_8x_cpu_pct | 30 | 60 |
| spec-24 | build_global_p95_ms | 2000 | 5000 |
| spec-24 | graph_node_max_default | 500 | — |
| spec-25 | attached_build_p95_ms | 800 | 2000 |
| spec-25 | depth_max | 10 | — |
| spec-26 | build_30min_p95_ms | 800 | 3000 |
| spec-26 | flow_node_max | 500 | — |
| spec-27 | ai_signal_fusion_latency_ms | 100 | 500 |
| spec-28 | three_layer_state_step_p99_ms | 50 | 200 |
| spec-29 | feedback_classify_p99_ms | 30 | 100 |
| spec-30 | notification_render_ms | 50 | 200 |
| spec-30 | aggregation_window_ms_default | 60000 | — |
| spec-31 | token_bucket_check_p99_ms | 1 | 5 |
| spec-32 | observability_snapshot_p95_ms | 200 | 1000 |
| spec-33 | zod_validate_p99_ms_per_schema | 1 | 5 |
| spec-34 | crash_recovery_detect_p95_seconds | 5 | 20 |
| spec-35 | backup_create_p95_seconds | 30 | 120 |
| spec-36 | diagnostic_pack_export_p95_seconds | 30 | 120 |
| spec-37 | permission_eval_p99_ms | 5 | 20 |

### §4.5 性能门禁规则

```yaml
gating:
  ci_pr_perf:
  trigger: 修改了 services/** 或 components/** 文件
  metrics_run: PR 路径相关 spec（按文件 ↔ spec 映射）
  fail_action: BLOCK_MERGE 当任意 metric 超 fatal
  warn_action: 评论 PR + 不阻塞
  ci_nightly_perf:
  trigger: cron 0 2 * * *（02:00 UTC）
  metrics_run: 全部 §4.1-§4.4 监控点
  fail_action: 通知 @oncall + 创建 issue（不阻塞 dev）
  release_gate:
  trigger: 准备发版 tag
  metrics_run: 全部 + 24h long-run
  fail_action: 阻塞 release
```

---

## §5 CI/CD 验收门禁（断言列表）

```yaml
ci_pipeline_stages:
  stage_1_compile:
  name: build & typecheck
  commands:
  - pnpm install --frozen-lockfile
  - pnpm typecheck  # tsc strict mode 0 errors
  - pnpm lint  # ESLint + Prettier
  fail_action: BLOCK_MERGE
  estimated_minutes: 4

  stage_2_unit:
  name: unit tests
  commands: ['pnpm test:unit -- --run --coverage']
  threshold:
  lines_pct: 80
  branches_pct: 75
  fail_action: BLOCK_MERGE
  estimated_minutes: 6

  stage_3_integration:
  name: integration tests
  commands: ['pnpm test:integration -- --run']
  threshold:
  ipc_channels_covered_pct: 100
  fail_action: BLOCK_MERGE
  estimated_minutes: 8

  stage_4_smoke:
  name: smoke e2e
  commands: ['pnpm test:e2e -- --grep "@smoke"']
  threshold:
  flake_rate_max_pct: 1
  fail_action: BLOCK_MERGE
  estimated_minutes: 8

  stage_5_assert_critical:
  name: 24 critical assertions（merge 前必过）
  commands: ['pnpm test:e2e -- --grep "@critical"']
  must_pass:
  r8a:
  - ASSERT_PROCESS_FIELD_PARITY
  - ASSERT_TOPOLOGY_FIRST_GLANCE
  - ASSERT_THEME_NON_COLOR_DELTA
  - ASSERT_ALWAYS_ON_TOP_FUNCTIONAL
  - ASSERT_PORT_PANEL_BREATHING_ROOM
  r8b:
  - ASSERT_PORT_POPOUT_TRIGGERS_4
  - ASSERT_BROWSERWINDOW_SECOND_DISPLAY
  - ASSERT_DRAWER_5_SLOTS
  - ASSERT_COMMAND_PALETTE_5_SCOPES
  - ASSERT_THUMBNAIL_WALL_GROUP_KEY
  - ASSERT_PROCESS_TREEMAP_RSS_PROPORTIONAL
  - ASSERT_THEME_DECORATION_8_PLUS_CUSTOM
  - ASSERT_STATUSBAR_AGGREGATE_BADGES
  r8c:
  - ASSERT_CLI_PROGRESS_REAL
  - ASSERT_AI_DETECT_NO_FALSE_IDLE
  - ASSERT_MONITOR_WINDOW_LIVE
  - ASSERT_INJECT_TO_AI_INSTANCE
  - ASSERT_WATCHDOG_RESTART
  - ASSERT_TOPOLOGY_DEPTH_10
  - ASSERT_THREE_GRAPH_SYSTEMS
  - ASSERT_NOTIFICATION_AGGREGATION
  - ASSERT_NO_TELEMETRY
  - ASSERT_ZOD_SINGLE_SOURCE
  - ASSERT_DIAGNOSTIC_PACK_OPT_IN
  fail_action: BLOCK_MERGE
  estimated_minutes: 25

  stage_6_perf_pr:
  name: PR-relevant perf
  commands: ['pnpm test:perf -- --pr-paths']
  threshold:
  no_metric_exceeds_fatal: true
  fail_action: BLOCK_MERGE on fatal; WARN on warn
  estimated_minutes: 12

  stage_7_journey_nightly:
  name: 5 user journeys
  commands: ['pnpm test:e2e -- --grep "@journey-"']
  schedule: cron nightly + manual
  fail_action: 通知 + 创建 issue
  estimated_minutes: 60

  stage_8_long_run_release:
  name: 24h long-run
  schedule: 仅 release-candidate / weekly
  threshold:
  memory_growth_pct: 5
  no_zombie_subprocess: true
  no_unhandled_rejection: true
  fail_action: BLOCK_RELEASE
  estimated_minutes: 1440

release_gate_summary:
  must_pass_all_24_assertions: true
  no_perf_metric_above_fatal: true
  long_run_24h_pass: true
  emoji_lint_pass: true  # rg 0 命中（U+1F000-1FFFF / 2600-27BF / E000-F8FF / 装饰符号）
  zod_schema_round_trip_pass: true  # spec-33 ASSERT_ZOD_SINGLE_SOURCE
  privacy_zero_telemetry: true  # ASSERT_NO_TELEMETRY 通过 wireshark 抓包验证
  audit_log_complete: true  # 所有 R8 mutations（csv-start / watchdog-restart / inject / theme-change / setting-change）记录在案
  diagnostic_pack_opt_in: true  # ASSERT_DIAGNOSTIC_PACK_OPT_IN
```

---

## §6 测试数据 / 夹具规划

```yaml
fixtures_path: tests/e2e/fixtures/
fixtures:

  cli_streams:
  claude-stream-sample.ndjson:  # spec-01 GWT-1
  size_kb: 12
  events: [start, progress, tool-use, message-out, completion]
  codex-shim-sample.txt:  # spec-02
  size_kb: 8
  gemini-stdout-sample.txt:  # spec-04
  size_kb: 5
  cursor-window-titles.json:  # spec-05
  titles_count: 20

  csv_batches:
  3-rows-devhub.csv:  # spec-14 GWT-1
  rows: 3
  runner: devhub
  5-rows-python.csv:  # spec-14 GWT-2
  rows: 5
  runner: python
  dag-5-nodes.csv:  # spec-15 GWT-2 / spec-20 GWT-1
  rows: 5
  pattern: A→B,C; B,C→D; A,D→E
  cycle-3.csv:  # spec-20 GWT-2
  cycle: A→B→C→A
  parallel-group-6.csv:  # spec-15 GWT-3
  group: frontend:max=2
  on-fail-retry-3.csv:  # spec-15 GWT-7
  retry_total: 3
  resume-skip-3.csv:  # spec-15 GWT-4
  succeeded: 3, failed: 2

  skills:
  builtin-10/  # spec-10 全部 10 SKILL
  user-custom-monaco/  # spec-11 编辑器测试

  recordings:
  rec-60s-baseline/  # spec-23 GWT-2
  streams: 5
  duration_sec: 60
  rec-with-redaction-keys/  # spec-22 GWT-9
  contains_api_keys: true
  rec-rotate-1gb/  # spec-22 GWT-7

  windows_processes_mocks:
  pid-8812-normal.json  # spec-02 / spec-04 标准进程
  pid-4-system-no-elevation.json  # spec-04 GWT-A2
  pid-cycle-spawn.json  # spec-16 心跳测试

  network_topologies:
  100-nodes-baseline.json  # spec-24 性能基准
  500-nodes-limit.json  # spec-24 GWT-4
  800-nodes-overflow.json  # spec-25 lazy expand 测试

  audit_logs:
  redacted-export-fixture.json  # spec-36 GWT
  24h-long-run-baseline.jsonl  # release gate

mock_strategy:
  electron:
  use: '@electron/playwright-driver'
  bypass_native: 启用 mock 替代 sudo-prompt / win-window-info
  ai_cli:
  codex_stub: scripts/test/codex-stub.js  # 模拟 codex stdout
  claude_stub: scripts/test/claude-stub.js  # 模拟 stream-json
  gemini_stub: scripts/test/gemini-stub.js
  network:
  block_external: true  # tests 中拒绝任何非 localhost 出站
  privacy_assertion_helper: tests/helpers/no-telemetry-spy.ts

policies:
  fixture_size_limit_kb: 1024  # 单 fixture ≤ 1MB
  total_fixtures_size_mb: 100  # 全集 ≤ 100MB
  generated_fixtures: scripts/gen-fixtures.ts  # 大型 fixture 用脚本生成
  no_real_api_keys: enforced  # CI grep 拒绝 sk-/anthropic key
```

---

## §7 5 大用户反馈追踪（验收映射）

```yaml
feedback_to_assertions:
  feedback_1_theme_only_color:
  assertions: [ASSERT_THEME_NON_COLOR_DELTA, ASSERT_THEME_DECORATION_8_PLUS_CUSTOM]
  journeys: [J5]
  spec_owners: [R8.A.spec-06, R8.A.spec-07, R8.B.spec-07]

  feedback_2_card_list_inconsistent:
  assertions: [ASSERT_PROCESS_FIELD_PARITY, ASSERT_PORT_POPOUT_TRIGGERS_4]
  journeys: [J3, J5]
  spec_owners: [R8.A.spec-02, R8.A.spec-04, R8.A.spec-09, R8.B.spec-01]

  feedback_3_topology_disappeared:
  assertions: [ASSERT_TOPOLOGY_FIRST_GLANCE, ASSERT_TOPOLOGY_DEPTH_10, ASSERT_THREE_GRAPH_SYSTEMS]
  journeys: [J3]
  spec_owners: [R8.A.spec-05, R8.C.spec-24, R8.C.spec-25, R8.C.spec-26]

  feedback_4_ai_detection_inaccurate:
  assertions: [ASSERT_CLI_PROGRESS_REAL, ASSERT_AI_DETECT_NO_FALSE_IDLE, ASSERT_MONITOR_WINDOW_LIVE,
  ASSERT_INJECT_TO_AI_INSTANCE, ASSERT_WATCHDOG_RESTART]
  journeys: [J1, J2]
  spec_owners: [R8.C.spec-01..06, spec-07/08, spec-12..19, spec-27..29]

  feedback_5_two_graphs_three_ends:
  assertions: [ASSERT_TOPOLOGY_DEPTH_10, ASSERT_THREE_GRAPH_SYSTEMS]
  journeys: [J3]
  spec_owners: [R8.C.spec-24, R8.C.spec-25, R8.C.spec-26, master-§7.8]

regression_lock_in:
  every_release_must_run:
  - all_24_critical_assertions
  - 5_journey_e2e
  - 24h_long_run
  - perf_full_nightly
  guarded_by:
  - master §11 must_pass_*_before_*
  - feature_flag_OFF rollback strategy（V1-Q-11.D.2 答 C）
```

---

## §8 实施期检查清单（逐 stage 自检）

```yaml
checklist:
  before_pr:
  low_resource_verified_gates:
  - targeted_vitest_for_touched_services_components
  - pnpm_-C_devhub_typecheck
  - pnpm_-C_devhub_lint
  - pnpm_-C_devhub_check:zod-sot
  - pnpm_-C_devhub_check:no-emoji
  - pnpm_-C_devhub_check:no-cloud-deps_when_touching_deferred_cloud_sync
  - pnpm_-C_devhub_check:no-ocr-deps_when_touching_ocr_disabled_contract
  - git_diff_--check_for_touched_code_and_spec_docs
  requires_current_slice_evidence:
  - modified_services_components_have_updated_unit_tests_or_documented_no-test_boundary
  - modified_IPC_channels_are_synchronized_with_runtime_registry_and_preload_contracts
  - modified_Zod_schemas_are_present_in_shared_schema_registry_and_zod_sot_gate
  - modified_feature_flags_are_verified_by_feature_flag_tests_or_existing_registry evidence
  before_merge:
  release_blockers_pending:
  - CI stage 1-6 must be green in the real CI environment
  - PR description must list impacted ASSERT ids
  - all 24 critical assertions must report 0 fail in release CI
  - perf gate must report 0 metric above fatal
  - code review approval is required
  before_release:
  release_blockers_pending:
  - stage 8 long-run 24h must pass
  - all 5 journeys must pass
  - emoji lint must report 0 hits
  - privacy zero telemetry packet capture must be verified
  - backup/restore real drill must pass for spec-35
  - diagnostic pack real export plus redaction verification must pass for spec-36
  release_blocked_if:
  - any 24 assertion failed
  - any perf metric > fatal
  - 24h long-run failed
  - external network connection detected
  - emoji 命中（U+1F000-1FFFF / 2600-27BF / E000-F8FF）
```
