# spec-37-permissions-time-bounded — 权限时效层（permission TTL + 自动回收）

> **batch**: R8.C  |  **flag**: `R8.C.permission.ttl`
> **depends_on**: R8.A spec-11 (permission-prompts), R8.C spec-33
> **derives_from**: V1-Q-9.G.2 答 D 时效授权 + V2-Q-17.A 自动回收

---

## 1. motivation

```yaml
user_quote_v1_q_9_g_2: "D — 敏感操作授权带 TTL；超时自动回收，再次需重授"
goals:
  - 在 R8.A.spec-11 permission prompts 基础上加 TTL
  - 8 类敏感操作分别可设 TTL：inject / shim-install / kill-pid / file-write / fs-elevated / webhook / smtp / store-api-key
  - 默认 TTL 30 min；范围 1min..24h
  - 用户可一键吊销全部
constraint:
  - TTL 用 monotonic clock（防系统时间回拨）
  - 吊销立即生效（事件总线广播）
  - 持久化授权状态（重启后保留剩余 TTL）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/permission/PermissionTtlManager.ts
  - devhub/src/main/services/permission/PermissionStore.ts
  - devhub/src/main/services/permission/PermissionTtlManager.test.ts
  - devhub/src/renderer/views/permission/PermissionPanel.tsx
  - devhub/src/renderer/components/permission/CountdownBadge.tsx
  - devhub/src/shared/schemas/permission-ttl.ts
modified_files:
  - devhub/src/main/services/permission/PermissionService.ts  # spec-R8.A.11 已有
  - devhub/src/main/ipc/permissionHandlers.ts
glob_anchors:
  - devhub/src/main/services/permission/PermissionService.ts:1-200
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const SensitiveOpEnum = z.enum([
  'inject',
  'shim-install',
  'kill-pid',
  'file-write',
  'fs-elevated',
  'webhook',
  'smtp',
  'store-api-key',
])

export const PermissionGrantSchema = z.object({
  grantId: z.string().uuid(),
  op: SensitiveOpEnum,
  scope: z.object({
  instanceId: z.string().optional(),
  pathGlob: z.string().optional(),
  targetUrl: z.string().optional(),
  }),
  grantedAt: z.number().int(),
  ttlMs: z.number().int().min(60_000).max(86_400_000),  // 1min..24h
  expiresAt: z.number().int(),
  monotonicGrantedAt: z.number(),  // process.hrtime ms
  grantedBy: z.string(),  // user id
  reason: z.string().max(500).optional(),
  revokedAt: z.number().int().nullable(),
  usageCount: z.number().int().nonnegative(),
})

export const PermissionPolicySchema = z.object({
  op: SensitiveOpEnum,
  defaultTtlMs: z.number().int().min(60_000).max(86_400_000).default(30 * 60_000),
  maxTtlMs: z.number().int().min(60_000).max(86_400_000).default(24 * 60 * 60_000),
  requireReason: z.boolean().default(false),
  rateLimitPerHour: z.number().int().min(1).max(60).default(20),
})

export const PermissionCheckResultSchema = z.object({
  granted: z.boolean(),
  grantId: z.string().uuid().optional(),
  expiresAt: z.number().int().optional(),
  remainingMs: z.number().int().optional(),
  reason: z.enum(['active','expired','revoked','never-granted','rate-limited']),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  permission:request:
  rateClass: low_freq_op
  req: { op: SensitiveOp, scope: object, ttlMs?: number, reason?: string }
  resp: PermissionGrant
  permission:check:
  rateClass: medium_query
  req: { op: SensitiveOp, scope: object }
  resp: PermissionCheckResult
  permission:revoke:
  rateClass: low_freq_op
  req: { grantId: string }
  resp: { success: boolean }
  permission:revoke-all:
  rateClass: low_freq_op
  req: {}
  resp: { revokedCount: number }
  permission:list-active:
  rateClass: meta
  resp: PermissionGrant[]
  permission:configure-policy:
  rateClass: low_freq_op
  req: PermissionPolicy
  resp: { success: boolean }
  permission:expiry-stream:  # main->renderer 倒计时
  rateClass: medium_query
  payload: { grantId: string, remainingMs: number }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| TTL 越界 | E_VALIDATION |
| op 未知 | E_VALIDATION |
| 未授权且操作触发 | E_PERMISSION |
| rate-limit 命中（每小时） | E_RATE_LIMITED |
| 系统时间回拨 | (用 monotonic 不受影响) |
| 持久化失败 | E_INTERNAL（grant 仅内存） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (TTL 自动回收):
  given: 授权 op=inject ttl=60s
  when: 65s 后 permission:check
  then: granted=false reason='expired'

GWT-2 (主动吊销):
  given: 5 个 active grant
  when: permission:revoke-all
  then: list-active 返回空；audit log 记录全部 revoke

GWT-3 (倒计时 UI):
  given: grant 剩 5min
  when: 订阅 expiry-stream
  then: renderer 倒计时 badge 显示 mm:ss + < 1min 时变红

GWT-4 (持久化):
  given: 授权剩余 20min；DevHub 重启
  when: 启动后 check
  then: granted=true remainingMs ≈ 20min（容差 ±5s）

GWT-5 (rate-limit):
  given: 1 小时内 25 次请求 inject
  when: 第 21 次
  then: E_RATE_LIMITED（policy.rateLimitPerHour=20）
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 ttl auto expire', async ({ page }) => {
  const grant = await page.evaluate(() => window.electronAPI.permission.request({ op: 'inject', scope: {}, ttlMs: 60_000 }))
  await page.waitForTimeout(65_000)
  const check = await page.evaluate(() => window.electronAPI.permission.check({ op: 'inject', scope: {} }))
  expect(check.granted).toBe(false)
  expect(check.reason).toBe('expired')
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'better-sqlite3@11':  持久化
  - 'zod@3.23':  schema
  - 'mitt@3':  事件总线
  - 'process.hrtime':  monotonic clock
inspirations:
  - macOS TCC（Transparency, Consent, Control）
  - sudo timestamp_timeout
  - OAuth2 token expiry
  - Linux PolicyKit
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~700
modified_loc: ~150
test_loc: ~400
total: ~1250
risk_areas:
  - 持久化与 monotonic clock 协调（重启后用 wall-clock 重算）
  - rate-limit 跨会话计数
  - UI 倒计时性能（高频 stream）
```

---

## 10. implement_checklist

- [x] PermissionTtlManager 启动时加载 store + 计算剩余
- [x] policy 8 op 默认配置
- [x] expiry-stream 1Hz throttle
- [x] CountdownBadge 1s 重渲染（< 1min 变红）
- [x] permission:check 高频 → spec-31 medium_query
- [x] revoke-all 二次确认
- [x] vitest + Playwright 5 GWT（Vitest TTL + CountdownBadge GWT 已通过；2026-05-11 Playwright permission TTL GWT 已通过）
- [x] feature flag R8.C.permission.ttl 默认 ON
- [x] audit log 全程

---

## 11. dependencies

```yaml
upstream:
  - R8.A.spec-11: PermissionService 基础
  - R8.C.spec-33: schema SoT
  - R8.C.spec-31: rate-limit middleware
downstream:
  - R8.C.spec-18/19: inject 检查 ttl
  - R8.C.spec-02: shim-install 检查 ttl
  - R8.C.spec-30: webhook/smtp 通道检查 ttl
```

---

## 12. fallback_strategy

```yaml
on_clock_skew:
  - 用 monotonic + wall-clock 双校对，取较大剩余
on_store_corrupt:
  - 视为全部 expired；用户重新授权
on_rate_limit_storm:
  - 短时间冷却 + 通知用户
flag_off_behavior:
  - R8.C.permission.ttl=OFF 时退回 spec-R8.A.11 单次授权（不 TTL）
```

---

## 13. performance_budget

```yaml
check_p99_us: { warn: 200, fatal: 1000 }
expiry_stream_hz: 1
list_active_p99_ms: { warn: 30, fatal: 200 }
memory_kb: { warn: 100, fatal: 500 }
```

---

## 2026-05-05 implementation_status

- Status: executable R8.C spec-37 backend/IPC/preload/schema slice complete for this task.
- Runtime: `devhub/src/main/services/R8RuntimeService.ts` persists TTL grants in `permissionTtlGrants`, records wall-clock expiry plus monotonic grant timestamps, and audits request/check-denied/revoke/revoke-all/configure operations.
- Operations: `inject`, `shim-install`, `kill-pid`, `file-write`, `fs-elevated`, `webhook`, `smtp`, and `store-api-key` are schema-enforced sensitive operations.
- TTL policy: default TTL is 30 minutes, schema bounds are 1 minute through 24 hours, per-op policy can constrain default/max TTL, and request rate limits are persisted per operation.
- IPC/preload: `permission:request`, `permission:check`, `permission:revoke`, `permission:revoke-all`, `permission:list-active`, `permission:configure-policy`, `permission:expiry-stream`, and legacy permission compatibility channels are wired.
- Verification: focused Vitest proves active grant success, expiry denial, revoke denial, revoke-all cleanup, and `E_RATE_LIMITED` behavior with real `electron-store` state isolated for deterministic assertions.

## 2026-05-10 verification_update

- Confirmed `devhub/src/shared/schemas/r8-runtime.ts` defines the exact 8 sensitive operations and uses `permissionRevokeAllRequestSchema.confirmedBy` as the revoke-all confirmation contract.
- Confirmed `devhub/src/shared/schemas/r8-runtime.ts` registers `permission:check` as `medium_query` and `permission:expiry-stream` as a main-to-renderer stream contract.
- Strengthened `devhub/src/main/services/R8RuntimeService.ts` so active permission checks and expiry-stream payload requests now write local audit events, complementing request, denied check, revoke, revoke-all, and policy configuration audit rows.
- Strengthened `devhub/src/main/services/R8RuntimeService.test.ts` to assert active grant, expiry, revoke, revoke-all, rate-limit, expiry-stream payload, 1Hz stream throttle/cache, request/revoke invalidation, and audit events with isolated real `electron-store` state.
- Added `devhub/src/renderer/components/permission/CountdownBadge.tsx` and wired it into `R8OpsPanel` so `permission:expiry-stream` data renders as an mm:ss badge with 1s repaint and a red critical state under 1 minute.
- Verified by `pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "permission TTL|resilience contracts"`.
- Verified by `pnpm -C devhub test --run src/renderer/components/permission/CountdownBadge.test.tsx --maxWorkers=1`.
- Remaining boundary: none for the local R8.C spec-37 checklist; keep release-level regression reruns before final all-doc closure.

### 2026-05-11 Playwright permission TTL GWT closure

- Fixed a real packaged/Electron launch blocker that prevented Playwright GWT from reaching the R8 Ops UI: main-process DAG and task-queue code now loads `@dagrejs/dagre` through a local `createRequire()` CJS compatibility helper instead of runtime ESM named imports that fail under Electron.
- Rebuilt production output with `pnpm -C devhub build`; the build completed successfully.
- Verified the rebuilt app can be launched by Playwright Electron with a minimal launch probe against `out/main/index.js`.
- Ran the existing permission TTL Playwright GWT:
  - `pnpm -C devhub test:e2e --grep "R8.C spec-37" --reporter=line`
  - Result: 1 Playwright Electron test passed in 10.3s.
- The GWT creates a real local TTL grant through `window.devhub.r8.permission.request()`, opens the R8 Ops panel, renders the `Permission TTL` countdown list, verifies `data-expiry-critical="false"` before the one-minute boundary, waits for the live countdown to become critical, and revokes the grant in cleanup.
- No mock grant data, fake renderer state, or simulated IPC path is used.

## 2026-05-11 verification_update

- Added `feature-flags.test.ts` coverage proving `R8.C.permission.ttl` is default ON.
- Reverified the runtime TTL, schema, CountdownBadge, and feature-flag focused suite with:
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/components/permission/CountdownBadge.test.tsx src/shared/feature-flags.test.ts --maxWorkers=1 -t "permission TTL|resilience contracts|CountdownBadge|default disabled states|feature flag"`: 4 files passed, 9 tests passed, 86 skipped.
  - `pnpm -C devhub exec vitest run src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/permission/CountdownBadge.test.tsx src/shared/feature-flags.test.ts --maxWorkers=1`: 5 files passed, 49 tests passed.
- Remaining boundary: none for the local R8.C spec-37 checklist; Playwright permission UI GWT is now covered by the 2026-05-11 Electron test run above.
