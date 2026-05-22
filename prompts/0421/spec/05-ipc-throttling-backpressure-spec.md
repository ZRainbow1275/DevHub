# Spec 05 — IPC Throttling & Backpressure & PowerShell Gateway

> Status: [TEST-PASS for X6 automated gate] scanner diff batching + bounded diff queue + ack/resync/suspend 主链已落地；P2.1 60-minute longrun bench passed on 2026-04-29；用户手测仍待补
> Owner: DevHub v2 Platform Team
> Siblings: spec/03 (Runtime Architecture), spec/04 (Scanner Lifecycle)
> Depends on contracts: C22 (IPC Envelope), C23 (Broadcast Batching)
> Ralph Round: R5 findings + R6 monitoring regression

---

## 1. 动机 (Motivation)

DevHub v2 的 IPC 层是主进程与渲染进程之间的唯一桥梁。随着扫描器数量从 2 增长到 6（processes / ports / windows / aiTasks / npm / branch），以及每个扫描器均以 sub-second 频率派发 PowerShell 查询，IPC 层与 PowerShell 进程池成为两大系统性瓶颈。

### 1.1 R5 证据链 (2026-04-15 归档)

- **N2 IPC Rate-Limit Loop**：`devhub.log` 在 30 分钟内出现 **971 条** `process:get-history` 被 RateLimiter 拦截记录，平均每 1.85 秒一次。根因是 ProcessDetail 面板的 React useEffect 依赖数组抖动 + renderer 侧缺乏客户端 debounce。
- **N4 Broadcast Storm**：`ScannerCache.updateProcesses` 每次 tick（2 秒）都会 diff 并广播 `processes:updated`。列表长度 200+ 时单次广播 payload 约 45 KB，16 个 renderer window 同时订阅时累计带宽 720 KB/s。
- **N7 PowerShell Zombies**：R5 Kill-Switch 测试发现 main 进程结束后 pwsh.exe 进程仍遗留 11 个，原因是没有集中式 gateway 持有子进程 handle。

### 1.2 R6 回归证据 (2026-04-20)

- monitoring 模块 CPU 飙升至 45%，pprof 采样显示 70% 时间花在 `ipcMain.emit` + `webContents.send` 序列化。
- RAM 从稳态 280 MB 涨到 1.1 GB，heap snapshot 指向 `DiffQueue` 内部缓冲的 `ProcessSnapshot[]` 未被释放。
- 复现 N2 rate-limit loop，数字从 971 降到 612 但并未消除，说明 R5 的"前端 debounce"补丁只治标。

### 1.3 债务索引

- **D02** — PowerShellGateway 缺失，每个 Scanner 自建 `spawn('pwsh')`。
- **D04** — ScannerCache 无批处理、无 seq 号、无背压。
- **D11** — `rateLimiter.ts` 仅作用于 ipcMain.handle，对 `webContents.send` 无效。
- **D17** — 渲染端无统一节流，各组件 useEffect 频繁发起 IPC。

本 spec 合并 D02 / D04 / D11 / D17 的修复方案，并与 spec/03（Runtime）共享 `DisposableRegistry` 与 lifecycle 钩子。

### 1.4 当前实现快照 (2026-04-22)

以下内容已经进入 `devhub/` 真实代码，并通过 `typecheck + lint + vitest` 验证：

- 新增 `src/main/ipc/BroadcastBatcher.ts`，提供带时间窗口、批大小上限、buffer bytes 上限与 truncation 标记的批处理基础设施。
- `src/main/services/BackgroundScannerManager.ts` 已将 `processes / ports / windows / aiTasks` 四类 diff 广播从“事件即发”改为 `BroadcastBatcher` 批处理发送。
- batched 广播现已带 `IPCEnvelope<T>` 元数据：`channel`、`seq`、`timestamp`、`batch`、`partial` 与可选 `meta.truncated`。
- `src/preload/extended.ts` 已对 batched envelope 做向后兼容归一化，renderer 侧现有 `scannerStore` 仍然按单个 `ScannerDiff` 消费，不需要同时大改 store 协议。
- `src/main/utils/rateLimiter.ts` 已从基础滑窗计数扩展为带每 channel `allowed / rejected / dropped / coalesced / remaining / resetAt` 快照的 report 能力。
- `src/main/ipc/devObservabilityHandlers.ts`、`src/preload/index.ts`、`src/renderer/hooks/useRuntimeMetrics.ts`、`src/renderer/components/dev/DevObservabilityPanel.tsx` 已打通 `dev:get-throttle-report`，开发态可直接在面板 IPC 标签查看 inbound throttle 快照。
- `src/main/ipc/scannerHandlers.ts`、`src/preload/extended.ts`、`src/renderer/App.tsx`、`src/renderer/stores/scannerStore.ts` 已打通最小 `ipc:request-resync` 闭环：main 在 `scanner:snapshot:push` 中附带当前 diff channel `channelSeqs` 基线，preload 检测 seq gap 后会请求 resync，renderer 通过 snapshot push 重建本地 store。
- `src/shared/types-extended.ts`、`src/main/ipc/scannerHandlers.ts` 与 `src/preload/extended.ts` 已补齐 `ScannerAckRequest` / `ScannerAckResponse`、`ipc:ack-seq` 与 snapshot baseline ACK：preload 在正常消费 diff envelope 后会回执最新 seq，在 resync snapshot 携带 `channelSeqs` 时也会补发 snapshot ACK，避免 main 长期停留在未 ACK 状态。
- `src/main/services/BackgroundScannerManager.ts` 已建立每 channel ACK 状态跟踪（`lastSentSeq` / `lastAckedSeq` / `pendingSeq` / `pendingSince` / `timeoutCount` / `lastTimeoutAt`），并在 `RENDERER_ACK_TIMEOUT_MS = 10_000` 基础上补齐 bounded `pendingEnvelopes` 队列、`DIFF_QUEUE_CAPACITY = 256`、`drop-oldest`、连续 3 次 timeout 自动 `suspended` 与 `prepareChannelsForSnapshot()` 恢复路径。
- `src/main/ipc/scannerHandlers.ts` 现在会在 `scanner:subscribe` 与 `ipc:request-resync` 推送 snapshot 前调用 `prepareChannelsForSnapshot(channelSeqs)`，把 suspended channel 切回 snapshot-resync 恢复路径，避免旧队列永久滞留。
- `src/shared/observability.ts`、`src/main/services/observability/MetricsCollector.ts` 与 `src/renderer/components/dev/DevObservabilityPanel.tsx` 已新增 `scannerBackpressure` / `Renderer ACK Backpressure` 观测面板，开发态可以直接查看 ack lag、pending seq、queued/dropped envelope、timeout 次数以及 suspended 状态。
- 已新增并通过：
  - `src/main/ipc/BroadcastBatcher.test.ts`
  - `src/main/services/BackgroundScannerManager.test.ts`
  - `src/main/utils/rateLimiter.test.ts`
  - `src/main/ipc/scannerHandlers.test.ts`

当前 0421 自动化验收已闭环，以下为用户手测边界与后续增强目标：

- 当前 ACK/backpressure 不再是“最小实现”：`ipc:ack-seq`、snapshot baseline ACK、bounded diff queue、`drop-oldest`、连续 timeout 进入 `suspended`、snapshot/resync 恢复链路与 backpressure observability 已进入代码并通过自动化验证；
- `DiffQueue` 的主状态机已进入代码，且 P2.1 60-minute longrun bench 已通过；用户手测仍未由用户确认，因此不能写成 `[USER-VERIFIED]`。
- inbound `rateLimiter` 虽然已经具备 `getRateLimitReport()` 快照能力；bucket / coalesce / drop-oldest / structured retryAfterMs 全套能力属于后续增强目标，不阻塞当前 P2.1 / X6 `[TEST-PASS]`。

因此，本 spec 当前最准确的进度是：

- scanner outbound broadcast batching 已真实落地；
- payload 已升级为可演进的 envelope，而不是裸 diff；
- renderer ACK + backpressure 主链已落地：preload 会对 diff 与 snapshot baseline 回执 `ipc:ack-seq`，main 会跟踪 per-channel pending/timeout/suspended 状态，并在未 ACK 时将后续 diff 进入 bounded queue；
- renderer seq gap detection + `ipc:request-resync` + snapshot baseline rebuild 已落地；
- P2.1 60-minute longrun bench 现已通过，当前可确认代码主链、自动化验证与长跑 bench 通过；用户手测仅作为 `[USER-VERIFIED]` 边界另行确认。

---

## 2. 受影响源码 (Affected Source)

### 2.1 PowerShell 调用点（全部纳入 Gateway）

| 文件 | 行号范围 | 当前实现 | 问题 |
| --- | --- | --- | --- |
| `devhub/src/main/services/ProcessScanner.ts` | 48-96 | `spawn('pwsh', ['-NoProfile', '-Command', ps])` | 无并发控制、无超时 |
| `devhub/src/main/services/PortScanner.ts` | 62-104 | 同上 | 同上 + 无输出 truncate |
| `devhub/src/main/services/WindowScanner.ts` | 71-130 | 同上 | 每 1s 一次，最密集 |
| `devhub/src/main/services/AITaskScanner.ts` | 55-112 | 基于 `node-pty` 伪 PTY | 游离进程最严重 |
| `devhub/src/main/services/NpmScanner.ts` | 40-78 | `execa('pwsh', ...)` | execa 未设 timeout |
| `devhub/src/main/services/BranchScanner.ts` | 35-68 | 同上 | — |
| `devhub/src/main/commands/systemCheck.ts` | 120-180 | 直接 `spawnSync` 阻塞 | main 进程阻塞 300ms |

### 2.2 ScannerCache 广播源

| 方法 | 行号 | 事件 | 触发频率 |
| --- | --- | --- | --- |
| `updateProcesses(list)` | 165-178 | `processes:updated` | 2s |
| `updatePorts(list)` | 180-193 | `ports:updated` | 3s |
| `updateWindows(list)` | 195-208 | `windows:updated` | 1s |
| `updateAITasks(list)` | 210-223 | `ai-tasks:updated` | 5s |

目前实现：计算 diff → `mainWindow.webContents.send(event, diff)`；无批处理、无丢弃策略、无 seq。

### 2.3 ipcMain.handle 入口

25 个 `ipcMain.handle` 调用散落在 `ipc/*Handlers.ts`，详见 §4 表格。

---

## 3. 数据契约 (Data Contracts)

### 3.1 PowerShellGateway

```typescript
export interface PowerShellGateway {
  execute(cmd: PSCommand, opts?: PSExecOptions): Promise<PSResult>
  executeStreaming(cmd: PSCommand, opts?: PSExecOptions): AsyncIterable<PSChunk>
  isAvailable(): boolean
  getPoolStats(): PSPoolStats
  shutdown(gracefulMs?: number): Promise<void>
}

export interface PSCommand {
  readonly id: string              // caller-side correlation id
  readonly script: string          // -NoProfile already injected
  readonly encoding: 'utf8' | 'utf16le'
  readonly timeoutMs: number       // default 15_000, max 60_000
  readonly priority: 'low' | 'normal' | 'high'
  readonly maxStdoutBytes: number  // default 1 MiB; overflow → PS_OUTPUT_TRUNCATED
  readonly tags: string[]          // e.g. ['scanner:process']
}

export interface PSExecOptions {
  readonly signal?: AbortSignal
  readonly onStderr?: (chunk: string) => void
}

export interface PSResult {
  readonly commandId: string
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly durationMs: number
  readonly truncated: boolean
  readonly queuedMs: number        // time spent in semaphore queue
}

export interface PSPoolStats {
  readonly active: number          // currently executing
  readonly queued: number          // waiting in semaphore
  readonly totalSpawned: number
  readonly totalCompleted: number
  readonly totalFailed: number
  readonly totalKilled: number     // killed by timeout or shutdown
  readonly totalTimedOut: number
  readonly avgDurationMs: number   // rolling 1-min
  readonly p95DurationMs: number
  readonly maxConcurrent: number   // semaphore ceiling, default 4
  readonly uptimeMs: number
}
```

### 3.2 IPCThrottleConfig

```typescript
export interface IPCThrottleConfig {
  readonly channel: string
  readonly direction: 'inbound' | 'outbound' | 'bidi'
  readonly bucket: 'tight' | 'standard' | 'loose' | 'burst'
  readonly maxPerMinute: number
  readonly maxBurst: number
  readonly windowMs: number        // sliding window size
  readonly dropPolicy: 'reject' | 'coalesce' | 'drop-oldest'
  readonly telemetry: boolean
}

export const BUCKETS: Record<string, Omit<IPCThrottleConfig, 'channel' | 'direction'>> = {
  tight:    { bucket: 'tight',    maxPerMinute:   10, maxBurst: 2,  windowMs: 60_000, dropPolicy: 'reject',      telemetry: true },
  standard: { bucket: 'standard', maxPerMinute:   60, maxBurst: 10, windowMs: 60_000, dropPolicy: 'coalesce',    telemetry: true },
  loose:    { bucket: 'loose',    maxPerMinute:  300, maxBurst: 30, windowMs: 60_000, dropPolicy: 'drop-oldest', telemetry: false },
  burst:    { bucket: 'burst',    maxPerMinute: 1000, maxBurst: 100,windowMs: 60_000, dropPolicy: 'drop-oldest', telemetry: false },
}
```

### 3.3 BroadcastBatcher<T>

```typescript
export interface BroadcastBatcher<T> {
  readonly channel: string
  readonly windowMs: number         // default 200ms
  readonly maxBatchSize: number     // default 50 items
  readonly maxBufferBytes: number   // default 256 KiB

  enqueue(item: T): void
  flush(): void                     // force immediate send
  close(): Promise<void>

  onFlush(handler: (batch: T[], seq: number) => void): Disposable
  getStats(): BatcherStats
}

export interface BatcherStats {
  readonly enqueued: number
  readonly flushed: number
  readonly dropped: number
  readonly currentBufferBytes: number
  readonly currentBufferItems: number
  readonly lastFlushAt: number | null
  readonly avgBatchSize: number
}
```

### 3.4 DiffQueue<T>

```typescript
export interface DiffQueue<T> {
  readonly capacity: number         // bounded, default 256
  readonly seqCursor: number        // monotonic seq emitted

  push(diff: T): { accepted: boolean; seq: number; dropped?: T }
  drain(maxItems?: number): Array<{ seq: number; diff: T }>
  size(): number
  oldestSeq(): number | null
}
```

### 3.5 Envelope (contracts/22)

```typescript
export interface IPCEnvelope<TPayload> {
  readonly channel: string
  readonly seq: number               // monotonic per channel
  readonly timestamp: number         // Date.now() at send
  readonly batch: boolean            // true if payload is T[]
  readonly partial: boolean          // true if payload contains diff only
  readonly payload: TPayload
  readonly meta?: {
    readonly causedBy?: string       // upstream command id
    readonly truncated?: boolean
  }
}
```

---

## 4. IPC 契约 (IPC Contracts)

### 4.1 新增 Channel

| Channel | 方向 | Bucket | 说明 | 可用环境 |
| --- | --- | --- | --- | --- |
| `ps:get-pool-stats` | inbound | tight | 返回 `PSPoolStats` 快照 | dev only |
| `ipc:get-throttle-report` | inbound | tight | 返回每个 channel 累计 `allowed / rejected / dropped / coalesced` 与当前窗口剩余额度 | dev only |
| `ipc:request-resync` | inbound | tight | renderer / preload 检测到 seq gap 后请求 main 推送完整 snapshot 与 channel seq 基线 | all |
| `ipc:subscribe-batched` | inbound | standard | renderer 声明对 batched channel 的订阅意向 | all |
| `ipc:ack-seq` | inbound | burst | renderer 回传已消费的 seq，驱动背压 | all |

### 4.2 现有 25 Channel 限额重排

| # | Channel | Current Limit | Proposed Limit | Justification |
| --- | --- | --- | --- | --- |
| 1 | `process:list` | 无 | standard (60/min) | 首屏加载 + 手动刷新 |
| 2 | `process:get-history` | 30/min (per caller) | **tight (10/min)** | R5 N2: 971 次循环；detail 面板仅需偶尔刷新 |
| 3 | `process:kill` | 10/min | tight (10/min) | 高危操作保持严限 |
| 4 | `process:set-priority` | 20/min | standard | 用户手动点击 |
| 5 | `process:open-location` | 无 | tight | OS 打开文件管理器，避免爆炸 |
| 6 | `ports:list` | 无 | standard | UI 刷新 |
| 7 | `ports:kill-owner` | 5/min | tight | 高危 |
| 8 | `windows:list` | 无 | standard | — |
| 9 | `windows:focus` | 无 | loose | 高频用户动作 |
| 10 | `windows:minimize-all` | 无 | tight | 全局副作用 |
| 11 | `ai-tasks:list` | 无 | standard | — |
| 12 | `ai-tasks:kill` | 5/min | tight | — |
| 13 | `npm:scan` | 无 | tight | 磁盘扫描昂贵 |
| 14 | `npm:run-script` | 5/min | tight | 派生子进程 |
| 15 | `branch:list` | 无 | standard | — |
| 16 | `branch:checkout` | 5/min | tight | 副作用大 |
| 17 | `config:get` | 无 | burst | 读取本地 JSON |
| 18 | `config:set` | 20/min | standard | 写入持久化 |
| 19 | `log:query` | 30/min | standard | DevTools 面板 |
| 20 | `log:tail` | 无 | loose | 流式订阅 |
| 21 | `theme:set` | 10/min | standard | 用户切主题 |
| 22 | `window:open-dev-tools` | 无 | tight | — |
| 23 | `system:check` | 10/min | tight | 触发多个 scanner |
| 24 | `telemetry:report` | 无 | burst | 埋点事件 |
| 25 | `diagnostic:dump` | 2/min | tight | 导出大 JSON |

### 4.3 Outbound Broadcast 改造

| Event | Current | New | Batcher Window | Max Batch |
| --- | --- | --- | --- | --- |
| `processes:updated` | 每 tick send | BroadcastBatcher | 200ms | 50 diff |
| `ports:updated` | 同上 | BroadcastBatcher | 300ms | 50 diff |
| `windows:updated` | 同上 | BroadcastBatcher | 150ms | 80 diff |
| `ai-tasks:updated` | 同上 | BroadcastBatcher | 500ms | 30 diff |
| `log:appended` | 无限制 | DiffQueue + Batcher | 100ms | 200 line |

---

## 5. 错误矩阵 (Error Matrix)

| Code | HTTP-equiv | Severity | Channel | Meaning | Recovery |
| --- | --- | --- | --- | --- | --- |
| `PS_POOL_FULL` | 503 | warn | ps:* | semaphore queue ≥ 32 等待项 | 丢弃最低优先级 + 上报 telemetry |
| `PS_CMD_TIMEOUT` | 504 | error | ps:* | 命令超过 `timeoutMs` 未返回 | Kill 子进程 + 抛 `PSTimeoutError` |
| `PS_CMD_KILLED` | — | info | ps:* | gateway shutdown 主动终止 | 返回 `{ exitCode: -1, killed: true }` |
| `PS_OUTPUT_TRUNCATED` | — | warn | ps:* | stdout 超过 `maxStdoutBytes` | 返回已收集部分 + `truncated: true` |
| `PS_SPAWN_FAILED` | 500 | error | ps:* | 无法 spawn pwsh（缺失/权限） | 标记 gateway unavailable，fallback cmd.exe |
| `IPC_RATE_LIMIT_EXCEEDED` | 429 | info | any inbound | caller 超过 bucket 限额 | 返回结构化 error，含 retryAfterMs |
| `IPC_DIFF_DROPPED_BACKPRESSURE` | — | warn | outbound | DiffQueue 溢出旧条目被丢 | 自增 metrics；renderer 重新拉全量 |
| `DIFF_SEQ_GAP` | — | error | outbound | renderer 检测 seq 不连续 | 触发 `ipc:request-resync` |
| `BATCHER_OVERFLOW` | — | warn | outbound | 单批 payload 超 `maxBufferBytes` | 强制 flush + 丢弃后续 |
| `BATCHER_CLOSED` | — | error | outbound | 向已 close 的 batcher enqueue | 抛异常，调用方 bug |
| `IPC_CHANNEL_UNKNOWN` | 404 | error | any | 未注册的 channel | 返回 error；dev 环境 throw |
| `IPC_ENVELOPE_MALFORMED` | 400 | error | any | envelope 缺字段或 seq 为负 | 拒绝；上报 telemetry |
| `RENDERER_ACK_TIMEOUT` | — | warn | outbound | renderer 超过 10s 未 ack | 暂停该 window 广播，触发健康检查 |

所有错误通过 `IPCErrorEnvelope`（见 contracts/22）返回：

```typescript
interface IPCErrorEnvelope {
  readonly ok: false
  readonly code: string        // 上表之一
  readonly message: string
  readonly channel: string
  readonly seq: number
  readonly retryAfterMs?: number
  readonly detail?: Record<string, unknown>
}
```

---

## 6. 验收条件 (Acceptance — GWT)

对齐 Match Matrix：**X6 (PowerShell Semaphore)**, **P2.1 (IPC ≤ 10/min per tight channel)**。

### GWT-1 PS 并发上限

```gherkin
Given PowerShellGateway 初始化 maxConcurrent=4
When 8 个 scanner 同时调用 execute()
Then 前 4 个立即进入 active 状态
And 后 4 个进入 queued 状态
And getPoolStats().active === 4 且 queued === 4
And 所有任务最终成功返回，无 spawn 超过 4 个 pwsh.exe
```

### GWT-2 PS 超时 Kill

```gherkin
Given 一个 timeoutMs=2000 的命令
When 命令执行 3 秒未返回
Then Gateway 调用 child.kill('SIGTERM')
And 1 秒后仍存活则 SIGKILL
And 抛出 PSTimeoutError
And getPoolStats().totalTimedOut 自增
```

### GWT-3 IPC Rate Limit 恢复

```gherkin
Given channel "process:get-history" 绑定 tight bucket
And caller 已在 60s 窗口内触发 10 次
When caller 第 11 次调用
Then 返回 { ok: false, code: 'IPC_RATE_LIMIT_EXCEEDED', retryAfterMs: N }
And 60s 后再次调用应成功
And dev 面板 ipc:get-throttle-report 能查询到累计 drop 1
```

### GWT-4 Broadcast Batcher 合并

```gherkin
Given BroadcastBatcher("processes:updated", windowMs=200)
When 在 150ms 内 enqueue 3 次 diff（分别包含 2/3/5 条变更）
Then 只产生 1 次 webContents.send
And envelope.batch === true
And payload 长度 === 10
And envelope.seq 为递增单值
```

### GWT-5 DiffQueue 背压

```gherkin
Given DiffQueue capacity=256
And renderer 连续 10s 未 ack
When main 继续 push 第 257 条 diff
Then 最旧一条被丢弃
And 返回 { accepted: true, seq: 257, dropped: <old> }
And 触发 metric ipc.diff.dropped +1
And 下一次 envelope.meta.truncated === true
```

### GWT-6 Renderer Resync

```gherkin
Given renderer 检测到 seq 从 42 直接跳到 45（期望 43）
When renderer 发送 ipc:request-resync(channel)
Then main 发送完整 snapshot 与当前 channelSeqs 基线
And preload 更新该 channel 的 seq baseline
And renderer 通过 snapshot push 重建 store 后恢复正常增量消费
```

---

## 7. E2E 草案 (E2E Draft)

### 7.1 Playwright Burst Test

`devhub/tests/e2e/ipc-throttling.spec.ts`：

```typescript
import { test, expect, _electron as electron } from '@playwright/test'

test('tight bucket rejects after 10/min', async () => {
  const app = await electron.launch({ args: ['.'] })
  const win = await app.firstWindow()

  const results: Array<{ ok: boolean; code?: string }> = []
  for (let i = 0; i < 15; i++) {
    const r = await win.evaluate(() =>
      window.electronAPI.invoke('process:get-history', { pid: 1234 })
    )
    results.push(r)
  }

  const rejected = results.filter(r => !r.ok && r.code === 'IPC_RATE_LIMIT_EXCEEDED')
  expect(rejected.length).toBeGreaterThanOrEqual(5)
  expect(results.slice(0, 10).every(r => r.ok || r.code !== 'IPC_RATE_LIMIT_EXCEEDED')).toBe(true)

  const report = await win.evaluate(() =>
    window.electronAPI.invoke('ipc:get-throttle-report')
  )
  expect(report.channels['process:get-history'].dropped).toBeGreaterThanOrEqual(5)

  await app.close()
})

test('PS pool never exceeds 4 concurrent', async () => {
  const app = await electron.launch({ args: ['.'] })
  const win = await app.firstWindow()

  await win.evaluate(() => {
    for (let i = 0; i < 20; i++) window.electronAPI.invoke('debug:ps-echo', { sleepMs: 2000 })
  })
  await new Promise(r => setTimeout(r, 500))

  const stats = await win.evaluate(() => window.electronAPI.invoke('ps:get-pool-stats'))
  expect(stats.active).toBeLessThanOrEqual(4)
  expect(stats.queued).toBeGreaterThan(0)

  await app.close()
})
```

### 7.2 Vitest for BroadcastBatcher

`devhub/src/main/ipc/__tests__/BroadcastBatcher.test.ts`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createBroadcastBatcher } from '../BroadcastBatcher'

describe('BroadcastBatcher', () => {
  it('coalesces enqueue within window', async () => {
    vi.useFakeTimers()
    const onFlush = vi.fn()
    const b = createBroadcastBatcher<number>({
      channel: 'test', windowMs: 100, maxBatchSize: 50, maxBufferBytes: 1024
    })
    const dispose = b.onFlush(onFlush)

    b.enqueue(1); b.enqueue(2); b.enqueue(3)
    expect(onFlush).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    await Promise.resolve()
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([1, 2, 3], 1)

    dispose.dispose()
    vi.useRealTimers()
  })

  it('flushes early on maxBatchSize', async () => {
    const onFlush = vi.fn()
    const b = createBroadcastBatcher<number>({
      channel: 'test', windowMs: 1_000, maxBatchSize: 3, maxBufferBytes: 1024
    })
    b.onFlush(onFlush)
    b.enqueue(1); b.enqueue(2); b.enqueue(3)
    await Promise.resolve()
    expect(onFlush).toHaveBeenCalledWith([1, 2, 3], 1)
  })

  it('drops on maxBufferBytes overflow', () => {
    const onFlush = vi.fn()
    const b = createBroadcastBatcher<string>({
      channel: 'test', windowMs: 1_000, maxBatchSize: 1000, maxBufferBytes: 64
    })
    b.onFlush(onFlush)
    for (let i = 0; i < 20; i++) b.enqueue('x'.repeat(16))
    expect(b.getStats().dropped).toBeGreaterThan(0)
  })
})
```

---

## 8. 参考实现 / 库 (Reference Implementations)

### 8.1 并发控制库

- **`p-queue`** — promise concurrency with priorities; 适合 PowerShellGateway 的 semaphore 实现，支持 `concurrency`、`timeout`、`throwOnTimeout`、`priority`。
- **`bottleneck`** — 更重但提供 reservoir / cluster mode；若后续需要跨 Electron 多窗口限流可升级。
- 决策：v1 采用 `p-queue@^8`（轻量、零依赖），v2 若出现跨进程需求再评估 `bottleneck`。

### 8.2 节流/debounce

- **`throttle-debounce`** — 纯函数、无 rxjs 体积，适合 renderer 侧 hook 包装。
- 避免 `rxjs` 作为 IPC 核心依赖（bundle 体积 ~200KB gzip）。
- 自研 `SlidingWindowLimiter`（基于已有 `rateLimiter.ts`）扩展支持 `coalesce` 和 `drop-oldest`。

### 8.3 Electron 官方指引

- 参考 [Electron IPC Performance Tips](https://www.electronjs.org/docs/latest/tutorial/performance)，重点：
  - 避免 `webContents.send` 传大对象（序列化开销 O(n)），改为传 diff + 客户端合并。
  - 使用 `MessageChannelMain` 处理高频私有信道（如 log stream），绕过 ipc router 开销。
  - `webContents.isDestroyed()` 检查必须前置，避免 write-after-destroy crash。

### 8.4 Chromium IPC 参考模式

- Chromium 的 Mojo IPC 采用 `AssociatedInterfaceRequest` + `QueueingChannel` 实现顺序保证 + 背压；我们的 `seq + DiffQueue + RENDERER_ACK_TIMEOUT` 设计借鉴该模型。
- "BeginNavigation" throttling: Chromium 对短时间内高频导航使用 token bucket，与本 spec 的 `maxBurst + maxPerMinute` 同构。

### 8.5 Prior Art in Repo

- `devhub/src/main/utils/rateLimiter.ts` 已实现基础 `SlidingWindowLimiter`，需扩展：
  1. 支持 `dropPolicy: coalesce`（合并相同参数请求）
  2. 已输出 `getRateLimitReport()` 快照；bucket / retryAfterMs / structured error 全量契约保留为后续增强目标
  3. 与 `DisposableRegistry`（spec/03）联动，window destroy 时清 caller 计数
- `devhub/src/main/services/ScannerCache.ts:165-223` 的 `updateXxx` 方法将被重构为 `emit(channel, diff) → batcher.enqueue(diff)`，逻辑保持，仅替换出口。

---

## Tail — Contract Contributions

本 spec 衍生两个 contract 条目：

### contracts/22 — IPC Envelope v2

- 强制所有 outbound 广播走 `IPCEnvelope<T>` 封装
- 必含字段：`seq`、`timestamp`、`batch`、`partial`、`payload`
- 可选 `meta.truncated`、`meta.causedBy` 用于诊断
- Renderer 侧约定：preload 检测 seq 断裂 → `ipc:request-resync` → `scanner:snapshot:push` 重建 baseline；检测 `meta.truncated` → 展示“数据可能不完整”toast

### contracts/23 — Broadcast Batching Protocol

- 每个 batched channel 必须声明 `BroadcastBatcherConfig`（windowMs、maxBatchSize、maxBufferBytes）
- Renderer 必须在 10s 内通过 `ipc:ack-seq` 回执最新消费的 seq（已落地）
- 连续 3 次 ack 超时 -> main 暂停对该 channel 的 diff 广播，进入 `suspended` 状态；当前通过 `prepareChannelsForSnapshot()` + snapshot/resync 链路恢复（代码已落地，P2.1 longrun bench 已通过，用户手测仍待补）
- DiffQueue 的 `drop-oldest` 行为必须在 envelope `meta.truncated=true` 中标注，不得静默丢弃（代码已落地；当前由 next deliverable envelope 与 retained envelope 共同携带截断信号）

### 跨 spec 依赖

- spec/03 §4 `DisposableRegistry` → 本 spec PowerShellGateway 注册为 app-level disposable；shutdown 时等待 queue drain。
- spec/04 §3 ScannerLifecycle.emit → 本 spec BroadcastBatcher 作为 emit 的底层 transport。
- spec/06（待定）renderer store 层：消费 seq + 处理 resync。

---

END OF SPEC 05

## 2026-04-29 P2.1 IPC/backpressure longrun evidence

- The final 60-minute P2.1 bench report shows IPC backpressure stayed within budget: `maxIpcRpm=8` against the `<=10` gate.
- Worst channel was `ipc:ack-seq` at `rpm=8`; `process:scan` and `process:get-groups` peaked at `rpm=6`, with no queue/disposal residue reported at shutdown.
- Report: `devhub/perf-reports/bench-p2-longrun-2026-04-29T11-19-59-787Z.json`.
- The implemented ACK timeout is documented as `10s`, aligned with the GWT-5 backpressure scenario and `RENDERER_ACK_TIMEOUT_MS = 10_000`.
