# R8.C spec-16 — Watchdog 引擎（9 项功能 + 多通道心跳）

> **batch**: R8.C  |  **priority_in_batch**: #16（24h 长跑可靠性核心）  |  **flag**: `R8.C.watchdog.engine`
> **depends_on**: spec-15（task queue 状态）+ spec-27（信号融合提供 CPU/IO/title 信号）+ spec-31（IPC 限流）+ spec-33（Zod SoT）
> **blocks**: spec-17（Watchdog 子进程化）+ spec-18（restart-resume 注入场景）
> **decision_anchor**: V1-Q-7.F.1 全选 9 项 / V1-Q-7.F.2 答 E（任一即心跳）/ V1-Q-7.F.3 默认 2min 用户可调 / V1-Q-7.F.5 答 D（CLI 支持就用，否则模拟）/ V1-Q-7.F.6 多通道告警 / V1-Q-17.A..D 双层守望
> **estimated_loc**: 1500
> **risk**: high

---

## 1. motivation

```yaml
user_quote_v1_q_7_f_1: "全选：检测停止 / 检测错误 / 自动恢复 / 自动注入 / 切换工具 / 升级模型 / 介入提醒 / 学习容错 / 手动介入"
user_quote_v1_q_7_f_2: "E — 任一即心跳：A 自报告 + B stdout + C CPU + D 窗口标题"
user_quote_v1_q_7_f_3: "D — 默认 2min，用户可调"
user_quote_v1_q_7_f_5: "D — CLI 支持 resume 就用 CLI，否则模拟键盘"
user_quote_v1_q_6_h_3: "对于 AI 进程的探测必须要做到准确无误"
feedback_4: "AI 任务在跑的时候，5 分钟内绝对不会闪过空闲状态"

goals:
  - 9 项功能：detect-stuck / detect-error / auto-recover / auto-inject / fallback-tool / escalate-model / notify / learn-tolerance / manual-intervene
  - 多通道心跳：marker 文件 + stdout + CPU 脉冲 + 窗口标题 + HTTP /health + node-pty + 文件系统活动 + 网络流量 + ETW
  - 默认 timeoutMs=120000（2min），用户可按任务状态分级（receiving-input/thinking/running/awaiting-human）
  - 重启风暴防护：连续重启 ≤ 5 次/小时；超限 → fallback-tool 或 human-intervention
  - 心跳定义可选两档：宽松（任一信号即心跳）/ 严格（≥ 2 信号且自报告优先）
  - 启动宽限期 30s + 重启后 60s + 系统压力时延长
  - 状态：healthy / suspect / stuck / restarting / fallback-pending / human-pending / dead
  - 与 spec-17 协同：本 spec 实现 InnerWatchdog 引擎逻辑；spec-17 把它装进独立子进程
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/watchdog/WatchdogService.ts
  - devhub/src/main/services/watchdog/HeartbeatCollector.ts
  - devhub/src/main/services/watchdog/sources/MarkerFileSource.ts  # .devhub/heartbeat.json mtime
  - devhub/src/main/services/watchdog/sources/StdoutSource.ts  # node-pty / cli parser
  - devhub/src/main/services/watchdog/sources/CpuPulseSource.ts  # systeminformation
  - devhub/src/main/services/watchdog/sources/WindowTitleSource.ts  # win-window-info / Win32
  - devhub/src/main/services/watchdog/sources/HttpHealthSource.ts  # CLI SHIM ping localhost
  - devhub/src/main/services/watchdog/sources/FsActivitySource.ts  # chokidar
  - devhub/src/main/services/watchdog/sources/HungWindowSource.ts  # IsHungAppWindow
  - devhub/src/main/services/watchdog/HeartbeatFusion.ts  # 多通道融合
  - devhub/src/main/services/watchdog/RestartGovernor.ts  # 风暴防护
  - devhub/src/main/services/watchdog/ActionExecutor.ts  # 9 功能分发
  - devhub/src/main/services/watchdog/GracePeriodManager.ts
  - devhub/src/main/services/watchdog/WatchdogStateMachine.ts  # 7 状态
  - devhub/src/main/services/watchdog/WatchdogService.test.ts
  - devhub/src/shared/schemas/watchdog.ts  # WatchdogStatusSchema
modified_files:
  - devhub/src/main/services/task-queue/TaskQueueService.ts  # subscribe Watchdog action
  - devhub/src/main/ipc/aiTaskHandlers.ts  # watchdog:status / configure
  - devhub/src/main/index.ts
glob_anchors:
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts  # spec-01 CliEvent 提供 stdout 心跳
  - devhub/src/main/services/detection/SignalCollector.ts  # spec-27 提供 CPU/IO 信号
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const HeartbeatSourceSchema = z.enum([
  'marker-file', 'stdout', 'cpu-pulse', 'window-title',
  'http-health', 'fs-activity', 'hung-window', 'network', 'etw'
])
export type HeartbeatSource = z.infer<typeof HeartbeatSourceSchema>

export const HeartbeatModeSchema = z.enum(['lenient', 'strict'])
// lenient = V1-Q-7.F.2 E（任一即活）；strict = V2-§17 推荐（≥2 + 自报告优先）

export const WatchdogActionPolicySchema = z.enum([
  'restart', 'fallback-tool', 'escalate-model', 'human-intervention', 'log-only'
])

export const TaskPhaseHeartbeatSchema = z.object({
  receivingInputMs: z.number().int().default(600000),  // 10min
  thinkingMs: z.number().int().default(300000),  // 5min
  runningMs: z.number().int().default(120000),  // 2min（默认）
  awaitingHumanMs: z.number().int().default(1800000),  // 30min
})

export const HeartbeatBeatSchema = z.object({
  ts: z.number().int(),
  instanceId: z.string(),
  source: HeartbeatSourceSchema,
  weight: z.number().min(0).max(1),  // 自报告 1.0；CPU 0.4 等
  detail: z.record(z.string(), z.unknown()).optional(),
})
export type HeartbeatBeat = z.infer<typeof HeartbeatBeatSchema>

export const WatchdogInstanceSchema = z.object({
  instanceId: z.string(),
  pid: z.number().int().positive(),
  alias: z.string().optional(),
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']),
  mode: HeartbeatModeSchema.default('lenient'),
  perPhase: TaskPhaseHeartbeatSchema,
  enabledSources: z.array(HeartbeatSourceSchema),
  graceUntil: z.number().int(),  // 启动宽限期 deadline
  state: z.enum(['healthy', 'suspect', 'stuck', 'restarting', 'fallback-pending', 'human-pending', 'dead']),
  consecutiveStuckCount: z.number().int(),
  lastHeartbeatAt: z.number().int(),
  actionPolicy: WatchdogActionPolicySchema.default('restart'),
})
export type WatchdogInstance = z.infer<typeof WatchdogInstanceSchema>

export const RestartGovernorConfigSchema = z.object({
  maxRestartsPerHour: z.number().int().default(5),
  cooldownAfterStormMs: z.number().int().default(1800000),  // 30min
  fallbackToToolAfterRestarts: z.number().int().default(3),
})

export const WatchdogStatusSchema = z.object({
  watchdogPid: z.number().int().positive(),
  startedAt: z.number().int(),
  isHealthy: z.boolean(),
  monitoredInstances: z.array(WatchdogInstanceSchema),
  lastSelfCheck: z.number().int(),
  totalRestarts24h: z.number().int(),
  totalFallbacks24h: z.number().int(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  watchdog:status:
  rate_limit: medium_query
  req: {}
  resp: WatchdogStatus
  watchdog:configure:
  rate_limit: low_freq_op
  req: {
  instanceId: string,
  patch: {
  mode?: HeartbeatMode,
  perPhase?: Partial<TaskPhaseHeartbeat>,
  enabledSources?: HeartbeatSource[],
  actionPolicy?: WatchdogActionPolicy,
  }
  }
  resp: { success: boolean }
  watchdog:override-restart:
  rate_limit: low_freq_op
  req: { instanceId: string, action: 'restart-now'|'force-fallback'|'force-human'|'pause-watchdog' }
  resp: { success: boolean }
  watchdog:event-stream:
  direction: main->renderer
  streaming: true
  payload: {
  instanceId: string,
  type: 'heartbeat'|'state-change'|'action-taken'|'storm-detected',
  data: unknown
  }
  watchdog:get-history:
  req: { instanceId: string, sinceTs: number }
  resp: HeartbeatBeat[]
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| instanceId 不存在 | E_NOT_FOUND |
| 心跳源不可用（如无 ETW 权限） | E_PERMISSION_DENIED（warn，降级） |
| 重启风暴超限 | E_WATCHDOG_DEAD（FATAL 通知用户） |
| 重启失败 spawn 不起来 | E_SPAWN_FAILED |
| Marker 文件路径无写权限 | E_PERMISSION_DENIED |
| timeoutMs < 5000（防止误杀） | E_VALIDATION |
| Watchdog 自身配置 schema 错 | E_VALIDATION |
| HungWindow API 调用失败 | E_RUNTIME（fallback） |
| ETW 不可用 | E_PERMISSION_DENIED（仅警告） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础心跳健康):
  given: instanceId=I tool=codex pid=P 启动正常，CPU 持续 ≥ 10%
  when: WatchdogService 运行 5min
  then:
  - state 始终 'healthy'
  - 不触发任何 action

GWT-2 (kill 后超时检测):
  given: instanceId=I 被 taskkill /F，timeoutMs=120000
  when: 等待 2min ± 5s
  then:
  - state 转 'stuck' 后 'restarting'
  - watchdog:event-stream emit action-taken: restart
  - spec-18 InjectScenario='watchdog-restart-resume' 被触发

GWT-3 (lenient 心跳):
  given: mode=lenient，仅 CPU > 5% 这一个信号活跃
  when: 监听 5min
  then: 不报 stuck（即使 stdout/marker/title 全部沉默）

GWT-4 (strict 心跳):
  given: mode=strict，仅 CPU > 5%（其他全沉默）
  when: 监听 timeoutMs=120000
  then:
  - state 转 'suspect' → 'stuck'
  - 不接受单一 CPU 信号作为活体证明

GWT-5 (启动宽限期):
  given: instanceId=I 刚 spawn，graceUntil = now + 30000
  when: 启动后 25s 还没看到任何心跳
  then:
  - state 保持 'healthy'（grace 内）
  - 不触发 action

GWT-6 (重启风暴防护):
  given: 1 小时内已重启 5 次
  when: 第 6 次 stuck
  then:
  - RestartGovernor 拒绝 restart
  - actionPolicy 切到 fallback-tool（如可用）或 human-intervention
  - 通知用户 ERROR 级别

GWT-7 (任务阶段化超时):
  given: AI 进入 thinking 阶段，perPhase.thinkingMs=300000
  when: 思考 4min（超过默认 2min running 阈值，但在 thinking 阈值内）
  then: state 保持 healthy（按阶段化阈值判断）

GWT-8 (Watchdog 自检):
  given: WatchdogService 主循环 ping 自身
  when: 任意 30s 周期
  then: lastSelfCheck 更新；spec-17 OuterWatchdog 收到 InnerWatchdog 心跳
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-16-watchdog-engine.spec.ts
test('GWT-2 kill triggers restart in 120s', async ({ page, electronApp }) => {
  const instanceId = 'codex-1'
  await page.evaluate((id) => window.electronAPI.ai.startInstance({ instanceId: id, tool: 'codex' }), instanceId)
  // taskkill
  await electronApp.evaluate(({ }, id) => {
  const cp = require('child_process')
  cp.execSync(`taskkill /F /IM codex.exe`)
  }, instanceId)
  const action = await page.evaluate(async () => new Promise<any>(resolve => {
  window.electronAPI.watchdog.eventStream.subscribe((e: any) => {
  if (e.type === 'action-taken' && e.data.action === 'restart') resolve(e)
  })
  }))
  expect(action.data.action).toBe('restart')
}, { timeout: 150000 })
```

---

## 8. reference_impl

```yaml
libraries:
  - 'systeminformation@5.x':  CPU/RSS/process 心跳
  - 'chokidar@4.x':  marker 文件 + 文件系统活动
  - 'win-window-info@x':  窗口标题 + IsHungAppWindow
  - 'execa@9.5':  spawn 重启
  - 'node-pty@10.x':  stdout 心跳来源
  - 'p-retry@6.x':  重启退避
  - 'eventemitter3@5.x':  内部事件总线
  - 'dayjs@1.11':  时间窗口计算
inspirations:
  - "systemd Restart=on-failure + RestartSec + StartLimitBurst"
  - "PM2 max-restarts + min-uptime"
  - "supervisord autorestart + startsecs + startretries"
  - "Process Hacker '冻结进程' API"
heartbeat_weight_table:
  marker-file: 1.0  # 自报告，最权威
  stdout: 0.7
  http-health: 0.9
  cpu-pulse: 0.4
  window-title: 0.5
  fs-activity: 0.5
  hung-window: 0.6
  network: 0.4
  etw: 0.7
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~120
test_loc: ~480
total: ~1500
risk_areas:
  - HungWindow API 在某些 Windows 11 build 失效（fallback 心跳源）
  - ETW 需 Administrator → 大多数情况下走降级
  - 重启风暴的 false-positive（误判心跳沉默 → 风暴 → 用户体验崩）
  - Watchdog 自身崩溃 → spec-17 OuterWatchdog 兜底
```

---

## 10. implement_checklist

- [x] HeartbeatCollector 注册 9 个 source；每源独立 enable/disable — 2026-05-16 `WatchdogEngine` policy boundary verifies all 9 heartbeat sources through `DEFAULT_SOURCES`, validates unknown sources, and preserves per-instance `enabledSources` gating without claiming OS-level HungWindow/ETW adapters.
- [x] HeartbeatFusion: lenient = max(weight)；strict = (count ≥ 2 OR weight ≥ 0.9) AND 主信号在
- [x] WatchdogStateMachine: healthy → (timeout) suspect → (再 timeout/2) stuck → (action) restarting/fallback-pending/human-pending → healthy/dead
- [x] RestartGovernor: 滑动 1h 窗口计数；超 maxRestartsPerHour → reject + 升级 actionPolicy
- [x] GracePeriodManager: 启动 30s 默认；重启后 60s；CPU > 80% 或 IO > 80% 时 ×1.5
- [x] ActionExecutor: 9 功能 → 实际调用 spec-15 task queue 改 status / spec-18 注入 / 通知 spec-30 — 2026-05-16 `WatchdogActionExecutor` now consumes real `action-taken` events, updates matched running task-queue runs to `retrying`/`failed` or `awaiting-human`, attempts `watchdog-restart-resume` injection only when the matched CSV task explicitly has `allow_inject=true`, emits unified spec-30 watchdog notifications, records local action results, and is covered by focused runtime tests without fabricating restart or injection success.
- [x] perPhase 超时按 spec-28 三层状态机的 task layer phase 切换（接 spec-28）
- [x] feature flag `R8.C.watchdog.engine` 默认 ON；子项 `R8.C.watchdog.engine.strict` 默认 OFF（用户开）
- [x] audit log: state-change / action-taken / storm-detected 全记
- [x] watchdog:event-stream 经 spec-31 high_freq_scan 限流（聚合 batch）— 2026-05-16 `R8RuntimeService` now batches real `WatchdogEngine` history events into `watchdog:event-stream` payloads, sends them to the main window and live BrowserWindows, exposes `window.devhub.watchdog.onEventStream()`, and validates the stream through shared Zod schemas.
- [x] vitest: kill instance / starvation / storm / phase-aware — 2026-05-16 focused watchdog suite now covers a real spawned child process kill via OS PID liveness probing, strict CPU-only starvation rejection, restart storm protection, and phase-aware thinking timeout without fake subprocess respawn success.
- [x] benchmarks: 16 instance 并发监控 CPU < 1% — 2026-05-16 focused benchmark uses the real `WatchdogEngine` with 16 registered instances, 240 heartbeat/evaluate sweeps, writes `perf-reports/watchdog-16-benchmark.json`, and measured estimated CPU at a 30s heartbeat interval as `0.000336%` with p95 sweep `0.879ms`.

---

## 11. dependencies

```yaml
upstream:
  - spec-15: TaskQueueService 提供 task phase
  - spec-27: SignalCollector 提供 CPU/IO/title 信号
  - spec-28: 三层状态机的 task layer phase
  - spec-31: IPC token bucket
  - spec-33: Zod SoT
downstream:
  - spec-17: 把 WatchdogService 装进独立子进程
  - spec-18: restart-resume 注入场景
  - spec-29: 反馈循环消费 storm-detected 事件
  - spec-30: 通知系统接收 watchdog 通知
```

---

## 12. fallback_strategy

```yaml
on_etw_unavailable:
  - 自动 enabledSources 移除 'etw'
  - audit log 记录降级
on_hung_window_api_fail:
  - 退化到 windowTitle + cpu-pulse 双信号
on_marker_file_no_write:
  - 通知用户 + 移除该信号源
on_storm_detected:
  - 立即转 fallback-tool（若可用）→ human-intervention
  - 通知用户 ERROR
flag_off_behavior:
  - R8.C.watchdog.engine=OFF → 退回 R7 时代仅 SystemProcessScanner 定时扫描，无主动重启
```

---

## 13. performance_budget

```yaml
heartbeat_collect_p95_ms_per_instance: 30
fusion_compute_p99_ms: 5
state_transition_p99_ms: 10
restart_action_p95_seconds: 8
action_decision_p95_ms: 50
self_check_interval_ms: 30000
heartbeat_default_timeout_ms: 120000  # V1-Q-7.F.3
grace_period_default_ms: 30000
restart_storm_window_ms: 3600000  # 1 hour
max_restarts_per_hour: 5
cpu_overhead_per_instance_pct: 0.5
memory_per_instance_kb: 64
ipc_channel: watchdog:event-stream → spec-31 high_freq_scan 30 RPM
total_instances_max: 16
```

## 14. implementation_checkpoint_2026_05_04_policy_engine_slice

```yaml
status: watchdog_policy_engine_verified
implemented:
  - Added WatchdogEngine as a real main-process policy engine for heartbeat registration, source weighting, lenient/strict fusion, startup grace, phase-aware timeout, restart storm governance, self-check, and persisted event history.
  - Extended shared Zod contracts with HeartbeatSource, HeartbeatMode, WatchdogActionPolicy, WatchdogPhase, WatchdogInstance, and expanded WatchdogStatus while preserving existing watchdog:status compatibility fields.
  - R8RuntimeService now delegates watchdog status/config/history/override to WatchdogEngine and exposes service-level registerWatchdogInstance, recordWatchdogHeartbeat, evaluateWatchdog, and watchdogSelfCheck for real internal runtime use.
  - Strict mode rejects CPU-only heartbeat as a sole proof of liveness; lenient mode accepts a single live source. No subprocess respawn is faked: stuck instances produce action-taken history and restarting/fallback/human-pending states only.
  - RestartGovernor uses a sliding one-hour restart event window and blocks the sixth restart by switching to human-pending or fallback-pending with storm-detected evidence.
  - Phase-aware timeout supports thinking/receiving-input/running/awaiting-human thresholds so long thinking can remain healthy while running would have timed out.
verified_by:
  - src/main/services/watchdog/WatchdogEngine.test.ts covers lenient heartbeat, strict CPU-only suspect/restart, startup grace, thinking-phase timeout, restart storm protection, and self-check.
  - src/main/services/R8RuntimeService.test.ts covers WatchdogEngine integration without claiming subprocess respawn success.
  - pnpm test --run src/main/services/watchdog/WatchdogEngine.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 passed: 5 files / 55 tests.
  - pnpm typecheck passed.
  - pnpm lint passed, including no-emoji over 297 files.
known_boundaries:
  - HeartbeatCollector OS integrations for all 9 sources, HungWindow/ETW adapters, real restart executor, spec-18 injection resume action, spec-30 notification emission, watchdog:event-stream broadcast, audit log rows, 16-instance benchmark, and spec-17 subprocess/outer watchdog are not claimed complete in this slice.
```

## 15. implementation_status_2026_05_11_policy_engine_closure

```yaml
status: watchdog_policy_engine_partial_verified
implemented:
  - Tightened WatchdogEngine heartbeat fusion so lenient mode accepts the highest-weight recent heartbeat instead of the latest-only beat, while strict mode still requires a primary signal plus either two sources or weight >= 0.9.
  - Verified the nine-source heartbeat registry and per-instance enabledSources gate at the policy-engine boundary without claiming OS-level collector adapters.
  - Tightened disabled-source handling so a heartbeat from a source excluded by enabledSources is still recorded for local audit history but no longer refreshes lastHeartbeatAt or transiently resets a suspect/stuck instance to healthy.
  - Added GracePeriodManager behavior for default 30s startup grace, default 60s restart grace, and 1.5x extension when startup input or latest heartbeat detail reports CPU or IO above 80%.
  - Preserved the finite state machine evidence path: healthy -> suspect -> stuck -> restarting / fallback-pending / human-pending, with state-change, action-taken, and storm-detected history events.
  - Verified default feature flags: R8.C.watchdog.engine is enabled by default and R8.C.watchdog.engine.strict is disabled by default but user-overridable.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/watchdog/WatchdogEngine.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "watchdog|Watchdog|default disabled states|feature flag" passed: 4 files passed / 2 skipped, 18 tests passed / 111 skipped.
  - pnpm -C devhub exec vitest run src/main/services/watchdog/WatchdogEngine.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 passed: 5 files / 57 tests.
known_boundaries:
  - HeartbeatCollector OS adapters, HungWindow/ETW integrations, real ActionExecutor calls into spec-15/spec-18/spec-30, watchdog:event-stream batching, full kill-instance Vitest, 16-instance benchmark, and spec-17 subprocess runtime remain open and are not claimed complete.
```

## 16. implementation_status_2026_05_16_watchdog_event_stream

```yaml
status: watchdog_event_stream_verified
implemented:
  - WatchdogEvent and WatchdogEventStreamPayload are now shared Zod contracts and registered in the R8 schema registry.
  - R8RuntimeService records the watchdog history baseline before configure/register/heartbeat/evaluate/self-check/manual override operations, then batches only newly persisted WatchdogEngine events.
  - watchdog:event-stream uses the existing main-to-renderer stream channel, emits at most 100 events per payload, and throttles subsequent payloads to the documented 2000ms / 30 RPM high_freq_scan cadence.
  - The stream sends to the main window plus live BrowserWindow targets and clears its timer on service dispose.
  - Preload and renderer global typings expose window.devhub.watchdog.onEventStream(callback) with a cleanup function.
  - The nine-source heartbeat registry and per-instance enabledSources gate remain verified at the policy-engine boundary; OS-level source adapters are still outside this slice.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "watchdog|Watchdog|event-stream|preload|IPC|schema"
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "streams watchdog events"
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub check:zod-sot
verified_results:
  focused_watchdog_contracts: passed; 3 files passed, 19 tests passed, 110 skipped by filter
  focused_watchdog_stream: passed; 1 file passed, 1 test passed, 102 skipped by filter
  typecheck: passed
  lint_no_emoji: passed; no emoji found in 648 files
  zod_sot: passed
known_boundaries:
  - HeartbeatCollector OS adapters, HungWindow/ETW integrations, full kill-instance/starvation/storm fixture set, 16-instance benchmark, and spec-17 subprocess runtime remain open.
```

## 17. implementation_status_2026_05_16_action_executor

```yaml
status: watchdog_action_executor_verified
implemented:
  - Added WatchdogActionExecutor as the spec-16 action dispatcher for real WatchdogEngine action-taken events.
  - R8RuntimeService now executes each new watchdog action event once, records bounded local action results, and audits action execution without adding background agents or fake success states.
  - Restart actions call the existing spec-15 StoreBackedTaskQueueService path through completeTaskRun; running matched tasks move to retrying when retries remain or failed when retries are exhausted.
  - Human-intervention, fallback-tool, and escalate-model actions call a new task-queue markAwaitingHuman transition for matched running tasks, using the existing running -> awaiting-human state-machine edge instead of mutating task records directly.
  - Restart-resume injection calls the existing spec-18 executeInject path only when the matched task row explicitly sets allow_inject=true; missing targets or permission gates are recorded as truthful blocked inject results rather than success.
  - Every watchdog action emits through the existing spec-30 unified notification service with source=watchdog and severity derived from restart, storm, human, fallback, or log-only policy.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/services/watchdog/WatchdogEngine.test.ts --maxWorkers=1 -t "watchdog|Watchdog"
  - pnpm -C devhub typecheck
verified_results:
  focused_watchdog_runtime: passed; 2 files passed, 17 tests passed, 100 skipped by filter
  typecheck: passed
known_boundaries:
  - OS-level HeartbeatCollector adapters, HungWindow/ETW integrations, full kill-instance/starvation/storm fixture set, and spec-17 subprocess runtime remain open.
  - ActionExecutor does not taskkill or spawn a fake replacement process. It coordinates existing queue, inject, and notification services and records blocked injection truthfully when no real target is ready or whitelisted.
```

## 18. implementation_status_2026_05_16_watchdog_16_instance_benchmark

```yaml
status: watchdog_16_instance_benchmark_verified
implemented:
  - Added a focused 16-instance WatchdogEngine benchmark to the real watchdog unit suite.
  - The benchmark registers 16 real WatchdogEngine instances, records heartbeat beats, evaluates all instances across 240 sweeps, measures process.cpuUsage(), and writes a local JSON artifact under perf-reports.
  - The CPU budget is evaluated as estimated steady-state CPU at the documented 30000ms heartbeat interval rather than a synthetic busy-loop percentage.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/watchdog/WatchdogEngine.test.ts --maxWorkers=1 -t "16-instance watchdog benchmark"
verified_results:
  focused_benchmark: passed; 1 file passed, 1 test passed, 10 skipped by filter
  artifact: devhub/perf-reports/watchdog-16-benchmark.json
  estimatedCpuPctAt30sInterval: 0.000336
  p95SweepMs: 0.879
  p99SweepMs: 0.951
  maxSweepMs: 1.037
known_boundaries:
  - This benchmark closes the 16-instance CPU budget for the in-process policy engine. It does not replace OS collector adapters or spec-17 subprocess runtime evidence.
```

## 19. implementation_status_2026_05_16_kill_starvation_storm_phase_matrix

```yaml
status: watchdog_vitest_matrix_verified
implemented:
  - R8RuntimeService now supplies WatchdogEngine with a real PID liveness probe based on process.kill(pid, 0).
  - The liveness probe treats ESRCH as dead, EPERM as alive, and unknown probe errors as unknown rather than killing or mutating the process.
  - WatchdogEngine converts a dead PID into the same stuck -> action flow as heartbeat starvation, producing a restart action without claiming a spawned replacement.
  - The focused suite covers a real spawned Node child process killed during the test, strict CPU-only starvation rejection, restart storm protection, and phase-aware thinking timeout.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/services/watchdog/WatchdogEngine.test.ts --maxWorkers=1 -t "watchdog|Watchdog|killed real child"
verified_results:
  focused_watchdog_runtime: passed; 2 files passed, 17 tests passed, 100 skipped by filter
known_boundaries:
  - OS-level HeartbeatCollector adapters for every source, HungWindow/ETW integrations, and spec-17 subprocess runtime remain open.
  - The kill fixture proves detection and restart action request against a real child PID; it does not spawn a fake replacement process or mark subprocess respawn complete.
```

## 20. implementation_status_2026_05_19_os_collector_adapters

```yaml
status: watchdog_os_collector_adapters_verified
implemented:
  - Added WatchdogHeartbeatCollector as the real adapter layer for all nine spec-16 heartbeat sources.
  - marker-file and fs-activity read real filesystem mtimes.
  - stdout uses real parser/stdout timestamps and byte counts supplied by runtime metadata.
  - cpu-pulse and network use the existing SystemInformationAdapter process and network inventories.
  - window-title uses the existing Win32WindowEnumerator and stores titleHash/titleLength rather than window title text.
  - http-health performs a real localhost/loopback-only fetch with bounded timeout.
  - hung-window calls user32.dll IsHungAppWindow through bounded PowerShell P/Invoke on Windows and fails explicitly on unsupported platforms.
  - etw probes local ETW sessions through logman when elevated and returns E_PERMISSION_DENIED without fabricating heartbeat when elevation is unavailable.
  - R8RuntimeService.collectWatchdogHeartbeats records real beats into WatchdogEngine, audits degraded source failures, evaluates status, and emits the existing watchdog event stream.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/watchdog/HeartbeatCollector.test.ts --maxWorkers=1
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "watchdog source adapters|watchdog heartbeat policy|collects real local watchdog"
  - pnpm -C devhub exec vitest run src/main/services/watchdog/HeartbeatCollector.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "WatchdogHeartbeatCollector|watchdog heartbeat policy|collects real local watchdog"
  - pnpm -C devhub exec eslint src/main/services/watchdog/HeartbeatCollector.ts src/main/services/watchdog/HeartbeatCollector.test.ts src/main/services/watchdog/index.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts --max-warnings=0
  - pnpm -C devhub typecheck
  - pnpm -C devhub check:no-emoji
  - pnpm -C devhub check:zod-sot
known_boundaries:
  - spec-17 subprocess Windows Service UAC execution and kill/orphan packaged E2E remain separate spec-17 boundaries.
  - ETW produces a real heartbeat only in an elevated Windows session; non-elevated sessions emit E_PERMISSION_DENIED as designed instead of fake success.
```
