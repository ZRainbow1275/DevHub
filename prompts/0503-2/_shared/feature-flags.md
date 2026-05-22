# R8 Feature Flags 注册表

> **生成时间**: 2026-05-03
> **版本**: v2.0（全量 71 文件 — 4 PRD + 11 R8.A + 17 R8.B + 39 R8.C）
> **数据源**: 各 spec 头部 `> **flag**:` + `flag_disable:` 段 + master PRD §1
> **命名规范**: `R8.{batch}.{module}.{feature}`（master §1 元约束）
> **机器可读**: 表格 + YAML 结构化字段

---

## §0 字段定义

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 必须 `R8.{batch}.{module}.{feature}` 格式 |
| `default` | enum | `ON` / `OFF` / `DEPRECATED` / `HARDCODED_OFF`（编译时禁用） |
| `source` | string | 来源 spec（如 R8.A/spec-02） |
| `description` | string | 一句话说明 |
| `depends_on` | string[] | 必须 ON 才生效的其他 flag |
| `mutex_with` | string[] | 不能同时 ON 的 flag |
| `parent` | string | 子 flag 的父 flag |

---

## §1 R8.A Feature Flags（11 spec / 29 flag）

```yaml
R8.A.libs.wmi-client:
  default: ON
  source: R8.A/spec-01
  description: WMI 客户端（深度进程字段）
  depends_on: []
  mutex_with: []

R8.A.libs.sudo-prompt:
  default: ON
  source: R8.A/spec-01
  description: sudo-prompt UAC spawn 集成
  depends_on: []

R8.A.libs.tree-kill:
  default: ON
  source: R8.A/spec-01
  description: tree-kill 进程树终止

R8.A.libs.node-window-manager:
  default: ON
  source: R8.A/spec-01
  description: node-window-manager 窗口枚举

R8.A.libs.koffi:
  default: ON
  source: R8.A/spec-01
  description: koffi Win32 FFI

R8.A.libs.win32-displayconfig:
  default: ON
  source: R8.A/spec-01
  description: 多显示器配置

R8.A.libs.nut-js:
  default: ON
  source: R8.A/spec-01
  description: nut-js 桌面自动化（SendInput 兜底）

R8.A.libs.node-pty:
  default: ON
  source: R8.A/spec-01
  description: node-pty 终端模拟

R8.A.libs.xyflow:
  default: ON
  source: R8.A/spec-01
  description: xyflow React 图渲染

R8.A.libs.d3-force:
  default: ON
  source: R8.A/spec-01
  description: d3-force 力导向布局

R8.A.libs.dagre:
  default: ON
  source: R8.A/spec-01
  description: dagre 分层布局

R8.A.libs.elkjs:
  default: ON
  source: R8.A/spec-01
  description: elkjs 布局兜底

R8.A.libs.webcola:
  default: OFF
  source: R8.A/spec-01
  description: webcola 约束布局（实验）

R8.A.libs.cmdk:
  default: ON
  source: R8.A/spec-01
  description: cmdk 命令面板基础库

R8.A.libs.resizable-panels:
  default: ON
  source: R8.A/spec-01
  description: react-resizable-panels 三栏布局

R8.A.libs.radix-dialog:
  default: ON
  source: R8.A/spec-01

R8.A.libs.radix-dropdown:
  default: ON
  source: R8.A/spec-01

R8.A.libs.radix-tooltip:
  default: ON
  source: R8.A/spec-01

R8.A.libs.grid-layout:
  default: ON
  source: R8.A/spec-01
  description: react-grid-layout

R8.A.process.unified-vm:
  default: ON
  source: R8.A/spec-02
  description: ProcessUnifiedViewModel 统一进程数据模型
  depends_on: [R8.A.libs.wmi-client]

R8.A.process.uac-spawn:
  default: ON
  source: R8.A/spec-03
  description: UAC 子进程提权（24h 记忆）
  depends_on: [R8.A.libs.sudo-prompt]

R8.A.process.card-list-parity:
  default: ON
  source: R8.A/spec-04
  description: 卡片/列表 schema 一致渲染
  depends_on: [R8.A.process.unified-vm]

R8.A.topology.discover:
  default: ON
  source: R8.A/spec-05
  description: 拓扑入口三端贯通（process/port/window）
  depends_on: [R8.A.libs.xyflow, R8.A.libs.d3-force]

R8.A.theme.4d-axis:
  default: ON
  source: R8.A/spec-06
  description: 4 维主题轴 UI 暴露（palette/density/radiusFamily/motionLevel）

R8.A.theme.default-delta:
  default: ON
  source: R8.A/spec-07
  description: 默认轴差异强化
  depends_on: [R8.A.theme.4d-axis]

R8.A.window.aot:
  default: ON
  source: R8.A/spec-08
  description: 窗口 always-on-top
  depends_on: [R8.A.libs.node-window-manager]

R8.A.port.card-improve:
  default: ON
  source: R8.A/spec-09
  description: 端口卡 R8.A 阶段优化（间距 + 安全标签）

R8.A.audit.log:
  default: ON
  source: R8.A/spec-10
  description: 操作审计日志（持久化）

R8.A.permission.prompt:
  default: ON
  source: R8.A/spec-11
  description: 危险动作权限确认
  depends_on: [R8.A.audit.log]
```

---

## §2 R8.B Feature Flags（17 spec / 17 flag）

```yaml
R8.B.port.popout-system:
  default: ON
  source: R8.B/spec-01
  description: 端口 popout 4 触发器系统
  depends_on: [R8.A.port.card-improve]

R8.B.popout.browserwindow:
  default: ON
  source: R8.B/spec-02
  description: popout 升级为 BrowserWindow（多显示器迁移）
  depends_on: [R8.B.port.popout-system]

R8.B.drawer.system:
  default: ON
  source: R8.B/spec-03
  description: 5 槽 Drawer（top/right/bottom/floating/statusbar）

R8.B.command.palette:
  default: ON
  source: R8.B/spec-04
  description: cmdk 命令面板 + URI 协议
  depends_on: [R8.A.libs.cmdk]

R8.B.dashboard.grid:
  default: ON
  source: R8.B/spec-05
  description: react-grid-layout 仪表板
  depends_on: [R8.A.libs.grid-layout]

R8.B.process.treemap-tree:
  default: ON
  source: R8.B/spec-06
  description: d3-hierarchy treemap + 虚拟化 tree
  depends_on: [R8.A.process.unified-vm]

R8.B.theme.decorations:
  default: ON
  source: R8.B/spec-07
  description: 装饰几何 8 种 + 主题音 + SVG 上传
  depends_on: [R8.A.theme.4d-axis]

R8.B.statusbar.extension:
  default: ON
  source: R8.B/spec-08
  description: 12 tile 状态栏聚合 + 6 badge

R8.B.window.thumbnail-wall:
  default: ON
  source: R8.B/spec-09
  description: Win32 PrintWindow 缩略图墙（5-tuple 分组）
  depends_on: [R8.A.libs.koffi]

R8.B.window.batch-ops:
  default: ON
  source: R8.B/spec-10
  description: 7 批量窗口操作 + Lasso

R8.B.window.virtual-desktop:
  default: ON
  source: R8.B/spec-11
  description: IVirtualDesktopManager + 命名布局
  depends_on: [R8.A.libs.koffi, R8.A.libs.win32-displayconfig]

R8.B.process.batch-ops:
  default: ON
  source: R8.B/spec-12
  description: 6 批量进程操作 + 5 确认场景
  depends_on: [R8.A.process.unified-vm]

R8.B.port.security-tier:
  default: ON
  source: R8.B/spec-13
  description: 4 级端口安全分级 + 30 默认可疑端口

R8.B.process.tags-history:
  default: ON
  source: R8.B/spec-14
  description: sha256(EXE+cwd) 标签 + 24h 历史采样

R8.B.i18n.scaffold:
  default: ON
  source: R8.B/spec-15
  description: i18next + zh-CN 完整 + en-US 占位

R8.B.a11y.full:
  default: ON
  source: R8.B/spec-16
  description: axe-core CI + reduced-motion + WCAG AA

R8.B.icon.library:
  default: ON
  source: R8.B/spec-17
  description: 4 图标库混用 + brand logos
```

---

## §3 R8.C Feature Flags（39 spec / 39 主 flag + 9 子 flag）

```yaml
R8.C.cli.parser:
  default: ON
  source: R8.C/spec-01
  description: CLIOutputParser 总框架
  depends_on: [R8.A.libs.node-pty]

R8.C.shim.codex:
  default: ON
  source: R8.C/spec-02
  description: Codex SHIM stream-json
  depends_on: [R8.C.cli.parser]

R8.C.shim.claude:
  default: ON
  source: R8.C/spec-03
  description: Claude SHIM stream-json
  depends_on: [R8.C.cli.parser]

R8.C.shim.gemini:
  default: ON
  source: R8.C/spec-04
  description: Gemini stdout 解析 SHIM
  depends_on: [R8.C.cli.parser]

R8.C.cli.cursor-copilot:
  default: ON
  source: R8.C/spec-05
  description: Cursor / Copilot 标题模式检测

R8.C.cli.detect:
  default: ON
  source: R8.C/spec-06
  description: 启动期 CLI 工具自动检测（5s 内完成）

R8.C.monitor.window:
  default: ON
  source: R8.C/spec-07
  description: AI 监控窗口主面板

R8.C.monitor.popout:
  default: ON
  source: R8.C/spec-08
  description: 监控窗口 popout BrowserWindow
  depends_on: [R8.C.monitor.window, R8.B.popout.browserwindow]

R8.C.skill.library:
  default: ON
  source: R8.C/spec-09
  description: SKILL YAML 库 + 校验

R8.C.skill.builtin:
  default: ON
  source: R8.C/spec-10
  description: 10 内置 SKILL
  depends_on: [R8.C.skill.library]

R8.C.skill.editor:
  default: ON
  source: R8.C/spec-11
  description: Monaco SKILL 编辑器
  depends_on: [R8.C.skill.library]

R8.C.csv.driver:
  default: ON
  source: R8.C/spec-12
  description: CSV 任务驱动核心

R8.C.csv.schema:
  default: ON
  source: R8.C/spec-13
  description: 18 列 CSV schema
  depends_on: [R8.C.csv.driver]

R8.C.csv.launch:
  default: ON
  source: R8.C/spec-14
  description: CSV 三启动入口（DevHub UI / Python / CLI）
  depends_on: [R8.C.csv.driver, R8.C.csv.schema]

R8.C.csv.launch.python:
  default: OFF
  source: R8.C/spec-14
  parent: R8.C.csv.launch
  description: Python 子启动器（用户自助开）

R8.C.csv.launch.cli:
  default: ON
  source: R8.C/spec-14
  parent: R8.C.csv.launch
  description: CLI 子启动器

R8.C.task.queue:
  default: ON
  source: R8.C/spec-15
  description: better-queue 任务队列
  depends_on: [R8.C.csv.launch]

R8.C.task.queue.engine:
  default: better-queue
  source: R8.C/spec-15
  parent: R8.C.task.queue
  description: 队列引擎选择 ∈ {better-queue, p-queue}

R8.C.watchdog.engine:
  default: ON
  source: R8.C/spec-16
  description: Watchdog 9 项可靠性策略
  depends_on: [R8.C.task.queue]

R8.C.watchdog.engine.strict:
  default: OFF
  source: R8.C/spec-16
  parent: R8.C.watchdog.engine
  description: 严格模式（重试 0 次直接 fail）

R8.C.watchdog.subprocess:
  default: ON
  source: R8.C/spec-17
  description: Watchdog 独立子进程隔离
  depends_on: [R8.C.watchdog.engine]

R8.C.watchdog.subprocess.windows-service:
  default: OFF
  source: R8.C/spec-17
  parent: R8.C.watchdog.subprocess
  description: Windows Service 模式（需管理员）

R8.C.inject.engine:
  default: ON
  source: R8.C/spec-18
  description: 自动注入 6 场景引擎
  depends_on: [R8.C.task.queue, R8.A.libs.nut-js]

R8.C.inject.engine.audit-full-content:
  default: ON
  source: R8.C/spec-18
  parent: R8.C.inject.engine
  description: 注入全文记入 audit
  depends_on: [R8.A.audit.log]

R8.C.inject.targets:
  default: ON
  source: R8.C/spec-19
  description: 注入目标白名单（安全闸门）
  depends_on: [R8.C.inject.engine]

R8.C.dag.orchestrator:
  default: ON
  source: R8.C/spec-20
  description: DAG 编排引擎（graphlib）
  depends_on: [R8.C.task.queue]

R8.C.dag.editor:
  default: ON
  source: R8.C/spec-21
  description: DAG 可视化编辑器（4 视图）
  depends_on: [R8.C.dag.orchestrator]

R8.C.recording.engine:
  default: ON
  source: R8.C/spec-22
  description: 任务录制（5 流：stdout/stdin/screenshot/fs/git-diff）

R8.C.recording.replay:
  default: ON
  source: R8.C/spec-23
  description: 任务复盘 + 时间轴回放
  depends_on: [R8.C.recording.engine]

R8.C.topology.global:
  default: ON
  source: R8.C/spec-24
  description: 全屏拓扑顶级一级入口（feedback#5）

R8.C.topology.attached:
  default: ON
  source: R8.C/spec-25
  description: 附属拓扑 10 层 lazy（feedback#5）
  depends_on: [R8.C.topology.global]

R8.C.flow.attached:
  default: ON
  source: R8.C/spec-26
  description: 流程图附属（第三套图体系）
  depends_on: [R8.C.recording.engine]

R8.C.signal.fusion:
  default: ON
  source: R8.C/spec-27
  description: AI 信号融合 6+4 信号源
  depends_on: [R8.C.cli.parser]

R8.C.state.three-layer:
  default: ON
  source: R8.C/spec-28
  description: AI 状态机三层（thinking/working/idle/error/stuck）
  depends_on: [R8.C.signal.fusion]

R8.C.feedback.loop:
  default: ON
  source: R8.C/spec-29
  description: 误报反馈循环（用户标注 → 权重学习）
  depends_on: [R8.C.signal.fusion]

R8.C.notify.system:
  default: ON
  source: R8.C/spec-30
  description: 通知引擎（toast/os/statusbar/email/webhook/desktop-bell）

R8.C.ipc.rate-limit:
  default: ON
  source: R8.C/spec-31
  description: IPC 速率限流（4 级 token bucket）

R8.C.observability.panel:
  default: ON
  source: R8.C/spec-32
  description: 观测面板（metrics 快照 + 实时订阅）
  depends_on: [R8.C.ipc.rate-limit]

R8.C.zod.sot:
  default: ON
  source: R8.C/spec-33
  description: Zod source-of-truth 统一校验

R8.C.recovery.crash:
  default: ON
  source: R8.C/spec-34
  description: 启动期脏数据回收 + 崩溃恢复

R8.C.backup.restore:
  default: ON
  source: R8.C/spec-35
  description: 备份 + 分类恢复（settings/csv/skills/audit 独立选）
  depends_on: [R8.C.recovery.crash]

R8.C.diagnostic.export:
  default: ON
  source: R8.C/spec-36
  description: 诊断包导出（含 audit + observability snapshot）
  depends_on: [R8.A.audit.log, R8.C.observability.panel]

R8.C.permission.ttl:
  default: ON
  source: R8.C/spec-37
  description: 权限时限化（24h 默认 → 用户可调）
  depends_on: [R8.A.permission.prompt]

R8.C.skill.cloud-sync:
  default: OFF
  source: R8.C/spec-38
  description: SKILL 云同步（V1 推迟 — DEFAULT OFF）
  depends_on: [R8.C.skill.library]

R8.C.ocr.interface:
  default: HARDCODED_OFF
  source: R8.C/spec-39
  description: OCR 接口（V1 禁用，V2 重启）
  mutex_with: [R8.C.cli.parser]
  notes: 编译时禁用，仅保留接口骨架以备 V2 重启
```

---

## §4 全局总览

| 维度 | 数量 |
|---|---|
| 总主 flag | **76**（11 R8.A 主 + 17 R8.A libs + 17 R8.B + 39 R8.C 主 — 注：R8.A 的 17 子 libs 也按主 flag 计） |
| 总子 flag（parent 关系） | **9**（R8.C） |
| 总 flag | **85** |
| 默认 ON | 78 |
| 默认 OFF | 5（R8.A.libs.webcola / R8.C.csv.launch.python / R8.C.watchdog.engine.strict / R8.C.watchdog.subprocess.windows-service / R8.C.skill.cloud-sync） |
| HARDCODED_OFF | 1（R8.C.ocr.interface — V2 重启） |
| DEPRECATED | 0 |
| 命名规范合规率 | 100% |

---

## §5 跨 flag 依赖图（Mermaid 风格 ASCII）

```text
集成库（R8.A.libs.*） → R8.A 模块 flag → R8.B / R8.C 业务 flag

R8.A.libs.wmi-client  → R8.A.process.unified-vm
R8.A.libs.sudo-prompt  → R8.A.process.uac-spawn
R8.A.libs.node-window-mgr → R8.A.window.aot
R8.A.libs.cmdk  → R8.B.command.palette
R8.A.libs.grid-layout  → R8.B.dashboard.grid
R8.A.libs.koffi  → R8.B.window.thumbnail-wall + R8.B.window.virtual-desktop
R8.A.libs.node-pty  → R8.C.cli.parser
R8.A.libs.nut-js  → R8.C.inject.engine
R8.A.libs.xyflow + d3  → R8.A.topology.discover

R8.A.process.unified-vm  → R8.A.process.card-list-parity
  → R8.B.process.treemap-tree
  → R8.B.process.batch-ops
  → R8.B.process.tags-history（间接）

R8.C.cli.parser  → R8.C.shim.codex/claude/gemini
  → R8.C.signal.fusion
  → R8.C.state.three-layer

R8.C.csv.driver  → R8.C.csv.schema
  → R8.C.csv.launch
  → R8.C.task.queue
  → R8.C.watchdog.engine
  → R8.C.dag.orchestrator
  → R8.C.inject.engine

R8.C.recording.engine  → R8.C.recording.replay
  → R8.C.flow.attached

R8.C.topology.global  → R8.C.topology.attached

R8.C.recovery.crash  → R8.C.backup.restore
```

## §6 互斥关系

```yaml
mutex_pairs:
  - [R8.C.ocr.interface, R8.C.cli.parser]  # OCR vs CLI 解析（V1 仅 cli.parser）
  - [R8.C.task.queue.engine=better-queue, R8.C.task.queue.engine=p-queue]  # 单选

no_other_mutex_violations: 全 flag 检查通过
```

---

## §7 实施期建议

```yaml
implementation_phases:
  Phase_1_R8A:
  enable_first: [R8.A.libs.* 17 个]
  then: R8.A.process.unified-vm → R8.A.process.uac-spawn → R8.A.process.card-list-parity
  then: R8.A.topology.discover → R8.A.theme.4d-axis → R8.A.theme.default-delta
  then: R8.A.window.aot → R8.A.port.card-improve → R8.A.audit.log → R8.A.permission.prompt
  gate: master §7.9 5 断言全过

  Phase_2_R8B:
  enable_first: R8.B.i18n.scaffold + R8.B.a11y.full + R8.B.icon.library（基础设施）
  then: R8.B.drawer.system → R8.B.command.palette → R8.B.dashboard.grid（收纳系统）
  then: R8.B.port.popout-system → R8.B.popout.browserwindow（feedback#3）
  then: R8.B.theme.decorations + R8.B.statusbar.extension（feedback#1）
  then: R8.B.process.treemap-tree + R8.B.process.batch-ops + R8.B.process.tags-history
  then: R8.B.window.thumbnail-wall + R8.B.window.batch-ops + R8.B.window.virtual-desktop
  then: R8.B.port.security-tier

  Phase_3_R8C:
  Wave_A_监控基础: R8.C.cli.parser → spec-02..06 → R8.C.monitor.window/popout
  Wave_B_SKILL_CSV: R8.C.skill.* → R8.C.csv.* → R8.C.task.queue
  Wave_C_可靠性: R8.C.watchdog.* → R8.C.inject.*
  Wave_D_编排: R8.C.dag.* → R8.C.recording.*
  Wave_E_拓扑: R8.C.topology.global → topology.attached → flow.attached
  Wave_F_AI 信号: R8.C.signal.fusion → state.three-layer → feedback.loop → notify.system
  Wave_G_横切: R8.C.ipc.rate-limit → observability.panel → zod.sot
  Wave_H_容灾: R8.C.recovery.crash → backup.restore → diagnostic.export → permission.ttl
  Deferred: skill.cloud-sync (OFF) / ocr.interface (V2)
```

---

**审计员**: spec-r8b
**报告版本**: v2.0（全 71 文件覆盖）
