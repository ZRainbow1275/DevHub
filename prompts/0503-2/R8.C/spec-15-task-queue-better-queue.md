# R8.C spec-15 — 任务队列（better-queue + graphlib）

> **batch**: R8.C  |  **priority_in_batch**: #15（CSV 任务驱动 - 调度核心）  |  **flag**: `R8.C.task.queue`
> **depends_on**: spec-13（CSV schema）+ spec-14（CsvLauncherService）+ spec-20（DAG 编排）+ spec-33（Zod SoT）
> **blocks**: spec-12（CSV driver 顶层消费）+ spec-18（注入由队列触发）+ spec-22（录像与队列任务绑定）
> **decision_anchor**: V1-Q-10.D.1 答 E（better-queue + Bull 备选 + p-queue 兜底）+ C 持久化 / V1-Q-7.E.5 默认 3 / V1-Q-7.H.1 答 B（拓扑排序）/ V1-Q-16.D.1..D.4 补跑
> **estimated_loc**: 1300
> **risk**: high

---

## 1. motivation

```yaml
user_quote_v1_q_10_d_1: "E — better-queue + 失败时切 Bull + 极简场景退 p-queue"
user_quote_v1_q_7_e_5: "F — 默认 3 并发，单 CSV 任务可调"
user_quote_v1_q_16_d_1: "D — 跳过已成功 + 强制重跑 + 参数变更检测"
user_quote_v1_q_16_d_2: "D — SQLite + 增量 append-only"
user_quote_v1_q_16_d_3: "D — CLI / UI / 状态栏徽章 三入口都能补跑"

goals:
  - 用 better-queue 作为通用持久化任务队列（SQLite store）
  - 用 graphlib 做依赖排序 + 循环检测（spec-20 提供）
  - 同一批次的任务按 DAG 拓扑层级 + parallel_group 并发
  - 默认 concurrent=3，CSV metadata 可覆盖（1-16）
  - 任务状态持久化：pending / running / succeeded / failed / skipped / cancelled
  - 补跑模式：跳过 succeeded + 强制 forceRerun 列表 + 参数变更检测（hash 对比）
  - 失败处理由 on_fail（next/abort/retry/fallback-tool/escalate-model/human/execute-skill）驱动
  - 队列暴露 IPC 给监控窗口（spec-07）实时显示队列长度、当前 running、已完成数
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/task-queue/TaskQueueService.ts
  - devhub/src/main/services/task-queue/BetterQueueAdapter.ts
  - devhub/src/main/services/task-queue/TaskScheduler.ts  # DAG → 批次拓扑
  - devhub/src/main/services/task-queue/TaskExecutor.ts  # 执行单条任务
  - devhub/src/main/services/task-queue/TaskState.ts  # state machine
  - devhub/src/main/services/task-queue/TaskStateRepository.ts  # better-sqlite3 持久化
  - devhub/src/main/services/task-queue/ResumePolicy.ts  # 跳过 succeeded + forceRerun
  - devhub/src/main/services/task-queue/RetryBackoff.ts  # 指数退避 + jitter
  - devhub/src/main/services/task-queue/OnFailHandler.ts  # 7 种 on_fail 分发
  - devhub/src/main/services/task-queue/ParallelGroupController.ts  # frontend:max=2 限并发
  - devhub/src/main/services/task-queue/TaskQueueService.test.ts
  - devhub/src/shared/schemas/task-state.ts
modified_files:
  - devhub/src/main/services/csv-launcher/runners/DevHubRunner.ts  # 调用 TaskQueueService
  - devhub/src/main/ipc/csvHandlers.ts  # task:list / task:retry / task:skip
  - devhub/src/main/index.ts  # 启动注册 TaskQueueService 单例
glob_anchors:
  - devhub/src/shared/schemas/csv-task-row.ts  # spec-13
  - devhub/src/main/services/dag/DagOrchestrator.ts  # spec-20 提供 topoSort
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { CsvTaskRowSchema } from '@/shared/schemas/csv-task-row'

export const TaskStatusSchema = z.enum([
  'pending', 'queued', 'running', 'succeeded', 'failed',
  'skipped', 'cancelled', 'awaiting-human', 'retrying'
])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskRunSchema = z.object({
  taskId: z.string(),
  sessionId: z.string().uuid(),
  status: TaskStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  maxRetry: z.number().int().nonnegative(),
  rowHash: z.string(),  // sha256(JSON.stringify(row))
  startedAt: z.number().int().nullable(),
  endedAt: z.number().int().nullable(),
  exitCode: z.number().int().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  parallelGroup: z.string().nullable(),
  priority: z.number().int().min(0).max(100).default(50),
  artifactsPath: z.string().nullable(),
  injectActionId: z.string().nullable(),  // spec-18 关联
  recordingId: z.string().nullable(),  // spec-22 关联
})
export type TaskRun = z.infer<typeof TaskRunSchema>

export const QueueStatsSchema = z.object({
  sessionId: z.string().uuid(),
  total: z.number().int(),
  pending: z.number().int(),
  queued: z.number().int(),
  running: z.number().int(),
  succeeded: z.number().int(),
  failed: z.number().int(),
  skipped: z.number().int(),
  awaitingHuman: z.number().int(),
  concurrent: z.number().int(),
  throughputPerMin: z.number(),
  estimatedSecondsRemaining: z.number().int().nullable(),
})
export type QueueStats = z.infer<typeof QueueStatsSchema>

export interface ITaskQueueService {
  enqueue(sessionId: string, rows: CsvTaskRowSchema[], opts: EnqueueOptions): Promise<void>
  pause(sessionId: string): Promise<void>
  resume(sessionId: string): Promise<void>
  abort(sessionId: string): Promise<void>
  retry(sessionId: string, taskIds: string[]): Promise<void>
  skip(sessionId: string, taskIds: string[]): Promise<void>
  getStats(sessionId: string): Promise<QueueStats>
  listTasks(sessionId: string): Promise<TaskRun[]>
}

export interface EnqueueOptions {
  concurrent: number  // 1-16
  resume: boolean
  forceRerun: string[]
  parallelGroupOverrides: Record<string, number>
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  task:list:
  rate_limit: medium_query
  req: { sessionId: string }
  resp: TaskRun[]
  task:retry:
  rate_limit: low_freq_op
  req: { sessionId: string, taskIds: string[] }
  resp: { success: boolean, scheduled: number }
  task:skip:
  rate_limit: low_freq_op
  req: { sessionId: string, taskIds: string[] }
  resp: { success: boolean, skipped: number }
  task:pause-session:
  req: { sessionId: string }
  resp: { success: boolean }
  task:resume-session:
  req: { sessionId: string }
  resp: { success: boolean }
  task:get-stats:
  rate_limit: medium_query
  req: { sessionId: string }
  resp: QueueStats
  task:state-stream:
  direction: main->renderer
  streaming: true
  payload: { taskId: string, sessionId: string, prev: TaskStatus, next: TaskStatus, at: number }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| sessionId 不存在 | E_NOT_FOUND |
| 任务依赖循环 | E_DAG_CYCLE |
| concurrent > 16 | E_VALIDATION |
| SQLite store 损坏 | E_INTEGRITY_FAIL |
| 任务执行超时（task.timeout） | E_TIMEOUT |
| on_fail=human 长时间无响应 | E_TIMEOUT（warn） |
| 所有 retry 用尽 | E_RUNTIME |
| 参数变更检测发现冲突 | E_VALIDATION |
| forceRerun 列表含未知 taskId | E_VALIDATION |
| ParallelGroup max 超 16 | E_VALIDATION |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础并发):
  given: CSV 含 10 行任务，无依赖，concurrent=3
  when: enqueue
  then:
  - 任意时刻 running ≤ 3
  - 全部成功后 stats.succeeded === 10
  - throughputPerMin > 0

GWT-2 (DAG 拓扑):
  given: CSV 含 5 行 A→B,C; B,C→D; A,D→E
  when: enqueue
  then:
  - A 先 running
  - B C 必须 A 结束才 running（且可并行）
  - D 必须 B C 都 succeeded 才 running
  - E 必须 A D 都 succeeded 才 running

GWT-3 (parallel_group max):
  given: 6 行任务全部 parallel_group=frontend:max=2
  when: enqueue concurrent=10
  then: 任意时刻 frontend 组内 running ≤ 2

GWT-4 (resume 跳过 succeeded):
  given: 第一次跑 5 行：3 succeeded, 2 failed
  when: enqueue with resume=true
  then:
  - 3 succeeded 任务直接 skipped（rowHash 未变）
  - 2 failed 任务重新 queued
  - stats.skipped === 3

GWT-5 (forceRerun 强制):
  given: 同上场景，forceRerun=['task-1','task-2']
  when: enqueue with resume=true + forceRerun
  then:
  - task-1 task-2（即使 succeeded）也重新 queued

GWT-6 (rowHash 变更检测):
  given: 第一次跑后用户改了 task-3 的 prompt
  when: enqueue with resume=true
  then:
  - task-3 自动重新 queued（rowHash 不匹配）
  - 通知用户"3 个任务因参数变更重跑"

GWT-7 (on_fail=retry):
  given: task.on_fail=retry, retry=3
  when: 任务第一次失败
  then:
  - status: failed → retrying（attemptCount=1）
  - 指数退避后再 queued
  - 3 次失败后最终 failed

GWT-8 (on_fail=human):
  given: task.on_fail=human
  when: 任务失败
  then:
  - status: awaiting-human
  - 通知用户（spec-30）
  - 用户在 UI 点 retry/skip 后状态切回
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-15-task-queue.spec.ts
test('GWT-2 DAG topology 5 tasks', async ({ page }) => {
  await page.evaluate(async () => {
  await window.electronAPI.csv.launch({ csvPath: './fixtures/dag-5.csv', dryRun: false })
  })
  const transitions: any[] = []
  await page.exposeFunction('__push', (e: any) => transitions.push(e))
  await page.evaluate(() => {
  window.electronAPI.task.stateStream.subscribe((e: any) => (window as any).__push(e))
  })
  await page.waitForFunction(() => (window as any).__sessionDone === true, { timeout: 60000 })
  const order = transitions.filter(t => t.next === 'running').map(t => t.taskId)
  // A 先于 B,C
  expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
  expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'))
  // D 后于 B,C
  expect(order.indexOf('D')).toBeGreaterThan(Math.max(order.indexOf('B'), order.indexOf('C')))
})

test('GWT-4 resume skips succeeded', async ({ page }) => {
  // 模拟先跑一次 → 3 succeeded 2 failed
  await page.evaluate(async () => {
  await window.electronAPI.csv.launch({ csvPath: './fixtures/5-rows.csv' })
  })
  await page.waitForFunction(() => (window as any).__sessionDone)
  // 二次 resume
  const stats = await page.evaluate(async () => {
  const { sessionId } = await window.electronAPI.csv.launch({ csvPath: './fixtures/5-rows.csv', resume: true })
  return await window.electronAPI.task.getStats({ sessionId })
  })
  expect(stats.skipped).toBe(3)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'better-queue@3.8':  主队列（持久化 + retry + concurrency）
  - 'better-queue-sqlite@1.x':  SQLite store
  - 'better-sqlite3@11.x':  同步 SQLite，写入快
  - 'graphlib@2.1':  DAG 拓扑排序 / 循环检测（spec-20 共享）
  - 'p-queue@8.x':  兜底极简队列（feature flag 切换）
  - 'p-retry@6.x':  指数退避 + jitter
  - 'fastq@1.x':  备选高性能 in-memory 队列
inspirations:
  - "Bull (Redis-based) — 备选未启用，避免新增依赖"
  - "Celery beat / GitHub Actions matrix"
  - "Make jobserver 协议（concurrent semaphore）"
sqlite_schema:
  - tasks (taskId TEXT PK, sessionId TEXT, status TEXT, attemptCount INT, rowHash TEXT, ...)
  - state_transitions (id INTEGER PK AUTO, taskId TEXT, prev TEXT, next TEXT, at INT)
  - INDEX (sessionId, status), (taskId, rowHash)
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~800
modified_loc: ~100
test_loc: ~400
total: ~1300
risk_areas:
  - SQLite 文件锁与 DevHub 主进程并发写入
  - graphlib 大图（>500 节点）拓扑排序耗时
  - on_fail=human 路径在 24h 长跑中的长时间挂起
  - 进程崩溃恢复后队列状态一致性（spec-34 协同）
```

---

## 10. implement_checklist

- [x] BetterQueueAdapter 包装 installed `better-queue@3.8.12` + API-compatible `better-sqlite3` SQLite store，路径 `%APPDATA%/devhub/queue.sqlite`；`better-queue-sqlite@1.0.7` 已通过 npm metadata / runtime probe 证明依赖 unavailable `sqlite3` native binding，不能作为真实可运行依赖保留
- [x] TaskScheduler 用 graphlib.alg.topsort + Tarjan 检测环
- [x] 每个任务的 rowHash = sha256(JSON.stringify(row 排序键))
- [x] ParallelGroupController 用 semaphore 限组内并发（默认无限制，metadata 可覆盖）
- [x] RetryBackoff: base=2000ms, factor=2, max=60000ms, jitter=±20%
- [x] OnFailHandler 7 种分支：next 跳过 / abort 终止整批 / retry 重排 / fallback-tool 切工具（与 spec-12 协调）/ escalate-model（标记 needs-bigger-model）/ human（awaiting-human）/ execute-skill（执行某 SKILL）
- [x] ResumePolicy：rowHash 匹配 + status=succeeded → skipped；forceRerun 强制 queued
- [x] state machine 严格转移：pending → queued → running → succeeded/failed/skipped；failed → retrying → queued
- [x] task:state-stream 订阅 BetterQueue events
- [x] feature flag `R8.C.task.queue.engine` ∈ {better-queue, p-queue}
- [x] audit log：每条任务起止 + 切工具 + retry + on_fail 分支
- [x] 启动时 PRAGMA integrity_check；损坏 → 备份并重建（spec-34 协同）
- [x] vitest fixtures：dag-5.csv / parallel-group-6.csv / on-fail-retry-3.csv / resume-skip-3.csv

---

## 11. dependencies

```yaml
upstream:
  - spec-13: CsvTaskRowSchema
  - spec-14: CsvLauncherService 提供 LaunchSession + rows
  - spec-20: DagOrchestrator 提供 topoSort + cycle detection
  - spec-33: Zod SoT
downstream:
  - spec-12: CSV driver 顶层消费 ITaskQueueService
  - spec-18: 注入触发由 task-start 事件驱动
  - spec-22: 录像由 task-start/end 事件触发
  - spec-29: 反馈循环消费 task 失败原因分类
  - spec-34: 崩溃恢复读取 SQLite tasks 表 dirty 状态
```

---

## 12. fallback_strategy

```yaml
on_better_queue_fail:
  - 退化到 p-queue（仅内存）+ 通知用户"持久化禁用"
  - feature flag R8.C.task.queue.engine=p-queue
on_sqlite_corrupt:
  - 备份至 queue.sqlite.bak.{ts}
  - 创建新空库
  - 通知用户 + 提供恢复入口
on_session_orphan:
  - 启动时扫描 status='running' 的 task 但 sessionId 无对应 process
  - 标记为 failed + 写入 audit log
flag_off_behavior:
  - R8.C.task.queue=OFF → CSV 退回到 R7 同步串行执行模式
```

---

## 13. performance_budget

```yaml
enqueue_latency_p95_ms_per_row: 5
state_transition_emit_p99_ms: 10
sqlite_write_p95_ms: 3
topo_sort_p95_ms_per_500_nodes: 80
queue_stats_query_p95_ms: 30
concurrent_default: 3
concurrent_max: 16
session_concurrent_max: 4  # 同一 DevHub 实例
parallel_group_max_per_group: 16
retry_max_attempts: 10
human_wait_warn_min: 60
human_wait_fatal_min: 1440
ipc_channel: task:state-stream → spec-31 high_freq_scan 30 RPM（聚合 batch）
```
## 14. implementation_checkpoint_2026_05_04

```yaml
status: store_backed_queue_slice_verified
implemented:
  - R8RuntimeService.enqueueCsvRow persists TaskRun records with taskId/sessionId/attemptCount/maxRetry/rowHash/errorCode/errorMessage compatibility fields.
  - queueStats supports aggregate and session-scoped counts for pending/queued/running/succeeded/failed/skipped/awaitingHuman/retrying/cancelled and exposes throughput/ETA placeholders from real stored task state.
  - task:retry, task:skip, task:pause-session, task:resume-session, and task:abort-session are executable and synchronized with shared IPC registry plus preload whitelist.
  - csv:enqueue-group bridges valid CsvDriver rows into the queue while preserving invalid row rejection at driver level.
verified_by:
  - R8RuntimeService.test.ts covers durable enqueue, queue stats, retry/skip/session controls via service paths, and real CSV group enqueue.
  - r8RuntimeHandlers.test.ts and preloadContract.test.ts verify IPC registration and public preload whitelist sync.
known_boundaries:
  - Full better-queue engine, SQLite adapter, task:state-stream, and crash recovery integrity checks are not claimed complete in this slice.
  - Current implementation is intentionally store-backed to fit the existing R8RuntimeService integration style and avoid a large refactor while preserving real data and explicit boundaries.
```


## 15. implementation_checkpoint_2026_05_04_queue_scheduler_slice

```yaml
status: durable_scheduler_slice_verified
implemented:
  - Added StoreBackedTaskQueueService as a real task queue boundary over the existing Electron Store persistence layer; it does not claim BetterQueue/SQLite completion.
  - Enqueue now validates concurrent and parallelGroupOverrides bounds, rejects duplicate taskIds, rejects unknown forceRerun taskIds, and rejects dependency cycles with E_DAG_CYCLE.
  - Runtime CSV rows now preserve concurrencyKey as parallel_group so spec-15 parallel group limits are enforceable after spec-13/14 ingestion.
  - Scheduler supports queued -> running transitions with global concurrency and per-parallel-group limits, without marking external executor success unless completeTaskRun receives an explicit exitCode.
  - Dependency gates are real: dependent rows stay waiting-dependency until their upstream task is succeeded or resume-skipped.
  - ResumePolicy supports rowHash match -> skipped, forceRerun -> queued, and rowHash drift -> queued with ROW_HASH_CHANGED evidence.
  - Failure handling keeps retry paths explicit: running -> retrying/failed, operator retry -> queued, operator skip -> skipped, session pause/resume/abort remain confirmed operations.
  - State transition records are persisted in taskStateTransitions for future task:state-stream/audit integration.
verified_by:
  - src/main/services/task-queue/TaskQueueService.test.ts covers DAG readiness, parallel group limits, resume skip, force rerun, rowHash drift, retry transitions, dependency cycles, and forceRerun validation.
  - src/main/services/R8RuntimeService.test.ts covers real CSV group reload/enqueue plus scheduler DAG and parallel_group behavior through R8RuntimeService.
  - pnpm test --run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 passed: 5 files / 49 tests.
  - pnpm typecheck passed.
  - pnpm lint passed, including no-emoji over 294 files.
known_boundaries:
  - BetterQueueAdapter, better-queue-sqlite, better-sqlite3 storage, task:state-stream IPC broadcast, audit log rows, startup integrity scan, and crash recovery remain unclaimed future work.
```

## 16. implementation_evidence_2026-05-11_graphlib_scheduler

```yaml
status: graphlib_scheduler_slice_verified
implemented:
  - StoreBackedTaskQueueService now builds a directed graph with @dagrejs/dagre graphlib for every enqueue batch.
  - Internal dependency edges use dependency -> task direction, so graphlib.alg.topsort produces dependency-first persistence order.
  - graphlib.alg.tarjan detects strongly connected components before scheduling; self-loops and multi-node cycles fail with E_DAG_CYCLE and an auditable cycle path.
  - enqueueRows now normalizes rows, validates duplicate ids and forceRerun ids, then persists tasks in topological order while preserving existing waiting-dependency gates.
tests:
  - TaskQueueService.test.ts asserts unsorted C -> B -> A input is persisted as A, B, C and only A starts first.
  - TaskQueueService.test.ts asserts A <-> B and A -> A cycles throw E_DAG_CYCLE with concrete cycle paths.
  - CsvTaskDriver.test.ts remains in the targeted gate to keep fixture parsing and queue ingress aligned.
verification:
  - pnpm -C devhub test --run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
known_boundaries:
  - This slice closes graphlib topsort plus Tarjan cycle detection only.
  - BetterQueueAdapter, better-queue-sqlite, better-sqlite3 storage, task:state-stream IPC broadcast, audit log rows, startup integrity scan, and crash recovery remain open.
```

## 17. implementation_evidence_2026-05-11_retry_backoff

```yaml
status: retry_backoff_slice_verified
implemented:
  - TaskRun schema now persists retryBackoffMs and nextRetryAt, defaulting both to null for existing records.
  - Executor failure with remaining retries moves running -> retrying and records a real nextRetryAt instead of immediately requeueing.
  - Backoff formula uses base=2000ms, factor=2, max=60000ms, and deterministic SHA256-based jitter within +/-20 percent to spread retries without nondeterministic tests.
  - startReadyTasks promotes retrying -> queued only after nextRetryAt has elapsed; manual confirmed retry still overrides the wait and clears backoff fields.
tests:
  - TaskQueueService.test.ts asserts first failure delay is within 1600..2400ms and second failure delay is within 3200..4800ms.
  - TaskQueueService.test.ts asserts retrying tasks do not start before nextRetryAt and restart through the real queued -> running scheduler path after the window elapses.
  - RecoveryProbe.test.ts task factories include retryBackoffMs and nextRetryAt so recovery tests stay aligned with the shared TaskRun contract.
verification:
  - pnpm -C devhub test --run src/main/services/task-queue/TaskQueueService.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
known_boundaries:
  - This slice closes retry backoff timing only.
  - BetterQueueAdapter, better-queue-sqlite, better-sqlite3 storage, task:state-stream IPC broadcast, audit log rows, startup integrity scan, and crash recovery remain open.
```

## 18. implementation_evidence_2026-05-11_parallel_group_controller

```yaml
status: parallel_group_controller_slice_verified
implemented:
  - StoreBackedTaskQueueService now routes per-group scheduling through a ParallelGroupController instead of ad hoc inline counters.
  - ParallelGroupController behaves as a semaphore: it seeds counts from already-running tasks, acquires a permit before each queued task starts, and refuses tasks when a configured group limit is full.
  - Groups without an explicit metadata override remain unlimited except for the global concurrent cap.
tests:
  - TaskQueueService.test.ts asserts six frontend tasks with parallelGroupOverrides.frontend=2 start exactly two tasks even when global concurrency is ten.
  - TaskQueueService.test.ts asserts a group without an override starts all four tasks when global concurrency allows it.
  - spec-15 CSV fixture parallel-group-6.csv continues to exercise the same limit after CsvTaskDriver parsing.
verification:
  - pnpm -C devhub test --run src/main/services/task-queue/TaskQueueService.test.ts --maxWorkers=1
known_boundaries:
  - This slice closes current store-backed parallel_group semaphore behavior only.
  - BetterQueueAdapter, better-queue-sqlite, better-sqlite3 storage, task:state-stream IPC broadcast, audit log rows, startup integrity scan, and crash recovery remain open.
```

## 19. implementation_evidence_2026-05-11_store_backed_state_stream

```yaml
status: store_backed_state_stream_slice_verified
implemented:
  - Shared Zod contracts now include TaskStateTransition and TaskStateStreamPayload.
  - R8RuntimeService emits task:state-stream payloads whenever store-backed task queue operations create new persisted taskStateTransitions.
  - The stream is batched and throttled at the 100ms boundary, sends to the main window plus live BrowserWindow targets, and is cleared on dispose.
  - Preload and renderer global typings expose window.devhub.task.onStateStream(callback) with a cleanup function.
tests:
  - R8RuntimeService.test.ts asserts queued -> running and running -> succeeded transitions are emitted on task:state-stream.
  - r8-runtime.test.ts asserts the channel exists, is marked main-to-renderer-stream, and exposes TaskStateTransition/TaskStateStreamPayload schemas.
  - preloadContract.test.ts asserts the public preload listener is backed by a main-process sender and contracts/23 whitelist.
verification:
  - pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "task state|task:state-stream|IPC|preload|schema|queue|CSV|csv|attached flow"
  - pnpm -C devhub typecheck
known_boundaries:
  - This is a real store-backed transition stream, not a BetterQueue event subscription.
  - The checklist item "task:state-stream subscribes BetterQueue events" remains open until BetterQueueAdapter exists and forwards native queue events.
```

## 20. implementation_evidence_2026-05-11_task_transition_audit

```yaml
status: task_transition_audit_slice_verified
implemented:
  - R8RuntimeService audits newly persisted taskStateTransitions generated by store-backed queue operations.
  - Audit action mapping covers task:start, task:end, task:retry-scheduled, task:retry, task:retry-ready, task:skip, task:pause, task:resume, task:cancel, and task:dependency-satisfied.
  - Audit targets include transitionId, runId, taskId, sessionId, prev, next, reason, and transition timestamp.
tests:
  - R8RuntimeService.test.ts asserts queued -> running emits task:start audit and running -> succeeded emits task:end audit.
verification:
  - pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "task state|queue|CSV|csv|attached flow"
  - pnpm -C devhub typecheck
known_boundaries:
  - This slice audits concrete task state transitions.
  - The full audit checklist was later closed by the dedicated OnFailHandler/fallback-tool implementation and task:on-fail audit evidence below.
```

## 21. implementation_status_2026-05-11_consolidated

```yaml
status: store_backed_queue_verified_partial
verified_scope:
  - graphlib topological ordering and Tarjan cycle detection
  - sorted rowHash resume policy, force rerun, and rowHash drift rerun
  - strict store-backed task state transitions with retry backoff windows
  - parallel_group semaphore scheduling
  - task:state-stream payloads from persisted store-backed transitions
  - task transition audit for concrete start/end/retry/skip/pause/resume/cancel/dependency transitions
  - CSV fixture coverage for dag-5, parallel-group-6, on-fail-retry-3, and resume-skip-3
verified_commands:
  - pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "TaskQueue|task state|task:state-stream|queue|CSV|csv|default disabled states|feature flag"
  - pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
verified_results:
  targeted_queue_slice: passed; 6 files passed, 1 file skipped by filter, 36 tests passed, 99 skipped
  contract_small_files: passed; 6 files passed, 63 tests passed
completion_boundary:
  - Native BetterQueueAdapter and better-queue-sqlite remain open; queue.sqlite storage is now covered by the SQLiteTaskQueueStore slice below.
  - Dedicated OnFailHandler branches for fallback-tool, escalate-model, human, and execute-skill were closed by the later on_fail audit and on_fail skill executor slices below.
  - Native BetterQueue event subscription and full on_fail/tool-switch audit remain open.
```

## 22. implementation_evidence_2026-05-16_sqlite_engine_selector

```yaml
status: sqlite_engine_selector_slice_verified
implemented:
  - Added SQLiteTaskQueueStore backed by the installed better-sqlite3 package and the real userData/queue.sqlite path.
  - Startup opens an existing queue.sqlite read-only, runs PRAGMA integrity_check, and treats any non-ok result or open failure as E_INTEGRITY_FAIL evidence.
  - Corrupt queue.sqlite files are renamed to queue.sqlite.bak.<timestamp>, including -wal and -shm sidecars when present, before a new usable store is created.
  - The SQLite store persists the queue key/value payloads plus inspectable task_runs and task_state_transitions indexes with session/status/task/hash indexes.
  - R8RuntimeService now defaults the task queue boundary to queue.sqlite while preserving legacy Electron Store task/taskStateTransitions migration when SQLite is empty.
  - Added enum semantics for R8.C.task.queue.engine with allowed values better-queue and p-queue, plus a storage status contract that reports active backend, SQLite path, integrity status, native better-queue package availability, and restart-required switching.
  - p-queue selection is persisted truthfully and marked restart-required; the current runtime does not pretend to hot-swap an already constructed queue service.
tests:
  - TaskQueueService.test.ts verifies persisted task runs survive reopening the SQLite store and that normalized task_runs/task_state_transitions rows are written.
  - TaskQueueService.test.ts verifies a corrupt queue.sqlite file is backed up and the rebuilt store can read/write real task state.
  - R8RuntimeService.test.ts verifies default better-queue selector semantics, real userData/queue.sqlite creation, allowed enum values, and persisted p-queue selection with restart-required warning.
verification:
  - pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "SQLite queue|task queue engine|durable task runs"
  - pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
known_boundaries:
  - Native BetterQueueAdapter and better-queue-sqlite remain unclaimed because the better-queue package is not installed in this project.
  - task:state-stream still emits from StoreBackedTaskQueueService transitions rather than native BetterQueue events.
  - Dedicated OnFailHandler branch routing and on_fail/tool-switch audit are covered in the follow-up slice below; execute-skill is covered by the later on_fail skill executor slice.
```

## 23. implementation_evidence_2026-05-16_on_fail_audit

```yaml
status: on_fail_audit_slice_verified
implemented:
  - Added OnFailHandler as the dedicated spec-15 branch router for next, abort, retry, fallback-tool, escalate-model, human, and execute-skill inputs.
  - Runtime CSV rows now support optional on_fail, fallback_tool, execute_skill, and needs_bigger_model fields through shared Zod contracts.
  - CsvTaskDriver maps on_fail/fallback_tool/execute_skill from inputArgs JSON so the public 18-column CSV header remains unchanged.
  - on_fail=next moves a failed running task to skipped and lets downstream completed-dependency tasks continue.
  - on_fail=abort fails the current task and cancels pending queued, paused, waiting-dependency, and retrying sibling tasks in the same session.
  - on_fail=retry preserves the existing exponential backoff path and keeps manual retry behavior unchanged.
  - on_fail=fallback-tool switches to the explicit fallback_tool and requeues through retrying with retryBackoffMs=0; missing fallback tools move to awaiting-human instead of fake switching.
  - on_fail=escalate-model marks the row with needs_bigger_model=true and moves the task to awaiting-human for operator selection.
  - on_fail=human moves the task to awaiting-human with a specific error code.
  - on_fail=execute-skill keeps the truthful unsupported/missing-skill boundary when no executor is available; R8RuntimeService wires a real executor in the later on_fail skill executor slice.
  - R8RuntimeService audit mapping now emits task:tool-switch for fallback-tool transitions and task:on-fail for other on_fail branches while preserving task:start, task:end, task:retry-scheduled, and task:retry audit rows.
tests:
  - TaskQueueService.test.ts covers next, abort, retry, fallback-tool, escalate-model, human, and execute-skill boundary decisions.
  - CsvTaskDriver.test.ts proves on_fail controls are parsed from inputArgs without adding CSV columns.
  - R8RuntimeService.test.ts proves fallback-tool transitions write task:tool-switch audit rows with prev/next/reason metadata.
verification:
  - pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "TaskQueue|CsvTaskDriver|on_fail|on-fail|task queue engine|SQLite queue|task:state-stream|schema"
known_boundaries:
  - The OnFailHandler checklist line is closed by the later on_fail skill executor slice, which executes a real local SKILL script before requeueing.
  - Native BetterQueue event subscription remains open for R8RuntimeService task:state-stream until the adapter is promoted into the active queue runtime.
```

## 24. implementation_evidence_2026-05-16_native_better_queue_adapter

```yaml
status: native_better_queue_adapter_slice_verified_partial
implemented:
  - Added the real better-queue@3.8.12 dependency to the DevHub package manifest and lockfile.
  - Attempted better-queue-sqlite@1.0.7 installation and runtime probe; the package requires sqlite3 native bindings that were not available under the current pnpm build policy.
  - Removed better-queue-sqlite rather than retaining a broken dependency or claiming a non-runnable adapter.
  - Added BetterQueueAdapter wrapping the installed better-queue package through createRequire, with a real processor callback, priority callback, pause/resume/destroy, and native event forwarding.
  - Added a BetterSqliteQueueStore for better-queue using the already installed better-sqlite3 package and a real SQLite file.
  - The store implements connect, getTask, putTask, deleteTask, takeFirstN, takeLastN, getLock, getRunningTasks, releaseLock, and close with real persisted rows.
  - R8RuntimeService storage status now distinguishes native better-queue package availability from the currently active StoreBackedTaskQueueService runtime backend.
tests:
  - BetterQueueAdapter.test.ts proves a real better-queue task runs through the better-sqlite3 store and forwards task_accepted, task_started, task_finish, and drain events.
  - BetterQueueAdapter.test.ts proves task_failed is forwarded without converting processor errors to success.
verification:
  - pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts --maxWorkers=1
  - pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "BetterQueueAdapter|TaskQueue|CsvTaskDriver|on_fail|on-fail|task queue engine|SQLite queue|task:state-stream|schema|feature flag"
  - pnpm -C devhub typecheck
known_boundaries:
  - Superseded by the 2026-05-17 closure: the original better-queue-sqlite package is not retained because its sqlite3 native binding is unavailable; the real BetterQueueAdapter uses the same better-queue store API with a runnable better-sqlite3 store.
  - The active R8RuntimeService queue path still uses StoreBackedTaskQueueService over queue.sqlite; promotion to the native BetterQueueAdapter requires a dedicated migration slice.
  - Native BetterQueue event-to-state-stream bridging is covered by the later native state stream bridge slice.
```

## 25. implementation_evidence_2026-05-16_on_fail_skill_executor

```yaml
status: on_fail_skill_executor_slice_verified
implemented:
  - StoreBackedTaskQueueService now distinguishes the default no-executor boundary from an executor-enabled runtime through a narrow onFailSkillExecutorAvailable option.
  - Without an executor, on_fail=execute-skill still returns truthful E_SKILL_EXECUTOR_UNAVAILABLE / E_SKILL_NOT_CONFIGURED rather than pretending to run code.
  - R8RuntimeService constructs the task queue with a real on_fail skill executor and schedules local execution when a failed running task enters ON_FAIL_EXECUTE_SKILL_RUNNING.
  - The executor resolves user and builtin skills through the existing strict Skill library, reuses scriptPath containment validation, and materializes builtin scripts under userData/skill-runtime/builtin before execution.
  - It writes a real failure-context.json artifact containing the actual task row, run metadata, attempt counters, and executor failure code/message.
  - It executes the SKILL script with execFile, no shell interpolation, a bounded 1000ms-60000ms timeout, windowsHide=true, a 1MiB output buffer, and a reduced environment allowlist.
  - Runtime support covers node, python, bash, powershell, and exe skills; python uses the existing local Python probe and reports E_DEPENDENCY_MISSING if unavailable.
  - stdout.txt, stderr.txt, and result.json are written beside failure-context.json under userData/task-queue/on-fail-skills.
  - Successful SKILL execution records ON_FAIL_EXECUTE_SKILL_SUCCEEDED, stores artifactsPath, and moves the original task from awaiting-human back to queued for a real retry without marking the failed executor task as succeeded.
  - Failed or timed-out SKILL execution records E_SKILL_EXECUTION_FAILED / E_SKILL_TIMEOUT / E_SKILL_NOT_FOUND / E_VALIDATION / E_PERMISSION and leaves the task awaiting human intervention.
  - R8RuntimeService writes task:on-fail-skill audit rows with runId, taskId, sessionId, skillName, artifactPath, and final task status.
tests:
  - TaskQueueService.test.ts proves the executor-enabled branch enters ON_FAIL_EXECUTE_SKILL_RUNNING and only recordOnFailSkillResult can move it back to queued.
  - R8RuntimeService.test.ts creates a real user SKILL on disk, runs its node script against the generated failure-context.json file, verifies the .seen side-effect file, stdout.txt, result.json, artifactsPath, queued retry state, and task:on-fail-skill audit row.
verification:
  - pnpm -C devhub typecheck
  - pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "execute-skill|on_fail SKILL|on_fail branch"
  - pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "BetterQueueAdapter|TaskQueue|CsvTaskDriver|on_fail|on-fail|execute-skill|on_fail SKILL|task queue engine|SQLite queue|task:state-stream|schema|feature flag"
  - pnpm -C devhub lint
known_boundaries:
  - Superseded by the 2026-05-17 closure: exact better-queue-sqlite package usage is rejected as non-runnable in this environment and replaced by the verified API-compatible better-sqlite3 store.
  - Native BetterQueue event-to-state-stream bridging is covered by the later native state stream bridge slice.
```

## 26. implementation_evidence_2026-05-16_native_state_stream_bridge

```yaml
status: native_better_queue_state_stream_bridge_verified
implemented:
  - BetterQueueAdapter now keeps queue-id to task metadata for native better-queue tasks, including taskId and sessionId extracted from the real task payload.
  - Added subscribeTaskStateTransitions(listener, now) as the task:state-stream bridge for native better-queue events.
  - The bridge subscribes to task_accepted, task_queued, task_started, task_retry, task_finish, and task_failed events from the real better-queue adapter.
  - It converts native events into TaskStateTransition-compatible records with transitionId, runId, taskId, sessionId, prev, next, at, and reason.
  - State mapping is deterministic: accepted/queued -> queued, started -> running, retry -> retrying, finish -> succeeded, failed -> failed.
  - Duplicate same-state native events are suppressed, so task_accepted and task_queued do not create conflicting queued->queued transitions.
  - Terminal native events clean the adapter metadata maps to avoid unbounded growth.
  - The active runtime still uses StoreBackedTaskQueueService over queue.sqlite; this bridge provides the native event subscription contract needed for later promotion without replacing the scheduler in this slice.
tests:
  - BetterQueueAdapter.test.ts runs a real better-queue task through the better-sqlite3 store and verifies pending -> queued -> running -> succeeded TaskStateTransition output from native events.
  - Existing BetterQueueAdapter tests still verify native event forwarding and failed-task event behavior.
verification:
  - pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
known_boundaries:
  - Superseded by the 2026-05-17 closure: exact better-queue-sqlite package usage is rejected as non-runnable in this environment and replaced by the verified API-compatible better-sqlite3 store.
  - Active R8RuntimeService promotion from StoreBackedTaskQueueService to BetterQueueAdapter remains a separate migration boundary.
```

## 27. implementation_evidence_2026-05-16_skill_sandbox_mcp

```yaml
status: skill_sandbox_mcp_slice_verified
implemented:
  - Skill metadata now includes license, sandbox, and mcpServers through the shared Zod source of truth.
  - on_fail=execute-skill Node execution now uses a generated preload guard.
  - read-only sandbox blocks fs write APIs, child_process APIs, and network modules unless the sandbox/permission model explicitly allows them.
  - read-write sandbox permits filesystem writes but keeps child_process and network blocked.
  - system sandbox permits explicit local child process execution and receives DEVHUB_SKILL_MCP_SERVERS_JSON.
  - Non-Node runtime execution requires system sandbox because the Node preload guard cannot enforce Python/Bash/PowerShell/exe behavior.
  - mcpServers metadata declares local stdio MCP servers; system SKILL scripts can read the metadata and call those servers.
tests:
  - R8RuntimeService.test.ts proves read-only SKILL write attempts fail with E_PERMISSION and leave the task awaiting-human.
  - R8RuntimeService.test.ts proves read-write SKILL scripts can write real artifacts and requeue the failed task for retry.
  - R8RuntimeService.test.ts proves system SKILL scripts can run an explicit local child process.
  - R8RuntimeService.test.ts starts a real local stdio JSON-RPC MCP server and an executed SKILL calls initialize, tools/list, and tools/call.
verification:
  - npx --no-install gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --maxWorkers=1 -t "SKILL|skill|sandbox|MCP|mcp|builtin|metadata"
  - pnpm -C devhub typecheck
  - pnpm -C devhub check:zod-sot
known_boundaries:
  - Final product acceptance remains unchecked until user-authored local SKILL files and the user MCP configuration are reviewed in the running application.
```

## 28. implementation_evidence_2026-05-17_better_queue_sqlite_contract_closure

```yaml
status: verified_better_queue_sqlite_contract_closure
implemented:
  - R8RuntimeService.getTaskQueueStorageStatus now reports nativeBetterQueueAvailable, nativeBetterQueueSqliteAvailable, and nativeSqlite3Available separately.
  - The storage warning no longer hides the exact package boundary: it states when better-queue is installed but better-queue-sqlite is not available, and identifies the active queue.sqlite runtime boundary.
  - R8RuntimeService.test.ts asserts the current real dependency state: better-queue is installed, better-queue-sqlite is unavailable, sqlite3 is unavailable, and queue.sqlite is still created through the durable SQLite-backed runtime path.
  - The existing BetterQueueAdapter remains the real native better-queue integration point and uses a better-sqlite3-backed custom store that implements the better-queue store API methods over a real SQLite file.
  - The exact better-queue-sqlite package is not installed because current npm metadata shows better-queue-sqlite@1.0.7 depends on sqlite3@^5.1.2, and the prior runtime probe proved that native binding is not runnable under the current pnpm build policy.
decision:
  - Treating better-queue-sqlite as mandatory would require retaining a broken native sqlite3 dependency, which violates the no-fake/no-broken-dependency rule.
  - The spec intent is closed by the installed better-queue adapter plus a runnable SQLite store that satisfies better-queue's documented custom store interface.
verification:
  npm_metadata: npm view better-queue-sqlite@1.0.7 version dependencies peerDependencies dist.tarball --json
  local_dependency_truth: pnpm -C devhub why better-queue sqlite3 better-sqlite3 --depth 2
  local_api_check: devhub/node_modules/better-queue/README.md documents connect, getTask, putTask, takeFirstN, and takeLastN custom store methods.
  focused_queue_suite: pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "BetterQueueAdapter|TaskQueue|CsvTaskDriver|on_fail|on-fail|execute-skill|on_fail SKILL|task queue engine|SQLite queue|task:state-stream|schema|feature flag"
  lint_touched_files: pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/services/task-queue/BetterQueueAdapter.ts src/main/services/task-queue/BetterQueueAdapter.test.ts
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
  result:
  npm_metadata: better-queue-sqlite@1.0.7 depends on sqlite3@^5.1.2.
  local_dependency_truth: better-queue@3.8.12 and better-sqlite3@11.10.0 are installed; sqlite3 is not installed.
  focused_queue_suite: 6 files passed, 49 tests passed, 125 skipped.
  lint_touched_files: passed.
  typecheck: passed.
remaining_boundary:
  - Active R8RuntimeService promotion from StoreBackedTaskQueueService to BetterQueueAdapter remains a separate migration boundary because it changes scheduler semantics rather than the original adapter/store checklist contract.
```
