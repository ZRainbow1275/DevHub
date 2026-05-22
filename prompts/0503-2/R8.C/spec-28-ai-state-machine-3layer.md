# spec-28-ai-state-machine-3layer — AI 任务三层状态机（system / task / ui）

> **batch**: R8.C  |  **flag**: `R8.C.state.three-layer`
> **depends_on**: R8.C spec-27 (signal fusion), R8.A spec-02 (ProcessUnifiedVM)
> **derives_from**: V1-Q-7.A.6 答 D 三层 + V2-Q-15.G..J + master §3.4 / §7.4

---

## 1. motivation

```yaml
user_quote_v1_q_7_a_6: "D — 三层状态机：system 进程层 / task AI 任务层 / ui 显示层；层间断言"
goals:
  - 三独立 FSM，互相约束但互不污染
  - system: { spawning, alive, zombie, dead }
  - task: { idle, thinking, running, awaiting-input, completed, error }
  - ui: { hidden, dim, normal, highlight, alert }
  - 层间断言：system=dead → task=error → ui=alert（违反则触发 spec-29 反馈循环）
  - 状态翻转 P99 < 50ms（master §7.4）
constraint:
  - 用 xstate 而非自手写（V2-Q-15.H 答 B）
  - 状态翻转必须经事件，禁直接 setState
  - 历史轨迹 ringbuffer 1024 长（spec-22 录像消费）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/state/SystemFSM.ts
  - devhub/src/main/services/state/TaskFSM.ts
  - devhub/src/main/services/state/UiFSM.ts
  - devhub/src/main/services/state/StateMachineCoordinator.ts
  - devhub/src/main/services/state/StateAssertion.ts
  - devhub/src/main/services/state/StateMachineCoordinator.test.ts
  - devhub/src/shared/schemas/state-machine.ts
modified_files:
  - devhub/src/main/services/R8RuntimeService.ts  # spec-27 fused signal -> state coordinator, state stream, audit hooks
  - devhub/src/main/ipc/r8RuntimeHandlers.ts  # ai:get-instance-state / rules IPC handlers
  - devhub/src/preload/index.ts  # typed renderer bridge and ai:state-stream listener
  - devhub/src/renderer/types/global.d.ts  # renderer global API typing
  - devhub/src/shared/schemas/r8-runtime.ts  # schema registry and IPC channel registry
  - devhub/src/shared/feature-flags.ts  # R8.C.state.three-layer flag, default ON by registry default
  - devhub/package.json  # xstate@5 dependency
compatibility_notes:
  - legacy AITaskTracker state fields were preserved and not refactored because pre-edit impact was MEDIUM
  - new ai:get-instance-state reads the three-layer coordinator; existing tracker paths continue to run unchanged
glob_anchors:
  - devhub/src/main/services/R8RuntimeService.ts:2220-2320
  - devhub/src/main/services/state/StateMachineCoordinator.ts
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const SystemStateEnum = z.enum(['spawning','alive','zombie','dead'])
export const TaskStateEnum = z.enum(['idle','thinking','running','awaiting-input','completed','error'])
export const UiStateEnum = z.enum(['hidden','dim','normal','highlight','alert'])

export const StateLayerEnum = z.enum(['system','task','ui'])

export const StateTransitionEventSchema = z.object({
  instanceId: z.string(),
  layer: StateLayerEnum,
  fromState: z.string(),
  toState: z.string(),
  trigger: z.string(),  // event name
  reason: z.string(),
  ts: z.number().int(),
  signalSnapshot: z.object({  // 触发瞬间的信号（spec-27）
  fusedConfidence: z.number(),
  topContribution: z.string(),
  }).optional(),
})

export const InstanceStateSchema = z.object({
  instanceId: z.string(),
  system: SystemStateEnum,
  task: TaskStateEnum,
  ui: UiStateEnum,
  lastTransitions: z.array(StateTransitionEventSchema).max(1024),
  assertionViolations: z.array(z.object({
  rule: z.string(),
  detectedAt: z.number().int(),
  resolvedAt: z.number().int().nullable(),
  })),
})

export const StateAssertionRuleSchema = z.object({
  ruleId: z.string(),
  description: z.string(),
  predicate: z.string(),  // serialized expr
  severity: z.enum(['warn','error','fatal']),
  onViolate: z.enum(['log','notify','invalidate-and-recompute']),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  ai:get-instance-state:
  req: { instanceId: string }
  resp: InstanceState
  ai:state-stream:
  direction: main->renderer
  payload: StateTransitionEvent
  rate_limit_class: medium_query
  ai:list-state-rules:
  resp: StateAssertionRule[]
  ai:override-rule:
  req: { ruleId: string, enabled: boolean }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 无效 transition（fromState 不允许 toState） | E_VALIDATION（拒绝 + audit） |
| 层间断言违反 | (触发 spec-29 反馈 + INVALIDATE) |
| ringbuffer 溢出 | (覆盖最旧；不报错) |
| xstate machine config 错 | E_INTERNAL（启动失败） |
| 同 instance 多线程并发翻转 | (xstate 自带串行化保护) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础翻转):
  given: instance system=spawning
  when: spawn 成功 → 触发 'spawned'
  then: system → alive；transition 写入 ringbuffer

GWT-2 (层间断言):
  given: system=dead
  when: 断言检查
  then: 若 task != error → assertionViolation 记录 + 触发 spec-29

GWT-3 (信号驱动 task):
  given: spec-27 fusedProgress.percent=0.4 confidence=0.85
  when: task=idle 收到 signal
  then: task → thinking 或 running（依据 progress > 0.1 阈值）

GWT-4 (P99 延迟):
  given: 1000 次随机 transition
  when: 测量
  then: P99 < 50ms（master §7.4 three_layer_state_machine_step_p99_ms）

GWT-5 (用户禁规则):
  given: user 禁用 'system-dead-implies-task-error' 规则
  when: 检查
  then: 不触发违反；audit log 记录禁用事件
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-2 layer assertion violation', async ({ page, electronApp }) => {
  await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.emit('test:force-state', { instanceId: 'x', layer: 'system', state: 'dead' })
  ipcMain.emit('test:force-state', { instanceId: 'x', layer: 'task', state: 'thinking' })
  })
  const state = await page.evaluate(() => window.electronAPI.ai.getInstanceState({ instanceId: 'x' }))
  expect(state.assertionViolations.length).toBeGreaterThan(0)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'xstate@5.x':  MIT  状态机框架
  - '@xstate/react@5.x':  renderer 端订阅
  - 'zod@3.23':  schema
inspirations:
  - VS Code language server LSP state model
  - Erlang/OTP supervision tree
  - Kubernetes pod phase model
state_machines_overview: |
  SystemFSM:
  spawning → alive (event=spawned)
  alive → zombie (event=heartbeat-lost)
  zombie → alive (event=heartbeat-recovered)
  zombie → dead (event=watchdog-confirm)
  alive → dead (event=process-exit)
  TaskFSM:
  idle → thinking (event=signal-active)
  thinking → running (event=tool-use-detected)
  running → awaiting-input (event=stdin-prompt)
  running → completed (event=cli-completion-marker)
  any → error (event=fatal-error)
  UiFSM:
  follows task + system; e.g. system=zombie → ui=alert
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~150
test_loc: ~450
total: ~1500
risk_areas:
  - xstate v5 学习曲线
  - 旧 AITaskTracker 状态字段兼容（feature flag 双跑）
  - 1024 ringbuffer 内存（高负载 1000 实例 → 1GB）
```

---

## 10. implement_checklist

- [x] xstate v5 三 machine 定义（SystemFSM / TaskFSM / UiFSM）
- [x] StateMachineCoordinator 路由事件到对应 machine
- [x] StateAssertion 内置 8 条规则（system-task / task-ui / system-ui）
- [x] 用户可在 ai:override-rule 关闭单条
- [x] ringbuffer 1024 长，溢出覆写
- [x] state-stream 100ms throttle
- [x] 性能：单 transition < 50ms（基准测试）
- [x] vitest 覆盖 5 GWT + xstate fixture
- [x] feature flag R8.C.state.three-layer 默认 ON
- [x] 双跑期：旧 path 也写但不读（防回归）
- [x] audit log: 违反规则全部入审计

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-27: signal fusion 提供 fusedProgress + contribution
  - R8.A.spec-02: ProcessUnifiedVM 提供 system 层信号源
  - R8.C.spec-33: Zod SoT
downstream:
  - R8.C.spec-29: 反馈循环订阅 transition + violation
  - R8.C.spec-22: 任务录像消费 transition stream
  - R8.C.spec-32: 观测面板显示 ui 层
```

---

## 12. fallback_strategy

```yaml
on_xstate_init_fail:
  - 退化到旧 AITaskTracker 单层状态（feature flag 自动 OFF）
on_ringbuffer_pressure:
  - 1000 实例时调小 ringbuffer 到 256
on_assertion_storm:
  - 同规则 10 条/min 自动 throttle
flag_off_behavior:
  - R8.C.state.three-layer=OFF 时仅 system 层（task/ui 用旧字段）
```

---

## 13. performance_budget

```yaml
transition_p99_ms: { warn: 50, fatal: 500 }
state_stream_throttle_ms: 100
ringbuffer_max_per_instance: 1024
memory_per_instance_kb: { warn: 64, fatal: 512 }
ipc_channel: ai:state-stream → spec-31 medium_query 60 RPM
```

---

## 14. implementation_status_2026-05-05

```yaml
status: complete
implementation_mode: incremental vertical slice, no legacy tracker deletion
runtime_dependency: xstate@5.31.0
feature_flag: R8.C.state.three-layer default ON through shared feature-flag registry
verification_scope: schema + state services + R8 runtime bridge + IPC + preload + full Vitest + lint + license + GitNexus impact
```

### Implemented Files

```yaml
state_core:
  - devhub/src/shared/schemas/state-machine.ts
  - devhub/src/main/services/state/SystemFSM.ts
  - devhub/src/main/services/state/TaskFSM.ts
  - devhub/src/main/services/state/UiFSM.ts
  - devhub/src/main/services/state/StateAssertion.ts
  - devhub/src/main/services/state/StateMachineCoordinator.ts
runtime_bridge:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
contracts:
  - devhub/src/shared/schemas/r8-runtime.ts
  - prompts/0421/contracts/23-ipc-contracts-master.md
tests:
  - devhub/src/main/services/state/StateMachineCoordinator.test.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.test.ts
  - devhub/src/shared/schemas/r8-runtime.test.ts
  - devhub/src/preload/preloadContract.test.ts
```

### GWT Mapping

- GWT-1: `StateMachineCoordinator.transition` drives `system: spawning -> alive` only through the xstate `spawned` event and records the transition in the 1024-entry history.
- GWT-2: `StateAssertion` records `system-dead-implies-task-error` and related layer violations; `R8RuntimeService` audits newly opened violations through `AuditLogger.log('ai:state-assertion-violation', ...)`.
- GWT-3: `R8RuntimeService.fuseSignals` feeds spec-27 `SignalContributionSnapshot` into `StateMachineCoordinator.applySignal`, moving task `idle -> thinking -> running` from fused progress and confidence.
- GWT-4: `StateMachineCoordinator.test.ts` executes 1000 deterministic xstate transitions and asserts P99 below 50ms.
- GWT-5: `ai:override-rule` is Zod-validated, requires `confirmedBy`, writes an audit row, disables the selected rule, and refreshes open violations without mutating state directly.

### Verification Evidence

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/state/StateMachineCoordinator.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
pnpm typecheck
npx gitnexus analyze --force
git restore -- AGENTS.md CLAUDE.md
npx gitnexus status
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact StateMachineCoordinator --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
```

Results:

- Targeted spec-28 suite: 5 files passed, 74 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 388 files`.
- License check: passed; 401 production package entries validated and 1 manifest exception retained.
- Full Vitest: 79 files passed, 599 tests passed with `--maxWorkers=1`.
- Final TypeScript typecheck: passed.
- GitNexus analyze: indexed 4,440 nodes, 13,734 edges, 381 clusters, and 300 flows.
- GitNexus status: up to date for commit `de634f9`.
- Post-index impact: `R8RuntimeService` LOW, `StateMachineCoordinator` LOW, `setupR8RuntimeHandlers` LOW.

### Completion Boundary

- Complete for spec-28 executable scope: three independent xstate v5 machines, event-only transitions, 1024 ringbuffer overwrite behavior, built-in 8-rule assertions, rule override audit path, state-stream emission with 100ms throttle, `InstanceState` IPC/preload contract, and fused-signal task driving.
- Intentionally not claimed here: spec-29 feedback-loop invalidation/recompute subscriber, spec-32 visual observability panel, packaged Electron performance artifacts, or a broad rewrite of `AITaskTracker`. Those are downstream slices or avoided to preserve existing behavior.
