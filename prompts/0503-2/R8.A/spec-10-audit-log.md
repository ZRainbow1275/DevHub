# R8.A spec-10 — 审计日志（横切：所有破坏性 / 提权 / 注入动作）

> **batch**: R8.A | **rank**: #10
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-9.A.* + V1-Q-J.* + V2-Q-13.F + master §10 PRIVACY-ZERO-TELEMETRY
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-01

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: V1-Q-J.1 (零遥测)
  raw: "绝不收集 / 绝不连云端"
  impact: 审计仅本地 + 用户授权才导出
  - source: V1-Q-9.A.3
  raw: 审计事件全选
  impact: 至少 12 类事件落审计
  - source: V2-Q-13.F.2
  raw: 诊断包内容含最近 100 条审计
  impact: 审计 query API 必须支持 tail(N) + 时间窗
  - source: master §10
  raw: 审计 vs 遥测严格分离
  impact: AuditLogger 不复用任何 telemetry channel
  - source: 多个 spec (03 / 04 / 11 等)
  raw: requires_audit: true
  impact: 本 spec 是横切契约
```

### 1.2 工程背景

- 后端已存在 AuditLogger 雏形（参考现有代码），但缺：UI 面板 / 导出 / 关键字段过滤 / 持久化策略 / 滚动归档。
- 本 spec 落地完整审计契约 + 应用内查看面板 + 导出（脱敏 + 加密可选）。

### 1.3 为什么放在 #10

是 spec-03 / spec-04 / spec-11 共同依赖的横切组件。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/main/services/audit/AuditLogger.ts
  op: REWRITE
  detail: append-only + 滚动归档 + Zod 校验 + 关键字段脱敏
  - path: devhub/src/main/services/audit/AuditStore.ts
  op: CREATE
  detail: SQLite (better-sqlite3) 持久化；按月分表
  - path: devhub/src/main/services/audit/AuditRedactor.ts
  op: CREATE
  detail: 关键字段过滤（API_KEY/TOKEN/PASSWORD/SECRET/cmdline 中敏感参数）
  - path: devhub/src/main/services/audit/AuditExporter.ts
  op: CREATE
  detail: 导出 JSON/CSV；可选 AES-256-GCM 加密
  - path: devhub/src/shared/audit/AuditEvent.ts
  op: CREATE
  detail: schema + 事件类型枚举
  - path: devhub/src/main/ipc/auditHandlers.ts
  op: CREATE
  detail: audit:tail / audit:query / audit:export / audit:purge
  - path: devhub/src/renderer/components/audit/AuditPanel.tsx
  op: CREATE
  detail: tanstack-table + 虚拟滚动；过滤、搜索、导出按钮
  - path: devhub/src/renderer/components/audit/AuditEventRow.tsx
  op: CREATE
  - path: devhub/src/renderer/components/audit/AuditExportDialog.tsx
  op: CREATE
  - path: devhub/src/renderer/hooks/useAudit.ts
  op: CREATE
  - path: devhub/src/renderer/components/cmdk-actions/auditActions.ts
  op: CREATE
  detail: cmdk: "查看审计 / 导出审计"
  - path: devhub/src/renderer/components/statusbar/AuditBadge.tsx
  op: CREATE
  detail: 状态栏 24h 内审计事件计数
```

---

## 3. data_contracts

### 3.1 AuditEvent schema

```typescript
import { z } from 'zod';

export const auditActorSchema = z.object({
  surface: z.enum(['ui','cmdk','ipc-direct','watchdog','autoscan']),
  user: z.string().nullable(),
});

export const auditTargetSchema = z.object({
  kind: z.enum(['process','port','window','ai-task','file','setting','elevation','flag','theme','export','workflow','none']),
  id: z.string(),
  display: z.string().optional(),
});

export const auditOutcomeSchema = z.object({
  result: z.enum(['ok','denied','error','cancelled']),
  error_code: z.string().nullable(),
});

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  ts: z.string().datetime(),
  action: z.enum([
  // process
  'process_kill', 'process_suspend', 'process_resume', 'process_priority_change', 'process_affinity_change',
  'process_dump_create',
  // window
  'window_focus', 'window_close', 'window_topmost_set', 'window_send_keys', 'window_layout_apply',
  // port
  'port_release', 'port_blacklist_add', 'port_blacklist_remove',
  // ai-task
  'ai_task_start', 'ai_task_stop', 'ai_task_inject_text',
  // workflow
  'csv_workflow_start', 'csv_workflow_stop', 'watchdog_restart', 'inject_text',
  // skill
  'skill_install', 'skill_uninstall', 'skill_invoke',
  // elevation
  'elevation_request', 'elevation_grant', 'elevation_deny', 'elevation_revoke',
  // flag / setting / theme
  'flag_set', 'setting_change', 'theme_set',
  // diag
  'diagnostics_export', 'audit_export', 'audit_purge',
  ]),
  actor: auditActorSchema,
  target: auditTargetSchema,
  outcome: auditOutcomeSchema,
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  redacted_fields: z.array(z.string()).default([]),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
```

### 3.2 滚动归档策略

```yaml
storage:
  backend: better-sqlite3
  path: <userData>/audit/audit-YYYY-MM.db
  rotation: monthly
  retention_default_days: 90
  max_size_per_db_mb: 200
  on_overflow: archive_oldest_then_purge
indexing:
  primary: id
  secondary: [ts, action, target.kind, target.id]
```

### 3.3 关键字段脱敏

```typescript
const REDACT_PATTERNS: Array<{ pattern: RegExp, replace: string }> = [
  { pattern: /(API_KEY|APIKEY)=[^\s&]+/gi, replace: '$1=<redacted>' },
  { pattern: /(TOKEN|SECRET|PASSWORD|PWD)=[^\s&]+/gi, replace: '$1=<redacted>' },
  { pattern: /(Bearer\s+)[A-Za-z0-9._-]+/g, replace: '$1<redacted>' },
  { pattern: /\b[A-Za-z0-9._-]{32,}\b(?=.*key|token|secret)/gi, replace: '<redacted>' },
];
// AuditRedactor 在 append 前调用；redacted_fields 累积命中字段名
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: audit:tail
  direction: renderer -> main
  request_schema: z.object({ limit: z.number().int().min(1).max(1000).default(100) })
  response_schema: z.object({ entries: z.array(auditEventSchema) })
  - name: audit:query
  direction: renderer -> main
  request_schema: z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  action: z.string().optional(),
  target_kind: z.string().optional(),
  target_id: z.string().optional(),
  result: z.enum(['ok','denied','error','cancelled']).optional(),
  cursor: z.string().nullable().default(null),
  limit: z.number().int().min(1).max(1000).default(200),
  })
  response_schema: z.object({
  entries: z.array(auditEventSchema),
  next_cursor: z.string().nullable(),
  total_estimate: z.number().int().nonnegative(),
  })
  - name: audit:export
  direction: renderer -> main
  request_schema: z.object({
  format: z.enum(['json','csv']),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  encrypt: z.boolean().default(false),
  passphrase: z.string().optional(),
  })
  response_schema: z.object({
  file_path: z.string(),
  bytes_written: z.number().int().nonnegative(),
  encrypted: z.boolean(),
  })
  requires_audit: true
  - name: audit:purge
  direction: renderer -> main
  request_schema: z.object({ before: z.string().datetime() })
  response_schema: z.object({ rows_deleted: z.number().int().nonnegative() })
  requires_audit: true
  - name: audit:append (internal only)
  direction: main internal
  request_schema: auditEventSchema.omit({ id: true, ts: true })
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| AuditStore 写入失败 | AUDIT_WRITE_FAIL | banner.error | 短期内存 ring buffer + 重试 |
| schema 校验失败 | AUDIT_SCHEMA_INVALID | dev: console | drop event + log warning |
| 导出磁盘空间不足 | AUDIT_DISK_FULL | toast | 用户选其他路径 |
| 加密 passphrase 太短 | AUDIT_PASS_TOO_SHORT | dialog 校验 | 拒绝导出 |
| query 超时（>2s） | AUDIT_QUERY_TIMEOUT | toast | 自动收紧时间窗 |
| 滚动归档冲突 | AUDIT_ROTATION_CONFLICT | warning | 跳过本次 rotation |
| 关键字段未被脱敏（dev 检测） | AUDIT_REDACT_LEAK | dev: fail-fast | 加 pattern |

---

## 6. acceptance_gwt

```gherkin
Feature: 审计日志

Scenario A1: process_kill 必落审计
  Given 用户从 UI 杀掉 pid=8812
  When SafeTaskKill 完成
  Then audit:tail { limit: 1 } 第一条 action = 'process_kill'
  And actor.surface = 'ui'
  And target = { kind: 'process', id: '8812' }
  And outcome.result = 'ok'

Scenario A2: cmdline 中 token 自动脱敏
  Given 进程 cmdline 含 'GITHUB_TOKEN=abc123def...'
  When append 该 process 相关事件
  Then context.cmdline 中 token 替换为 '<redacted>'
  And redacted_fields 含 'cmdline'

Scenario A3: 导出 JSON 含最近 100 条
  Given 已有 200 条审计
  When 用户点导出 JSON, from=24h ago
  Then 文件 path 返回
  And 内容是 JSON array
  And 每条 schema 校验通过

Scenario A4: 加密导出
  Given encrypt=true, passphrase='strong-passphrase-12345'
  When audit:export
  Then file 第一个字节是 magic 'DHA1'（DevHub Audit v1）
  And AES-256-GCM 解密能恢复原 JSON

Scenario A5: 默认零外发
  Given 应用启动 1h
  When 用 wireshark 抓本机出向流量
  Then 审计相关无任何外网出站
  # PRIVACY-ZERO-TELEMETRY 验证

Scenario A6: 状态栏徽章计数
  Given 24h 内 audit count = 42
  Then statusbar AuditBadge 显示 "42"
  When 用户点击
  Then AuditPanel 打开

Scenario A7: 滚动归档
  Given 当前月数据库 size > 200MB
  When 写入新事件
  Then 归档至旧 db 文件
  And 新 db 创建
  And UI 不阻塞
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-10-audit-log.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('process_kill writes audit entry', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.evaluate(async () =>
  window.devhub.process.kill({ pids: [99999] }).catch(() => null)
  );
  const tail = await win.evaluate(async () => window.devhub.audit.tail({ limit: 5 }));
  const found = tail.entries.find((e: any) => e.action === 'process_kill' && e.target.id === '99999');
  expect(found).toBeDefined();
  await app.close();
});

test('redacts API_KEY in context', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.evaluate(async () =>
  window.devhub.testing.injectAuditEvent({
  action: 'ai_task_start',
  actor: { surface: 'ui', user: 'me' },
  target: { kind: 'ai-task', id: 'task-1' },
  outcome: { result: 'ok', error_code: null },
  context: { cmdline: 'codex --token=abcdef0123456789ABCDEF' },
  })
  );
  const tail = await win.evaluate(async () => window.devhub.audit.tail({ limit: 1 }));
  expect(tail.entries[0].context.cmdline).not.toContain('abcdef0123456789ABCDEF');
  expect(tail.entries[0].redacted_fields).toContain('cmdline');
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| Append-only audit | https://www.elastic.co/guide/en/security/current/audit-log.html |
| AES-256-GCM in Node | https://nodejs.org/api/crypto.html#class-cipher |
| SQLite better-sqlite3 | https://github.com/WiseLibs/better-sqlite3 |
| Schema-driven redaction | OWASP cheat sheet |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 700
breakdown:
  AuditLogger rewrite: 110
  AuditStore (sqlite): 150
  AuditRedactor: 90
  AuditExporter (JSON/CSV/encrypt): 130
  schema: 80
  IPC handlers: 90
  AuditPanel UI: 200 (含表/虚滚)
  AuditEventRow: 50
  AuditExportDialog: 80
  AuditBadge statusbar: 30
  cmdk auditActions: 30
files_touched: ~14
risk_radius:
  - 现有 AuditLogger 调用方需切到新 schema
  - sqlite 依赖在 packaging 时需要原生模块构建
  - 滚动归档与 query 跨 db 拼接性能
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 写 AuditEvent schema + 类型
  - step_02: AuditStore（better-sqlite3 + monthly rotation）
  - step_03: AuditRedactor + REDACT_PATTERNS + 单测
  - step_04: AuditExporter（JSON/CSV + 可选 AES-256-GCM）
  - step_05: AuditLogger 重写：append -> redactor -> store
  - step_06: 注册 IPC handlers
  - step_07: AuditPanel UI（tanstack-table + virtual + 过滤/搜索）
  - step_08: AuditExportDialog 含 passphrase 校验
  - step_09: AuditBadge in statusbar
  - step_10: cmdk auditActions
  - step_11: 现有 callers 全部接入（process_kill / window_topmost_set / theme_set / 等）
  - step_12: 写 e2e（§7）
  - step_13: 验证 PRIVACY-ZERO-TELEMETRY（外网零出站）
verify:
  - pnpm typecheck
  - pnpm test --filter audit
  - pnpm e2e --grep "spec-10"
```

---

## 11. dependencies

```yaml
blocks:
  - spec-11-permission-prompts.md (确认动作落审计)
  - R8.B/spec-13-diagnostics-bundle.md
  - R8.C/spec-* (csv_workflow / watchdog / inject 全部落审计)
blocked_by:
  - spec-01-integration-libs.md (tanstack-table)
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "sqlite 加载失败"
  action: "fallback JSONL append 模式（性能降级）；UI banner"
  - cause: "导出文件被锁定"
  action: "提示用户关闭外部读取器后重试"
  - cause: "passphrase 太短"
  action: "拒绝导出 + 弹"建议 ≥ 12 字符"提示"
```

---

## 13. performance_budget

```yaml
budgets:
  append_p50: 4ms
  append_p95: 12ms
  query_p95_1k_rows: 80ms
  export_throughput_rows_per_sec: >= 5000
  panel_initial_render_500_rows: < 250ms
  rotation_overhead: < 800ms
  rss_baseline_overhead: < 30MB
verification:
  - vitest microbench append
  - Playwright trace panel render
```
