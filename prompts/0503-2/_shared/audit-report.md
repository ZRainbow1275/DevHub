# R8 PRD/Spec 渐进式质量审计报告（中间版）

> **生成时间**: 2026-05-03
> **审计模式**: 渐进式（第一轮）— 已落地文件全量审计 + 待落地文件占位
> **审计范围**: `prompts/0503-2/` 全部 PRD + spec
> **目标基线**: 4 PRD + 67 spec = 71 文件
> **本轮实际盘点**: 4 PRD + 51 spec = **55 文件已落地**
> **待落地**: 16 spec（R8.C spec-20~26 / 31~39，由 task #6/#7 承接）
> **本轮总结论**: **PASS（已落地 55 文件零红线违规）**；剩余 16 spec 的契约一致性待第二轮全量审计验证。

> **当前状态（2026-05-14）**: 上述 2026-05-03 结论是历史中间版，保留用于追踪，不再作为当前完成度判断依据。当前完成度以 `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md`、各 spec 的 `implementation_status_*`、以及本地验证命令输出为准。

## §-1 当前审计附录（2026-05-14）

```yaml
current_filesystem_truth:
  prompt_markdown_files: 81
  batches: [root, _shared, R8.A, R8.B, R8.C]
  current_ledger: .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
  historical_sections_below: retained_for_traceability_only

current_completion_summary:
  R8.A:
  files: 12
  verified: 12
  partial: 0
  missing: 0
  R8.B:
  files: 18
  verified: 1
  partial: 17
  missing: 0
  R8.C:
  files: 40
  verified: 26
  partial: 14
  missing: 0
  _shared:
  files: 9
  verified_after_2026_05_14_addendum: 9
  partial: 0
  missing: 0
  root:
  files: 2
  status: not_applicable_process_documents

current_red_line_status:
  no_delete: preserved
  no_mock_runtime_completion_claims: enforced_by_ledger_evidence
  no_emoji: verified_for_devhub_by_check_no_emoji
  no_cloud_dependency: guarded_by_check_no_cloud_deps
  no_ocr_dependency: guarded_by_check_no_ocr_deps
  zod_single_source_of_truth: guarded_by_check_zod_sot
```

### §-1.1 当前本地验证证据

- R8.A 五个 gate assertion 已由 `devhub/docs/r8a-implementation-report.md`、R8.A contract tests、以及 completion ledger 记录为 verified。
- R8.C `spec-27-ai-signal-fusion-tuning` 已在 2026-05-14 通过真实 Dempster-Shafer mass combination 与 Bayesian log-odds 算法补齐，不再降级为 weighted mean。
- R8.C `spec-14-csv-launch-3way` 已在 2026-05-14 通过真实 Python named-pipe 事件通道与独立控制通道补齐 pause/resume ACK，不再将 Python 长驻控制管道列为未验证边界。
- `_shared/zod-schemas.md` 已在 2026-05-14 通过 R8 IPC owner coverage 修复确认：`setupR8RuntimeHandlers`、`setupA11yHandlers`、`setupProcessHandlers` 的真实 owner split 覆盖 `R8_IPC_CHANNELS`，无缺失、无重复 R8 channel。
- 当前低资源验证命令已覆盖 `pnpm -C devhub check:zod-sot`、`pnpm -C devhub exec tsc --noEmit --pretty false`、`pnpm -C devhub check:no-emoji`、focused schema/IPC/preload Vitest、以及 touched-file diff whitespace checks。

### §-1.2 当前仍不得声称完成的边界

- R8.B 仍有 17 份 partial spec；包括 i18n 全量硬编码迁移、a11y 全 renderer ARIA 审计、port/window/process batch native executor、virtual desktop COM service、thumbnail native capture、theme custom SVG/sound sanitizer 等未完全闭合项。
- R8.C 仍有 10 份 partial spec；packaged Codex shim exe 已在 2026-05-16 通过真实三平台构建产物和 Windows 执行验证闭合；direct koffi Cursor/Copilot scanner、BetterQueue/SQLite queue adapter、real watchdog OS collectors/subprocess runtime、real inject adapters、topology global builders、recording stream classes 等仍为未完全闭合项。
- 本报告不把 contract-only fallback、历史中间版 `MISSING` 字样、或仅文档存在当作功能完成证据；所有完成结论必须回到 ledger 行、代码路径、测试命令和本地验证结果。

---

## §0 8 维度审计结果一览

| 维度 | 范围 | 已落地结果 | 备注 |
|---|---|---|---|
| 1. Emoji + PUA 全清扫 | U+1F000-1FFFF / 2600-27BF / 2300-23FF / 2B00-2BFF / E000-F8FF | **PASS（0 命中）** | 含 PUA 区 nerd font 检查 |
| 2. 13 章节齐全 | 51 spec 文件 | **PASS（51/51）** | 全数 13 节命中 |
| 3. 跨 spec 契约一致 | flag 命名 / IPC namespace / Zod schema | **PASS** | 无 V2/分裂命名 |
| 4. V1+V2 锚点合规 | `V[12]-Q-X.Y.Z` | **PASS（405 处）** | 44 文件分布 |
| 5. 5 大反馈映射完整 | feedback#1.1~5 → spec | **PASS（已落地部分）** | #4.3/#5 部分依赖待落地 spec |
| 6. 三套图体系强约束 | network / neural / flow | **PARTIAL** | 锚点 spec 24/25/26 未落地 |
| 7. 自研白名单遵守 | NeuralGraphEngine / AITaskTracker / WindowManager / ProcessUnifiedViewModel | **PASS** | 仅在 master + R8.A spec-01 声明，无越界 |
| 8. master §7 全局契约引用 | §7.1~§7.9 | **PASS** | 引用一致 |

---

## §1 文件盘点

### §1.1 PRD（4/4 — 100%）

| 文件 | 路径 | 状态 |
|---|---|---|
| Master PRD | `prompts/0503-2/00-r8-master-prd.md` | OK |
| R8.A PRD | `prompts/0503-2/R8.A/prd.md` | OK |
| R8.B PRD | `prompts/0503-2/R8.B/prd.md` | OK |
| R8.C PRD | `prompts/0503-2/R8.C/prd.md` | OK |

### §1.2 R8.A spec（11/11 — 100%）

| # | 文件 | flag |
|---|---|---|
| 01 | spec-01-integration-libs.md | `R8.A.libs.{slug}` ×17 子 flag |
| 02 | spec-02-process-unified-vm.md | `R8.A.process.unified-vm` |
| 03 | spec-03-process-uac-elevation.md | `R8.A.process.uac-spawn` |
| 04 | spec-04-process-card-list-parity.md | `R8.A.process.card-list-parity` |
| 05 | spec-05-topology-discoverability.md | `R8.A.topology.discover` |
| 06 | spec-06-theme-4d-axis-exposure.md | `R8.A.theme.4d-axis` |
| 07 | spec-07-theme-default-distance.md | `R8.A.theme.default-delta` |
| 08 | spec-08-window-always-on-top.md | `R8.A.window.aot` |
| 09 | spec-09-port-card-improvement.md | `R8.A.port.card-improve` |
| 10 | spec-10-audit-log.md | `R8.A.audit.log` |
| 11 | spec-11-permission-prompts.md | `R8.A.permission.prompt` |

### §1.3 R8.B spec（17/17 — 100%）

| # | 文件 | flag |
|---|---|---|
| 01 | spec-01-port-popout-system.md | `R8.B.port.popout-system` |
| 02 | spec-02-port-floating-window.md | `R8.B.popout.browserwindow` |
| 03 | spec-03-drawer-system-top-right-bot.md | `R8.B.drawer.system` |
| 04 | spec-04-command-palette-cmdk.md | `R8.B.command.palette` |
| 05 | spec-05-dashboard-grid-layout.md | `R8.B.dashboard.grid` |
| 06 | spec-06-process-treemap-tree.md | `R8.B.process.treemap-tree` |
| 07 | spec-07-theme-decorations-extend.md | `R8.B.theme.decorations` |
| 08 | spec-08-statusbar-extension.md | `R8.B.statusbar.extension` |
| 09 | spec-09-window-thumbnail-wall.md | `R8.B.window.thumbnail-wall` |
| 10 | spec-10-window-batch-ops.md | `R8.B.window.batch-ops` |
| 11 | spec-11-window-virtual-desktop.md | `R8.B.window.virtual-desktop` |
| 12 | spec-12-process-batch-ops.md | `R8.B.process.batch-ops` |
| 13 | spec-13-port-security-tier-banner.md | `R8.B.port.security-tier` |
| 14 | spec-14-process-tags-history.md | `R8.B.process.tags-history` |
| 15 | spec-15-i18n-scaffold.md | `R8.B.i18n.scaffold` |
| 16 | spec-16-a11y-full.md | `R8.B.a11y.full` |
| 17 | spec-17-icon-library-mix.md | `R8.B.icon.library` |

### §1.4 R8.C spec（23/39 — 59%）

| # | 文件 | 状态 | flag |
|---|---|---|---|
| 01 | spec-01-cli-output-parser.md | OK | `R8.C.cli.parser` |
| 02 | spec-02-shim-codex.md | OK | `R8.C.shim.codex` |
| 03 | spec-03-shim-claude-stream-json.md | OK | `R8.C.shim.claude` |
| 04 | spec-04-shim-gemini-stdout.md | OK | `R8.C.shim.gemini` |
| 05 | spec-05-cursor-copilot-detection.md | OK | `R8.C.cli.cursor-copilot` |
| 06 | spec-06-cli-detect-init.md | OK | `R8.C.cli.detect` |
| 07 | spec-07-monitor-window.md | OK | `R8.C.monitor.window` |
| 08 | spec-08-monitor-window-popout.md | OK | `R8.C.monitor.popout` |
| 09 | spec-09-skill-library-yaml.md | OK | `R8.C.skill.library` |
| 10 | spec-10-skill-builtin-10.md | OK | `R8.C.skill.builtin` |
| 11 | spec-11-skill-editor.md | OK | `R8.C.skill.editor` |
| 12 | spec-12-csv-task-driver.md | OK | `R8.C.csv.driver` |
| 13 | spec-13-csv-schema-18cols.md | OK | `R8.C.csv.schema` |
| 14 | spec-14-csv-launch-3way.md | OK | `R8.C.csv.launch` |
| 15 | spec-15-task-queue-better-queue.md | OK | `R8.C.task.queue` |
| 16 | spec-16-watchdog-engine.md | OK | `R8.C.watchdog.engine` |
| 17 | spec-17-watchdog-subprocess.md | OK | `R8.C.watchdog.subprocess` |
| 18 | spec-18-auto-inject.md | OK | `R8.C.inject.engine` |
| 19 | spec-19-auto-inject-targets.md | OK | `R8.C.inject.targets` |
| 20 | spec-20-dag-engine | **MISSING** | TBD（task #6） |
| 21 | spec-21-dag-editor-ui | **MISSING** | TBD（task #6） |
| 22 | spec-22-dag-execution | **MISSING** | TBD（task #6） |
| 23 | spec-23-topology-service | **MISSING** | TBD（task #6） |
| 24 | spec-24-topology-global-fullscreen | **MISSING** | TBD（task #6） |
| 25 | spec-25-topology-attached-10layer | **MISSING** | TBD（task #6） |
| 26 | spec-26-flow-attached | **MISSING** | TBD（task #6） |
| 27 | spec-27-ai-signal-fusion-tuning.md | OK | `R8.C.signal.fusion` |
| 28 | spec-28-ai-state-machine-3layer.md | OK | `R8.C.state.three-layer` |
| 29 | spec-29-feedback-loop-misreport.md | OK | `R8.C.feedback.loop` |
| 30 | spec-30-notification-system.md | OK | `R8.C.notify.system` |
| 31~36 | crosscut + observability | **MISSING** | TBD（task #7） |
| 37~39 | backup + diagnostic-bundle | **MISSING** | TBD（task #7） |

**总计已落地**: 4 PRD + 11 R8.A + 17 R8.B + 23 R8.C = **55 / 71 = 77.5%**

---

## §2 红线检查（详细）

### §2.1 Emoji + PUA 全清扫（PASS）

```yaml
扫描范围:
  - U+1F300-1FAFF（emoji 全段含 1FA70-1FAFF）
  - U+2600-27BF（杂项符号 + dingbats）
  - U+1F000-1F2FF（早期 emoji）
  - U+2300-23FF（杂项技术）
  - U+2B00-2BFF（杂项符号箭头）
  - U+E000-F8FF（PUA 区，nerd font 检查）

工具: ripgrep 字符类
扫描文件: 55 个已落地文件
结果: 0 命中
```

### §2.2 13 章节齐全（PASS）

```yaml
模板: motivation / affected_source / data_contracts / ipc_contracts / error_matrix
  / acceptance_gwt / e2e_playwright_draft / reference_impl / impact_radius_loc
  / implement_checklist / dependencies / fallback_strategy / performance_budget

扫描方式: rg "^## \d+\." 计数
结果: 51 spec × 13 节 = 663 节命中
缺失: 0
```

### §2.3 flag 命名规范（PASS）

```yaml
规则: R8.{batch}.{module}.{feature}（master §1 元约束）

R8.A: 11 spec 全数命中（R8.A.libs/process/topology/theme/window/port/audit/permission）
R8.B: 17 spec 全数命中（R8.B.port/popout/drawer/command/dashboard/process/theme/statusbar/window/a11y/i18n/icon）
R8.C: 23 spec 全数命中（R8.C.cli/shim/monitor/skill/csv/task/watchdog/inject/signal/state/feedback/notify）

变体允许: 子 flag 用 .{sub-feature} 后缀（如 R8.A.libs.wmi-client）
违规: 0
```

### §2.4 V1+V2 锚点合规（PASS）

```yaml
模式: V[12]-Q-X.Y.Z（X 为表号 / Y 为节字母 / Z 为题号）

统计: 405 处，分布于 44 文件
高频文件:
  - 00-r8-master-prd.md: 89 处
  - R8.C/prd.md: 71 处
  - R8.A/spec-01-integration-libs.md: 39 处
  - R8.B/prd.md: 35 处
  - R8.B/spec-01-port-popout-system.md: 23 处
  - R8.B/spec-02-port-floating-window.md: 11 处
  - R8.B/spec-04-command-palette-cmdk.md: 14 处
  - R8.B/spec-10-window-batch-ops.md: 6 处

非法格式: 0
```

### §2.5 自研白名单遵守（PASS）

```yaml
master PRD §1 声明的 4 自研白名单:
  - NeuralGraphEngine
  - AITaskTracker
  - WindowManager
  - ProcessUnifiedViewModel

扫描"自研"关键词:
  - 00-r8-master-prd.md: 4 处（白名单声明 + 集成原则）
  - R8.A/prd.md: 2 处（继承白名单）
  - R8.A/spec-01-integration-libs.md: 2 处（V1-Q-10.J.3 答 B 引用）

跨 spec 引用 4 自研组件: 80 处（13 文件）
扫描结果: 无新增自研声明，所有外围模块走集成路径

ProcessUnifiedViewModel 引用一致性:
  - 仅 ProcessUnifiedViewModel / ProcessUnifiedViewModelSchema 出现
  - 无 V2 / Light / Full 等分裂命名
  - 13 文件 × 多次引用 = 44 处一致命中
```

### §2.6 三套图体系强约束（PARTIAL）

```yaml
术语规范（master §7.8）:
  - network-topology
  - neural-relationship
  - flow

锚点文件状态:
  R8.A.spec-05-topology-discoverability.md: 已落地（45 处拓扑术语命中）
  R8.C.spec-23-topology-service: MISSING
  R8.C.spec-24-topology-global-fullscreen: MISSING
  R8.C.spec-25-topology-attached-10layer: MISSING
  R8.C.spec-26-flow-attached: MISSING

dual_existence_rule 检查:
  global_entry: 待 spec-24 落地后验证
  attached_entry: R8.A.spec-05 已声明，但深度依赖 spec-25 落地
  data_consistency（TopologyGraphService 单例）: 待 spec-23 落地

结论: PARTIAL — 等待 task #6 交付 spec-23~26 后做闭环检查
```

### §2.7 master PRD §7 全局契约引用一致性（PASS）

```yaml
§7.1 ProcessUnifiedViewModel: PASS
  - 锚点: R8.A.spec-02 / R8.A.spec-04
  - 引用方: R8.B.spec-12/14 / R8.C.spec-07

§7.2 IPC channel registry: PASS
  - 命名规范: {namespace}:{verb}-{object}
  - 22 namespace（process/port/window/topology/flow/ai-task/watchdog/skill/observability/audit/drawer/command/dashboard/theme/status/i18n/a11y/icon）
  - 各 spec ipc_contracts 节全部遵守

§7.3 错误码全集: PASS
  - E_VALIDATION / E_NOT_FOUND / E_INTERNAL / E_TIMEOUT / E_PERMISSION_DENIED
  - 各 spec error_matrix 节引用一致

§7.4 性能预算汇总: PASS
  - p95_render_ms / bundle_kb / fps
  - 各 spec performance_budget 节遵守

§7.5 主题 4 维轴: PASS
  - palette / density / radiusFamily / motionLevel
  - R8.A.spec-06/07 + R8.B.spec-07 一致

§7.6 SKILL frontmatter: PASS
  - R8.C.spec-09 锚点 + spec-10/11 引用

§7.7 CSV Schema 18 列: PASS
  - R8.C.spec-13 锚点 + spec-12/14/15 引用

§7.8 三套图体系: PARTIAL
  - 锚点 R8.C.spec-23~26 未落地
  - master 单点权威定义存在

§7.9 用户感知 5 断言: PASS
  - ASSERT_PROCESS_FIELD_PARITY / TOPOLOGY_FIRST_GLANCE / THEME_NON_COLOR_DELTA
  / ALWAYS_ON_TOP_FUNCTIONAL / PORT_PANEL_BREATHING_ROOM
```

---

## §3 5 大反馈映射完整性

### §3.1 反馈 #1.1（显示不均，需多收纳）— PASS

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| 多收纳系统 | R8.B.spec-03（Drawer 5 槽） | 已落地 |
| Dashboard 仪表板 | R8.B.spec-05（react-grid-layout） | 已落地 |
| popout 摘出 | R8.B.spec-01/02 | 已落地 |
| 状态栏聚合 | R8.B.spec-08（12 tile） | 已落地 |

### §3.2 反馈 #1.2（主题只换色）— PASS

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| 4 维主题轴暴露 | R8.A.spec-06 | 已落地 |
| 默认轴差异强化 | R8.A.spec-07 | 已落地 |
| 装饰几何扩展 | R8.B.spec-07 | 已落地 |

### §3.3 反馈 #2.1（卡片/列表不一致）— PASS

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| ProcessUnifiedViewModel | R8.A.spec-02 | 已落地 |
| Card/List parity | R8.A.spec-04 | 已落地 |
| UAC spawn 提权 | R8.A.spec-03 | 已落地 |

### §3.4 反馈 #2.2（拓扑/神经图三端贯通）— PARTIAL

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| 三端入口贯通 | R8.A.spec-05 | 已落地 |
| 全屏拓扑一级入口 | R8.C.spec-24 | **MISSING** |
| 附属拓扑 10 层 | R8.C.spec-25 | **MISSING** |
| 流程图附属 | R8.C.spec-26 | **MISSING** |

### §3.5 反馈 #3.1（端口卡太小）— PASS

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| R8.A 阶段优化 | R8.A.spec-09 | 已落地 |
| popout 4 触发 | R8.B.spec-01 | 已落地 |
| BrowserWindow 升级 | R8.B.spec-02 | 已落地 |
| 4 级安全分级 | R8.B.spec-13 | 已落地 |

### §3.6 反馈 #4.1（误报）— PASS

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| 6+4 信号融合 | R8.C.spec-27 | 已落地 |
| 三层状态机 | R8.C.spec-28 | 已落地 |
| 反馈循环 | R8.C.spec-29 | 已落地 |

### §3.7 反馈 #4.2（监控不准）— PASS

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| CLI 输出解析 | R8.C.spec-01 | 已落地 |
| Codex SHIM | R8.C.spec-02 | 已落地 |
| Claude SHIM | R8.C.spec-03 | 已落地 |
| Gemini SHIM | R8.C.spec-04 | 已落地 |
| Cursor+Copilot | R8.C.spec-05 | 已落地 |
| CLI 自动检测初始化 | R8.C.spec-06 | 已落地 |

### §3.8 反馈 #4.3（监控窗口/SKILL/CSV/Watchdog/inject）— PASS

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| 监控窗口 | R8.C.spec-07 | 已落地 |
| 监控窗口 popout | R8.C.spec-08 | 已落地 |
| SKILL YAML | R8.C.spec-09 | 已落地 |
| 内置 10 SKILL | R8.C.spec-10 | 已落地 |
| Monaco 编辑器 | R8.C.spec-11 | 已落地 |
| CSV 任务驱动 | R8.C.spec-12 | 已落地 |
| 18 列 CSV schema | R8.C.spec-13 | 已落地 |
| 3 启动入口 | R8.C.spec-14 | 已落地 |
| better-queue | R8.C.spec-15 | 已落地 |
| Watchdog 9 项 | R8.C.spec-16 | 已落地 |
| 独立子进程 | R8.C.spec-17 | 已落地 |
| 自动注入 6 场景 | R8.C.spec-18 | 已落地 |
| inject 目标白名单 | R8.C.spec-19 | 已落地 |
| 通知系统 | R8.C.spec-30 | 已落地 |

### §3.9 反馈 #5（拓扑双重存在）— PARTIAL

| 反馈点 | spec 覆盖 | 状态 |
|---|---|---|
| 三端入口贯通 | R8.A.spec-05 | 已落地 |
| 全屏拓扑顶级一级 | R8.C.spec-24 | **MISSING** |
| 附属拓扑 10 层 | R8.C.spec-25 | **MISSING** |
| 流程图附属 | R8.C.spec-26 | **MISSING** |
| 三套图统一服务 | R8.C.spec-23 | **MISSING** |

---

## §4 跨 spec 引用索引表

### §4.1 共享 Zod Schema 索引

| Schema 名 | 定义位置 | 引用方 |
|---|---|---|
| `ProcessUnifiedViewModelSchema` | R8.A.spec-02 §3 | R8.A.spec-04/03 / R8.B.spec-12/14/06/09 / R8.C.spec-07 |
| `PopoutKindSchema` | R8.B.spec-01 §3 | R8.B.spec-02/03 / R8.C.spec-08 |
| `DrawerSlotSchema` | R8.B.spec-03 §3 | R8.B.spec-08 / R8.B.spec-04（cmdk） / R8.B.spec-05（dashboard） |
| `LocaleSchema` | R8.B.spec-15 §3 | 全 R8.B/R8.C spec 字符串外置 |
| `SecurityTierSchema` | R8.B.spec-13 §3 | R8.A.spec-09 / R8.B.spec-01 |
| `SkillManifestSchema` | R8.C.spec-09 §3 | R8.C.spec-10/11 |
| `CSVRowSchema` | R8.C.spec-13 §3 | R8.C.spec-12/14/15 |
| `WatchdogConfigSchema` | R8.C.spec-16 §3 | R8.C.spec-17 |
| `InjectScenarioSchema` | R8.C.spec-18 §3 | R8.C.spec-19 |
| `SignalFusionSchema` | R8.C.spec-27 §3 | R8.C.spec-28/29 |
| `StateMachineSchema` | R8.C.spec-28 §3 | R8.C.spec-29/30 |
| `NotificationSchema` | R8.C.spec-30 §3 | R8.C.spec-29 / R8.A.spec-10（audit） |

### §4.2 IPC namespace 注册表（22 个，对齐 master §7.2）

```yaml
process:  R8.A.spec-02/04 / R8.B.spec-06/12/14
port:  R8.A.spec-09 / R8.B.spec-01/02/13
window:  R8.A.spec-08 / R8.B.spec-09/10/11
topology:  R8.A.spec-05 / R8.C.spec-23..26（待）
flow:  R8.C.spec-26（待）
ai-task:  R8.C.spec-12/15/27/28/29
watchdog:  R8.C.spec-16/17
skill:  R8.C.spec-09/10/11
observability: R8.C.spec-31~36（待）
audit:  R8.A.spec-10
drawer:  R8.B.spec-03
command:  R8.B.spec-04
dashboard:  R8.B.spec-05
theme:  R8.A.spec-06/07 / R8.B.spec-07
status:  R8.B.spec-08
i18n:  R8.B.spec-15
a11y:  R8.B.spec-16
icon:  R8.B.spec-17
permission: R8.A.spec-11
inject:  R8.C.spec-18/19
notify:  R8.C.spec-30
csv:  R8.C.spec-12/13/14
```

### §4.3 spec 互引统计

```yaml
互引总数: 612 处 spec 名引用
平均每 spec 互引数: 12 处
高引用文件:
  - R8.C.spec-18-auto-inject.md: 30 处
  - R8.C.spec-15-task-queue.md: 25 处
  - R8.C.spec-16-watchdog-engine.md: 23 处
  - R8.B.spec-01-port-popout-system.md: 22 处
  - R8.A.spec-01-integration-libs.md: 22 处
  - R8.C.spec-14-csv-launch-3way.md: 22 处
  - R8.C.spec-19-auto-inject-targets.md: 21 处
  - R8.A.spec-04-process-card-list-parity.md: 20 处
```

---

## §5 待修复清单

### §5.1 P0（阻塞 R8.C 完整审计 — task #6 承接）

```yaml
- spec-20-dag-engine
- spec-21-dag-editor-ui
- spec-22-dag-execution
- spec-23-topology-service  # master §7.8 锚点
- spec-24-topology-global-fullscreen  # feedback#5 + feedback#2.2
- spec-25-topology-attached-10layer  # feedback#5 + feedback#2.2
- spec-26-flow-attached  # 第三套图体系锚点
```

### §5.2 P1（阻塞最终 71 文件验收 — task #7 承接）

```yaml
- spec-31~36: crosscut + observability（横切 / metrics / logs / health）
- spec-37~39: backup + diagnostic-bundle + 升级
```

### §5.3 P2（已落地文件零修复需求）

```yaml
no_action_required:
  4 PRD: 0 issues
  11 R8.A spec: 0 issues
  17 R8.B spec: 0 issues
  23 R8.C spec: 0 issues
```

### §5.4 P3（建议增强）

```yaml
建议增强项（非阻塞）:
  - master §7.8 三套图 dual_existence_rule 当 spec-23~26 落地后做闭环验证
  - Zod schema 跨 spec 引用建议在 _shared/ 建立单一注册表（task #10 已开）
  - IPC namespace 22 个建议在 _shared/ipc-registry.yaml 集中维护（task #10 已开）
```

---

## §6 验收门禁决议

```yaml
gate_R8A_implementation:
  status: GO
  blockers: 无
  rationale: 11 spec 全数 PASS 8 维度审计

gate_R8B_implementation:
  status: GO
  blockers: 依赖 R8.A 5 断言通过（master §7.9）
  rationale: 17 spec 全数 PASS 8 维度审计

gate_R8C_partial_implementation:
  status: PARTIAL_GO
  ready_modules:
  - CLI parser + SHIM（spec-01~06）
  - 监控窗口（spec-07~08）
  - SKILL（spec-09~11）
  - CSV 驱动（spec-12~15）
  - Watchdog（spec-16~17）
  - 自动注入（spec-18~19）
  - AI 信号 + 状态机 + 反馈 + 通知（spec-27~30）
  blocked_modules:
  - DAG 引擎（spec-20~22）
  - 三套图体系（spec-23~26）
  - 横切观测（spec-31~36）
  - 备份诊断（spec-37~39）

gate_overall_audit:
  current_phase: PROGRESSIVE_ROUND_1（55/71 = 77.5% 文件覆盖）
  red_line_violations: 0
  cross_spec_inconsistencies: 0
  next_round_trigger: task #6 + task #7 完成通知
  next_round_actions:
  - 全量 71 文件 emoji 复扫
  - 全 13 章节复检
  - 三套图 dual_existence_rule 闭环验证
  - feedback #2.2 / #5 完整链路验证
  - master §7.8 引用一致性闭环
  - Zod schema 注册表对齐 task #10 产出
```

---

## §7 推荐后续行动

```yaml
immediate_actions:
  1. R8.A 实施可立即启动（11 spec GO）
  2. R8.B 实施待 R8.A 5 断言通过后启动
  3. R8.C 已就绪 23 spec 可并行启动子模块实施
  4. task #6/#7 owner 加速 16 个 R8.C 缺漏 spec

audit_round_2_trigger:
  condition: task #6 + task #7 全部 completed
  expected_files: 71（4 PRD + 11 R8.A + 17 R8.B + 39 R8.C）
  expected_runtime: ~10 分钟（全量扫描 + 闭环验证）

deferred_to_round_2:
  - 三套图 dual_existence_rule 闭环
  - master §7.8 spec-23~26 引用一致性
  - feedback #2.2 / #5 完整链路验证
  - observability 层契约（spec-31~36）

coordination_with_task_10:
  task_10_scope: _shared/ 整合 IPC + Schema + FeatureFlag 三大注册表
  audit_scope: 验证注册表对齐 master §7 + 各 spec 引用
  handoff: task #10 产出后审计本轮报告 §4.1/§4.2 索引表
```

---

**审计员**: spec-r8b
**审计时间**: 2026-05-03
**报告版本**: v1.1（中间审计 / 渐进式第一轮）
**最终决议**: 已落地 55 文件全部通过 8 维度红线检查，零修复需求；剩余 16 spec 待落地后做第二轮全量审计。
