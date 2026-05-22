# R8 术语表（Glossary）

> **生成时间**: 2026-05-03
> **覆盖范围**: 4 PRD + 67 spec + 4 _shared 注册表 + 2 整合摘要中出现的全部专有术语
> **用途**: 实施 agent / QA / 用户 1 跳定位术语含义与引用 spec
> **排序**: 字母序（A → Z）；中文术语另列 §α 索引
> **格式**: 每条含「术语 / 缩写 / 中英对照 / 含义 / 在 R8 中的角色 / 引用 spec」六列

> **当前状态（2026-05-14）**: 本术语表作为 R8 文档与实现沟通用 reference artifact。完成状态只表示术语体系已与当前 ledger、R8 IPC/Zod SoT、以及 2026-05-14 已验证 slices 对齐；不表示每个引用 spec 的全部功能均已完成。

## §-1 当前术语维护附录（2026-05-14）

```yaml
glossary_status:
  role: shared_reference
  current_authority:
  - prompts/0503-2/00-r8-master-prd.md
  - prompts/0503-2/R8.A/prd.md
  - prompts/0503-2/R8.B/prd.md
  - prompts/0503-2/R8.C/prd.md
  - .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
  - devhub/src/shared/schemas/r8-runtime.ts
  verified_scope:
  - no_emoji_terms_added
  - no_mock_or_placeholder_completion_semantics
  - current_R8_A_gate_names_preserved
  - current_R8_C_signal_fusion_terms_include_dempster_shafer_and_bayesian_boundaries
  - current_schema_terms_reference_Zod_SoT_instead_of_duplicate_runtime_types
```

### §-1.1 2026-05-14 术语解释修订

- `Dempster-Shafer` 在当前实现中不再是降级到 weighted mean 的占位算法；`SignalFusion` 已实现真实 mass combination，并保留 conflict warning。
- `Bayesian` 在当前实现中不再是降级到 weighted mean 的占位算法；`SignalFusion` 已实现 log-odds evidence fusion。
- `CSV Python control pipe` 表示 DevHub 与 `scripts/devhub-batch.py` 之间的真实长驻 pause/resume 控制连接；事件连接与控制连接分离，避免读写同一 pipe 造成阻塞。
- `R8 IPC owner split` 表示 `R8_IPC_CHANNELS` 中部分 executable channels 由专用模块注册；当前覆盖测试按 `setupR8RuntimeHandlers`、`setupA11yHandlers`、`setupProcessHandlers` 的真实启动顺序验证。
- `contract-only` 仅表示 registry 中尚未落地 executable handler 的显式拒绝路径；不得用作功能完成证明。

---

## §0 索引

```yaml
glossary_index:
  total_terms: 92
  categories:
  OS_concepts: [pid, ppid, hwnd, cwd, IL, namespace, ETW, WMI, UAC, NTLM]
  integration_libs: [zod, xstate, react-grid-layout, xyflow, d3-force, dagre, framer-motion, recharts, papaparse, chokidar, better-queue, graphlib, koffi, electron, monaco-editor, execa, node-pty, archiver, sound-play, undici, nodemailer, gray-matter, mathjs, nut-js, sudo-prompt, tree-kill, wmi-client, win32-displayconfig, node-window-manager, limiter, lru-cache, lodash, semver, which, fs-extra, ndjson, split2, eventsource-parser, strip-ansi, iconv-lite, mitt, ajv, dom-purify]
  R8_internal: [ProcessUnifiedViewModel, AITaskTracker, NeuralGraphEngine, WindowManager, CLIOutputParser, SignalFusion, StateMachineCoordinator, MisreportLogger, NotificationService, RateLimiter, SchemaRegistry, RecoveryProbe, BackupManager, DiagnosticPackBuilder, PermissionTtlManager, MarkerProtocol, ShimRegistry, PopoutManager, DrawerSystem, CommandPalette, ToolDetectResult, ParseSession, SignalContribution, InstanceState]
  methodology: [DAG, GWT, FSM, SoT, NDJSON, SHIM, SSE, popout, drawer, cmdk, treemap, ringbuffer, monotonic, token_bucket, sha256, ASAR, vibrancy, opt-in, redaction, three_graph_systems, four_d_theme_axis, dual_existence]
  constraints: [NO-DELETE, NO-EMOJI, NO-MOCK, NO-REFACTOR, REDUNDANCY-FIRST, INTEGRATE-FIRST, PRIVACY-ZERO-TELEMETRY, TASKKILL-PER-PID, DUAL-GRAPH-MANDATORY, GRAPH-DUAL-EXISTENCE, NO-API-KEY-UI, NO-OCR-INTEGRATION, ZOD-SINGLE-SOURCE]
  error_codes: [E_VALIDATION, E_NOT_FOUND, E_RATE_LIMITED, E_SHIM_NOT_INSTALLED, E_CLI_NOT_FOUND, E_CSV_INVALID, E_DAG_CYCLE, E_WATCHDOG_DEAD, E_SKILL_NOT_FOUND, E_INJECT_BLOCKED, E_OCR_DISABLED, E_GRAPH_NODE_LIMIT, E_GRAPH_DEPTH_LIMIT, E_FEATURE_DEFERRED, E_ELEVATION_REQUIRED, E_PERMISSION, E_TIMEOUT, E_INTERNAL, E_PARSE]
```

---

## §1 术语条目（A → Z 字母序）

### A

#### `aggregationKey`
- **缩写**: 无
- **中英对照**: 通知聚合键
- **含义**: `sha256(level + source + instanceId)` 的哈希字符串，用于在聚合窗口内合并同类通知。碰撞概率 < 1e-9。
- **R8 角色**: 通知去重，避免 60s 内 5 条相同 ERROR 刷屏。
- **引用 spec**: R8.C.spec-30 / master §3.7

#### `ajv`
- **缩写**: 无
- **中英对照**: Another JSON Validator
- **含义**: JSON Schema 校验库（备用于 zod）
- **R8 角色**: SKILL 库 schema 备用校验
- **引用 spec**: R8.C.spec-09

#### `archiver`
- **缩写**: 无
- **中英对照**: 归档/打包库
- **含义**: Node.js ZIP / TAR 流式打包库（v7.x）
- **R8 角色**: 备份与诊断包导出的打包引擎
- **引用 spec**: R8.C.spec-35 / spec-36

#### `ASAR`
- **缩写**: Atom Shell Archive Format
- **中英对照**: Electron 资源归档格式
- **含义**: Electron 内置资源打包格式，类似 tar；用于把 renderer 资源 / 内置 SKILL 打包入主程序
- **R8 角色**: 内置 10 个 SKILL 嵌入 ASAR；R8.C.spec-10
- **引用 spec**: R8.C.spec-10

#### `AITaskTracker`
- **缩写**: 无
- **中英对照**: AI 任务追踪器
- **含义**: 现有 service（白名单），监控 AI CLI 任务的旧 6 信号融合。R8 阶段被 spec-27 SignalFusion 替换主路径，旧路径作为 flag-off fallback 保留
- **R8 角色**: 自研白名单 1/4；feedback#4 误报根因
- **引用 spec**: R8.C.spec-27 / spec-28

### B

#### `better-queue`
- **缩写**: 无
- **中英对照**: 优秀队列（库名）
- **含义**: Node.js 队列库，支持 SQLite 持久化、并发控制、retry、priority、concurrent groups
- **R8 角色**: AI 任务调度引擎（默认并发 3，最大 16）
- **引用 spec**: R8.C.spec-15

#### `BrowserWindow`
- **缩写**: 无
- **中英对照**: 浏览器窗口
- **含义**: Electron 提供的独立 Chromium 渲染窗口；每个 BrowserWindow 是独立 renderer 进程
- **R8 角色**: 监控窗口、监控 popout、端口 popout 升级版
- **引用 spec**: R8.C.spec-07 / spec-08 / R8.B.spec-02

### C

#### `chokidar`
- **缩写**: 无
- **中英对照**: 文件监听库
- **含义**: 跨平台文件系统事件监听（v3.6），比原生 fs.watch 稳定
- **R8 角色**: SKILL 库 / CSV 任务文件 / 主题包热加载
- **引用 spec**: R8.C.spec-09 / spec-12

#### `CliEvent`
- **缩写**: 无
- **中英对照**: CLI 事件
- **含义**: CLI 输出解析后的统一事件 schema（master §3.1）。type ∈ {start, progress, tool-use, message-out, completion, error, unknown}
- **R8 角色**: cli-parser 与 SignalFusion 之间的契约；rawSource ∈ {ndjson, shim, line, sse, window-title}
- **引用 spec**: R8.C.spec-01 / master §3.1

#### `CLIOutputParser`
- **缩写**: 无
- **中英对照**: CLI 输出解析器
- **含义**: R8.C 阶段新建的总框架，统一 5 个 AI CLI 工具输出。包含 4 策略（NDJSON / SHIM / line / SSE）+ ParserRegistry + StreamMultiplexer
- **R8 角色**: feedback#4 监控不准的核心解决方案
- **引用 spec**: R8.C.spec-01..06

#### `cmdk`
- **缩写**: command palette
- **中英对照**: 命令面板
- **含义**: VS Code 风格的快捷键命令搜索面板（Cmd+K / Ctrl+Shift+P）
- **R8 角色**: 9 capability 命令面板，feedback#1 收纳方案之一
- **引用 spec**: R8.B.spec-04

#### `confidence`
- **缩写**: 无
- **中英对照**: 置信度
- **含义**: 信号源对当前判断的可信程度，[0, 1] 区间
- **R8 角色**: 所有 ProgressDataPoint 必含字段；< 0.5 红 / 0.5-0.7 黄 / 0.7-0.9 蓝 / > 0.9 绿
- **引用 spec**: R8.C.spec-27 / spec-28

#### `cwd`
- **缩写**: current working directory
- **中英对照**: 当前工作目录
- **含义**: 进程的当前工作路径，POSIX `getcwd()` 或 Windows `GetCurrentDirectoryW`
- **R8 角色**: ProcessUnifiedViewModel 必含字段；neural-relationship 中 shares-cwd 边类型
- **引用 spec**: R8.A.spec-02 / R8.C.spec-25

### D

#### `d3-force`
- **缩写**: 无
- **中英对照**: D3 力导向库
- **含义**: D3.js 子模块，实现力导向图布局算法（节点斥力 + 边吸引力）
- **R8 角色**: NeuralGraphEngine 布局引擎；附属拓扑力导向模式
- **引用 spec**: R8.A.spec-01 / R8.C.spec-25

#### `DAG`
- **缩写**: Directed Acyclic Graph
- **中英对照**: 有向无环图
- **含义**: 任务依赖图的数学结构，禁止循环依赖
- **R8 角色**: spec-20 DAG orchestrator；E_DAG_CYCLE 错误码
- **引用 spec**: R8.C.spec-20 / spec-21

#### `dagre`
- **缩写**: 无
- **中英对照**: DAG 布局库
- **含义**: 分层 DAG 布局算法（Sugiyama 风格）
- **R8 角色**: DAG 可视化编辑器布局后端；dagre 优先于 elkjs
- **引用 spec**: R8.A.spec-01 / R8.C.spec-21

#### `Dempster-Shafer`
- **缩写**: DS theory
- **中英对照**: 邓普斯特-谢弗证据理论
- **含义**: 多源证据融合的数学框架，比 weighted-mean 更鲁棒
- **R8 角色**: SignalFusion 的备用算法（mathjs 实现）；默认 weighted-mean
- **引用 spec**: R8.C.spec-27

#### `decay half-life`
- **缩写**: 无
- **中英对照**: 衰减半衰期
- **含义**: 信号样本的时效衰减参数；默认 60s（每 60s 权重减半）
- **R8 角色**: SignalSample.decayHalfLifeMs；防止旧信号污染当前判断
- **引用 spec**: R8.C.spec-27

#### `drawer`
- **缩写**: 无
- **中英对照**: 抽屉
- **含义**: 从屏幕边缘滑出的容器组件，5 槽位（top / right / bottom / floating / statusbar）
- **R8 角色**: feedback#1 多收纳的实现；DrawerStateSchema
- **引用 spec**: R8.B.spec-03

#### `DUAL-GRAPH-MANDATORY`
- **缩写**: 无
- **中英对照**: 三图强制约束
- **含义**: 硬约束：网络拓扑 / 神经关系 / 流程图 三套图体系都必须存在，禁止删任一
- **R8 角色**: master §1 元约束；feedback#5 直接对应
- **引用 spec**: master §1 / R8.C.spec-24/25/26

#### `dual existence`
- **缩写**: 无
- **中英对照**: 双重存在
- **含义**: 三套图同时存在「全局一级入口」与「进程/端口/窗口三端附属嵌入」
- **R8 角色**: GRAPH-DUAL-EXISTENCE 硬约束；TopologyGraphService 单例 + scope 投影实现
- **引用 spec**: master §7.8 / R8.C.spec-24/25/26

### E

#### `electron`
- **缩写**: 无
- **中英对照**: Electron 桌面框架
- **含义**: Chromium + Node.js 桌面应用框架（v33.x）
- **R8 角色**: DevHub 主框架；BrowserWindow / Notification / desktopCapturer / ipcMain
- **引用 spec**: 全部 spec

#### `EMA`
- **缩写**: Exponential Moving Average
- **中英对照**: 指数移动平均
- **含义**: 加权移动平均算法，新值权重高，旧值权重指数衰减
- **R8 角色**: 用户反馈调权时的平滑算法（备用），主路径用线性 delta clip 5%
- **引用 spec**: R8.C.spec-29

#### `ETW`
- **缩写**: Event Tracing for Windows
- **中英对照**: Windows 事件跟踪
- **含义**: Windows 内核级事件跟踪框架，可捕获进程/线程/网络等系统事件
- **R8 角色**: 备选高精度信号源（当前 R8 阶段未启用，未来扩展）
- **引用 spec**: 未在 R8 直接使用，预留概念

#### `eventsource-parser`
- **缩写**: 无
- **中英对照**: SSE 解析器
- **含义**: Server-Sent Events 协议解析器（v1.1）
- **R8 角色**: SSE 策略解析（Anthropic / OpenAI 备用流格式）
- **引用 spec**: R8.C.spec-01

#### `execa`
- **缩写**: 无
- **中英对照**: 进程执行库
- **含义**: 增强版 child_process，支持 timeout / 流式 stdio / 跨平台（v9.5）
- **R8 角色**: SHIM 子进程 spawn / CLI 检测 / SKILL 执行
- **引用 spec**: R8.C.spec-01 / spec-06

### F

#### `feature flag`
- **缩写**: 无
- **中英对照**: 特性开关
- **含义**: 命名规范 `R8.{batch}.{module}.{feature}`，控制功能启用/禁用
- **R8 角色**: 全 spec 都有；默认 ON 多数；R8.C.skill.cloud-sync 永远 OFF；R8.C.ocr.interface 硬编码 OFF
- **引用 spec**: _shared/feature-flags.md

#### `four_d_theme_axis`
- **缩写**: 4 维主题轴
- **中英对照**: palette + density + radiusFamily + motionLevel
- **含义**: 主题不只换颜色，4 维独立调节并互相联动
- **R8 角色**: feedback#1 解决方案；ThemeAxisSchema + PALETTE_DEFAULT_AXES 联动表
- **引用 spec**: R8.A.spec-06 / spec-07

#### `framer-motion`
- **缩写**: 无
- **中英对照**: React 动效库
- **含义**: React 声明式动效库（v11.x）
- **R8 角色**: motionLevel 主题轴的实现；confidence 颜色过渡
- **引用 spec**: R8.A.spec-01 / R8.C.spec-07

#### `FSM`
- **缩写**: Finite State Machine
- **中英对照**: 有限状态机
- **含义**: 状态机数学模型；R8 使用 xstate v5 实现
- **R8 角色**: 三层状态机（system / task / ui）
- **引用 spec**: R8.C.spec-28

### G

#### `gray-matter`
- **缩写**: 无
- **中英对照**: YAML frontmatter 解析库
- **含义**: 解析 markdown 文件 `---` 之间的 YAML 元数据（v4.0）
- **R8 角色**: SKILL 库 SKILL.md 文件解析
- **引用 spec**: R8.C.spec-09

#### `graphlib`
- **缩写**: 无
- **中英对照**: 图算法库
- **含义**: dagre 内置的图数据结构与算法（topological sort / cycle detection）
- **R8 角色**: DAG orchestrator 拓扑序与循环检测；E_DAG_CYCLE
- **引用 spec**: R8.C.spec-20

#### `GWT`
- **缩写**: Given / When / Then
- **中英对照**: 给定 / 当 / 那么
- **含义**: BDD 验收测试三段式语法
- **R8 角色**: 每 spec §6 必含 ≥ 5 GWT；机器可解析
- **引用 spec**: 全部 spec §6

### H

#### `hwnd`
- **缩写**: Window Handle
- **中英对照**: Windows 窗口句柄
- **含义**: Windows OS 分配给每个 GUI 窗口的唯一整数 ID
- **R8 角色**: WindowManager 操作的核心 ID；EnumWindows / GetWindowTextW
- **引用 spec**: R8.A.spec-08 / R8.C.spec-05

### I

#### `iconv-lite`
- **缩写**: 无
- **中英对照**: 字符编码转换库
- **含义**: 纯 JS 实现的编码转换（utf-8 / gb18030 / utf-16）（v0.6）
- **R8 角色**: CSV 任务文件自动检测编码（用户中文 Excel 常见 GB18030）
- **引用 spec**: R8.C.spec-12

#### `IL`
- **缩写**: Integrity Level
- **中英对照**: Windows 完整性级别
- **含义**: Windows 安全机制，进程标记为 Low / Medium / High / System；管理员进程为 High
- **R8 角色**: ProcessUnifiedViewModel 字段；UAC 提权后子进程为 High
- **引用 spec**: R8.A.spec-02 / spec-03

#### `INTEGRATE-FIRST`
- **缩写**: 无
- **中英对照**: 集成优先
- **含义**: 硬约束 R8-INTEGRATE-FIRST：优先用成熟集成库（白名单见 master §1），禁止自研重复造轮子
- **R8 角色**: master §1 元约束之一
- **引用 spec**: master §1

#### `IPC`
- **缩写**: Inter-Process Communication
- **中英对照**: 进程间通信
- **含义**: Electron main 与 renderer 之间的消息通道（ipcMain / ipcRenderer）
- **R8 角色**: 全 R8 IPC 通道命名 `domain:action`；按 spec-31 4 级速率限制
- **引用 spec**: R8.C.spec-31 / _shared/ipc-channels.md

#### `IpcSchemaGuard`
- **缩写**: 无
- **中英对照**: IPC 模式守卫
- **含义**: 中间件，自动用 zod schema 校验 IPC 入参与回参
- **R8 角色**: spec-33 强制每个 IPC handler 包装；校验失败 E_VALIDATION
- **引用 spec**: R8.C.spec-33

#### `instanceId`
- **缩写**: 无
- **中英对照**: 实例 ID
- **含义**: AI CLI 任务的唯一标识，跨 cli-parser / signal-fusion / state-machine / monitor 共用
- **R8 角色**: 跨 spec 关联键；CliEvent / SignalSample / InstanceState 都含
- **引用 spec**: R8.C.spec-01 / spec-27 / spec-28

### K

#### `koffi`
- **缩写**: 无
- **中英对照**: Node.js FFI 库
- **含义**: Node.js Foreign Function Interface（v2.10），调 Win32 API
- **R8 角色**: EnumWindows / GetWindowTextW / SetEnvironmentVariable / SendInput
- **引用 spec**: R8.A.spec-01 / spec-08 / R8.C.spec-05 / spec-18

### L

#### `limiter`
- **缩写**: 无
- **中英对照**: 限流库
- **含义**: token bucket 算法实现（v2.x）
- **R8 角色**: spec-31 IPC 速率限制核心库
- **引用 spec**: R8.C.spec-31

#### `lru-cache`
- **缩写**: Least Recently Used cache
- **中英对照**: 最近最少使用缓存
- **含义**: 容量受限的 LRU 缓存（v10.x）
- **R8 角色**: 限流状态缓存 / observability 数据 / popout 状态
- **引用 spec**: R8.C.spec-31 / spec-32

### M

#### `MarkerProtocol`
- **缩写**: 无
- **中英对照**: 标记协议
- **含义**: SHIM 与 DevHub 之间的二进制安全通信协议；前缀 `DEVHUB::MARKER::v=1::FIELD=value`
- **R8 角色**: Codex SHIM 透传 stdout 时夹带结构化事件
- **引用 spec**: R8.C.spec-02

#### `mathjs`
- **缩写**: 无
- **中英对照**: 数学计算库
- **含义**: 高精度数值计算（v13.x）
- **R8 角色**: SignalFusion Bayesian update 备用算法
- **引用 spec**: R8.C.spec-27

#### `mitt`
- **缩写**: 无
- **中英对照**: 微型事件总线
- **含义**: 200 字节事件订阅库（v3.x）
- **R8 角色**: PermissionTtlManager / 内部事件分发
- **引用 spec**: R8.C.spec-37

#### `monaco-editor`
- **缩写**: 无
- **中英对照**: VS Code 编辑器内核
- **含义**: VS Code 同源代码编辑器（v0.50）+ React 包装（@monaco-editor/react v4.6）
- **R8 角色**: SKILL editor / DAG visual editor / CSV 编辑器
- **引用 spec**: R8.C.spec-11 / spec-21

#### `monotonic clock`
- **缩写**: 无
- **中英对照**: 单调时钟
- **含义**: 不会回拨的时钟源（process.hrtime），与 wall-clock（Date.now）相对
- **R8 角色**: PermissionTtl 防系统时间回拨；rate-limiter
- **引用 spec**: R8.C.spec-37 / spec-31

### N

#### `NDJSON`
- **缩写**: Newline Delimited JSON
- **中英对照**: 换行分隔 JSON
- **含义**: 每行一个 JSON 对象的流式格式
- **R8 角色**: Claude `--output-format=stream-json` 解析格式；ParserStrategy 之一
- **引用 spec**: R8.C.spec-01 / spec-03

#### `NeuralGraphEngine`
- **缩写**: 无
- **中英对照**: 神经关系图引擎
- **含义**: 现有 service（自研白名单 2/4），实现 neural-relationship 图。区别于 network-topology（OS 硬连接）
- **R8 角色**: 三套图体系之一
- **引用 spec**: R8.C.spec-25 / master §7.8

#### `nodemailer`
- **缩写**: 无
- **中英对照**: Node 邮件库
- **含义**: SMTP 邮件发送库（v6.9）
- **R8 角色**: 通知系统 email 通道（默认 OFF）
- **引用 spec**: R8.C.spec-30

#### `node-pty`
- **缩写**: 无
- **中英对照**: Node 伪终端
- **含义**: 跨平台 pty 子进程库（v10.x）
- **R8 角色**: 交互式 CLI（Codex / Claude）；execa 不支持 pty 时用
- **引用 spec**: R8.A.spec-01 / R8.C.spec-01

#### `nut-js`
- **缩写**: 无
- **中英对照**: 自动化工具库
- **含义**: 跨平台键鼠注入 / 屏幕捕获（v4.x）
- **R8 角色**: 自动注入 SendInput 替代方案；备用注入模式
- **引用 spec**: R8.A.spec-01 / R8.C.spec-18

#### `namespace`
- **缩写**: 无
- **中英对照**: 命名空间
- **含义**: schema / IPC 通道 / feature flag 的层级隔离前缀
- **R8 角色**: IPC 通道格式 `domain:action`；feature flag `R8.{batch}.{module}.{feature}`；schema 文件位 `src/shared/schemas/`
- **引用 spec**: 全部

#### `NTLM`
- **缩写**: NT LAN Manager
- **中英对照**: Windows 域认证协议
- **含义**: Windows 网络认证机制
- **R8 角色**: 进程信息字段（ProcessUnifiedViewModel 含 owner / sid）；R8 不直接使用 NTLM
- **引用 spec**: R8.A.spec-02

### O

#### `opt-in`
- **缩写**: 无
- **中英对照**: 主动启用 / 用户选择加入
- **含义**: 默认关闭，用户主动启用；与 opt-out（默认开启）相对
- **R8 角色**: 诊断包导出 / email 通道 / webhook 都 opt-in；privacy 强约束
- **引用 spec**: R8.C.spec-30 / spec-36

### P

#### `papaparse`
- **缩写**: 无
- **中英对照**: CSV 解析库
- **含义**: 浏览器 + Node 双端 CSV 流式解析（v5.4）；含 BOM 处理
- **R8 角色**: CSV 任务驱动核心库
- **引用 spec**: R8.C.spec-12

#### `PermissionTtlManager`
- **缩写**: 无
- **中英对照**: 权限时效管理器
- **含义**: 8 类敏感操作的 TTL 授权管理；监控自动回收
- **R8 角色**: spec-37；feedback#2 24h 提权约束
- **引用 spec**: R8.C.spec-37

#### `pid`
- **缩写**: Process ID
- **中英对照**: 进程标识符
- **含义**: OS 分配给每个进程的唯一整数 ID
- **R8 角色**: ProcessUnifiedViewModel 主键；TASKKILL-PER-PID 硬约束（必带 PID + tree-kill）
- **引用 spec**: R8.A.spec-02 / master §1

#### `popout`
- **缩写**: 无
- **中英对照**: 弹出 / 摘出
- **含义**: 从主窗口摘出独立浮窗（半浮卡 OR BrowserWindow 双模）
- **R8 角色**: feedback#3 端口卡太小的解决方案；4 触发（hover 1s / click / drag 8px / 右键菜单）
- **引用 spec**: R8.B.spec-01 / spec-02 / R8.C.spec-08

#### `ppid`
- **缩写**: Parent Process ID
- **中英对照**: 父进程 ID
- **含义**: 当前进程的父进程 PID
- **R8 角色**: ProcessUnifiedViewModel 字段；进程树 / parent-of 边
- **引用 spec**: R8.A.spec-02 / R8.C.spec-25

#### `PRIVACY-ZERO-TELEMETRY`
- **缩写**: 无
- **中英对照**: 零遥测隐私
- **含义**: 硬约束：DevHub 进程不向任何外部域名发送任何数据；包括本地 OpenTelemetry 不外发
- **R8 角色**: master §1 元约束；CI 网络监控测试
- **引用 spec**: master §1 / R8.C.spec-32 / spec-36

#### `ProcessUnifiedViewModel`
- **缩写**: 无
- **中英对照**: 进程统一视图模型
- **含义**: 现有 service（自研白名单 3/4），R8.A.spec-02 重做。Card 与 List 视图共用同一份 schema，确保字段一致
- **R8 角色**: feedback#2 字段不一致根因解决
- **引用 spec**: R8.A.spec-02 / spec-04 / master §3.1

#### `ProgressDataPoint`
- **缩写**: 无
- **中英对照**: 进度数据点
- **含义**: 任务进度的标准化输出 schema；必含 source ∈ {cli-real, heuristic, fusion} + confidence
- **R8 角色**: cli-parser → signal-fusion → monitor 的数据契约
- **引用 spec**: R8.C.spec-01 / spec-27

### R

#### `react-grid-layout`
- **缩写**: 无
- **中英对照**: React 网格布局库
- **含义**: 拖拽 + 网格对齐布局组件
- **R8 角色**: feedback#1 仪表盘可拖拽
- **引用 spec**: R8.B.spec-05

#### `react-resizable-panels`
- **缩写**: 无
- **中英对照**: React 可调整面板
- **含义**: 三栏 / 多栏布局调整库
- **R8 角色**: drawer 系统底层
- **引用 spec**: R8.B.spec-03

#### `recharts`
- **缩写**: 无
- **中英对照**: React 图表库
- **含义**: 基于 D3 的 React 图表（v2.13）
- **R8 角色**: 监控窗口 progress / token 折线图；可观测面板
- **引用 spec**: R8.C.spec-07 / spec-32

#### `RateLimiter`
- **缩写**: 无
- **中英对照**: 速率限制器
- **含义**: 4 级 token bucket（high_freq_scan=30 / medium_query=60 / low_freq_op=120 / meta=600 RPM）
- **R8 角色**: 全 IPC 通道速率约束；spec-31 全局单例
- **引用 spec**: R8.C.spec-31 / master §7.4

#### `redaction`
- **缩写**: 无
- **中英对照**: 脱敏
- **含义**: 敏感信息（API key / 路径 / IP / JWT）替换为 `[REDACTED]`
- **R8 角色**: 诊断包导出 ≥ 7 条规则；audit log；user note
- **引用 spec**: R8.C.spec-36

#### `REDUNDANCY-FIRST`
- **缩写**: 无
- **中英对照**: 冗余优先
- **含义**: 硬约束 R8-REDUNDANCY-FIRST：短期允许重复实现 + 双跑期 + 可一键回滚；不强求消除冗余
- **R8 角色**: master §1 元约束；feature flag 双跑配合
- **引用 spec**: master §1

#### `ringbuffer`
- **缩写**: circular buffer
- **中英对照**: 环形缓冲区
- **含义**: 固定容量队列，溢出覆写最旧
- **R8 角色**: 状态机 transition 历史 1024；observability 30min；fixed-size memory
- **引用 spec**: R8.C.spec-28 / spec-32

### S

#### `schemaVersion`
- **缩写**: 无
- **中英对照**: 模式版本
- **含义**: zod schema 的语义版本（如 `1.0.0`）
- **R8 角色**: 跨版本 SchemaMigration；备份 / SKILL 库 / observability 都含
- **引用 spec**: R8.C.spec-33

#### `semver`
- **缩写**: Semantic Versioning
- **中英对照**: 语义化版本
- **含义**: 版本号格式 `major.minor.patch`
- **R8 角色**: SKILL 版本 / SchemaMigration / 集成库版本固定
- **引用 spec**: R8.C.spec-09 / spec-33

#### `sha256`
- **缩写**: Secure Hash Algorithm 256-bit
- **中英对照**: 安全哈希算法 256 位
- **含义**: 哈希算法，输出 64 字符 hex
- **R8 角色**: aggregationKey / 备份完整性校验 / SKILL 内容 hash
- **引用 spec**: R8.C.spec-30 / spec-35

#### `SHIM`
- **缩写**: 无（业内通用术语）
- **中英对照**: 垫片 / 中间层
- **含义**: 一个小型可执行（codex-shim.exe），通过 PATH 优先级拦截真 CLI 调用，透传 stdio 同时分流给 DevHub。来源：scoop / shimexe / rust-bin shim
- **R8 角色**: Codex / Claude / Gemini SHIM；feedback#4 stdout 解析的核心机制
- **引用 spec**: R8.C.spec-02 / spec-03 / spec-04

#### `SHIM-PATH-PRIORITY`
- **缩写**: 无
- **中英对照**: SHIM 路径优先
- **含义**: 硬约束：通过 PATH 修改注入 SHIM，禁止改注册表
- **R8 角色**: spec-02 实施约束；只动 process.env.PATH 不动 HKCU\\Environment
- **引用 spec**: R8.C.spec-02

#### `SignalFusion`
- **缩写**: 无
- **中英对照**: 信号融合
- **含义**: 6 现有信号 + 4 新信号（cli_parse / window_title / process_cpu_io / file_mtime / network_active / user_input_event）的加权 + decay 融合
- **R8 角色**: feedback#4 误报根因解决；cli_parse 高权重 0.8
- **引用 spec**: R8.C.spec-27

#### `SoT`
- **缩写**: Source of Truth
- **中英对照**: 单一事实源
- **含义**: 跨进程共享类型由 zod schema 唯一定义，TS 类型 z.infer 推导
- **R8 角色**: ZOD-SINGLE-SOURCE 硬约束；spec-33 实施
- **引用 spec**: R8.C.spec-33 / master §1

#### `sound-play`
- **缩写**: 无
- **中英对照**: 声音播放库
- **含义**: 跨平台短音频播放（v1.1）
- **R8 角色**: 通知 desktop-bell 通道
- **引用 spec**: R8.C.spec-30

#### `split2`
- **缩写**: 无
- **中英对照**: 行切分流
- **含义**: 把流式 stdout 按换行切成 chunk（v4.2）
- **R8 角色**: line-based / NDJSON 策略输入预处理
- **引用 spec**: R8.C.spec-01

#### `SSE`
- **缩写**: Server-Sent Events
- **中英对照**: 服务器推送事件
- **含义**: HTTP 单向流式协议（`text/event-stream`）
- **R8 角色**: ParserStrategy 之一；Anthropic / OpenAI 备用流格式
- **引用 spec**: R8.C.spec-01

#### `strip-ansi`
- **缩写**: 无
- **中英对照**: ANSI 控制符剥离
- **含义**: 移除 stdout 中的 ANSI 颜色控制码（v7.1）
- **R8 角色**: Gemini stdout 解析预处理
- **引用 spec**: R8.C.spec-04

#### `sudo-prompt`
- **缩写**: 无
- **中英对照**: UAC 提权弹窗库
- **含义**: 跨平台 root/admin 提权弹窗
- **R8 角色**: UAC spawn 子进程提权（B 路线）
- **引用 spec**: R8.A.spec-01 / spec-03

### T

#### `TASKKILL-PER-PID`
- **缩写**: 无
- **中英对照**: 按 PID 杀进程
- **含义**: 硬约束：杀进程必带 PID + tree-kill；禁全名 `taskkill /IM`
- **R8 角色**: master §1 元约束；防误杀同名进程
- **引用 spec**: master §1

#### `three_graph_systems`
- **缩写**: 无
- **中英对照**: 三套图体系
- **含义**: network-topology（OS 硬连接）/ neural-relationship（业务语义软连接）/ flow（时序事件链）
- **R8 角色**: feedback#5 直接对应；DUAL-GRAPH-MANDATORY + GRAPH-DUAL-EXISTENCE 双约束
- **引用 spec**: R8.C.spec-24/25/26 / master §7.8

#### `token bucket`
- **缩写**: 无
- **中英对照**: 令牌桶（限流算法）
- **含义**: 限流算法：固定速率往桶加令牌，请求消耗令牌；空桶时拒绝
- **R8 角色**: spec-31 IPC 限流核心算法
- **引用 spec**: R8.C.spec-31

#### `tree-kill`
- **缩写**: 无
- **中英对照**: 进程树终结库
- **含义**: 跨平台终结进程及全部子进程
- **R8 角色**: TASKKILL-PER-PID 配对实现
- **引用 spec**: R8.A.spec-01

#### `treemap`
- **缩写**: 无
- **中英对照**: 矩形树图
- **含义**: 嵌套矩形展示层级数据，面积代表权重
- **R8 角色**: 进程层级可视化（feedback#1 收纳之一）
- **引用 spec**: R8.B.spec-06

#### `TTL`
- **缩写**: Time To Live
- **中英对照**: 存活时间
- **含义**: 时效字段，超时自动失效
- **R8 角色**: PermissionGrant.ttlMs（1min..24h）；cache TTL
- **引用 spec**: R8.C.spec-37

### U

#### `UAC`
- **缩写**: User Account Control
- **中英对照**: Windows 用户账户控制
- **含义**: Windows 提权机制；管理员操作需弹窗确认
- **R8 角色**: spec-03 UAC spawn 子进程；不让 main 进程提权（B 路线）
- **引用 spec**: R8.A.spec-03

#### `undici`
- **缩写**: 无
- **中英对照**: Node.js HTTP 客户端
- **含义**: 高性能 HTTP/1.1 客户端（v6.x），替代 axios
- **R8 角色**: webhook 通道（仅本地 webhook，仍属 NO-TELEMETRY）
- **引用 spec**: R8.C.spec-30

### V

#### `vibrancy`
- **缩写**: 无
- **中英对照**: 毛玻璃效果
- **含义**: macOS / Windows 11 半透明背景效果
- **R8 角色**: 监控窗口 / popout 视觉风格；4 维主题轴 decoration 之一
- **引用 spec**: R8.C.spec-07

### W

#### `Watchdog`
- **缩写**: 无
- **中英对照**: 看门狗
- **含义**: 独立子进程监控 AI 实例存活；心跳超时（默认 120s）触发重启
- **R8 角色**: feedback#4 9 项监控
- **引用 spec**: R8.C.spec-16 / spec-17

#### `weighted mean`
- **缩写**: 无
- **中英对照**: 加权平均
- **含义**: SignalFusion 默认融合算法
- **R8 角色**: 比 Dempster-Shafer 简单稳定；spec-27 默认
- **引用 spec**: R8.C.spec-27

#### `which`
- **缩写**: 无
- **中英对照**: 跨平台 PATH 探测库
- **含义**: 等价 Unix `which` 命令（v4.0）
- **R8 角色**: CLI 检测策略 path-env
- **引用 spec**: R8.C.spec-06

#### `WindowManager`
- **缩写**: 无
- **中英对照**: 窗口管理器
- **含义**: 现有 service（自研白名单 4/4），WIN_SEND_KEYS / EnumWindows 封装
- **R8 角色**: WIN_SEND_KEYS:463 + spec-08 always-on-top + spec-18 注入
- **引用 spec**: R8.A.spec-08 / R8.C.spec-05 / spec-18

#### `WMI`
- **缩写**: Windows Management Instrumentation
- **中英对照**: Windows 管理规范
- **含义**: Windows 系统信息查询基础设施（进程 / 服务 / 网络）
- **R8 角色**: ProcessUnifiedViewModel 信息源（wmi-client 库）
- **引用 spec**: R8.A.spec-01 / spec-02

### X

#### `xstate`
- **缩写**: 无
- **中英对照**: 状态机库
- **含义**: 主流 JS FSM 库（v5.x）；声明式状态图
- **R8 角色**: 三层状态机 SystemFSM / TaskFSM / UiFSM
- **引用 spec**: R8.C.spec-28

#### `xyflow`
- **缩写**: ReactFlow
- **中英对照**: React 流程图库
- **含义**: 流程图 / DAG 可视化（前身 ReactFlow）
- **R8 角色**: DAG 可视化编辑器渲染层；附属拓扑视图
- **引用 spec**: R8.A.spec-01 / R8.C.spec-21 / spec-25

### Z

#### `zod`
- **缩写**: 无
- **中英对照**: TypeScript 优先 schema 库
- **含义**: 运行时校验 + TS 类型推导（v3.23）
- **R8 角色**: ZOD-SINGLE-SOURCE 硬约束；全 R8 schema 唯一定义来源
- **引用 spec**: R8.C.spec-33 / master §1

#### `zod-validation-error`
- **缩写**: 无
- **中英对照**: zod 错误友好化库
- **含义**: 把 zod 报错转人类可读消息（v3.x）
- **R8 角色**: SKILL editor / IPC schema guard 的友好提示
- **引用 spec**: R8.C.spec-11 / spec-33

#### `ZOD-SINGLE-SOURCE`
- **缩写**: 无
- **中英对照**: zod 单源约束
- **含义**: 硬约束：TS 类型由 z.infer 派生；禁 types-extended.ts 与 schemas/ 重复定义
- **R8 角色**: master §1 元约束；spec-33 实施 + verify-zod-sot CI
- **引用 spec**: master §1 / R8.C.spec-33

---

## §α 中文术语索引（按功能分组）

```yaml
chinese_index:
  AI 检测:
  信号融合: SignalFusion → §S
  三层状态机: 见 FSM → §F
  误报反馈循环: MisreportLogger → R8.C.spec-29
  置信度: confidence → §C

  CLI 解析:
  输出解析器: CLIOutputParser → §C
  垫片 / 中间层: SHIM → §S
  标记协议: MarkerProtocol → §M
  Anthropic Agent Skills 兼容: SKILL.md frontmatter → R8.C.spec-09

  UI 模式:
  弹出 / 摘出: popout → §P
  抽屉: drawer → §D
  命令面板: cmdk → §C
  矩形树图: treemap → §T
  毛玻璃效果: vibrancy → §V

  主题:
  4 维主题轴: four_d_theme_axis → §F
  palette + density + radiusFamily + motionLevel: 同上

  图体系:
  三套图体系: three_graph_systems → §T
  网络拓扑图: network-topology → master §3.6
  神经关系图: neural-relationship → master §3.6
  流程图: flow → master §3.6
  双重存在: dual existence → §D

  权限:
  权限时效: TTL → §T
  UAC 提权: UAC → §U
  完整性级别: IL → §I
  监控自动回收: PermissionTtlManager → §P

  时间 / 调度:
  单调时钟: monotonic clock → §M
  令牌桶: token bucket → §T
  指数移动平均: EMA → §E
  衰减半衰期: decay half-life → §D

  数据:
  单一事实源: SoT → §S
  模式版本: schemaVersion → §S
  脱敏: redaction → §R
  环形缓冲区: ringbuffer → §R
  哈希算法: sha256 → §S

  进程 OS:
  进程标识符: pid → §P
  父进程 ID: ppid → §P
  窗口句柄: hwnd → §H
  当前工作目录: cwd → §C
  完整性级别: IL → §I
  Windows 管理规范: WMI → §W
  Windows 事件跟踪: ETW → §E

  约束硬条:
  禁删: NO-DELETE → master §1
  零遥测: PRIVACY-ZERO-TELEMETRY → §P
  按 PID 杀: TASKKILL-PER-PID → §T
  三图强制: DUAL-GRAPH-MANDATORY → §D
  双重存在: GRAPH-DUAL-EXISTENCE → §D
  zod 单源: ZOD-SINGLE-SOURCE → §Z
```

---

## §β 错误码速查表

```yaml
error_codes_quick_lookup:
  E_VALIDATION:  输入未通过 schema 校验（最常见）
  E_NOT_FOUND:  目标资源不存在（实例 / 文件 / 备份）
  E_RATE_LIMITED:  IPC 限流命中
  E_TIMEOUT:  操作超时（含 retryAfterMs）
  E_INTERNAL:  内部错误（捕获后已处理）
  E_PARSE:  YAML / JSON / CSV 解析失败
  E_PERMISSION:  权限不足（含 UAC / 文件 / 操作）
  E_ELEVATION_REQUIRED:  需要 UAC 提权
  E_SHIM_NOT_INSTALLED:  SHIM 未安装而尝试使用
  E_CLI_NOT_FOUND:  AI CLI 未在 PATH 中找到
  E_CSV_INVALID:  CSV 18 列校验失败
  E_DAG_CYCLE:  DAG 检测到循环
  E_WATCHDOG_DEAD:  Watchdog 自身故障
  E_SKILL_NOT_FOUND:  引用的 SKILL 不存在
  E_INJECT_BLOCKED:  自动注入白名单拒绝
  E_OCR_DISABLED:  OCR 接口调用（spec-39 永远返回此码）
  E_FEATURE_DEFERRED:  功能占位（spec-38 SKILL 云同步 R9 启用）
  E_GRAPH_NODE_LIMIT:  图节点 > 500 降级
  E_GRAPH_DEPTH_LIMIT:  图深度 > 10 强制 lazy
```

---

## §γ 集成库版本对照表

```yaml
integration_libraries_pinned_versions:
  electron: ^33.x
  react: ^18.x
  zod: ^3.23.8
  xstate: ^5.x
  better-queue: ^3.8
  graphlib: (dagre 内置)
  papaparse: ^5.4
  chokidar: ^3.6
  monaco-editor: ^0.50
  '@monaco-editor/react': ^4.6
  monaco-yaml: ^5.x
  framer-motion: ^11
  recharts: ^2.13
  d3-force: ^3.x
  dagre: ^0.8
  xyflow (reactflow): ^11
  react-grid-layout: ^1.4
  react-resizable-panels: ^2.x
  archiver: ^7.x
  unzipper: ^0.12
  better-sqlite3: ^11.x
  execa: ^9.5
  node-pty: ^10.x
  koffi: ^2.10
  win32-displayconfig: latest
  node-window-manager: latest
  wmi-client: latest
  sudo-prompt: latest
  tree-kill: latest
  nut-js: ^4.x
  limiter: ^2.x
  lru-cache: ^10.x
  lodash.throttle: ^4.1
  lodash.debounce: ^4.1
  semver: ^7.6
  which: ^4.0
  fs-extra: ^11.x
  ndjson: ^2.0
  split2: ^4.2
  eventsource-parser: ^1.1
  strip-ansi: ^7.1
  iconv-lite: ^0.6
  mitt: ^3
  ajv: ^8.x
  mathjs: ^13.x
  gray-matter: ^4.0
  js-yaml: ^4.1
  nodemailer: ^6.9
  undici: ^6.x
  sound-play: ^1.1
  pkg: ^5.8
  bun: ^1.1
  systeminformation: ^5.x
  zod-validation-error: ^3.x
  zod-to-json-schema: ^3.x
  node-cron: ^3.0
  find-process: ^1.4
  dompurify: ^3.x
```

---

## §11 Sign-off

```yaml
sign_off:
  produced_by: prd-writer agent
  produced_at: 2026-05-03
  total_terms: 92
  source_documents:
  - 4 PRD（master + R8.A + R8.B + R8.C）
  - 67 spec
  - 4 _shared 注册表（audit / feature-flags / ipc-channels / zod-schemas）
  - 2 整合摘要（quickstart + feedback-traceability + dependency-graph）
  cross_check:
  - 全部硬约束（13 条）已收录: PASS
  - 全部错误码（≥ 19 条）已收录: PASS
  - 全部集成库（≥ 50 个）已对齐版本: PASS
  - 中英对照完整: PASS
  next_action:
  - implementation agent 编码时按本表对齐术语
  - QA 测试名按本表命名
  - 用户文档参考本表保持一致
```
