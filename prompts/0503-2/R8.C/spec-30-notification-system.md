# spec-30-notification-system — 统一通知系统（4 级 6 通道 + 聚合）

> **batch**: R8.C  |  **flag**: `R8.C.notify.system`
> **depends_on**: R8.A spec-01, R8.C spec-33 (Zod SoT)
> **derives_from**: V1-Q-7.J.3 答 C 默认 60s 范围 5s-10min + master §3.7 + §7.2

---

## 1. motivation

```yaml
user_quote_v1_q_7_j_3: "C — 默认 60s 聚合窗口，用户可调（5s-10min）"
goals:
  - 统一通知接入点 NotificationService（替代散点 toast/electron-notification）
  - 4 级：INFO / WARN / ERROR / FATAL
  - 6 通道：toast / os-notification / statusbar / email / webhook / desktop-bell
  - 聚合：同 aggregationKey 在窗口内合并为 1 条
  - 用户可调聚合窗口（5s..10min）
constraint:
  - email / webhook 默认 OFF（隐私）
  - 不调外部短信/IM 服务
  - aggregationKey = sha256(level + source + instanceId)
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/notification/NotificationService.ts
  - devhub/src/main/services/notification/NotificationAggregator.ts
  - devhub/src/main/services/notification/channels/ToastChannel.ts
  - devhub/src/main/services/notification/channels/OsNotificationChannel.ts
  - devhub/src/main/services/notification/channels/StatusbarChannel.ts
  - devhub/src/main/services/notification/channels/EmailChannel.ts
  - devhub/src/main/services/notification/channels/WebhookChannel.ts
  - devhub/src/main/services/notification/channels/DesktopBellChannel.ts
  - devhub/src/main/services/notification/NotificationService.test.ts
  - devhub/src/renderer/components/notify/ToastHost.tsx
  - devhub/src/renderer/components/notify/NotificationCenter.tsx
modified_files:
  - devhub/src/main/index.ts  # 注入单例
  - devhub/src/main/ipc/notifyHandlers.ts  # 新建
  - devhub/src/renderer/App.tsx  # ToastHost 挂载
glob_anchors:
  - devhub/src/shared/schemas/notification.ts  # spec-33 SoT
```

---

## 3. data_contracts

```typescript
// 复用 master §3.7 + R8.C PRD §3.7
import { z } from 'zod'

export const NotificationLevelSchema = z.enum(['INFO','WARN','ERROR','FATAL'])
export const NotificationChannelSchema = z.enum(['toast','os-notification','statusbar','email','webhook','desktop-bell'])

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  level: NotificationLevelSchema,
  ts: z.number().int(),
  source: z.enum(['ai-task','csv-batch','watchdog','inject','system']),
  instanceId: z.string().optional(),
  title: z.string().max(120),
  body: z.string().max(2000),
  channels: z.array(NotificationChannelSchema),
  aggregationKey: z.string(),
  signalContributions: z.record(z.string(), z.number()).optional(),
  actions: z.array(z.object({
  label: z.string(),
  actionId: z.string(),
  })).max(3),
})

export const NotificationAggregationConfigSchema = z.object({
  windowMs: z.number().int().min(5000).max(600000).default(60000),
  perLevel: z.record(NotificationLevelSchema, z.number().int().min(5000).max(600000)).optional(),
})

export const ChannelConfigSchema = z.object({
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
  minLevel: NotificationLevelSchema,
  rateLimitPerMinute: z.number().int().min(1).max(60),
  smtpConfig: z.object({  // email 通道
  host: z.string(),
  port: z.number().int(),
  user: z.string(),
  requireTls: z.boolean(),
  }).optional(),
  webhookConfig: z.object({  // webhook
  url: z.string().url(),
  method: z.enum(['POST']).default('POST'),
  headers: z.record(z.string(), z.string()),
  }).optional(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  notify:emit:  # 内部 main-side 调用为主
  req: NotificationSchema
  resp: { id: string, suppressed: boolean }
  notify:list:
  req: { since?: number, level?: NotificationLevel }
  resp: Notification[]
  notify:dismiss:
  req: { id: string }
  resp: { success: boolean }
  notify:configure-aggregation:
  req: NotificationAggregationConfig
  resp: { success: boolean }
  notify:configure-channel:
  req: ChannelConfig
  resp: { success: boolean }
  notify:stream:
  direction: main->renderer
  payload: Notification
  rate_limit_class: medium_query
  notify:invoke-action:
  req: { id: string, actionId: string }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| email 无 SMTP 配置 | E_VALIDATION |
| webhook URL 非 HTTPS | E_VALIDATION |
| channel rateLimit 命中 | E_RATE_LIMITED（suppressed=true 但仍写 list） |
| 通知 body 超长 | (自动截断 + ...) |
| os-notification API 失败 | (退化到 toast) |
| webhook 网络失败 | E_TIMEOUT（重试 3 次后丢弃） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (4 级 6 通道):
  given: 任意 source emit ERROR 级
  when: notify:emit
  then:
  - 至少 toast + statusbar 两通道触发
  - email/webhook 仅在用户启用时触发

GWT-2 (聚合 60s):
  given: 同 instanceId 同 level 60s 内 5 条
  when: aggregator
  then:
  - notify:list 仅 1 条；body 含"5 occurrences"
  - aggregationKey 命中

GWT-3 (用户调窗):
  given: user 设 windowMs=120000
  when: notify:configure-aggregation
  then: 立即生效；audit log

GWT-4 (FATAL 不聚合):
  given: 任意 FATAL
  when: emit
  then: 立即推送（不入聚合窗口）；desktop-bell 触发

GWT-5 (action 回调):
  given: 通知含 actions=['restart','dismiss']
  when: 用户点 restart → notify:invoke-action
  then: 调用 actionId 注册的 handler；通知标 dismissed
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-2 aggregation 60s', async ({ page, electronApp }) => {
  for (let i = 0; i < 5; i++) {
  await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.emit('test:emit-notification', { level: 'ERROR', source: 'ai-task', instanceId: 'x', title: 'fail', body: 'oops' })
  })
  }
  const list = await page.evaluate(() => window.electronAPI.notify.list({ level: 'ERROR' }))
  const aggregated = list.filter((n: any) => n.body.includes('5 occurrences'))
  expect(aggregated.length).toBe(1)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'electron@33':  Notification + ipcMain
  - 'nodemailer@6.9':  email
  - 'undici@6.x':  webhook (replace axios)
  - 'sound-play@1.1':  desktop-bell
  - 'lodash.debounce@4':  聚合
inspirations:
  - macOS Notification Center
  - Slack notification dedup
  - PagerDuty incident grouping
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~1100
modified_loc: ~150
test_loc: ~500
total: ~1750
risk_areas:
  - email/webhook 隐私（默认 OFF）
  - 聚合内存（高频时 key 数量爆炸）
  - 跨 OS notification API 兼容
```

---

## 10. implement_checklist

- [x] 6 通道独立类，各自 rateLimit
- [x] 聚合 windowMs 默认 60s（master §7.4）
- [x] perLevel 可独立设（FATAL 默认不聚合）
- [x] aggregationKey = sha256(level + source + instanceId)
- [x] email/webhook 默认 OFF；启用需用户主动配置
- [x] webhook URL 必 HTTPS
- [x] body 自动截断 2000
- [x] notify:stream 100ms throttle
- [x] vitest + renderer integration tests cover 5 GWT; Playwright draft retained in §7
- [x] feature flag R8.C.notify.system 默认 ON
- [x] audit log: 配置变更全部记录

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-33: NotificationSchema SoT
  - R8.C.spec-31: rate-limit token bucket
downstream:
  - R8.C.spec-29: 反馈循环可触发通知
  - R8.C.spec-32: 观测面板显示通知历史
  - R8.C.spec-16/17: watchdog 故障 → FATAL 通知
```

---

## 12. fallback_strategy

```yaml
on_email_smtp_fail:
  - 标 channel suspended + 通知用户 + 改写 toast
on_webhook_repeated_fail:
  - 5 次连续失败 → 自动停用 + audit
on_os_api_unavailable:
  - 退化 toast
flag_off_behavior:
  - R8.C.notify.system=OFF 时 emit 仅 console.warn（不显示 UI）
```

---

## 13. performance_budget

```yaml
notify_render_ms: { warn: 50, fatal: 200 }
aggregation_evaluate_p99_ms: { warn: 30, fatal: 200 }
default_aggregation_window_ms: 60000
max_active_aggregations: { warn: 1000, fatal: 10000 }
ipc_channel: notify:stream → spec-31 medium_query 60 RPM
```

---

## 14. implementation_status_2026-05-05

```yaml
status: implemented_verified
implementation_scope:
  shared_schema:
  - devhub/src/shared/schemas/notification.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  main_services:
  - devhub/src/main/services/notification/NotificationService.ts
  - devhub/src/main/services/notification/NotificationAggregator.ts
  - devhub/src/main/services/notification/channels/ToastChannel.ts
  - devhub/src/main/services/notification/channels/OsNotificationChannel.ts
  - devhub/src/main/services/notification/channels/StatusbarChannel.ts
  - devhub/src/main/services/notification/channels/EmailChannel.ts
  - devhub/src/main/services/notification/channels/WebhookChannel.ts
  - devhub/src/main/services/notification/channels/DesktopBellChannel.ts
  bridge_and_ui:
  - devhub/src/main/services/NotificationService.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/components/notify/ToastHost.tsx
  - devhub/src/renderer/components/notify/NotificationCenter.tsx
privacy_defaults:
  email: off
  webhook: off
external_delivery:
  email: nodemailer real SMTP transport when explicitly configured
  webhook: real HTTPS POST with timeout and three retries
  sms_or_im: not integrated by design
verification_snapshot:
  full_vitest: 85 files / 614 tests passed with --maxWorkers=1
  lint_no_emoji: passed, No emoji found in 415 files
  typecheck: passed
  license: passed, 422 production package entries validated
```

### Implementation Notes

- `NotificationSchema` is now a shared Zod SoT with uppercase `INFO/WARN/ERROR/FATAL`, 6 explicit channels, max body length 2000, max 3 actions, UUID ids, and per-notification `occurrenceCount` / `dismissedAt` state.
- `UnifiedNotificationService` is the main entrypoint. Legacy `NotificationService.notify(...)` now forwards into the unified system while preserving existing in-memory legacy history and click metadata behavior.
- The aggregator is synchronous and deterministic: same `level + source + instanceId` within the configured window updates one existing list item and rewrites the body with `N occurrences`; FATAL bypasses aggregation.
- Email and webhook channels are real but privacy-off by default. Enabling email requires SMTP config; enabling webhook requires HTTPS. Repeated webhook failure or email transport validation failure suspends the channel and audits `notify:channel-suspended`.
- Native OS notifications check `Notification.isSupported()` and fall back to toast when unavailable; renderer desktop-bell uses a real short Web Audio tone from the `notify:desktop-bell` stream.
- IPC/preload now expose `notify:emit`, `notify:list`, `notify:dismiss`, `notify:configure-aggregation`, `notify:configure-channel`, `notify:invoke-action`, plus `notify:stream`, `notify:statusbar`, and `notify:desktop-bell` renderer listeners.
- `scripts/check-license.mjs` now recognizes `MIT-0` as an allowed permissive license to admit `nodemailer` while preserving the existing forbidden package list and EPL manifest exception flow.

### Completion Boundary

- Completed: 4 levels, 6 independent channels, default 60s aggregation, user aggregation configuration, FATAL no-aggregation desktop bell, action callback dispatch, channel rate limits, HTTPS webhook validation, body truncation, 100ms stream throttle, default-on feature flag, audit on config/emit/dismiss/suspension, renderer toast host, renderer notification center, IPC/preload contract sync, and strict type/test coverage.
- Not added by design: SMS/IM services, remote telemetry, default email/webhook activation, and external notification provider credentials.
