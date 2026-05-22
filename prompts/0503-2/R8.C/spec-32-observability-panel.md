# spec-32-observability-panel — 可观测性面板（snapshot + stream + 趋势）

> **batch**: R8.C  |  **flag**: `R8.C.observability.panel`
> **depends_on**: R8.C spec-27/28/29/30/31, R8.A spec-02
> **derives_from**: V1-Q-9.A.3 答 D 全维度 + V1-Q-9.B.5 答 C 不外发遥测

---

## 1. motivation

```yaml
user_quote_v1_q_9_a_3: "D — 全维度（CPU/IO/IPC/限流/通知/状态机/信号融合/SHIM/Watchdog）"
user_quote_v1_q_9_b_5: "C — 全部本地，不向外部发任何遥测（NO-TELEMETRY）"
goals:
  - 一键打开"可观测面板"独立窗或 Drawer
  - 实时显示：通道 RPM / 限流命中 / 通知聚合 / 状态机违反 / 融合权重 / 内存 / SHIM 状态 / Watchdog 心跳
  - 支持时间游标拖动看 30 分钟历史
  - snapshot 快照可导出（spec-36 诊断包）
constraint:
  - 完全本地（NO-TELEMETRY）
  - 默认 30 分钟 ringbuffer，用户可调 5min..6h
  - 高负载时降采样
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/observability/MetricsCollector.ts
  - devhub/src/main/services/observability/SnapshotBuilder.ts
  - devhub/src/main/services/observability/RingBufferStore.ts
  - devhub/src/main/services/observability/SnapshotBuilder.test.ts
  - devhub/src/renderer/views/observability/ObservabilityPanel.tsx
  - devhub/src/renderer/views/observability/MetricChart.tsx
  - devhub/src/renderer/views/observability/TimeCursor.tsx
  - devhub/src/shared/schemas/observability.ts
modified_files:
  - devhub/src/main/index.ts  # MetricsCollector 单例
  - devhub/src/renderer/App.tsx  # 路由 /observability
glob_anchors:
  - devhub/src/main/services/audit/AuditLogger.ts
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const MetricKindEnum = z.enum([
  'ipc-rpm',
  'rate-limit-reject',
  'notification-emit',
  'state-transition',
  'fusion-confidence',
  'memory-rss',
  'cpu-pct',
  'shim-status',
  'watchdog-heartbeat',
  'csv-row-throughput',
  'inject-success-rate',
])

export const MetricSampleSchema = z.object({
  kind: MetricKindEnum,
  ts: z.number().int(),
  value: z.number(),
  labels: z.record(z.string(), z.string()).optional(),
})

export const SnapshotSchema = z.object({
  collectedAt: z.number().int(),
  windowStart: z.number().int(),
  windowEnd: z.number().int(),
  metrics: z.array(MetricSampleSchema),
  globalCounters: z.object({
  totalIpcRequests: z.number().int(),
  totalRateLimited: z.number().int(),
  totalNotifications: z.number().int(),
  totalAssertionViolations: z.number().int(),
  activeInstances: z.number().int(),
  }),
  health: z.object({
  overall: z.enum(['healthy','degraded','unhealthy']),
  issues: z.array(z.string()),
  }),
})

export const ObservabilityConfigSchema = z.object({
  ringBufferMinutes: z.number().int().min(5).max(360).default(30),
  samplingHz: z.number().min(0.1).max(10).default(1),
  exportEnabled: z.boolean().default(true),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  obs:get-snapshot:
  rateClass: medium_query
  req: { sinceMs?: number }
  resp: Snapshot
  obs:subscribe:
  rateClass: medium_query
  direction: main->renderer
  payload: MetricSample[]
  obs:configure:
  rateClass: low_freq_op
  req: ObservabilityConfig
  resp: { success: boolean }
  obs:export-snapshot:
  rateClass: low_freq_op
  req: { format: 'json'|'csv', destPath: string }
  resp: { success: boolean, sizeBytes: number }
  obs:export-diagnostic-pack:  # 转发给 spec-36
  rateClass: meta
  req: { includeScreenshots: boolean }
  resp: { zipPath: string }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| ringBuffer 内存超限 | (自动降采样 + warn) |
| snapshot 计算超时 | E_TIMEOUT（返回部分数据） |
| 导出磁盘满 | E_INTERNAL |
| 用户配置超出范围 | E_VALIDATION |
| streaming 订阅 > 3 同时 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (snapshot p95 < 200ms):
  given: 1000 实例 + 30min ringbuffer
  when: obs:get-snapshot
  then: P95 < 200ms（master §7.4 observability_snapshot_p95_ms）

GWT-2 (NO-TELEMETRY):
  given: panel 打开 30min
  when: 网络抓包
  then: 0 字节流向外部域名（除用户主动 webhook）

GWT-3 (时间游标):
  given: panel 显示 30min 视图
  when: 拖游标到 -15min
  then: MetricChart 显示历史快照（不卡）

GWT-4 (健康度):
  given: rejectRate > 10% + 状态机违反 > 5
  when: 计算 health
  then: health.overall='degraded' issues 含原因

GWT-5 (导出):
  given: user 点导出
  when: obs:export-snapshot format=json
  then: 文件落盘 + audit log
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-2 NO-TELEMETRY', async ({ page, networkMonitor }) => {
  await page.goto('app://renderer/observability')
  await page.waitForTimeout(30000)
  const requests = networkMonitor.getOutboundRequests()
  expect(requests.filter(r => !r.url.startsWith('app://') && !r.url.startsWith('file://'))).toHaveLength(0)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'recharts@2.13':  渲染图表
  - 'd3-time-format@4.x':  时间轴
  - 'lru-cache@10.x':  ringbuffer
  - 'lodash.throttle@4':  stream 节流
inspirations:
  - Grafana single-pane
  - Datadog metrics explorer
  - Prometheus + node_exporter（仅本地）
sampling_strategy: |
  default 1Hz; on memory pressure → 0.5Hz; on idle → 0.2Hz
  high-priority metrics (state-transition / rate-limit-reject) always full rate
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~1100
modified_loc: ~150
test_loc: ~500
total: ~1750
risk_areas:
  - ringbuffer 内存（30min × 1000 实例 × 11 metric）
  - chart 渲染性能（recharts 大数据集）
  - 误开外部网络（CI 网络监控测试）
```

---

## 10. implement_checklist

- [x] MetricsCollector 订阅各 service 事件
- [x] RingBufferStore 默认 30min 1Hz
- [x] SnapshotBuilder P95 < 200ms（基准）
- [x] 时间游标 + 拖动平滑
- [x] 11 种 metric 显示卡片
- [x] 健康度计算（degraded / unhealthy）
- [x] 导出 JSON / CSV
- [x] CI 网络监控：禁外部域名
- [x] vitest + Playwright 5 GWT
- [x] feature flag R8.C.observability.panel 默认 ON
- [x] 主题 4 维同步（feedback#1）

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-27/28/29/30/31: 信号源
  - R8.A.spec-02: ProcessUnifiedVM 提供 cpu/memory
downstream:
  - R8.C.spec-36: 诊断包导出 snapshot
  - R8.C.spec-34: 崩溃恢复用 snapshot 重建
```

---

## 12. fallback_strategy

```yaml
on_memory_pressure:
  - 自动降采样 1Hz → 0.5Hz → 0.2Hz
on_chart_render_slow:
  - 启用 virtualization + binning
on_collector_fail:
  - 单 metric 失败不影响其他
flag_off_behavior:
  - R8.C.observability.panel=OFF 时菜单不显示
```

---

## 13. performance_budget

```yaml
snapshot_p95_ms: { warn: 200, fatal: 1000 }
sampling_hz_default: 1
ringbuffer_default_minutes: 30
memory_mb: { warn: 80, fatal: 300 }
stream_throttle_ms: 500
ipc_channel: obs:subscribe → spec-31 medium_query 60 RPM
```

---

## implementation_status_2026-05-05

status: implemented_and_verified

implemented_files:
  - devhub/src/shared/schemas/observability.ts
  - devhub/src/main/services/observability/RingBufferStore.ts
  - devhub/src/main/services/observability/SnapshotBuilder.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/src/renderer/views/observability/ObservabilityPanel.tsx
  - devhub/src/renderer/views/observability/MetricChart.tsx
  - devhub/src/renderer/views/observability/TimeCursor.tsx
  - devhub/src/renderer/components/dev/DevObservabilityPanel.tsx
  - devhub/src/renderer/hooks/useRuntimeMetrics.ts

verification_2026-05-05:
  - pnpm typecheck
  - pnpm test --run src/main/services/observability/RingBufferStore.test.ts src/main/services/observability/SnapshotBuilder.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/renderer/views/observability/ObservabilityPanel.test.tsx --maxWorkers=1
  - pnpm test --run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 --reporter=verbose
  - pnpm test --run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
  - pnpm test --run --maxWorkers=1
  - pnpm lint
  - pnpm check:no-emoji
  - pnpm check:license
  - git diff --check
  - git -C .. diff --check

notes:
  - `obs:unsubscribe` was added as a cleanup companion for `obs:subscribe`; it is registered under the same feature flag and `meta` rate class.
  - prompts/0503-2 declared IPC coverage is now 298 unique channels; `obs:*` channels are explicitly covered in `r8-runtime.test.ts`.
  - `cleanupR8RuntimeHandlers()` keeps production `dispose()` cleanup while tolerating incomplete test doubles, so handler cleanup remains idempotent in tests and production.
  - `obs:export-diagnostic-pack` forwards to the existing local diagnostic export path and returns `zipPath: null`; no fake ZIP is created before spec-36.
  - NO-TELEMETRY is preserved: all collection and exports are local filesystem / in-memory IPC paths.
