# R8.A spec-03 — UAC 单次提权 spawn 子进程模型

> **batch**: R8.A | **rank**: #3
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-4.B.1/B.2/B.3 + V1-Q-9.A.* + V2-Q-13.I.3 + master §7.3
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-01, spec-02

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: V1-Q-4.B.1
  raw: "B + D（顶部横幅 + 24 小时记忆）"
  impact: 提权 UI = 顶部横幅；24h 内不再次弹（按 EXE+字段类别 hash）
  - source: V1-Q-4.B.2
  raw: "B（单次 spawn 提权子进程）"
  impact: 主进程保持普通用户；仅深度查询时 spawn UAC 子进程
  - source: V1-Q-4.B.3
  raw: "全部勾选"
  impact: 系统进程 cmdline / 其他用户内存 / 服务 handle / System Integrity / WMI ParentProcessId 等全部纳入"需提权字段"集
  - source: V1-Q-9.A.* + master §10
  raw: "审计 vs 遥测严格分离 / 零外发"
  impact: 提权事件必须落审计日志；不上报任何外网
```

### 1.2 工程背景

- 现有 AdminRelaunch.ts 仅支持"重启 DevHub 为管理员"（粗暴）。
- 用户选 B：单次 spawn UAC 子进程 + 主进程保持普通用户。
- spec-02 中 ProcessViewModel.permission_summary.next_required_action 触发本 spec UI。
- 子进程 cmdline 严格隔离：仅承载受限的查询动作，禁止任意命令。

### 1.3 为什么放在 #3

是 ProcessUnifiedViewModel 的"取深"补全器；spec-04 UI 横幅依赖本 spec 提供的 elevate 接口。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/main/services/elevation/AdminRelaunch.ts
  op: KEEP
  detail: 不删，作为"全程提权"路径并行存在
  - path: devhub/src/main/services/elevation/SingleShotElevation.ts
  op: CREATE
  detail: 单次 spawn UAC 子进程；调用 SudoSpawn adapter
  - path: devhub/src/main/services/elevation/ElevationCache.ts
  op: CREATE
  detail: 24h 记忆；按 sha256(exe_path + field_category) 索引
  - path: devhub/src/main/services/elevation/ElevationAuditLogger.ts
  op: CREATE
  detail: 写入审计日志（spec-10 落地写入）
  - path: devhub/src/main/services/elevation/elevated-worker/
  op: CREATE_DIR
  detail: 提权后被 spawn 的 worker 入口；仅接受 STDIN 命令
  - path: devhub/src/main/services/elevation/elevated-worker/index.js
  op: CREATE
  detail: bundled 单文件；接受 JSON-RPC over STDIN，仅暴露 PROCESS_FIELDS 白名单动作
  - path: devhub/src/main/ipc/elevationHandlers.ts
  op: CREATE
  detail: elevation:request / elevation:status / elevation:revoke
  - path: devhub/src/renderer/components/elevation/ElevationBanner.tsx
  op: CREATE
  detail: 顶部横幅；spec-04 嵌入
  - path: devhub/src/renderer/components/elevation/ElevationConfirmDialog.tsx
  op: CREATE
  detail: 弹窗确认；spec-11 复用
  - path: devhub/src/renderer/hooks/useElevation.ts
  op: CREATE
  - path: devhub/src/main/services/integrations/SudoSpawn.ts
  op: USE
  detail: spec-01 已建；本 spec 调用
```

---

## 3. data_contracts

### 3.1 schema

```typescript
import { z } from 'zod';

export const fieldCategorySchema = z.enum([
  'system_process_cmdline',
  'other_user_memory',
  'service_handles',
  'system_integrity_full',
  'wmi_parent_pid',
  'token_information',
  'open_handles_full',
  'modules_full',
  'env_vars_other_user',
]);

export const elevationRequestSchema = z.object({
  reason: z.string().min(8).max(280),
  field_categories: z.array(fieldCategorySchema).min(1),
  target_pid: z.number().int().positive(),
  ttl_ms: z.number().int().min(60_000).max(86_400_000).default(86_400_000),
  user_initiated: z.boolean(),
});

export const elevationGrantSchema = z.object({
  grant_id: z.string().uuid(),
  granted_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  field_categories: z.array(fieldCategorySchema),
  exe_path: z.string(),
  cache_key: z.string().regex(/^[a-f0-9]{64}$/),
  worker_pid: z.number().int().positive(),
  audit_id: z.string().uuid(),
});

export const elevationStatusSchema = z.object({
  active_grants: z.array(elevationGrantSchema),
  recent_denials: z.array(z.object({
  requested_at: z.string().datetime(),
  field_categories: z.array(fieldCategorySchema),
  reason: z.string(),
  })),
});

export type ElevationRequest = z.infer<typeof elevationRequestSchema>;
export type ElevationGrant = z.infer<typeof elevationGrantSchema>;

// cache_key 计算
export function computeCacheKey(exe_path: string, field_category: string): string {
  // sha256(exe_path + ':' + field_category)
  // 不含 hostname / pid / cmdline，避免误命中
  return /* sha256 hex */ '' as string;
}
```

### 3.2 elevated-worker JSON-RPC 协议

```yaml
inbound (renderer -> main -> worker via stdin):
  - method: 'process.cmdline'
  params: { pid: number }
  returns: { value: string | null }
  - method: 'process.modules.full'
  params: { pid: number }
  - method: 'process.handles.full'
  params: { pid: number }
  - method: 'process.token-info'
  params: { pid: number }
  - method: 'process.env-vars'
  params: { pid: number }
  - method: 'shutdown'
  params: {}

forbidden_methods:
  - "execute arbitrary command"
  - "fs read outside whitelist paths"
  - "registry write"
  - "service start/stop"
  - "kill"
```

### 3.3 ElevationCache 24h 记忆

```typescript
interface ElevationCacheEntry {
  cache_key: string;  // sha256(exe + category)
  granted_at: string;
  expires_at: string;  // = granted_at + 24h
  granted_categories: ReadonlyArray<string>;
}
// store 在 electron-store；启动时清理过期
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: elevation:request
  direction: renderer -> main
  request_schema: elevationRequestSchema
  response_schema: z.object({
  ok: z.boolean(),
  grant: elevationGrantSchema.nullable(),
  error_code: z.enum(['UAC_CANCELLED','UAC_DENIED','SPAWN_FAILED','OK']).default('OK'),
  })
  requires_audit: true
  - name: elevation:status
  direction: renderer -> main
  request_schema: z.object({})
  response_schema: elevationStatusSchema
  - name: elevation:revoke
  direction: renderer -> main
  request_schema: z.object({ grant_id: z.string().uuid() })
  response_schema: z.object({ ok: z.boolean() })
  requires_audit: true
  - name: elevation:execute
  direction: main internal (not exposed to renderer)
  detail: ProcessViewModelService 通过此内部 API 让 elevated-worker 执行白名单动作
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| UAC 弹窗用户取消 | UAC_CANCELLED | banner: "已取消提权，可再次尝试" | 不重试 |
| UAC 弹窗被策略拒绝 | UAC_DENIED | banner + 引导用户调整 GPO | 仅提示 |
| sudo-prompt spawn 失败 | SPAWN_FAILED | banner red + 详细日志按钮 | fallback: 引导 AdminRelaunch |
| worker 启动后崩溃 | WORKER_CRASHED | banner + 自动重启 1 次 | 1 次重启失败后回退 |
| worker 超时 (>10s) | WORKER_TIMEOUT | toast | 中止该次取数；不回收 grant |
| cache_key 命中但已过期 | GRANT_EXPIRED | 透明：再次走 elevation:request | — |
| field_categories 不在白名单 | INVALID_CATEGORY | dev: 抛错 | 启动期 vitest |
| 同一 grant 被并发请求 >5 | THROTTLED | toast | 1s 内最多 5 次 |

---

## 6. acceptance_gwt

```gherkin
Feature: 单次 UAC spawn 提权

Scenario A1: 首次取系统进程 cmdline 触发 UAC
  Given pid=4 (System) 不可读
  And ElevationCache 中无对应 cache_key
  When 用户点详情面板顶部 "提升权限以查看完整信息"
  Then 弹 ElevationConfirmDialog
  And 用户点"是"
  Then 调用 elevation:request { field_categories: ['system_process_cmdline'], target_pid: 4 }
  And UAC 弹窗显示
  Then 用户同意后返回 grant
  And 24h 内同 EXE 同 category 不再弹 UAC

Scenario A2: 24h 记忆命中
  Given ElevationCache 中存在未过期 cache_key (exe='svchost.exe', cat='system_process_cmdline')
  When 调用 elevation:request 同 cache_key
  Then 不弹 UAC
  And 直接返回该 grant
  And audit 仍记录该次"实际取数"事件

Scenario A3: UAC 取消
  Given 弹 UAC
  When 用户点"否"
  Then elevation:request 返回 { ok: false, error_code: 'UAC_CANCELLED' }
  And ProcessUnifiedViewModel.permission_summary 保持 'partial'
  And 顶部横幅文案变为 "已取消提权"
  And audit 记录 cancel 事件

Scenario A4: worker 不接受任意命令
  Given elevated-worker 已启动
  When main 进程通过 STDIN 发送 method='execute' params={cmd:'rm -rf /'}
  Then worker 立即拒绝并退出 (exit code 65)
  And audit 记录 INVALID_CATEGORY

Scenario A5: revoke 立即终止 worker
  Given 存在 active grant
  When 调用 elevation:revoke { grant_id }
  Then ElevationCache 移除该 cache_key
  And worker 进程被终止（SafeTaskKill）
  And status.active_grants 不再含该 grant

Scenario A6: cache_key 不含 pid/hostname
  Given 同 EXE 但 pid=A 触发授权
  When 后续 pid=B (相同 EXE) 请求
  Then 命中 cache（因 cache_key 仅 hash exe+category）
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-03-uac-elevation.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('elevation request returns grant and stays cached for 24h', async () => {
  const app = await electron.launch({ args: ['./dist/main.js', '--mock-uac=accept'] });
  const win = await app.firstWindow();
  const grant1 = await win.evaluate(async () =>
  window.devhub.elevation.request({
  reason: '查看 System cmdline',
  field_categories: ['system_process_cmdline'],
  target_pid: 4,
  user_initiated: true,
  })
  );
  expect(grant1.ok).toBe(true);
  expect(grant1.grant?.grant_id).toMatch(/^[0-9a-f-]{36}$/);
  // 第二次同 category 不再弹 UAC（mock 计数）
  const calls = await win.evaluate(async () =>
  window.devhub.testing.getUacPromptCallCount()
  );
  expect(calls).toBe(1);
  const grant2 = await win.evaluate(async () =>
  window.devhub.elevation.request({
  reason: 'again',
  field_categories: ['system_process_cmdline'],
  target_pid: 4,
  user_initiated: true,
  })
  );
  const calls2 = await win.evaluate(async () =>
  window.devhub.testing.getUacPromptCallCount()
  );
  expect(calls2).toBe(1);
  expect(grant2.ok).toBe(true);
  await app.close();
});

test('worker rejects arbitrary commands', async () => {
  const app = await electron.launch({ args: ['./dist/main.js', '--mock-uac=accept'] });
  const win = await app.firstWindow();
  const result = await win.evaluate(async () =>
  window.devhub.testing.sendRawWorkerCommand('execute', { cmd: 'rm -rf /' })
  );
  expect(result.error_code).toBe('INVALID_CATEGORY');
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| sudo-prompt API | https://github.com/jorangreef/sudo-prompt |
| Win UAC ShellExecute lpVerb='runas' | https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shellexecutea |
| JSON-RPC over stdio | https://www.jsonrpc.org/specification |
| Field-category hashing | OWASP cryptographic storage cheat sheet |
| Restricted child process | Node.js `child_process.spawn` with `windowsVerbatimArguments: false` |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 900
breakdown:
  SingleShotElevation: 200
  ElevationCache: 110
  ElevationAuditLogger: 80
  elevated-worker (bundled JS): 220
  IPC handlers: 100
  ElevationBanner UI: 90
  ElevationConfirmDialog UI: 60
  useElevation hook: 70
  schema + tests: 70
files_touched: ~12
risk_radius:
  - 与 spec-04 banner UI 必须同步
  - electron-store 读写并发竞态需测试
  - elevated-worker 二进制签名（codesigning）须在 R8.B 之前完成
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 创建 SingleShotElevation 服务 + sudo-prompt 调用
  - step_02: 创建 elevated-worker bundle（esbuild 单文件）
  - step_03: 创建 ElevationCache（electron-store 后端）
  - step_04: 注册 elevation:request / status / revoke IPC
  - step_05: 创建 ElevationBanner + ElevationConfirmDialog UI
  - step_06: useElevation hook + 状态机（idle / requesting / granted / denied）
  - step_07: ProcessViewModelService 接入 elevation:execute 内部 API
  - step_08: vitest 覆盖 cache_key 算法 + grant 过期 + 并发限流
  - step_09: e2e（§7）+ mock UAC accept/cancel 两路径
  - step_10: 与 spec-10 audit-log 接通
verify:
  - pnpm typecheck
  - pnpm test --filter elevation
  - pnpm e2e --grep "spec-03"
  - audit log 中能找到 elevation_request / grant / revoke
```

---

## 11. dependencies

```yaml
blocks:
  - spec-04-process-card-list-parity.md
  - spec-10-audit-log.md (audit 写入对接)
  - spec-11-permission-prompts.md (复用 ConfirmDialog)
blocked_by:
  - spec-01-integration-libs.md (SudoSpawn / SafeTaskKill)
  - spec-02-process-unified-vm.md (permission_summary 字段)
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "sudo-prompt 在某些 Win 版本失败"
  action: "fallback AdminRelaunch（重启全程提权），用户明确同意"
  - cause: "用户连续 3 次取消 UAC"
  action: "1 小时内不再弹 UAC banner（避免骚扰）"
  - cause: "electron-store IO 失败"
  action: "ElevationCache 内存模式；重启后丢失（接受降级）"
  - cause: "elevated-worker codesigning 不完整（dev 模式）"
  action: "Win 不弹 UAC 但抛错；dev 提示"未签名 worker，无法在生产路径使用""
```

---

## 13. performance_budget

```yaml
budgets:
  uac_prompt_to_grant_p50: 800ms
  uac_prompt_to_grant_p95: 2500ms
  cache_hit_to_first_field_p95: 350ms
  worker_start_overhead: < 600ms
  worker_idle_rss: < 25MB
  worker_idle_cpu: < 0.3%
  cache_lookup_p99: < 5ms
  max_concurrent_grants: 8
  audit_write_overhead: < 8ms
verification:
  - vitest microbench cache_key
  - Playwright trace UAC -> first field
```
