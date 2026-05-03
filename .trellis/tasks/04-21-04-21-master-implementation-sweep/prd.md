# 0421 Master Implementation Sweep

## Goal

基于 `prompts/0421/` 全套 R7 规格文档，对 `devhub/` 执行一轮完整的 spec 驱动开发、验证、复核和文档回写，优先完成 P0 / P1 / P2 级问题与横切契约要求，确保真实实现与验收矩阵一致。

## Source Of Truth

- `prompts/0421/00-round7-overview.md`
- `prompts/0421/00-master-spec-plan.md`
- `prompts/0421/00-acceptance-matrix.md`
- `prompts/0421/rca/01-r5-archive-metadata-only.md`
- `prompts/0421/rca/03-architecture-debt-ledger.md`
- `prompts/0421/playbooks/29-rollout-phasing-plan.md`
- `prompts/0421/playbooks/30-r7-daily-verification-checklist.md`

## Hard Constraints

- 不删除任何现有功能、模块、组件或代码路径；如需降级，只能兼容迁移，不能删除。
- 不引入任何 mock 数据、假扫描结果、占位 IPC 或假 UI；所有路径必须连接真实 Electron、真实 Win32 / PowerShell、真实 store、真实 React Flow / 布局逻辑。
- 不使用 Emoji 图标；仅允许项目现有图标库和新增 SVG / logo 资产。
- 保持现有设计语言与架构大框架，不做脱离 spec 的大重构。
- 所有跨层改动必须同步更新 contracts / tests / docs / spec。
- 不能把 archive 或 commit message 当作完成证明，必须依赖 lint / typecheck / tests / E2E / 手动验证证据。

## Scope

### In Scope

- Stage 0：Runtime 稳定性与可观测性
- Stage 1：拓扑 / 流程图附属化与渲染稳定性
- Stage 2：AI 窗口别名、检测、分组、布局、进度、操作目录
- Stage 3：P1 可见性 bug 修复
- Stage 4：响应式、主题、图标与项目 UX 打磨
- Crosscutting：数据模型、IPC、权限控制、无 Emoji 清单、测试 / playbook / docs / spec 回写

### Out Of Scope

- 扩展到 R8 的新产品功能
- 非 Windows 11 x64 平台适配
- SQL 数据库设计
- 任何以 mock 替代真实运行链路的演示性实现

## Batch Summary

### Batch 0 / Stage 1

- 移除顶层 `topology` / `flow` 导航入口，但保留兼容代码路径
- 将拓扑和流程图重挂载到 process / port / window 详情视图
- 定义可执行的 `TopologyScope` 与附属视图契约

### Batch 1 / Stage 0

- 消除扫描器双实例问题
- 建立统一 PowerShell 执行网关、超时中止和回收策略
- 补齐 scanner / handler / lifecycle 的 dispose 链
- 引入 IPC 节流、批处理和 DevObservabilityPanel 指标面板

### Batch 2 / Stage 2

- AI 窗口别名支持真实外部标题修改、通知透传、历史持久化和重启恢复
- AI 任务检测采用多信号融合，避免误报 / 漏报
- 窗口分组和布局必须对真实窗口生效，并支持持久化恢复
- 进度状态机与 UI 渲染保持一致
- 窗口卡片提供完整的操作目录

### Batch 3 / Stage 3

- 项目卡片下拉菜单 Portal 化，避免遮挡
- 进程详情支持权限降级和管理员重启路径
- 端口视图支持滚动、可调分栏和超时文案
- 窗口长标题支持截断、tooltip 和交互态滚动
- 拓扑渲染修复容器 0 尺寸与 resize 重排问题

### Batch 4 / Stage 4

- 响应式布局必须 reflow，而不是单纯挤压
- 主题系统暴露 `theme / density / radius-family / motion-level` 正交配置
- AI 工具图标替换为真实品牌 Logo 资产
- 项目 UX 打磨以不删功能为前提逐项实现

### Crosscutting

- 为关键共享类型补齐 Zod schema 与类型约束
- 为 IPC channel 建立主契约，并确保 preload 白名单、main handler、renderer 调用一致
- 敏感操作接入审计与权限控制
- 建立无 Emoji 校验与持续验证

## Acceptance Criteria

- `00-acceptance-matrix.md` 中对应条目被实际实现并具备验证证据
- `pnpm check:no-emoji` 通过
- `pnpm lint` 通过
- `pnpm typecheck` 通过
- 相关单测通过；若新增 E2E / bench / 手测，则结果要同步回写
- 实现过程中不删除现有模块和功能
- 文档与实现同步，spec / contracts / tests / playbooks 的 drift 被修正
- `gitnexus` 影响分析与变更检测结果与预期范围一致

## Validation Strategy

- 每次修改关键符号前先做影响评估
- 每个批次至少完成一轮代码实现、一轮自动验证、一轮审查修复和一轮复验
- 优先绑定 `prompts/0421/tests/27-e2e-test-plan.md` 与 `playbooks/30-r7-daily-verification-checklist.md`
- 只有真实测试证据可以推动状态提升；静态检查和单测通过不等于用户验收完成

## Implementation Progress Snapshot (2026-04-22)

### 已落地并完成自动验证的实现

- Runtime 已新增统一执行层 `devhub/src/main/services/runtime/PowerShellGateway.ts`，具备并发队列、超时 abort、`tree-kill` 回收、pool stats 与 `shutdown()` 能力。
- `SystemProcessScanner`、`AITaskTracker`、`ToolMonitor`、`WindowManager`、`PortScanner`、`ProjectScanner` 已切换到 `PowerShellGateway`。
- IPC handlers 已优先复用 `src/main/index.ts` 中的共享 runtime 实例，避免主路径重复构造 scanner / manager。
- `devhub/src/main/services/runtime/ScannerRegistry.ts` 已落地轻量单例注册层，主进程启动时会统一注册 `process / port / window / aiTask / toolMonitor / scannerCache / backgroundScannerManager` 七类共享实例；`process/window/ai-task/port` handlers 的 fallback 现在也会优先从 registry 取实例。
- `devhub/src/main/services/runtime/DisposalRegistry.ts` 已落地轻量退出清理层，`before-quit` 现统一执行 `disposeAll()`、输出结构化 disposal report，再执行 `shutdownPowerShellGateway()`；`BackgroundScannerManager.stopAll()` 也已升级为等待 batcher close 完成。
- `devhub/src/main/index.ts` 已在 dev / unpackaged 场景暴露最小 runtime test hook，供 Electron E2E 直接读取 registry snapshot 与 disposal report；`e2e/example.spec.ts` 已新增 X5 / X7 两条专项用例，走真实主进程链路，不依赖 mock。
- `BroadcastBatcher`、inbound throttle report、ACK / backpressure、bounded queue、suspend / resync 恢复链路已真实接入主进程与 preload。
- `NotificationService` 历史记录与 `AITaskTracker.completeTask()` 已补齐任务别名与 `windowHwnd` 透传。
- `ScriptSelector` dropdown 已改为 `createPortal + fixed`，`P1.1` 当时进入代码完成态；后续真实 E2E 已通过并提升为 `[TEST-PASS]`。
- `PortView` 已接入现有 `PanelSplitter`，FocusPanel 打开后切换为真实双栏布局；端口列表改为显式滚动容器并加上 `scrollbar-gutter: stable both-edges` 与 `data-testid="port-list-scroll"`。2026-04-30 追加 `PanelSplitter` 初始/持久化比例归一化、端口 splitter `stackBelow={1004}` 与真实 Electron E2E，`P3.1-a/b` 已进入 `[TEST-PASS]`。
- `PortFocusPanel` 已把 `port:get-detail-incremental` 的超时降级链补为完整 banner，包含缓存年龄、`重试` 按钮与 `切换到轻量模式` checkbox；轻量模式基于当前扫描快照构建真实简版 `PortFocusData`。2026-04-30 通过真实超时候选 E2E 验证，`P3.1-c` 已进入 `[TEST-PASS]`。
- `TruncatedText` 已增强 `maxChars`、原生 `title` tooltip、双击 marquee 与 `data-testid="window-title-cell"`；`WindowView` 多处窗口标题已接入该能力，`WindowCard` 同时固定 `minHeight: 88px`。`P4.1` 后续已通过真实 E2E 与单测并提升为 `[TEST-PASS]`。
- `AITaskView` 已切换为 `AIToolBrandLogo`，并完成品牌 Logo 统一出口、仓内 SVG 资产补齐、simple-icons 与本地 SVG 混合映射。
- `types-extended.ts` 中历史符号字符已统一改为 Unicode 转义，避免源码层面继续命中 no-emoji 扫描。
- `app.on('before-quit')` 已接入 `shutdownPowerShellGateway()`，退出时主动 abort / kill 已跟踪 PowerShell 子进程。
- `src/main/utils/safeConsole.ts` 已补入主进程早期保护，继续忽略 console write 侧 `EPIPE` / `ERR_STREAM_DESTROYED`，并仅对 Windows 下匹配 `ERR_OUT_OF_RANGE` + `Pipe.onStreamRead` 签名的已知 pipe 读流崩溃做窄范围保护，其它异常保持真实 crash 语义。
- `contracts/23-ipc-contracts-master.md` 已补齐 `Renderer Preload` 白名单权威段，`src/preload/preloadContract.test.ts` 会真实对账 `preload -> main -> contracts` 三方一致性；同时补上 `log:clear` 主进程接收、`ai-task:updated` / `window:updated` 兼容事件发送，并已补齐通过 `E2E-X2-preload`，`X2` 进入 `[TEST-PASS]`。
- `P2.2` 已补齐 `AccessReport`、`process:probe-access`、`app:relaunch-as-admin` 与 `ProcessDetailDrawer` 降级展示链：当 `process:get-deep-detail` 拿不到完整详情或需要提权时，drawer 仍会展示基础进程快照、权限提示条、`重试` 与 `以管理员身份重启` 按钮，不再退回整屏错误；同时新增 `data-testid="process-detail-panel"` / `detail-error-only` 供自动化校验降级分支。2026-04-25 追加真实系统 PID 闭环：`pid:NNN` 搜索在开发进程列表未命中时会通过 `process:get-basic-info -> SystemProcessScanner.lookupProcessByPid()` 从完整 Win32 进程空间补查基础信息，renderer 显示 `process-exact-pid-banner` 与真实单行结果，并修正空态判断，避免精确 PID fallback 被“无开发进程”提示覆盖。

### 已完成验证

- `pnpm --dir D:\Desktop\CREATOR ONE\devhub check:no-emoji`
- `pnpm --dir D:\Desktop\CREATOR ONE\devhub typecheck`
- `pnpm --dir D:\Desktop\CREATOR ONE\devhub lint`
- `pnpm --dir D:\Desktop\CREATOR ONE\devhub exec vitest run`
- `pnpm --dir D:\Desktop\CREATOR ONE\devhub build`
- `pnpm --dir D:\Desktop\CREATOR ONE\devhub test:e2e`
- `pnpm --dir D:\Desktop\CREATOR ONE\devhub exec vitest run src/renderer/components/monitor/ProcessDetailDrawer.test.tsx`
- 当前验证结果：上一轮 `check:no-emoji` 对 181 个文件零命中；vitest 为 29 个测试文件、314 个测试全部通过，其中 `ProcessDetailDrawer.test.tsx`、`ScannerRegistry.test.ts`、`DisposalRegistry.test.ts` 覆盖了 `P2.2` 与 X5/X7 的关键代码路径；`pnpm build` 已完成 Electron main / preload / renderer 生产构建；`pnpm test:e2e` 为 `7 passed`，其中已包含 X2 / X5 / X6 / X7 / X8 专项；`pnpm bench:x6`、`pnpm bench:x7` 均已通过真实 runtime 压测。2026-04-25 当时重跑 `check:no-emoji` 阶段仍通过；但该历史会话内 Node 读取 `tsc` / `eslint` 入口与 Playwright worker `spawn` 均返回 `EPERM`，审批链路非沙箱重跑也因本机 `codex-auto-review` 502 未获准，因此当时 `E2E-P2.2` 暂记录为环境阻塞而非产品失败；该阻塞已在 2026-04-30 后续 E2E 恢复批次中解除。

- `P1.2-a`：已完成并通过真实 Electron E2E。`ProjectList` 监听真实 `data-density` 并用 64px compact / 144px comfortable 虚拟行高驱动密度切换；`SettingSelect` 补齐原生 select 可访问标签，E2E 通过设置面板切换 `信息密度` 并验证 `<html data-density>`、项目列表 `data-density` / `data-estimated-row-height` 与 `appearance.informationDensity` 持久化一致。已通过 `pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm exec playwright test e2e/example.spec.ts -g "P1.2-a" --timeout=90000 --workers=1`、`pnpm exec playwright test e2e/example.spec.ts -g "P1.1|P1.2-a" --timeout=90000 --workers=1` 和 `pnpm test:e2e`。

### 当前已提升的状态

- `P3.1-a`：提升为 `[TEST-PASS]`
- `P3.1-b`：提升为 `[TEST-PASS]`
- `P3.1-c`：提升为 `[TEST-PASS]`
- `P2.2`：当时提升为代码完成态；后续真实权限降级 E2E 已通过并提升为 `[TEST-PASS]`
- `P1.2-a`：提升为 `[TEST-PASS]`
- `P1.2-b`：提升为 `[TEST-PASS]`
- `P4.1`：当时提升为代码完成态；后续真实窗口标题 E2E 已通过并提升为 `[TEST-PASS]`
- `X2`：提升为 `[TEST-PASS]`
- `P5.2`：提升为 `[TEST-PASS]`
- `X4`：提升为 `[TEST-PASS]`
- `X5`：提升为 `[TEST-PASS]`
- `X6`：提升为 `[TEST-PASS]`
- `X7`：提升为 `[TEST-PASS]`
- `X8`：提升为 `[TEST-PASS]`

### 用户手测待确认项

- `P3.1-a/b` 已补齐真实 Electron `E2E-P3.1-a/b`：P3.1-a 在 1366x768 下验证真实端口列表溢出、稳定滚动槽位和滚轮滚动；P3.1-b 在足够监控工作区下验证 `devhub:port-view-split` 的 640px/360px/560px 边界、拖拽和双击重置。当前已标记 `[TEST-PASS]`，仍缺用户手测，不能标记 `[USER-VERIFIED]`。
- `P3.1-c` 已补齐真实 Electron `E2E-P3.1-c`：测试通过真实 `port:get-detail-incremental` 找到 `source="timeout"` 候选端口，再进入 UI 验证缓存年龄 banner、`重试` 按钮和 `切换到轻量模式` checkbox。当前已标记 `[TEST-PASS]`，仍缺用户手测，不能标记 `[USER-VERIFIED]`。
- `P1.2-a` 已补齐并通过 `E2E-P1.2-a` 专项脚本，当前已标记为 `[TEST-PASS]`；仍缺用户手测，因此不能标记为 `[USER-VERIFIED]`。
- `P1.2-b` 已补齐真实 Electron `E2E-P1.2-b`：2026-05-01 本机通过 `winget` 安装并确认 `Cursor (User) 3.2.16` 后，测试从 renderer preload 调用 `window.devhub.projects.openIn(projectPath, target)` 覆盖 VS Code / Cursor / Explorer / PowerShell 四入口，并用真实进程快照确认外部应用打开或复用。`pnpm typecheck` 通过；`pnpm exec playwright test e2e/example.spec.ts -g "P1.2-b" --timeout=120000 --workers=1` 为 `1 passed (11.1s)`。当前自动化状态已标记为 `[TEST-PASS]`，仍缺用户手测，不能标记为 `[USER-VERIFIED]`。
- `P2.2` 已完成真实权限探测、基础信息快照降级、管理员重启入口与 `pid:NNN` 精确查询 fallback，并已通过 `ProcessDetailDrawer.test.tsx` 与 `E2E-P2.2` 专项脚本；当前已标记为 `[TEST-PASS]`，仍缺用户手测，不能标记为 `[USER-VERIFIED]`。
- `P4.1` 已完成真实标题截断 / hover 完整标题 / 双击 marquee / 固定卡片高度链路；后续 `pnpm exec playwright test e2e/example.spec.ts -g "P4.1" --timeout=120000 --workers=1` 与 `TruncatedText.test.tsx` 已通过，当前为 `[TEST-PASS]`。
- `P5.2` / `X4` 已完成自动化 E2E，但仍缺用户手测，不能标记为 `[USER-VERIFIED]`。
- `X2` 已完成源码白名单、主进程注册对账、contract 自动化回归与 `E2E-X2-preload` 专项验证，但仍缺用户手测，不能标记为 `[USER-VERIFIED]`。
- `P2.1` 60 分钟长跑已补齐并通过；`X6` 已补齐 `E2E-X6-semaphore + BENCH-X6`，但仍缺用户手测。当前自动化可以证明并发闸门、真实 PowerShell 压测与 P2.1 稳定性长跑通过，不能替代用户手测验收。
- `X5` 已通过 `E2E-X5-singleton`，但仍缺用户手测，不能标记为 `[USER-VERIFIED]`。
- `X7` 已补齐 `E2E-X7-quit + BENCH-X7`，但仍缺用户手测，不能标记为 `[USER-VERIFIED]`。
- `X8` 已通过 `E2E-X8-panel`，并补入 non-profiling build 下的 React commit fallback；当前自动化状态为 `[TEST-PASS]`，更长周期观察与用户手测仅作为后续增强/人工验收边界。

## Technical Notes

- 仓库真实代码根为 `devhub/`，R7 的真实开发规范以 `prompts/0421` 为准。
- 历史 RCA 已确认 R5 存在 metadata-only archive 事故，因此本任务必须输出真实代码与真实验证证据。
- 当前 `AIToolType` 真实枚举为：`codex`、`claude-code`、`gemini-cli`、`cursor`、`opencode`、`aider`、`windsurf`、`continue-dev`、`cline`、`other`。
- 当前 `@icons-pack/react-simple-icons` / `simple-icons` 实际可用的品牌组件为 `SiClaude`、`SiGooglegemini`、`SiCursor`、`SiWindsurf`、`SiCline`；`codex`、`opencode`、`aider`、`continue-dev` 继续使用仓内 SVG 资产。
- 本任务是 fullstack / cross-layer 工作，涉及 Electron main / preload / renderer / shared / docs 多层联动。


## Implementation Progress Snapshot (2026-04-25 P4.2-b 误报治理续做)

### 本轮已落地

- `AITaskTracker` 完成 P4.2-b 主路径补强：完成阈值不再直返 `completed`；`validating` 仅作为 monitor state；最终完成仍需 confirmation timer 的双重 re-score。
- 子进程退出信号新增 evidence 记忆，必须先看到真实 child PID，再看到 child PID 消失，才允许 `child_process_exit` 参与完成分数；解决“从未有子进程也持续加分”的误报风险。
- 进程消失新增 grace window 与 evidence 分流：错误信号进入 `error`，已有完成证据进入 `completed`，缺少完成证据时进入 `cancelled`，不再单次缺失就完成。
- confirmation window 内若 CPU/I/O/编译活动恢复，会取消待确认计时器，避免旧计时器在任务继续运行时发完成通知。
- `aiTaskHandlers` 对 `history.status !== 'completed'` 的历史事件只广播、不发完成通知，避免 `error/cancelled` 被误报为任务完成。
- `WindowManager.normalizeExternalWindowTitle()` 改为 charCode 清理控制字符，保留原语义并消除 ESLint `no-control-regex`。
- `ToolProfile`、`ConfidenceReport`、`StateTransition` 基础契约已接入 shared types、`AITaskTracker`、main IPC、preload 与 renderer global types；`setToolProfile()` 对未注册工具返回 `false` 且不修改全局权重。
- `AITaskTracker.test.ts` 新增阈值不直返、child-exit 去抖、missing-process grace/cancel/complete 分流，以及 confidence report / state history / tool profile round-trip / invalid profile no-side-effect 用例。

### 本轮验证

- `pnpm install --frozen-lockfile --ignore-scripts --child-concurrency=1 --virtual-store-dir node_modules/.pnpm-new` 成功恢复测试/类型检查工具链；旧 `node_modules/.pnpm` 仍存在无法 unlink 的权限死文件。
- 因上一条安装使用 `--ignore-scripts`，本轮补跑 `node_modules/.pnpm-new/electron@28.3.3/node_modules/electron/install.js` 恢复真实 Electron `path.txt`，随后定向 Vitest 可正常导入 Electron 依赖。
- `pnpm check:no-emoji` 通过。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过。
- `pnpm exec vitest run src/main/services/AITaskTracker.test.ts` 通过：39 tests passed。
- `git diff --check -- <P4.2 相关文件>` 通过，仅有 CRLF 提示。

### 2026-04-29 P4.2-b CODE-DONE 补充

- `P4.2-b` 已在 2026-05-01 正式 30 分钟 `BENCH-P4.2-b` 中通过，当前已标记 `[TEST-PASS]`；仍不能替代用户手测 `[USER-VERIFIED]`。
- 真实代码侧已补齐独立检测抽层：`SignalCollector`、`ConfidenceEngine`、`CompletionStateMachine`、`CalibrationSampleStore`、`TaskKey` 已落地并由 `AITaskTracker` 调用；不再把多信号融合、状态派生、校准和 key 生成继续留在单一类内手写分叉。
- 公共契约已补齐：`DetectionSignalName`、`SignalResult`、`SignalContribution`、`CalibrationSample`、`CalibrationResult` 进入 shared types 与 schema registry；`ai-task:calibrate` 已贯通 main / preload / renderer global / IPC contract。
- 验证证据：`pnpm exec vitest run src/main/services/detection/DetectionEngine.test.ts src/main/services/AITaskTracker.test.ts src/preload/preloadContract.test.ts` 为 48 tests passed；`pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过。
- `BENCH-P4.2-b` harness 已落地，短时真实运行报告 `devhub/perf-reports/bench-p4-ai-accuracy-2026-04-29T12-13-40-050Z.json` 观察到真实 `maxClaudeCount=3`、`falsePositives=0`、`sampleCount=2`；因无 30 分钟窗口、无 completion-events oracle、无 6 次真实完成事件和 delay 样本，`passed=false` 是正确阻塞。
- 2026-04-30 本轮复跑短时 smoke 生成 `devhub/perf-reports/bench-p4-ai-accuracy-2026-04-29T17-16-02-421Z.json`：`passed=false`、`sampleCount=1`、`maxClaudeCount=0`、`completionEvents=0`，继续证明无真实 Claude 实例与 oracle 时不会误标验收通过。
- 正式验收已于 2026-05-01 闭环：`devhub/perf-reports/bench-p4-ai-accuracy-2026-05-01T18-22-08-249Z.json` 为 `passed=true`，真实 completion-events oracle 共 7 条，active 完成 6，漏报 0，误报 1，最大延迟 0ms。completion oracle 仍必须来自 Claude Code 官方 `Stop` / `SubagentStop` / `TaskCompleted` hooks，禁止手写 mock 事件。
## Implementation Progress Snapshot (2026-04-30 P4.2-a Alias E2E)

- `P4.2-a-1`、`P4.2-a-2`、`P4.2-a-4` 已提升为 `[TEST-PASS]`。
- 新增真实 Electron E2E `P4.2-a AI 窗口别名可真实应用外部标题并跨重启恢复`：测试创建真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd / pid，调用真实 preload/IPC `aiAlias.renameAndApply()`，验证 alias 写入 electron-store、外部窗口标题同步为 `[Claude Code-别名] 原标题`、持久化记录不保存 PID，并在 DevHub 重启后通过 `aiAlias.getAll()` 从真实 store 恢复。
- 验证通过：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-a" --timeout=120000 --workers=1` 为 `1 passed (9.3s)`；`pnpm typecheck` 通过。
- `P4.2-a-3` 已提升为 `[TEST-PASS]`：2026-04-30 新增真实 Electron E2E，创建真实 `BrowserWindow` 并取得真实 hwnd / pid，通过 dev/test hook 调用真实主进程 `NotificationService.notifyTaskComplete()`，再通过真实 renderer IPC `notification.getHistory()` 读取通知历史，断言标题 `[Claude Code-别名] 任务完成`、body PID、`metadata.aliasOrToolName/displayName/taskId/windowHwnd` 全部存在。验证命令：`pnpm build` 通过；`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-a-3" --timeout=120000 --workers=1` 为 `1 passed (4.0s)`；`pnpm typecheck` 通过。

## Implementation Progress Snapshot (2026-04-28 P4.2-c-1 窗口分组恢复)

### 本轮已落地

- `WindowManager` 分组主链路已从“持久化裸 hwnd”升级为 fingerprint 持久化 + 运行时 live hwnd 解析，旧分组数据会在加载时补齐 `memberFingerprints`。
- `getGroups()` 与 `focusWindowGroup()` / `restoreGroup()` / `minimizeGroup()` / `closeGroup()` 会先基于真实窗口扫描解析成员，再执行 Win32 操作，避免跨重启 stale hwnd silent fail。
- `createGroup()`、`addToGroup()`、`renameGroup()` 增加空名、重名、成员上限、真实 hwnd 校验；分组 ID 使用 `randomUUID()` 后缀，避免同毫秒创建覆盖。
- `window:rename-group` 已贯通 `types-extended`、main IPC、preload、renderer global types、`useWindows()` 与 `WindowView` 行内重命名 UI。
- 新增 `WindowManager.test.ts`，用真实 `WindowManager` 逻辑覆盖跨重启 hwnd 解析、分组操作使用 resolved hwnd、重命名拒绝重复名且不突变旧状态。

### 本轮验证

- `pnpm exec vitest run src/main/services/WindowManager.test.ts` 通过：3 tests。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过，包含 `check:no-emoji`。
- `git diff --check -- <P4.2-c-1 相关文件>` 通过，仅有 CRLF 提示。

### 历史阻塞 / 后续已完成

- `P4.2-c-1` 已提升为 `[TEST-PASS]`：2026-04-30 新增真实 Electron E2E，创建两个真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd，调用真实 preload/IPC `createGroup()`、`getGroups()`、`renameGroup()` 与 `removeGroup()`，断言 `memberFingerprints`、`resolvedMembership`、`resolutionReport.matched` 与真实 hwnd 对齐，并确认删除分组后真实窗口仍然存在。验证命令：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-c-1" --timeout=120000 --workers=1` 为 `1 passed (7.5s)`；`pnpm typecheck` 通过。
- 真实拖拽、ambiguous picker、自动分组、颜色修改和用户手测作为增强验收继续保留；该时点的下一切片为 `P4.2-c-2`，后续已补齐 `window:apply-layout`、`window:save-snapshot`、`window:restore-snapshot` 与恢复平铺前位置的真实布局快照链路并提升为 `[TEST-PASS]`。
## Implementation Progress Snapshot (2026-04-28 P4.2-c-2 窗口布局引擎恢复)

### 本轮已落地

- `moveWindow()` 已改为真实 `SetWindowPos` 路径，并在窗口最小化时先恢复窗口，避免布局命令只更新内部状态或停留在预览层。
- `applyLayout()` 成为布局执行主入口，支持 preset、custom rect、snapshot restore，并在执行前自动保存 restore point。
- 旧 `tileWindows()` / `cascadeWindows()` / `stackWindows()` 保持对外兼容，但内部已改走 `applyLayout()`，因此现有 UI 按钮也获得 restore point。
- 新增 `WindowLayoutSnapshot` / `ApplyLayoutIntent` / `ApplyLayoutResult` / `TilePreset` / `MonitorInfo` shared 类型，以及 snapshot / restore-previous / preview / monitor / tile-group IPC。
- preload、renderer global types、`useWindows()` 已暴露新布局 API；`WindowView` 增加“撤销布局”按钮，保存布局时同时写 fingerprint snapshot 与兼容旧 layout。
- `WindowManager.test.ts` 新增 `SetWindowPos` 命令、tile restore point、restorePrevious 回退原始 rect 覆盖。

### 本轮验证

- `pnpm exec vitest run src/main/services/WindowManager.test.ts` 通过：5 tests。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过，包含 `check:no-emoji`。
- `git diff --check -- <P4.2-c-1/c-2 相关文件>` 通过，仅有 CRLF 提示。

### 历史阻塞 / 后续已完成

- `P4.2-c-2` 已提升为 `[TEST-PASS]`：2026-04-30 新增真实 Electron E2E，创建两个真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd / rect，调用真实 preload/IPC `saveSnapshot()`、`applyLayout({ customRects, saveRestorePoint:true })`、`restoreSnapshot()`、再次 `applyLayout()` 与 `restorePrevious()`，并用后续扫描 rect 按像素容差校验布局移动、快照恢复和撤销恢复。验证命令：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-c-2" --timeout=120000 --workers=1` 为 `1 passed (15.9s)`；`pnpm typecheck` 通过。
- 真实多显示器和用户手测仍作为增强验收保留，但不再阻塞当前矩阵的核心布局链路；该时点的后续 `P4.2-d` / `P5.1` 进度状态对齐与 `P4.2-c-1` 专项 Playwright/Electron E2E 均已在后续批次补齐并提升为 `[TEST-PASS]`。

## Implementation Progress Snapshot (2026-04-29 P4.2-d / P5.1 AI 进度状态派生)

### 本轮已落地

- 新增 `src/shared/detection/derive-progress.ts`，将 AI 进度定义为 `AIMonitorState` / legacy `AITaskState` 的派生视图，覆盖 idle hidden、thinking indeterminate、coding 40..75、compiling 78、validating 92、waiting-input 98、completed/error 100 等 invariant。
- `AITaskView` 改为通过 `toDerivableProgressState()` + `deriveProgress()` 渲染状态 badge 与进度，不再直接使用 `task.status.progressEstimate.percentage` 控制 UI，避免“空闲 + 百分比”“思考中 + determinate”等不可能组合。
- 新增 `ProgressBar` 组件并接入 `AITaskView`；hidden 模式保留 `data-testid="ai-progress-bar"` 供 E2E 断言但不暴露 `progressbar` role，indeterminate 模式不显示百分比且不设置 `aria-valuenow`，determinate 模式才暴露 `aria-valuenow` 与百分比文本。
- 新增 `ai-progress-indeterminate-sweep` CSS 动画，使用真实 CSS 运动表达不可估算阶段，不引入 Emoji。

### 本轮验证

- `pnpm exec vitest run src/shared/detection/derive-progress.test.ts` 通过：8 tests。
- `pnpm exec vitest run src/shared/detection/derive-progress.test.ts src/renderer/components/monitor/ai-task/ProgressBar.test.tsx` 通过：11 tests。
- `pnpm exec vitest run src/main/services/AITaskTracker.test.ts` 通过：39 tests。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过，包含 `check:no-emoji`，No emoji found in 186 files。
- `pnpm check:no-emoji` 单独通过。
- `git diff --check -- <P4.2-d/P5.1 相关文件>` 通过，仅有 CRLF 提示。

### 当前状态

- `P4.2-d / P5.1` 后续已通过真实 Electron `E2E-P4.2-d/P5.1`，覆盖 1000+ 次状态/进度快照、真实 tracker 派生、timeline 一致性与 history 折叠，当前为 `[TEST-PASS]`；仍不能替代用户手测 `[USER-VERIFIED]`。

## Implementation Progress Snapshot (2026-04-29 P4.2-e Window Operations Catalog)

- Status: `[TEST-PASS]` for the real-window operation chain.
- Implemented a shared `WINDOW_OPERATION_CATALOG` with stable operation ids and renderer `data-testid=window-op-<kind>` hooks. The exposed catalog covers 16 actions and includes all P4.2-e required operations.
- Added real main-process operations for window screenshots, favorite toggling, favorite listing, and opening the resolved process executable directory. These are wired through IPC, preload, renderer global types, `useWindows`, and `WindowView`.
- Navigation actions now dispatch `devhub:monitor-navigate` so MonitorPanel can switch to process / port / AI task tabs, while disabled states remain driven by real PID / port / task / project data availability.
- Verification passed: targeted 11 tests for catalog + WindowManager, combined 61-test regression including AI progress, `pnpm typecheck`, `pnpm lint`, `pnpm check:no-emoji`, and related-file `git diff --check` with only CRLF warnings.
- 2026-04-30 追加真实 Electron E2E `P4.2-e 窗口操作目录对真实窗口执行关键操作`：创建真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd，并调用真实 preload/IPC 覆盖 `focus`、`minimize`、`restore`、`maximize`、`setTopmost`、`setOpacity`、`toggleFavorite`、`screenshot`、`setTitle` 与 `close`；截图断言真实 PNG 文件落盘，关闭断言后续扫描中窗口消失。验证命令：`pnpm exec playwright test e2e/example.spec.ts -g "P4.2-e" --timeout=120000 --workers=1` 为 `1 passed (9.8s)`；`pnpm typecheck` 通过。
- 端口 / 进程 / AI 任务跳转仍依赖运行时是否存在对应真实关联数据，已由 catalog/disabled-state 和后续手测覆盖，不再阻塞当前真实窗口操作链路。


## Implementation Progress Snapshot (2026-04-29 P6/P7 Attached Topology + Flow)

- Current status: `P6.1`, `P6.2`, and `P7.1` have since advanced from `[CODE-DONE]` to `[TEST-PASS]`; this snapshot records the earlier implementation step.
- `MonitorPanel` top-level navigation now exposes only `process / port / window / ai-task`; topology and flow are no longer first-class monitor tabs.
- Added shared scoped topology contracts in `src/shared/topology/scope.ts`, including Zod scope validation, `ScopedTopologyGraph`, `ScopedFlow`, and deterministic builders over real `ProcessInfo[]`, `PortInfo[]`, and `WindowInfo[]` scanner snapshots.
- Added main-process IPC handlers for `topology:build-scoped-graph`, `flow:build-scoped-flow`, and `topology:warm-scope`; preload, renderer global types, and contracts/23 were synchronized and verified by `preloadContract`.
- Added attached UI components `AttachedGraphView`, `AttachedFlowView`, and `ScopeControls`; mounted them into `ProcessDetailPanel`, `PortFocusPanel`, and selected-window context in `WindowView`.
- `NeuralGraphEngine` now avoids the old 800x600 fallback, re-centers on real container resize, and computes layer spacing from actual height rather than a fixed 150px gap.
- Verification passed: `pnpm typecheck`, `pnpm lint`, targeted 12-test vitest sweep, and `src/preload/preloadContract.test.ts`.
- Follow-up enhancement gates: broader Electron visual distribution/resizing coverage, physical legacy directory move if still required after PortView compatibility review, JumpDispatcher/back-stack polish, and user-visible manual verification. These do not block the current 0421 matrix `[TEST-PASS]` status.

## Implementation Progress Snapshot (2026-04-29 P8 Responsive + Theme Language)

- Current status: `P8.1` and `P8.2` have since advanced from `[CODE-DONE]` to `[TEST-PASS]`; this snapshot records the earlier responsive/theme implementation step.
- `PanelSplitter` now supports container-size driven `stackBelow` mode; `AppContent` attaches a real responsive shell container and exposes layout breakpoint/density data attributes for CSS reflow.
- `Sidebar` collapsed width is aligned to the P8.1 56px icon-only requirement; `breakpoints.css` and P8 responsive CSS prevent horizontal overflow and compact project/monitor/settings grids below 900px.
- `useContainerSize` provides reusable breakpoint/density classification with targeted tests.
- `useTheme` now manages a four-axis `ThemeState` (`palette`, `density`, `radiusFamily`, `motionLevel`) and applies all axes to root datasets while persisting through the existing settings bridge.
- `SettingsDialog` appearance controls now expose design-language palettes, preset combinations, density, radius family, and motion level without introducing a detached mock settings flow.
- `AppearanceSettings`, `DEFAULT_SETTINGS`, main settings IPC whitelist/validation, AppStore test fixtures, and theme token CSS were synchronized for the new axes.
- Verification passed: `pnpm typecheck`, `pnpm exec vitest run src/renderer/theme/theme-language.test.ts src/renderer/hooks/useContainerSize.test.ts src/main/store/AppStore.test.ts`, `pnpm lint`; `No emoji found in 203 files.`
- Follow-up enhancement gates: additional <900px screenshot/overflow coverage, broader restart persistence proof for every theme axis, and computed-style assertions for palette/radius/motion transitions. These are retained as hardening targets, not current 0421 blockers.

## Implementation Progress Snapshot (2026-04-29 X1 Contract Schema Registry)

- Current status: `X1` has since advanced from `[CODE-DONE]` to `[TEST-PASS]` for the executable schema registry slice; this snapshot records the earlier implementation step.
- Added `src/shared/schemas/contract-models.ts` with Zod schemas for all contracts/22 model families: scanner, process, port, window, AI alias, AI task, topology, theme, notification, and IPC envelope.
- Added `contractSchemaRegistry` so automation can assert named contract types have runtime schemas.
- Added `contract-models.test.ts` with the contracts/22 type list as the executable coverage source and behavioral checks for access-report-required process details, theme v2 schema defaults, and fingerprint-based layout snapshots.
- Verification passed: `pnpm typecheck`, `pnpm exec vitest run src/shared/schemas/contract-models.test.ts src/renderer/theme/theme-language.test.ts src/renderer/hooks/useContainerSize.test.ts src/main/store/AppStore.test.ts`, `pnpm lint`; `No emoji found in 205 files.`
- Follow-up enhancement gates: migrate legacy IPC handlers to parse every outbound payload through the registry and add CI enforcement against future contracts/22 drift. These remain desirable contract-hardening work, not a current 0421 matrix blocker.


## Implementation Progress Snapshot (2026-04-29 X3 Permission Audit)

### 本轮已落地

- `AuditLogger` 已对齐 `contracts/24` 的真实日志路径，默认写入 Electron `userData/logs/security-audit.log`，并保留既有 `log(action, target, result, reason?)` 调用兼容。
- 审计条目现在同时包含 `timestamp/action/target/result/reason` 与 `ts/op/outcome`，兼容旧调用和 R7 权限审计规格。
- 审计日志具备跨日轮转与 30 天保留清理：旧活动日志归档为 `security-audit-YYYY-MM-DD.log`，过期轮转日志被清理。
- `windowHandlers` 已把真实窗口敏感操作接入主进程审计，覆盖 close、move、group、layout、snapshot、topmost、opacity、title、send-keys、screenshot、open-working-dir 等 handler；process/port/admin relaunch 的既有审计调用保持兼容。
- 新增 `AuditLogger.test.ts` 与 `windowHandlers.audit.test.ts`，分别覆盖真实文件 IO 与窗口敏感 action 审计接线契约。

### 本轮验证

- `pnpm typecheck` 通过。
- `pnpm exec vitest run src/main/services/AuditLogger.test.ts src/main/ipc/windowHandlers.audit.test.ts src/main/services/PortScanner.test.ts src/main/services/WindowManager.test.ts src/main/store/AppStore.test.ts` 通过：5 个 test files，74 tests。
- `pnpm lint` 通过，包含 `check:no-emoji`，输出 `No emoji found in 207 files.`。
- `git diff --check -- src/main/services/AuditLogger.ts src/main/services/AuditLogger.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/windowHandlers.audit.test.ts` 通过，仅有 Windows LF/CRLF 提示。
- GitNexus `detect_changes(scope=all)` 已执行；由于当前 devhub 工作树累计 61 个已改文件，报告为全局 critical，应按全局积压解读，不能等同于本 X3 切片独有风险。

### 历史阻塞 / 后续已完成

- `X3` 已提升为 `[TEST-PASS]`：2026-04-30 复跑真实 Electron E2E，测试创建真实 `BrowserWindow`，通过真实 `windowManager.scan(false)` 获取 hwnd，调用真实 preload/IPC `windowManager.setTitle()` 覆盖成功与校验失败路径，并读取 Electron `userData/logs/security-audit.log` 断言结构化审计条目。验证命令：`pnpm build` 通过；`pnpm exec playwright test e2e/example.spec.ts -g "X3" --timeout=120000 --workers=1` 为 `1 passed (4.1s)`。
- `P2.1` 已通过真实 60 分钟长跑、bench 和退出后子进程归零证据；不能把未执行的用户手测误标为完成。

## Implementation Progress Snapshot (2026-04-29 P2.1 TEST-PASS)

- `P2.1` is now backed by a real 60-minute Electron longrun bench, not a short smoke run.
- `MetricsCollector` CPU sampling now uses one `app.getAppMetrics()` read per sample, main-process CPU semantics, and a strict 5-minute timestamp window average.
- Final report: `devhub/perf-reports/bench-p2-longrun-2026-04-29T11-19-59-787Z.json`.
- Result: `passed=true`, `acceptanceEligible=true`, `maxCpu5m=1.4`, `maxIpcRpm=8`, `mainRatio=1.0677540986832446`, `rendererRatio=1.0757544784203639`, `maxPsChildren=2`, `psChildrenAfterExit=0`, `remainingAfter=[]`.
- Verification for this slice: `pnpm typecheck`, `pnpm exec vitest run src/main/services/observability/MetricsCollector.test.ts src/main/ipc/scannerHandlers.test.ts src/main/services/BackgroundScannerManager.test.ts src/preload/preloadContract.test.ts src/main/services/observability/IpcChannelCounter.test.ts`, `pnpm lint`, `pnpm build`, `pnpm bench:p2.1 -- --duration-minutes=1 --baseline-minutes=1 --sample-interval-ms=10000 --allow-short`, and `pnpm bench:p2.1`.

## Implementation Progress Snapshot (2026-04-30 E2E Recovery / P1.1 / P2.2 / X8 TEST-PASS)

### 本轮已落地

- 修复 Electron E2E teardown：`e2e/example.spec.ts` 新增 `closeElectronApp()`，先在真实 Electron main process 调用 `app.quit()` 并等待 close event，再短时 fallback 到 Playwright context close，避免 `electronApp.close()` 在当前 app 中等待约 60 秒后强杀。
- `ScriptSelector` 保持轻量 `createPortal(..., document.body)` 实现，不引入新依赖；补充 `aria-haspopup` / `aria-expanded` / `role=menu` / `role=menuitem` / `data-testid` 与 Escape 关闭回焦，支撑 P1.1 真实 E2E。
- `SystemProcessScanner.getProcessDeepDetail()` 补齐 partial-read 权限判定：非管理员运行且 `userName` / `commandLine` / `executablePath` 等特权字段缺失时，保留真实基础字段并标记 `requiresElevation=true`。
- `SystemProcessScanner.probeProcessAccess()` 同步把 partial-read 归类为 `access-denied`，在当前进程非管理员时返回 `suggestion='relaunch-as-admin'`，驱动 `ProcessDetailDrawer` 显示权限原因和“以管理员身份重启”。
- `E2E-X2` preload 白名单同步新增真实 `topology` bridge，覆盖 `topology.buildScopedGraph`、`topology.buildScopedFlow`、`topology.warmScope`。

### 本轮验证

- `pnpm typecheck` 通过。
- `pnpm build` 通过。
- `pnpm exec playwright test e2e/example.spec.ts -g "应用应该正常启动" --timeout=60000 --workers=1` 通过：1 test，2.7s。
- `pnpm exec playwright test e2e/example.spec.ts -g "P1.1" --timeout=90000 --workers=1` 通过：1 test，3.1s。
- `pnpm exec playwright test e2e/example.spec.ts -g "P2.2|X2 preload" --timeout=90000 --workers=1` 通过：2 tests，19.2s。
- `pnpm test:e2e` 通过：10 tests，43.2s。
- `pnpm exec vitest run src/main/services/SystemProcessScanner.test.ts src/renderer/components/monitor/ProcessDetailDrawer.test.tsx src/main/services/runtime/PowerShellGateway.test.ts src/preload/preloadContract.test.ts` 通过：4 files / 66 tests。
- `pnpm lint` 通过，包含 `check:no-emoji`，输出 `No emoji found in 216 files.`。
- `pnpm test` 通过：42 files / 405 tests。
- GitNexus `detect_changes(scope=all)` 已复跑；当前累计工作树仍为历史大范围 dirty，报告 `changed_files=63`、`changed_count=356`、`affected_count=98`、`risk_level=critical`，需按全局积压风险解读，不代表本切片单独引入 63 个文件。

### 状态更新

- `P1.1` 已提升为 `[TEST-PASS]`。
- `P2.2` 已提升为 `[TEST-PASS]`。
- `X8` 已提升为 `[TEST-PASS]`。
- `P4.2-b` 已提升为 `[TEST-PASS]`：2026-05-01 正式 30 分钟双 Claude Code 实例 + completion-events oracle 验收通过。报告 `devhub/perf-reports/bench-p4-ai-accuracy-2026-05-01T18-22-08-249Z.json` 为 `passed=true`、`acceptanceEligible=true`；真实 oracle 文件 `devhub/perf-reports/p4-acceptance-2026-05-01T17-51-31-302Z/claude-completion-events.jsonl` 共 7 条 `Stop` hook event；`activeCompletions=6`、`falsePositives=1`、`missedEvents=0`、`maxDelayMs=0`、`oracleIngestionErrors=0`、`strongReportCount=586`。

## Implementation Progress Snapshot (2026-04-30 P1.2-a TEST-PASS)

- `P1.2-a` advanced from `[CODE-DONE]` to `[TEST-PASS]`.
- `SettingsDialog` `SettingSelect` now exposes native select controls with `aria-label` and `data-testid`, enabling accessibility-aligned Playwright selection for the information density control.
- `E2E-P1.2-a` launches the real Electron app, opens the real settings dialog, switches `信息密度` to `compact` and `comfortable`, and verifies `<html data-density>`, `project-list-scroll[data-density]`, `data-estimated-row-height=64/144`, and persisted `settings.appearance.informationDensity`.
- Verification passed: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (`42 files / 405 tests`), `pnpm exec playwright test e2e/example.spec.ts -g "P1.2-a" --timeout=90000 --workers=1` (`1 passed`), `pnpm exec playwright test e2e/example.spec.ts -g "P1.1|P1.2-a" --timeout=90000 --workers=1` (`2 passed`), and `pnpm test:e2e` (`10 passed`).
- Remaining gate for this item: user hands-on verification only; no mock data or simulated project list was used.


## Implementation Progress Snapshot (2026-04-30 P3.1 TEST-PASS)

- `P3.1-a`, `P3.1-b`, and `P3.1-c` advanced from `[CODE-DONE]` to `[TEST-PASS]`.
- `PanelSplitter` now normalizes initial and persisted two-pane sizes once the container size is known, so `minSizes` / `maxSizes` protect first render and legacy `localStorage` split values, not only drag updates.
- `PortView` keeps the existing split-pane design and adds a 1004px stack threshold for the port detail splitter, matching 640px list + 360px focus + 4px divider. This prevents squeezed unreadable panes when the outer project-list split leaves the monitor sub-container too narrow.
- E2E uses only real Electron and real port data. `E2E-P3.1-a/b` verifies 30+ real ports, `port-list-scroll` overflow and wheel scrolling at 1366x768, then verifies port splitter min/max widths, drag resizing, and double-click reset in a sufficiently wide real BrowserWindow. `E2E-P3.1-c` finds a real timeout candidate from `port:get-detail-incremental` and verifies timeout banner, retry, and light mode controls in the UI.
- Verification passed: `pnpm typecheck`, `pnpm build`, and `pnpm exec playwright test e2e/example.spec.ts -g "P3.1" --timeout=90000 --workers=1` (`2 passed (28.9s)`).
- Remaining gate for these items: user hands-on verification only; no mocked ports, mocked timeout, or simulated process data was used.

## Implementation Progress Snapshot (2026-04-30 P8.1 TEST-PASS)

- `P8.1` advanced from `[CODE-DONE]` to `[TEST-PASS]` with a real Electron E2E and a real settings-backed layout mode, not just an automatic breakpoint smoke test.
- `AppearanceSettings` now includes `layoutMode: auto | split | stacked`; defaults, IPC whitelist, settings validation, SettingsDialog, and App shell consumption are synchronized.
- `AppContent` uses container width first and BrowserWindow width as a fallback for automatic reflow, fixing the real E2E finding where `ResizeObserver` could leave shell width at `0` and keep auto mode in split.
- `Sidebar` settings action now has `aria-label="设置"` and `data-testid="sidebar-settings-button"`, so icon-only collapsed sidebar remains accessible and automatable.
- `E2E-P8.1` verifies auto split/stacked through real BrowserWindow resize, forced stacked through the real settings dialog, cross-restart persistence, and a reset back to auto.
- Verification passed: `pnpm typecheck`, `pnpm build`, and `pnpm exec playwright test e2e/example.spec.ts -g "P8.1" --timeout=120000 --workers=1` (`1 passed (7.7s)`).
- Follow-up full-suite verification passed after E2E timeout/accessibility stabilization: `pnpm lint` (`No emoji found in 216 files.`), `pnpm test` (`42 files / 407 tests`), and `pnpm test:e2e` (`14 passed (1.3m)`).

## Implementation Progress Snapshot (2026-04-30 P8.2 TEST-PASS)

- `P8.2` advanced from `[CODE-DONE]` to `[TEST-PASS]` with a real Electron E2E, not a mocked settings flow.
- `e2e/example.spec.ts` now includes `P8.2 外观四轴设置可真实应用并跨重启持久化`, covering independent density changes, radius-family token application, reduced-motion token application, semantic palette token changes, preset application, settings persistence, and restart restore.
- A real failure was found and fixed: `--duration-theme` stayed at `250ms` even under `data-motion-level=reduced` because `animations.css :root` was imported after `theme-tokens.css`. `theme-tokens.css` now uses `html[data-motion-level=...]` selectors so the motion axis wins by specificity.
- Verification passed: `pnpm typecheck`, `pnpm build`, `pnpm exec playwright test e2e/example.spec.ts -g "P8.2" --timeout=120000 --workers=1` (`1 passed (6.2s)`), and full `pnpm test:e2e` after the P3.1 stability fix (`13 passed (1.2m)`).
- Remaining gate for this item: user hands-on verification only; the automated acceptance evidence now covers `E2E-P8.2-a/b/c/d/e` without mock data or simulated operations.

## Implementation Progress Snapshot (2026-04-30 X1 TEST-PASS)

- `X1` advanced from `[CODE-DONE]` to `[TEST-PASS]` for the executable schema registry slice.
- `contractSchemaRegistry` now includes `IScanner`, validating the scanner lifecycle contract shape (`id`, `start`, `stop`, `getSnapshot`, `subscribe`, `getMetrics`) instead of leaving the service interface outside runtime coverage.
- `CONTRACT_22_TYPE_NAMES` now includes the P4.2-b detection/calibration runtime schemas: `DetectionSignalName`, `SignalResult`, `SignalContribution`, and `CalibrationSample`.
- `contract-models.test.ts` now asserts both directions: every documented model has a Zod schema, and the runtime registry has no untracked schema keys outside the fixed contract list.
- Verification passed: `pnpm exec vitest run src/shared/schemas/contract-models.test.ts` (`1 file / 6 tests passed`) and `pnpm typecheck`.
- Remaining broader contract work stays scoped to other matrix items: migrating every legacy IPC handler to parse outbound payloads through the registry is not bundled into X1's model-coverage gate.

## Implementation Progress Snapshot (2026-04-30 P3.1 E2E Stability Follow-up)

- Full `pnpm test:e2e` initially exposed a real P3.1-c race: a background `port:get-detail-incremental` call could observe timeout/cache, while the immediate UI detail call for the same port completed fresh and hid the TimeoutBanner.
- `portHandlers` now keeps a real timeout/cache result for the same port for 10 seconds, so immediate UI consumers see the same stale-data warning instead of racing it away. The cache is cleared on successful incremental results and handler cleanup.
- `PortFocusPanel` close control now has `data-testid="port-focus-close-button"` and `aria-label="关闭端口详情"` for accessible, deterministic real UI automation.
- Verification passed after the fix: `pnpm typecheck && pnpm build`, `pnpm exec playwright test e2e/example.spec.ts -g "P3.1-c" --timeout=120000 --workers=1` (`1 passed (12.2s)`), and `pnpm test:e2e` (`13 passed (1.2m)`).


## Implementation Progress Snapshot (2026-04-30 P6/P7 TEST-PASS)

- `P6.1`、`P6.2`、`P7.1` advanced from `[CODE-DONE]` to `[TEST-PASS]` in `prompts/0421/00-acceptance-matrix.md`.
- This slice uses a real Electron E2E, real preload IPC, real system process/port/window scans, and the real project store. No mock graph, fixture project, simulated IPC response, or renderer-only acceptance path is used.
- The scoped topology E2E verifies `project`, `process`, `port`, and `window` scopes through `topology.buildScopedGraph`, `topology.buildScopedFlow`, and `topology.warmScope`; accepted graph sources are real `cache` / `scan` sources, not `renderer-store` fallback.
- The attached graph/flow UI now exposes deterministic data attributes for root kind/id, source, and counts, while the top-level monitor tab list remains constrained to process/port/window/AI task.
- The rendering E2E now observes the actual topology SVG through `graph-node.ownerSVGElement` and verifies node transform distribution plus resize-time `viewBox` synchronization to the SVG parent container. This fixes the previous false failures caused by reading control-bar SVG icons or assuming split-pane width must grow monotonically.
- Verification passed: `pnpm typecheck`, `pnpm exec vitest run src/shared/topology/scope.test.ts` (`1 file / 4 tests passed`), `pnpm lint` (`No emoji found in 216 files.`), `pnpm build`, and `pnpm exec playwright test e2e/example.spec.ts -g "P6.1" --timeout=120000 --workers=1` (`1 passed (14.4s)` after the final verification rerun).
- GitNexus / ABCoder MCP calls were unavailable in this run due `Transport closed`, so blast-radius verification for this slice is represented by targeted diff review plus the real typecheck/lint/build/E2E gates above.


## Implementation Progress Snapshot (2026-04-30 P4.1 TEST-PASS)

- `P4.1` advanced from `[CODE-DONE]` to `[TEST-PASS]` in `prompts/0421/00-acceptance-matrix.md`.
- A real Electron `BrowserWindow` with a long title is created during E2E, then discovered through the real `windowManager.scan(false)` Win32 path and rendered by the real Window Manager UI after pressing refresh and filtering by the search input.
- The test verifies character truncation, native `title` tooltip, marquee enter/exit, and card/title height stability without mock windows or simulated scanner payloads.
- Product fix: `TruncatedText` now isolates marquee-enabled title clicks from parent card selection and treats two plain clicks within 500ms as a double-click fallback. This prevents the first click from selecting the window card and moving the second click target when the relationship panel appears.
- Verification passed: `pnpm exec vitest run src/renderer/components/ui/TruncatedText.test.tsx` (`1 file / 3 tests passed`), `pnpm typecheck`, `pnpm build`, `pnpm exec playwright test e2e/example.spec.ts -g "P4.1" --timeout=120000 --workers=1` (`1 passed (6.8s)`), and `pnpm lint` (`No emoji found in 216 files.`).
- `E2E-P4.1-c` large-window virtualization remains a separate future performance target and was not used as the basis for this TEST-PASS status.

## Implementation Progress Snapshot (2026-04-30 P4.2-d / P5.1 TEST-PASS)

- `P4.2-d` and `P5.1` advanced from `[CODE-DONE]` to `[TEST-PASS]` with a real Electron E2E.
- The new E2E starts a real codex-like Node child process, lets the real `AITaskTracker` discover it through real system scanning, then drives the main-process tracker through the dev/test-only hook and verifies renderer DOM via real IPC events. It does not inject renderer store data.
- `TimelineEntry` now stores the fine-grained `monitorState` and `AIProgressTimeline` renders `monitorState ?? status`, so validating and waiting-input no longer collapse to legacy running/waiting labels.
- The E2E takes 1020 DOM snapshots across idle, thinking, coding, validating, waiting-input, and error states; validates no impossible combinations; verifies coding 40..75, validating 92, waiting-input 98, completed 100, timeline states, and real history folding after `task-completed`.
- Verification passed: `pnpm typecheck`, `pnpm build`, and `pnpm exec playwright test e2e/example.spec.ts -g "P4.2-d/P5.1" --timeout=180000 --workers=1` (`1 passed (48.1s)`).

## Implementation Progress Snapshot (2026-05-01 P1.2-b TEST-PASS)

- `P1.2-b` advanced from `[CODE-DONE]` to `[TEST-PASS]` in `prompts/0421/00-acceptance-matrix.md`.
- Environment evidence: Cursor was installed through the real Windows package manager path and verified as `Cursor (User) Anysphere.Cursor 3.2.16 winget`; VS Code / Cursor / Explorer / PowerShell were then exercised through the real Electron preload IPC path.
- Verification evidence: `pnpm typecheck` passed, and `pnpm exec playwright test e2e/example.spec.ts -g "P1.2-b" --timeout=120000 --workers=1` passed with `1 passed (11.1s)`.
- User verification remains separate; do not mark `[USER-VERIFIED]` until the user manually confirms the four project-open actions in the running app.


## Implementation Progress Snapshot (2026-05-01 P4.2-b TEST-PASS)

- `P4.2-b` advanced from `[CODE-DONE]` to `[TEST-PASS]` after a real 30-minute `BENCH-P4.2-b` run with two concurrent Claude Code instances and real Claude hook completion-events oracle.
- Runtime implementation now includes `ai-task:record-completion-oracle` with validated main-process IPC, a preload narrow wrapper, renderer global typing, and `AITaskTracker.recordCompletionOracleEvent()` writing real oracle completions into history, timeline, notification flow, and ConfidenceReport evidence.
- `scripts/bench-p4-ai-accuracy.mjs` now refreshes real process/task scans before samples, ingests new JSONL hook events during the sampling loop, deduplicates by alias/session/task key, and matches each event by its own alias so an allowed idle event cannot corrupt active delay accounting.
- Verification passed: `pnpm exec vitest run src/main/services/AIAliasManager.test.ts src/main/services/AITaskTracker.test.ts src/main/services/BackgroundScannerManager.test.ts src/main/services/SystemProcessScanner.test.ts` (`109 tests passed`), `pnpm typecheck`, `pnpm lint` (`No emoji found in 219 files.`), `pnpm build`, and `pnpm bench:p4.2-b:acceptance`.
- Formal bench evidence: `devhub/perf-reports/bench-p4-ai-accuracy-2026-05-01T18-22-08-249Z.json` with `passed=true`, `acceptanceEligible=true`, 7 real completion events, `activeCompletions=6`, `falsePositives=1`, `missedEvents=0`, `maxDelayMs=0`, `oracleIngestionErrors=0`, and `strongReportCount=586`.
- Remaining gate: user hands-on verification only; do not mark `[USER-VERIFIED]` without user confirmation.
