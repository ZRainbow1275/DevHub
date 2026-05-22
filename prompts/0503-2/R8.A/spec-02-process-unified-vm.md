# R8.A spec-02 — ProcessUnifiedViewModel（Light + Deep + 错误降级）

> **batch**: R8.A | **rank**: #2
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-4.A.2 / V1-Q-4.A.3 / V1-Q-4.B.* + V2-Q-13.I + refs/source-snapshot-v2.md (维度 2)
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-01

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: V1-Q-4.A.2
  raw: "C + D 混合（默认轻，进阶按钮取深，但 viewmodel 已分层）"
  impact: 一份 ViewModel 同时含 light + deep 字段；render time 决定取哪层
  - source: V1-Q-4.A.3
  raw: "全部全选，必须全部做到，这才是能让产品产生差异的东西"
  impact: 详情字段完整性硬约束（基础 + 进阶 + 安全/权限三大组）
  - source: V1-Q-4.B.1
  raw: "B + D（顶部横幅 + 24 小时记忆）"
  impact: 权限不足时统一 UI 路径
  - source: V1-Q-4.B.2
  raw: "B（单次 spawn 提权子进程）"
  impact: 取深字段 fallback 单次 UAC（spec-03 实施）
  - source: V2-Q-13.I.4
  raw: 用户感知拥挤；4 视图必须分层
  impact: ViewModel 为 4 视图（卡片/列表/树/treemap）提供统一字段集
  - source: refs/source-snapshot-v2.md 维度 2
  raw: "Card 走 ProcessRelationship；List 走 ProcessDeepDetail；数据来源不同"
  impact: 必须合并为单 ViewModel
```

### 1.2 工程背景

- ProcessDetailPanel 与 ProcessDetailDrawer 当前走两套 IPC（ProcessRelationship vs ProcessDeepDetail），字段差导致 P1（卡片/列表权限不一致）。
- master §7.1 的 ProcessUnifiedViewModelSchema 是横切契约，本 spec 落地之。
- 所有进程相关 spec（04/05/10）以本 ViewModel 为唯一源。

### 1.3 为什么放在 #2

是 process 链上 Card/List/UAC 三个 spec 的公共数据契约，必须先定 schema 才能往下走。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/shared/viewmodels/ProcessUnifiedViewModel.ts
  op: CREATE
  detail: 主 schema + 类型导出（master §7.1 落地）
  - path: devhub/src/shared/viewmodels/index.ts
  op: CREATE
  - path: devhub/src/main/services/process/ProcessViewModelService.ts
  op: CREATE
  detail: 组装 light/deep；调度 wmi-client / PowerShell / koffi
  - path: devhub/src/main/services/process/fields/
  op: CREATE_DIR
  detail: 字段维度的 collector
  - path: devhub/src/main/services/process/fields/BasicFieldsCollector.ts
  op: CREATE
  - path: devhub/src/main/services/process/fields/AdvancedFieldsCollector.ts
  op: CREATE
  - path: devhub/src/main/services/process/fields/SecurityFieldsCollector.ts
  op: CREATE
  - path: devhub/src/main/services/process/fields/CollectorOrchestrator.ts
  op: CREATE
  detail: 并行调度 + 超时 + 降级
  - path: devhub/src/main/ipc/processHandlers.ts
  op: MODIFY
  detail: 新增 process:vm:get-light / process:vm:get-deep / process:vm:subscribe
  - path: devhub/src/renderer/hooks/useProcessViewModel.ts
  op: CREATE
  detail: 渲染端 hook，按 mode (light|deep) 取数
  - path: devhub/src/renderer/components/monitor/ProcessDetailPanel.tsx
  lines: "168 / 314-346 / 674-733"
  op: MODIFY
  detail: relationship 改为 viewmodel.relationships；去 fallback
  - path: devhub/src/renderer/components/monitor/ProcessDetailDrawer.tsx
  op: MODIFY
  detail: 改用同一 useProcessViewModel
  - path: devhub/src/renderer/components/monitor/ProcessView.tsx
  op: MODIFY
  detail: 卡片/列表共用 ViewModel
```

---

## 3. data_contracts

### 3.1 ProcessUnifiedViewModel

```typescript
import { z } from 'zod';

export const integrityLevelSchema = z.enum(['Low','Medium','High','System','Untrusted','AppContainer','Unknown']);
export const fieldSourceSchema = z.enum(['wmi','powershell','koffi','etw','cache','degraded']);
export const fieldErrorCodeSchema = z.enum([
  'OK',
  'PERMISSION_DENIED',
  'WMI_TIMEOUT',
  'POWERSHELL_TIMEOUT',
  'KOFFI_CALL_FAILED',
  'PROCESS_GONE',
  'NOT_IMPLEMENTED',
  'NO_DATA',
]);

export const fieldEnvelopeSchema = <T extends z.ZodTypeAny>(inner: T) => z.object({
  value: inner.nullable(),
  source: fieldSourceSchema,
  error_code: fieldErrorCodeSchema,
  fetched_at: z.string().datetime(),
  cache_ttl_ms: z.number().int().nonnegative().default(0),
  requires_elevation: z.boolean().default(false),
});

export const processBasicFieldsSchema = z.object({
  pid: z.number().int().positive(),
  ppid: z.number().int().nonnegative().nullable(),
  name: z.string(),
  exe_path: fieldEnvelopeSchema(z.string()),
  cmdline: fieldEnvelopeSchema(z.string()),
  cwd: fieldEnvelopeSchema(z.string()),
  start_time: fieldEnvelopeSchema(z.string().datetime()),
  uptime_ms: z.number().int().nonnegative(),
  user: fieldEnvelopeSchema(z.string()),
  sid: fieldEnvelopeSchema(z.string()),
  cpu_percent: z.number().min(0).max(100),
  rss_bytes: z.number().int().nonnegative(),
  ws_bytes: z.number().int().nonnegative(),
  handle_count: fieldEnvelopeSchema(z.number().int().nonnegative()),
  thread_count: fieldEnvelopeSchema(z.number().int().nonnegative()),
});

export const processAdvancedFieldsSchema = z.object({
  modules: fieldEnvelopeSchema(z.array(z.object({
  name: z.string(), path: z.string(), base_address: z.string(), size: z.number().int(),
  }))),
  open_handles: fieldEnvelopeSchema(z.array(z.object({
  type: z.string(), path: z.string().nullable(), handle: z.string(),
  }))),
  network_connections: fieldEnvelopeSchema(z.array(z.object({
  proto: z.enum(['TCP','UDP']),
  local: z.object({ ip: z.string(), port: z.number().int() }),
  remote: z.object({ ip: z.string(), port: z.number().int() }).nullable(),
  state: z.string(),
  }))),
  registry_keys_open: fieldEnvelopeSchema(z.number().int().nonnegative()),
  env_vars: fieldEnvelopeSchema(z.record(z.string(), z.string())),
  process_tree: fieldEnvelopeSchema(z.object({
  parents: z.array(z.number().int()),
  children: z.array(z.number().int()),
  siblings: z.array(z.number().int()),
  })),
  digital_signature: fieldEnvelopeSchema(z.object({
  signed: z.boolean(),
  issuer: z.string().nullable(),
  valid: z.boolean(),
  timestamp: z.string().datetime().nullable(),
  })),
  service_association: fieldEnvelopeSchema(z.array(z.object({
  name: z.string(), display_name: z.string(), state: z.string(),
  }))),
  appcontainer: fieldEnvelopeSchema(z.object({
  is_appcontainer: z.boolean(),
  package_full_name: z.string().nullable(),
  })),
  uac_level: fieldEnvelopeSchema(z.string()),
  wmi_extras: fieldEnvelopeSchema(z.object({
  creation_class_name: z.string().nullable(),
  caption: z.string().nullable(),
  wmi_command_line: z.string().nullable(),
  })),
  gpu_usage: fieldEnvelopeSchema(z.object({
  percent: z.number().min(0).max(100),
  vram_bytes: z.number().int().nonnegative(),
  adapter: z.string().nullable(),
  })),
});

export const processSecurityFieldsSchema = z.object({
  integrity_level: fieldEnvelopeSchema(integrityLevelSchema),
  token_user: fieldEnvelopeSchema(z.object({
  name: z.string(),
  sid: z.string(),
  groups: z.array(z.string()),
  })),
  is_elevated: fieldEnvelopeSchema(z.boolean()),
  dep_enabled: fieldEnvelopeSchema(z.boolean()),
  aslr_enabled: fieldEnvelopeSchema(z.boolean()),
});

export const processRelationshipsSchema = z.object({
  ports: z.array(z.object({ port: z.number().int(), proto: z.string(), state: z.string() })),
  windows: z.array(z.object({ hwnd: z.string(), title: z.string() })),
  child_processes: z.array(z.object({ pid: z.number().int(), name: z.string() })),
  parent: z.object({ pid: z.number().int(), name: z.string() }).nullable(),
  ai_task_id: z.string().nullable(),
});

export const processUnifiedViewModelSchema = z.object({
  schema_version: z.literal('1.0'),
  pid: z.number().int().positive(),
  fetched_at: z.string().datetime(),
  mode: z.enum(['light','deep']),
  is_ai_tool: z.boolean().default(false),
  basic: processBasicFieldsSchema,
  advanced: processAdvancedFieldsSchema.optional(),
  security: processSecurityFieldsSchema.optional(),
  relationships: processRelationshipsSchema,
  permission_summary: z.object({
  overall_status: z.enum(['full','partial','denied']),
  missing_fields: z.array(z.string()),
  next_required_action: z.enum(['none','elevate_for_field','elevate_full']),
  last_elevation_at: z.string().datetime().nullable(),
  }),
  user_tags: z.array(z.string()).default([]),
});

export type ProcessUnifiedViewModel = z.infer<typeof processUnifiedViewModelSchema>;
```

### 3.2 collector contract

```typescript
export interface FieldCollector<T> {
  readonly name: string;
  readonly required_elevation: boolean;
  readonly timeout_ms: number;
  collect(pid: number, opts: { signal: AbortSignal }): Promise<{
  value: T | null;
  source: 'wmi'|'powershell'|'koffi'|'etw'|'cache'|'degraded';
  error_code: 'OK'|'PERMISSION_DENIED'|'WMI_TIMEOUT'|'POWERSHELL_TIMEOUT'|'KOFFI_CALL_FAILED'|'PROCESS_GONE'|'NOT_IMPLEMENTED'|'NO_DATA';
  }>;
}
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: process:vm:get-light
  direction: renderer -> main
  request_schema: z.object({ pid: z.number().int().positive() })
  response_schema: processUnifiedViewModelSchema
  p95_target_ms: 200
  - name: process:vm:get-deep
  direction: renderer -> main
  request_schema: z.object({ pid: z.number().int().positive(), allow_elevate: z.boolean().default(false) })
  response_schema: processUnifiedViewModelSchema
  p95_target_ms: 1500
  requires_audit: true
  - name: process:vm:subscribe
  direction: renderer -> main (event stream)
  request_schema: z.object({ pid: z.number().int().positive(), interval_ms: z.number().int().min(500).max(10000).default(2000) })
  response_schema: processUnifiedViewModelSchema  # repeated push
  - name: process:vm:unsubscribe
  request_schema: z.object({ subscription_id: z.string() })
deprecated_channels:
  - name: process:get-relationship
  replaced_by: process:vm:get-light
  - name: process:get-deep-detail
  replaced_by: process:vm:get-deep
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| pid 不存在或已退出 | PROCESS_GONE | toast + close detail | client refresh list |
| wmi-client 超时 | WMI_TIMEOUT | field-level "数据不全" 标记 | fallback PowerShell；最多重试 1 次 |
| PowerShell 超时 | POWERSHELL_TIMEOUT | 同上 | degrade: source='degraded' |
| 字段需提权且 allow_elevate=false | PERMISSION_DENIED | 顶部横幅 + 提权按钮（spec-04） | 仅展示 light 字段 |
| koffi 调用崩溃 | KOFFI_CALL_FAILED | 仅该字段 envelope 报错 | 不影响其他字段 |
| 全部 collector 失败 | NO_DATA | drawer 空态 | 提供"重试"按钮 |
| schema 校验失败 | R8A_VM_SCHEMA_INVALID | dev: console error；prod: ignore + audit | 启动期跑 vitest 阻断 |

---

## 6. acceptance_gwt

```gherkin
Feature: ProcessUnifiedViewModel

Scenario A1: light 模式 200ms 内返回
  Given 普通用户进程 pid=8812 存在
  When 调用 process:vm:get-light { pid: 8812 }
  Then 响应在 200ms 内返回
  And basic 字段全有值
  And advanced 字段为 undefined（light 模式不加载）
  And permission_summary.overall_status = 'full' 或 'partial'

Scenario A2: deep 模式无提权时降级
  Given 系统进程 pid=4 (System) 不可读
  When 调用 process:vm:get-deep { pid: 4, allow_elevate: false }
  Then 响应正常返回
  And permission_summary.overall_status = 'partial' 或 'denied'
  And missing_fields 包含 'cmdline'
  And next_required_action = 'elevate_for_field'

Scenario A3: deep 模式提权 + 24h 记忆
  Given 用户 5 分钟前已 UAC 同意 'pid=4' 字段类
  When 调用 process:vm:get-deep { pid: 4, allow_elevate: true }
  Then 不再次弹 UAC
  And 字段从 cache_or_elevated 路径返回
  And source = 'powershell' 或 'koffi'

Scenario A4: 卡片与列表字段一致 (ASSERT_PROCESS_FIELD_PARITY)
  Given 同一 pid=8812
  When 卡片视图与列表视图各自调用 process:vm:get-light
  Then 两次响应的 JSON 字段集合（以 schema key 计）完全相同
  And basic.cpu_percent / rss_bytes 在 1s 内偏差 < 5%

Scenario A5: 订阅推流在进程退出时清理
  Given 已订阅 pid=8812
  When 进程退出
  Then main 推送一次 last update with PROCESS_GONE
  And 主动取消该 subscription_id
  And 渲染端 hook 清理 useEffect

Scenario A6: schema 校验失败启动期 fail-fast
  Given mock collector 返回非法 schema
  When 启动期单测 vitest run viewmodels
  Then 进程退出码 != 0
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-02-process-vm.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('card and list show identical fields for same pid', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=进程');
  await win.click('button:has-text("卡片")');
  await win.click('[data-pid="8812"]');
  const cardFields = await win.locator('[data-vm-field]').evaluateAll((nodes) =>
  nodes.map((n) => n.getAttribute('data-vm-field')).sort()
  );
  await win.keyboard.press('Escape');
  await win.click('button:has-text("列表")');
  await win.click('[data-pid-row="8812"]');
  const listFields = await win.locator('[data-vm-field]').evaluateAll((nodes) =>
  nodes.map((n) => n.getAttribute('data-vm-field')).sort()
  );
  expect(listFields).toEqual(cardFields);
  await app.close();
});

test('deep mode without elevation degrades gracefully', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  const vm = await win.evaluate(async () =>
  window.devhub.process.getDeep({ pid: 4, allow_elevate: false })
  );
  expect(['partial','denied']).toContain(vm.permission_summary.overall_status);
  expect(vm.permission_summary.missing_fields.length).toBeGreaterThan(0);
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| Layered ViewModel | https://learn.microsoft.com/en-us/dotnet/architecture/microservices/multi-container-microservice-net-applications/data-driven-crud-microservice |
| Process info on Windows | https://learn.microsoft.com/en-us/windows/win32/wmisdk/wmi-tasks-processes |
| Token integrity level | https://learn.microsoft.com/en-us/windows/win32/secauthz/mandatory-integrity-control |
| Field-level error envelopes | "errors are values" pattern |
| zod schema versioning | https://zod.dev/?id=branding |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 1800
breakdown:
  schema: 280
  ProcessViewModelService: 320
  BasicFieldsCollector: 180
  AdvancedFieldsCollector: 360
  SecurityFieldsCollector: 220
  CollectorOrchestrator: 220
  IPC handlers: 150
  useProcessViewModel hook: 120
  ProcessDetailPanel + ProcessDetailDrawer 改造: 150
files_touched: ~13
risk_radius:
  - process:get-relationship 现有 callers 全部迁移
  - 取深字段并发调度（最多 3 个 collector 并发）需控制 CPU
  - permission_summary 必须与 spec-04 UI 对齐
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 创建 src/shared/viewmodels/ProcessUnifiedViewModel.ts + Zod schema
  - step_02: 写 vitest 单测覆盖 schema（valid + invalid 各 5 例）
  - step_03: 创建 BasicFieldsCollector（wmi-client 主路径 + powershell fallback）
  - step_04: 创建 AdvancedFieldsCollector（按字段切 collector，super-class 管 timeout）
  - step_05: 创建 SecurityFieldsCollector（koffi GetTokenInformation 主路径）
  - step_06: 创建 CollectorOrchestrator（Promise.allSettled + 超时 + 降级标记）
  - step_07: 注册 IPC channels（new + deprecated 别名兼容 1 release）
  - step_08: ProcessDetailPanel/Drawer 切到新 hook
  - step_09: ProcessView 提供 view-mode 切换；两侧用同 hook
  - step_10: 取消 process:get-relationship 内部调用，仅保留兼容 alias
  - step_11: 写 e2e（§7）
verify:
  - pnpm typecheck
  - pnpm test --filter viewmodels
  - pnpm e2e --grep "spec-02"
  - 对照 ASSERT_PROCESS_FIELD_PARITY 通过
```

---

## 11. dependencies

```yaml
blocks:
  - spec-03-process-uac-elevation.md
  - spec-04-process-card-list-parity.md
  - spec-05-topology-discoverability.md
  - spec-10-audit-log.md
blocked_by:
  - spec-01-integration-libs.md
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "wmi-client 不可用"
  action: "Orchestrator 标记 source='powershell'；性能指标降级"
  - cause: "PowerShell 也超时"
  action: "envelope.value=null + source='degraded'；UI 显示空态"
  - cause: "deep 模式高负载"
  action: "Orchestrator 限流：同一 pid 1s 内最多 1 次 deep"
  - cause: "schema 演进"
  action: "schema_version 字段 + main side dual-write old/new；客户端按 version 选 parser"
```

---

## 13. performance_budget

```yaml
budgets:
  light_mode_p50: 80ms
  light_mode_p95: 200ms
  deep_mode_p50: 600ms
  deep_mode_p95: 1500ms
  subscribe_min_interval_ms: 500
  cpu_overhead_per_subscription_idle: < 0.5%
  rss_per_subscription: < 1MB
  collector_timeout_basic: 200ms
  collector_timeout_advanced: 800ms
  collector_timeout_security: 600ms
verification:
  - vitest microbench
  - Playwright trace 量 p50/p95
```
