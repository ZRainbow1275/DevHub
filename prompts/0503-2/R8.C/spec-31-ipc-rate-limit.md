# spec-31-ipc-rate-limit — IPC 速率限制（4 级 token bucket）

> **batch**: R8.C  |  **flag**: `R8.C.ipc.rate-limit`
> **depends_on**: R8.A spec-01 (integration-libs)
> **derives_from**: master §7.4 ipc_rpm + V1-Q-9.B.4 答 D 4 级分类

---

## 1. motivation

```yaml
user_quote_v1_q_9_b_4: "D — 4 级分类：high_freq_scan / medium_query / low_freq_op / meta"
goals:
  - 全 IPC 通道按 master §7.4 速率分级
  - 4 级 token bucket: high_freq_scan=30 / medium_query=60 / low_freq_op=120 / meta=600 RPM
  - 超限直接拒绝（E_RATE_LIMITED）
  - 输出限流命中统计供 spec-32 观测
constraint:
  - 全局单例 RateLimiter
  - 每通道在注册时声明级别；未声明者默认 medium_query
  - 不同 sender（main/preload/renderer）共享 bucket
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/ipc/RateLimiter.ts
  - devhub/src/main/services/ipc/IpcChannelRegistry.ts
  - devhub/src/main/services/ipc/RateLimiter.test.ts
  - devhub/src/main/services/ipc/RateLimitMiddleware.ts
  - devhub/src/shared/schemas/ipc-rate-limit.ts
modified_files:
  - devhub/src/main/index.ts  # 启动时注册全部通道
  - devhub/src/main/ipc/*.ts  # 全部 handler 通过 middleware 包装
glob_anchors:
  - devhub/src/main/ipc/index.ts:1-100
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const RateLimitClassEnum = z.enum(['high_freq_scan','medium_query','low_freq_op','meta'])

export const RATE_LIMIT_RPM: Record<z.infer<typeof RateLimitClassEnum>, number> = {
  high_freq_scan: 30,
  medium_query: 60,
  low_freq_op: 120,
  meta: 600,
}

export const ChannelRegistrationSchema = z.object({
  channel: z.string().regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/),
  rateClass: RateLimitClassEnum,
  burstAllowance: z.number().int().min(0).default(5),  // 短突发桶
  perSenderBucket: z.boolean().default(false),  // 默认全局单桶
  description: z.string(),
})

export const RateLimitVerdictSchema = z.object({
  channel: z.string(),
  allowed: z.boolean(),
  rateClass: RateLimitClassEnum,
  remainingTokens: z.number(),
  retryAfterMs: z.number().int(),
  ts: z.number().int(),
})

export const RateLimitStatsSchema = z.object({
  channel: z.string(),
  rateClass: RateLimitClassEnum,
  totalRequests: z.number().int(),
  rejectedRequests: z.number().int(),
  rejectRate: z.number().min(0).max(1),
  windowStart: z.number().int(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  ipc:rate-limit-stats:  # meta channel
  rateClass: meta
  req: {}
  resp: { perChannel: RateLimitStats[] }
  ipc:rate-limit-channel-list:
  rateClass: meta
  resp: ChannelRegistration[]
  ipc:override-rate-class:  # dev only
  rateClass: meta
  req: { channel: string, rateClass: RateLimitClass }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 通道未注册 | E_VALIDATION（启动期 throw） |
| 限流命中 | E_RATE_LIMITED（含 retryAfterMs） |
| 突发桶耗尽 | E_RATE_LIMITED |
| override-rate-class 在 prod | E_VALIDATION |
| stats 计数溢出 | (自动 reset 窗口) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基本限流):
  given: 通道 'ai:fusion-stream' rateClass=high_freq_scan (30 RPM)
  when: 1 分钟内 35 次请求
  then: 前 30 通过；后 5 拒绝（E_RATE_LIMITED + retryAfterMs）

GWT-2 (4 级独立):
  given: 同时打满 4 级（high/medium/low/meta）
  when: 各自计数
  then: 不互相影响（独立 bucket）

GWT-3 (突发桶):
  given: burstAllowance=5
  when: 1s 内瞬时 5 次
  then: 全通过（突发桶吸收）；6th 被限

GWT-4 (统计):
  given: 1 小时随机流量
  when: ipc:rate-limit-stats
  then: rejectRate < 0.05（健康负载）

GWT-5 (未注册通道拒启动):
  given: dev 注册了未声明 rateClass 通道
  when: 启动期校验
  then: throw E_VALIDATION + 启动失败（强制开发者声明）
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 high_freq_scan 30 RPM enforcement', async ({ page }) => {
  let rejected = 0
  for (let i = 0; i < 35; i++) {
  try {
  await page.evaluate(() => window.electronAPI.ai.fusionStream.subscribe(() => {}))
  } catch (e: any) {
  if (e.code === 'E_RATE_LIMITED') rejected++
  }
  }
  expect(rejected).toBeGreaterThanOrEqual(5)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'limiter@2.x':  token bucket 实现
  - 'lru-cache@10.x':  per-channel 状态缓存
inspirations:
  - GitHub API rate limiting
  - AWS API Gateway throttle
  - Cloudflare Workers rate limit
algorithm: |
  token bucket per (channel, optional sender):
  capacity = RATE_LIMIT_RPM[class] / 60 * 1.5  // 1.5x burst
  refillRate = RATE_LIMIT_RPM[class] / 60 per sec
  on request: if tokens >= 1 -> consume 1 + allow else reject + retryAfterMs
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~620
modified_loc: ~300  # 全部 IPC handler 包装
test_loc: ~400
total: ~1320
risk_areas:
  - 全 IPC 通道注册一致性（CI grep 校验）
  - 高负载下 lru-cache 内存
  - dev/prod 配置漂移
```

---

## 10. implement_checklist

- [x] IpcChannelRegistry 启动期注册（CI 强制）
- [x] 4 级 token bucket（限流 + 突发）
- [x] middleware 自动包装 ipcMain.handle
- [x] perSenderBucket 仅在敏感通道开启
- [x] stats 1 分钟滑窗
- [x] dev override 仅 NODE_ENV=development
- [x] vitest 覆盖 5 GWT + 高并发模拟
- [x] feature flag R8.C.ipc.rate-limit 默认 ON
- [x] CI grep：未注册通道直接 fail
- [x] audit log: rejectRate > 5% 时 WARN

---

## 11. dependencies

```yaml
upstream:
  - R8.A.spec-01: limiter / lru-cache 已安装
downstream:
  - 全部 spec：所有 IPC 通道引用本表
  - R8.C.spec-32: 观测面板显示 rejectRate
```

---

## 12. fallback_strategy

```yaml
on_limiter_lib_fail:
  - 退化到 setInterval 计数（性能差但功能正常）
on_clock_skew:
  - 使用 monotonic clock (process.hrtime)
on_cache_pressure:
  - 仅保留高频通道；低频用计算代替
flag_off_behavior:
  - R8.C.ipc.rate-limit=OFF 时仅日志不限流（dev 调试用）
```

---

## 13. performance_budget

```yaml
limit_check_p99_us: { warn: 50, fatal: 500 }
memory_total_mb: { warn: 20, fatal: 100 }
stats_compute_p99_ms: { warn: 30, fatal: 200 }
ipc_rpm_class_default:
  high_freq_scan: 30
  medium_query: 60
  low_freq_op: 120
  meta: 600
```

---

## implementation_status_2026-05-05

```yaml
status: COMPLETE
implemented_in:
  zod_sot:
  - devhub/src/shared/schemas/ipc-rate-limit.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  main_services:
  - devhub/src/main/services/ipc/IpcChannelRegistry.ts
  - devhub/src/main/services/ipc/RateLimiter.ts
  - devhub/src/main/services/ipc/RateLimitMiddleware.ts
  - devhub/src/main/utils/rateLimiter.ts
  ipc_runtime:
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/main/services/R8RuntimeService.ts
  renderer_contract:
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/src/renderer/components/monitor/R8OpsPanel.tsx
  tests:
  - devhub/src/main/services/ipc/RateLimiter.test.ts
  - devhub/src/main/utils/rateLimiter.test.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
verification:
  targeted:
  command: pnpm test --run src/main/services/ipc/RateLimiter.test.ts src/main/utils/rateLimiter.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
  result: 5 files passed / 68 tests passed
  typecheck:
  command: pnpm typecheck
  result: passed
notes:
  - Existing dependency set did not include limiter/lru-cache; implementation used the spec fallback path: zero-dependency monotonic token bucket with bounded in-memory maps.
  - Existing fixed-window utils/rateLimiter API remains compatible; old handlers keep calling withRateLimit without broad IPC refactors.
  - ipc:override-rate-class is wired through preload but throws E_VALIDATION outside NODE_ENV=development.
  - R8OpsPanel now shows ChannelRegistration rows rather than the older R8IpcChannelDefinition shape for the rate-limit channel list.
```
