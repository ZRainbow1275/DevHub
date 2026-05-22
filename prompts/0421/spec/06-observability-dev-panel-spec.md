# Spec 06 — DevObservabilityPanel (Runtime Metrics & Developer Observation Bar)

> Sibling of `spec/03-ps-runtime-fix-spec.md`, `spec/04-scanner-supervisor-spec.md`,
> `spec/05-ps-pool-spec.md`. This spec is the **verification surface** for the
> contracts introduced there. Without it, "看似改过" regressions recur unpunished.

Status: [TEST-PASS] 面板与 runtime telemetry 已落地，`E2E-X8-panel`、P2.1 60 分钟 longrun 与相关 runtime bench 已通过；仍不能替代用户手测 `[USER-VERIFIED]`
Owner: DevHub Runtime Group
Related debts: D22, D23, D29, D30
Related rounds: R5 (silent regression), R6 (six-archive failure)

---

## 1. 动机 (Motivation)

### 1.1 User verbatim

用户在 R6 回归总结中明确下达硬要求：

> **强硬要求**：这些指标在主界面增加"开发者观测栏"直接展示，让用户在手测时
> 实时看到是否真的改好了。不要再用"看似改过"的方式做下一轮。

这是合约级别的要求，不是 nice-to-have。R7 任何自称"已修复"的改动，若无法在
DevObservabilityPanel 上呈现出**可复现的视觉证据曲线**（指标下降、计数归零、
泄露停止），都将在验收阶段自动判定为未完成。

### 1.2 为何 R5 会失败

R5 自述修复了六个 archive 所定义的 P0，但 R6 测试结果是六个全部回退。根因是
反馈回路缺失：

- 开发者只能通过 `console.log` + 任务管理器粗略观察。
- 指标（RSS、powershell.exe 计数、IPC 速率）从未聚合到统一视图。
- 无时间序列，无法区分"瞬态峰值"与"单调上升的泄露"。
- 修复成功/失败的判定被推迟到下一轮 QA，循环周期 3~5 天。

### 1.3 债务对齐

| 债务 ID | 主题                     | 本 spec 如何清偿                                              |
|--------:|--------------------------|---------------------------------------------------------------|
| D22     | Missing runtime telemetry | 引入 `MetricsCollector` 和 1 Hz 采样，持久化环形缓冲。        |
| D23     | No regression proof loop  | 在主界面中以 Ctrl+Shift+D 打开面板，所有 P0 指标直出。         |
| D29     | PS 子进程计数不可见       | `PowerShellPoolProbe` + `tasklist.exe` 实时计数。              |
| D30     | IPC 风暴不可观测          | Channel RPM top-10 聚合与导出。                                |

### 1.4 失败模式到观察模式的映射

| R5 失败模式                     | DevObservabilityPanel 对应指标                        |
|--------------------------------|-------------------------------------------------------|
| Main RSS 无界增长               | Metric #1 折线 + 斜率告警                             |
| Renderer RSS 泄露               | Metric #2 折线                                        |
| powershell.exe 残留             | Metric #3 计数条                                      |
| CPU 持续 15%+                   | Metric #4 5 分钟滚动均值                              |
| IPC ack storm / renderer backlog | Metric #5 RPM top-10 表 + ACK backpressure 列表      |
| React 过度重渲染                | Metric #6 commit/min + component 排行                 |

### 1.5 当前落地状态 (2026-04-22)

本 spec 对应的主链路已经进入真实代码，并形成 `main -> IPC -> preload -> renderer` 的可运行闭环：

- `src/main/services/observability/MetricsCollector.ts` 已落地，真实采样 main RSS、renderer RSS、CPU、IPC RPM、PowerShell pool stats、scanner health、cache sizes 与 recent errors。
- `src/main/services/observability/RingBuffer.ts`、`IpcChannelCounter.ts` 已落地并补齐单测；当前全量 `vitest` 已提升到 **29 个测试文件、314 个测试通过**。
- `src/main/index.ts` 已在启动阶段创建并启动 `MetricsCollector`，通过 `setRateLimitObserver(...)` 旁路记录 `withRateLimit` 命中的 channel，并在 `before-quit` 中停止 collector、移除 observer。
- `src/main/ipc/devObservabilityHandlers.ts` 已提供 `dev:get-runtime-metrics`、`dev:get-throttle-report`、`dev:reset-runtime-metrics`、`dev:export-diagnostic-bundle` 四个真实 handler；仅在 dev / `ENABLE_DEV_OBS=1` / `--enable-dev-obs` 条件下启用。
- `src/main/ipc/index.ts`、`scannerHandlers.ts`、`portHandlers.ts` 已对关键非 `withRateLimit` 通道补齐埋点，避免只统计一半 IPC 流量。
- `src/shared/observability.ts` 已补齐 `ScannerBackpressureRow`；`src/main/services/observability/MetricsCollector.ts` 会通过 `BackgroundScannerManager.getChannelAckSnapshot()` 聚合 `ackLag` / `pendingSeq` / `queuedEnvelopes` / `droppedEnvelopes` / `timeoutCount` / `lastTimeoutAt` / `suspendedAt`，并写入 runtime snapshot。
- `src/shared/observability.ts` 已新增 `DisposalReport` 与 `ExtendedPanels.lastDisposalReport`；`MetricsCollector` 会在 `before-quit` 清理完成后把最近一次 disposal report 暴露给 renderer，并将 `disposalPending` 保持为 `lastDisposalReport?.remainingAfter.length ?? 0` 的保守语义。
- `src/preload/index.ts` 已按开关条件暴露 `window.devhub.devObs`；`src/renderer/hooks/useRuntimeMetrics.ts`、`useReactCommitProfiler.ts`、`App.tsx` 与 `components/dev/DevObservabilityPanel.tsx` 已完成 renderer 侧 polling、React Profiler 聚合、导出与重置操作，并在 IPC 标签新增 `Renderer ACK Backpressure` 区块，用于查看 inbound throttle 命中、renderer ACK 堵塞、queue depth、drop-oldest 与 suspended 状态。
- `useReactCommitProfiler.ts` 已新增 `recordCommit()` fallback，`App.tsx` 中的 `CommitTelemetryProbe` 会在 non-profiling build 下记录真实 commit 次数，避免 `React Commits` 面板在 unpackaged / flag 场景长期为空。
- `src/renderer/App.tsx` 已接入 `Ctrl+Shift+D` / `Ctrl+Alt+D` 热键、`Escape` 关闭、`<Profiler>` 包裹与 Toast 成功/失败反馈，面板已成为真实可触达的开发者观察入口。
- `devhub/e2e/example.spec.ts` 已新增 `X8 DevObservabilityPanel 可通过真实热键打开并暴露核心指标`，真实覆盖 `Ctrl+Shift+D` / `Ctrl+Alt+D`、6 个核心指标、IPC throttle、Renderer ACK Backpressure 与诊断包导出链路。

当前状态表述：

- `P2.1` / `X8` 已达到 0421 自动化 `[TEST-PASS]`：P2.1 60 分钟 longrun、`E2E-X8-panel`、runtime telemetry 与 backpressure/diagnostic bundle 证据均已补齐。
- 文档中列出的扩展通道（如独立 `dev:get-ipc-rpm`、`dev:get-react-commits`、`dev:set-sampling-rate`、`dev:metrics-push`）仍属于后续增强目标；当前实现采用 renderer 本地合并 React commit report 的更低风险路径，不阻塞 0421 矩阵闭环。
- 仍不能替代用户手测 `[USER-VERIFIED]`。

---

## 2. 受影响源码 (Affected Source)

### 2.1 新增文件

| Path                                                               | 职责                                 |
|--------------------------------------------------------------------|--------------------------------------|
| `src/renderer/components/dev/DevObservabilityPanel.tsx`            | UI 主体，分 tab，基于 inline SVG sparkline 渲染 |
| `src/renderer/hooks/useRuntimeMetrics.ts`                          | 1s polling main metrics，并与 renderer 本地 React commit report 合并 |
| `src/renderer/hooks/useReactCommitProfiler.ts`                     | React Profiler 包裹，本地聚合 commits |
| `src/main/services/observability/MetricsCollector.ts`              | 1 Hz 聚合 RSS/CPU/IPC/PS 与扩展面板数据 |
| `src/main/services/observability/IpcChannelCounter.ts`             | 拦截 ipcMain.on/handle，累积 RPM    |
| `src/main/services/observability/RingBuffer.ts`                    | 定长环形数组，支持 snapshot          |
| `src/shared/observability.ts`                                      | 共享类型定义                         |

### 2.2 修改文件（精确 file:line，以当前 master 为基线）

| File                                                      | Line range (approx.) | 改动                                               |
|-----------------------------------------------------------|---------------------:|----------------------------------------------------|
| `src/renderer/App.tsx`                                    | approx. 300-430      | 接入 `<Profiler>`、热键、Toast 与面板浮层          |
| `src/main/ipc/index.ts`                                   | approx. 1-220        | 注册 observability handlers，并对关键 channel 埋点 |
| `src/main/index.ts`                                       | approx. 1-320        | `app.whenReady` 之后启动 `MetricsCollector`，退出时清理 |
| `src/preload/index.ts`                                    | approx. 1-220        | 条件暴露 `window.devhub.devObs` 到 isolated world  |
| `src/shared/observability.ts`                             | 全文                  | 共享 observability 合同与 helper                   |

所有行号以实际改动后 `git blame` 为准；PR 必须附带本表格更新。

---

## 3. 数据契约 (Data Contracts)

### 3.1 核心类型

```ts
// src/shared/observability.ts

export type Timestamp = number; // epoch ms

export interface MetricSample {
  readonly ts: Timestamp;
  readonly v: number;
}

export interface RingBufferSnapshot<T> {
  readonly capacity: number;
  readonly size: number;
  readonly items: readonly T[];
  readonly wrapped: boolean;
}

export interface ProcessMetric {
  readonly rssMB: number;
  readonly cpuPct: number;
  readonly pid: number;
}

export interface ChannelRpmEntry {
  readonly channel: string;
  readonly rpm: number;      // messages / minute, EMA window=60s
  readonly totalSinceBoot: number;
}

export interface ChannelRpmReport {
  readonly generatedAt: Timestamp;
  readonly windowMs: number;
  readonly top: readonly ChannelRpmEntry[];   // length <= 10
  readonly truncated: boolean;
}

export interface ReactCommitEntry {
  readonly id: string;             // React Profiler id
  readonly commits: number;
  readonly avgActualMs: number;
  readonly avgBaseMs: number;
}

export interface ReactCommitReport {
  readonly windowMs: number;
  readonly top: readonly ReactCommitEntry[];  // length <= 5
}

export interface DisposalFailureRow {
  readonly name: string
  readonly reason: string
}

export interface DisposalReport {
  readonly completedAt: Timestamp
  readonly durationMs: number
  readonly failed: readonly DisposalFailureRow[]
  readonly remainingAfter: readonly string[]
  readonly startedAt: Timestamp
  readonly succeeded: readonly string[]
  readonly timedOut: readonly string[]
  readonly total: number
}

export interface RuntimeMetricsSnapshot {
  readonly schemaVersion: 1;
  readonly sampledAt: Timestamp;
  readonly mainRss: RingBufferSnapshot<MetricSample>;        // 30s @ 1Hz -> cap=30
  readonly rendererRss: RingBufferSnapshot<MetricSample>;    // same
  readonly psChildCount: number;
  readonly psChildPids: readonly number[];
  readonly cpuNow: number;
  readonly cpu5mAvg: number;
  readonly cpuSeries: RingBufferSnapshot<MetricSample>;      // 300 samples
  readonly ipcRpm: ChannelRpmReport;
  readonly reactCommits: ReactCommitReport;
  readonly extended: ExtendedPanels;
}

export interface ExtendedPanels {
  readonly scannerHealth: readonly ScannerHealthRow[];   // see spec/04
  readonly scannerBackpressure: readonly ScannerBackpressureRow[];
  readonly psPoolStats: PsPoolStatsRow;                  // see spec/05
  readonly disposalPending: number;
  readonly lastDisposalReport: DisposalReport | null;
  readonly recentErrors: readonly ErrorLogRow[];         // last 50
  readonly cacheSizes: readonly CacheSizeRow[];
}

export interface ScannerHealthRow {
  readonly kind: string;                                 // ScannerKind
  readonly state: 'idle' | 'scanning' | 'cooldown' | 'failed';
  readonly lastRunAt: Timestamp | null;
  readonly lastDurationMs: number | null;
  readonly consecutiveFailures: number;
}

export interface ScannerBackpressureRow {
  readonly channel: string;
  readonly lastSentSeq: number | null;
  readonly lastSentAt: Timestamp | null;
  readonly lastAckedSeq: number | null;
  readonly lastAckedAt: Timestamp | null;
  readonly pendingSeq: number | null;
  readonly queuedEnvelopes: number;
  readonly droppedEnvelopes: number;
  readonly pendingSince: Timestamp | null;
  readonly ackLag: number;
  readonly suspended: boolean;
  readonly suspendedAt: Timestamp | null;
  readonly timedOut: boolean;
  readonly timeoutCount: number;
  readonly lastTimeoutAt: Timestamp | null;
}

export interface PsPoolStatsRow {
  readonly workers: number;
  readonly idle: number;
  readonly busy: number;
  readonly queued: number;
  readonly spawnedTotal: number;
  readonly recycledTotal: number;
}

export interface ErrorLogRow {
  readonly ts: Timestamp;
  readonly level: 'warn' | 'error' | 'fatal';
  readonly source: string;
  readonly message: string;
  readonly stack?: string;
}

export interface CacheSizeRow {
  readonly name: string;
  readonly entries: number;
  readonly bytes: number;
}

export interface MetricsCollectorConfig {
  readonly sampleIntervalMs: number;     // default 1000
  readonly rssBufferCapacity: number;    // default 30
  readonly cpuBufferCapacity: number;    // default 300
  readonly emitCadenceMs: number;        // default 1000
  readonly tasklistTimeoutMs: number;    // default 1500
  readonly ipcRpmWindowMs: number;       // default 60000
}
```

### 3.2 RingBuffer 不变式

- `push(x)` 是 O(1)，容量已满时覆盖最旧元素。
- `snapshot()` 必须返回冻结数组（`Object.freeze`），禁止暴露内部索引。
- `size <= capacity` 永恒成立。
- 时间戳单调不减；若系统时钟回拨 >500ms，丢弃样本并记录警告。

### 3.3 采样来源

| 指标            | 来源                                                    |
|-----------------|---------------------------------------------------------|
| Main RSS        | `process.memoryUsage().rss`                             |
| Renderer RSS    | `webContents.getProcessId()` → CDP `Performance.metrics` |
| PS child count  | `PowerShellPoolProbe.count()`                           |
| CPU %           | `pidusage(mainPid, rendererPids...)` 聚合              |
| IPC RPM         | `IpcChannelCounter` 拦截统计                            |
| React commits   | `<Profiler onRender>` → `useReactCommitProfiler`        |

---

## 4. IPC 契约 (IPC Contracts)

所有通道均以 `dev:` 前缀，开发构建默认启用；生产构建需 `ENABLE_DEV_OBS=1`
环境变量或 `--enable-dev-obs` 启动参数。Preload 仅在启用时暴露 `window.devObs`。

### 4.1 通道清单

| Channel                        | Direction      | Payload                          | Response                     | Cadence     |
|--------------------------------|----------------|----------------------------------|------------------------------|-------------|
| `dev:get-runtime-metrics`      | R → M (invoke) | `{}`                             | `RuntimeMetricsSnapshot`     | 1 Hz pull   |
| `dev:reset-runtime-metrics`    | R → M (invoke) | `RuntimeMetricsResetScope[]?`    | `{ cleared: RuntimeMetricsResetScope[] }` | manual |
| `dev:export-diagnostic-bundle` | R → M (invoke) | `{ includeLogs?: boolean, reactCommits?: ReactCommitReport }` | `{ path: string, bytes: number }` | manual |

### 4.2 版本化与前向兼容

- Payload 顶层恒带 `schemaVersion: 1`；renderer 校验不一致时降级为只读 fallback。
- 新增字段必须可选；移除字段必须 bump `schemaVersion`。
- 当前 handler 实现位于 `src/main/ipc/devObservabilityHandlers.ts`，由 `ipc/index.ts` 注册。

### 4.3 安全
- 所有 `dev:*` handler 在 **非 dev** 模式下直接 throw `DEV_OBS_DISABLED`。
- preload 仅在启用条件满足时暴露 `window.devhub.devObs`，生产默认不暴露该入口。
- `export-diagnostic-bundle` 的落盘路径固定在 `app.getPath('userData')/diagnostics/`，
  文件名 `devobs-<iso>.json`，拒绝路径注入。

---

## 5. 错误矩阵 (Error Matrix)

| Code                         | 触发条件                                      | 降级行为                                       |
|------------------------------|-----------------------------------------------|------------------------------------------------|
| `DEV_OBS_DISABLED`           | 生产构建未启用 flag 却调用 `dev:*`            | IPC 立即 reject，不泄露信息                    |
| `SAMPLING_FAILED`            | `process.memoryUsage` 抛错                    | 插入空样本 `{ts, v: NaN}`，UI 渲染为虚线        |
| `TASKLIST_UNAVAILABLE`       | 非 Windows 或 `tasklist.exe` 不存在           | `psChildCount=-1`，UI 显示 "N/A (non-Win32)"   |
| `TASKLIST_TIMEOUT`           | `tasklist` > `tasklistTimeoutMs`              | 保留上次值，标记 stale=true                     |
| `PIDUSAGE_FAILED`            | `pidusage` 返回 ENOENT                        | CPU=NaN，面板显示灰色                          |
| `CDP_RENDERER_RSS_FAILED`    | `webContents.debugger.attach` 失败            | 回退 `process.getProcessMemoryInfo()` 估算      |
| `RPM_BUFFER_OVERFLOW`        | IpcChannelCounter 环形 >16384 通道            | LRU 淘汰，log warn，UI top-10 仍可用           |
| `PROFILER_NOT_MOUNTED`       | `<Profiler>` 未挂载即调用 `dev:get-react-commits` | 返回空 report                              |
| `EXPORT_FAILED`              | 写入 diagnostic bundle 失败                   | 返回 `{ok:false,error}`，UI toast             |
| `EXPORT_DISK_FULL`           | ENOSPC                                        | UI 明确提示磁盘已满                            |
| `HOTKEY_CONFLICT`            | Ctrl+Shift+D 已被其他 accelerator 占用        | 回退到 Ctrl+Alt+D，UI banner 通知               |
| `CONFIG_OUT_OF_RANGE`        | `set-sampling-rate` 传入 < 100ms 或 > 60000ms | 拒绝并返回当前 config + `INVALID_RANGE`        |
| `CLOCK_SKEW`                 | 系统时钟回拨 > 500ms                          | 丢弃该样本并记录 warn                           |

所有错误必须经 `ErrorLogRow` 持久化到 `extended.recentErrors`，上限 50 条。

---

## 6. 验收条件 (Acceptance — Match Matrix X8)

| #  | Given                                                | When                                  | Then                                                     |
|----|------------------------------------------------------|---------------------------------------|----------------------------------------------------------|
| 1  | DevHub 运行中，构建为 dev 或启用 flag                 | 用户按下 `Ctrl+Shift+D`                | 面板在 < 150 ms 内浮出，6 个主指标全部有数据（非空占位）   |
| 2  | 面板已打开                                           | 30 秒内持续采样                        | Main/Renderer RSS 曲线点数 >= 28（允许 2 次丢帧）          |
| 3  | 启动一次触发 scanner 的动作                          | 观察 Metric #3                         | 峰值捕获 powershell.exe 数量变化；动作结束后回到基线 ±1     |
| 4  | IPC 风暴正在发生（renderer 每秒发 >100 消息）         | 查看 Metric #5                         | top channel rpm >= 6000，且 truncated 标记正确             |
| 5  | React 组件过度 rerender                              | 查看 Metric #6                         | 相应 component 出现在 top-5，commit 数单调递增             |
| 6  | 点击 Export                                          | 1 秒内                                 | 生成 JSON 文件，schemaVersion=1，所有 6 个指标非空         |
| 7  | 非 Windows 平台启动                                  | 打开面板                               | Metric #3 显示 "N/A (non-Win32)"，不抛异常                 |
| 8  | 生产构建、未开启 flag                                | 按 Ctrl+Shift+D                        | 无任何反应；`dev:*` IPC 调用全部 reject `DEV_OBS_DISABLED` |

### 6.1 GWT 场景（Gherkin 精炼版）

```
Scenario 1: 冷启动即可见
  Given DevHub 已冷启动 2 秒
  When 用户按 Ctrl+Shift+D
  Then 面板打开且 Main RSS 至少显示 1 个样本

Scenario 2: PS 泄露可视化
  Given MetricsCollector 正在采样
  When 启动一个 scanner 且故意不释放 PS
  Then psChildCount 单调上升并在面板红色告警阈值 (>3) 处高亮

Scenario 3: IPC 洪峰
  Given IpcChannelCounter 已注入
  When 某 channel 一秒内收到 200 条消息
  Then 该 channel 出现在 top-10，rpm >= 12000

Scenario 4: 重置
  Given 面板已运行 5 分钟累积数据
  When 用户点击 Reset 并选择 'ipc' section
  Then 只有 IPC RPM 归零，其他 ring buffer 保留

Scenario 5: 导出契约
  Given 面板运行 30 秒
  When 用户点击 Export
  Then 产生文件匹配正则 /devobs-\d{8}T\d{6}\.json/，且通过 schemaVersion=1 校验

Scenario 6: 热键冲突回退
  Given 另一组件已绑定 Ctrl+Shift+D
  When MainLayout 挂载
  Then 自动回退到 Ctrl+Alt+D 并在面板顶部显示 banner
```

---

## 7. E2E 草案 (Playwright)

文件：`tests/e2e/dev-observability-panel.spec.ts`

```ts
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('DevObservabilityPanel', () => {
  test('opens via hotkey and exposes all 6 metrics', async () => {
    const app = await electron.launch({
      args: ['.', '--enable-dev-obs'],
      env: { ...process.env, ENABLE_DEV_OBS: '1' },
    });
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');

    await win.keyboard.press('Control+Shift+D');
    const panel = win.locator('[data-testid="dev-obs-panel"]');
    await expect(panel).toBeVisible({ timeout: 500 });

    for (const id of [
      'metric-main-rss',
      'metric-renderer-rss',
      'metric-ps-children',
      'metric-cpu',
      'metric-ipc-rpm',
      'metric-react-commits',
    ]) {
      await expect(panel.locator(`[data-testid="${id}"]`)).toBeVisible();
    }

    // Wait >= 5 samples
    await win.waitForTimeout(6000);
    const sampleCount = await panel
      .locator('[data-testid="metric-main-rss"] [data-sample]')
      .count();
    expect(sampleCount).toBeGreaterThanOrEqual(5);

    // Export
    const [exportResult] = await Promise.all([
      win.evaluate(() => (window as any).devObs.exportBundle()),
      panel.locator('[data-testid="export-btn"]').click(),
    ]);
    expect(exportResult.bytes).toBeGreaterThan(0);
    const content = JSON.parse(fs.readFileSync(exportResult.path, 'utf8'));
    expect(content.schemaVersion).toBe(1);
    expect(content.mainRss.items.length).toBeGreaterThan(0);

    await app.close();
  });

  test('auto-refresh streams at ~1Hz', async () => {
    const app = await electron.launch({ args: ['.', '--enable-dev-obs'] });
    const win = await app.firstWindow();
    await win.keyboard.press('Control+Shift+D');

    const readCount = () =>
      win.locator('[data-testid="metric-main-rss"] [data-sample]').count();
    const c0 = await readCount();
    await win.waitForTimeout(3500);
    const c1 = await readCount();
    expect(c1 - c0).toBeGreaterThanOrEqual(3);
    await app.close();
  });

  test('refuses in production build without flag', async () => {
    const app = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production', ENABLE_DEV_OBS: '' },
    });
    const win = await app.firstWindow();
    await win.keyboard.press('Control+Shift+D');
    await expect(
      win.locator('[data-testid="dev-obs-panel"]')
    ).not.toBeVisible({ timeout: 500 });
    await app.close();
  });
});
```

---

## 8. 参考实现 / 库 (References)

### 8.1 库选型

| Lib                         | 用途                          | 选择原因                                 |
|-----------------------------|-------------------------------|------------------------------------------|
| inline SVG sparkline        | RSS / CPU 小图                | 无需新增 `recharts` 依赖，直接复用现有 UI 栈 |
| `app.getAppMetrics()`       | 主/渲染进程 CPU 与 memory     | Electron 官方 API，主进程可直接读取       |
| React `<Profiler>`          | commit 计数                   | React 官方 API，零外部依赖               |
| `process.getProcessMemoryInfo()` | 当前进程 memory（参考）   | Electron 官方 API；renderer 侧可用于独立核验 |
| `IpcChannelCounter`         | IPC RPM 聚合                  | 低风险、无额外依赖                       |
| 自研 `RingBuffer`           | 定长历史样本                  | O(1) push / snapshot，便于测试与导出      |

### 8.2 外部参考

- Sentry Performance panel — 分段 timeline + drill-down 布局。
- VS Code Runtime Status (`Developer: Show Running Extensions`) — 表格 + 实时 CPU 排行。
- Chromium `chrome://tracing` — 事件密度可视化。

### 8.3 面板布局 ASCII 草图

```
+---------------------------------------------------------------------------+
| DevObservabilityPanel                           [Export] [Reset] [Close] |
+---------------------------------------------------------------------------+
| Tabs: [ Core ] [ Scanners ] [ PS Pool ] [ Disposal ] [ Errors ] [ Cache ] |
+---------------------------------------------------------------------------+
|                                                                           |
|  +-----------------------------+   +-----------------------------+        |
|  | (1) Main RSS  (30s)         |   | (2) Renderer RSS (30s)      |        |
|  |  MB                         |   |  MB                         |        |
|  |   ^                         |   |   ^                         |        |
|  |   |        .-._.            |   |   |     _.-''.              |        |
|  |   |    _.-'     '._.-.      |   |   | _.-'                    |        |
|  |   +---------------------->  |   |   +----------------------->  |        |
|  |              t (s)          |   |              t (s)          |        |
|  +-----------------------------+   +-----------------------------+        |
|                                                                           |
|  +-----------------------------+   +-----------------------------+        |
|  | (3) powershell.exe count    |   | (4) CPU %  (5m avg)         |        |
|  |   live:  2   peak: 7        |   |   now: 11.3   avg: 8.7      |        |
|  |   PIDs: [1234,5678]         |   |   ^                         |        |
|  |   +-----+ +-----+           |   |   |    _.-''-._.-''._       |        |
|  |   |#####| |###  |           |   |   +----------------------->  |        |
|  |   +-----+ +-----+           |   |           t (s)             |        |
|  +-----------------------------+   +-----------------------------+        |
|                                                                           |
|  +---------------------------------------+ +-----------------------------+|
|  | (5) IPC RPM (top 10)                  | | (6) React Commits / min     ||
|  | +-----------------------------+-----+ | | +----------------+-------+  ||
|  | | channel                     | rpm | | | | component      | c/m   |  ||
|  | +-----------------------------+-----+ | | +----------------+-------+  ||
|  | | fs:scan:progress            | 420 | | | | ProjectTable   |  88   |  ||
|  | | ps:exec                     | 310 | | | | AiStatusBadge  |  54   |  ||
|  | | window:focus                | 210 | | | | SidebarItem    |  31   |  ||
|  | | scanner:tick                |  98 | | | | FileTree       |  22   |  ||
|  | | ...                         | ... | | | | Toast          |   9   |  ||
|  | +-----------------------------+-----+ | | +----------------+-------+  ||
|  +---------------------------------------+ +-----------------------------+|
|                                                                           |
|  Sampling: 1000ms   Buffer: 30 / 300    Errors(last 50): 3  [view -->]    |
+---------------------------------------------------------------------------+
```

---

## Tail — 合约贡献

### 对 `contracts/22-observability.contract.md` 的贡献
- 新增 `MetricsCollector` 接口及其生命周期 (boot → ready → stopped)。
- 声明 6 个主指标的采样来源、频率、精度。
- 规定 `RuntimeMetrics.schemaVersion` 升级流程。
- 规定 `dev:*` 通道在生产构建中的强制禁用条件。

### 对 `contracts/23-developer-feedback-loop.contract.md` 的贡献
- 定义"修复证据"三要素：(a) 相应指标曲线单调下降或归零；(b) `recentErrors`
  不再出现对应 code；(c) 导出 bundle 可被 R7 QA 作为客观附件存档。
- 规定任何 R7+ 的 PR 必须附带 `devobs-*.json` 对比（修复前 / 修复后）。
- 规定 `dev:export-diagnostic-bundle` 的 schema 为合约兼容层（schemaVersion=1
  冻结，变更需双方签字）。

---

End of spec 06.
