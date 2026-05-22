# R8.A spec-11 — 权限二次确认（横切：UAC / kill / inject 等）

> **batch**: R8.A | **rank**: #11
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-4.C.3 + V1-Q-9.B.* + V2-Q-13.G.5 + master §7.3
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-03, spec-10

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: V1-Q-4.C.3
  raw: "A + C（系统进程必须确认 + 配置白名单）"
  impact: 危险操作必须二次确认；用户可加白名单
  - source: V1-Q-9.B
  raw: 危险操作（注入文本、kill、关键服务）必须显式确认
  impact: 本 spec 提供统一 ConfirmDialog
  - source: V2-Q-13.G.5
  raw: "C + D（录屏证据 + 自动暂停）"
  impact: 用户操作有未达预期路径时可调出审计 / 录屏
  - source: master §7.3 error codes
  raw: PERMISSION_DENIED / USER_CANCELLED 是横切错误码
```

### 1.2 工程背景

- 当前危险动作零散弹原生 dialog；无统一确认 UX；无白名单；无确认事件落审计。
- 本 spec：统一 PermissionConfirmDialog 组件 + 危险动作矩阵 + 白名单 + 审计接入。

### 1.3 为什么放在 #11

是 R8.A 横切收尾 spec；blocks R8.B / R8.C 中所有引入新破坏性操作的 spec。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/shared/permissions/DangerousActionMatrix.ts
  op: CREATE
  detail: 动作 -> 风险等级 -> 默认确认行为映射
  - path: devhub/src/shared/permissions/ConfirmRequest.ts
  op: CREATE
  detail: schema + 类型
  - path: devhub/src/main/services/permissions/PermissionService.ts
  op: CREATE
  detail: 协调 ConfirmDialog + 白名单 + 审计
  - path: devhub/src/main/services/permissions/AllowlistStore.ts
  op: CREATE
  detail: 用户加白名单（按 action + target hash）
  - path: devhub/src/renderer/components/permissions/PermissionConfirmDialog.tsx
  op: CREATE
  detail: 统一 Dialog；含 "本次" / "24h 内不再询问" / "永久允许"
  - path: devhub/src/renderer/components/permissions/PermissionAllowlistPanel.tsx
  op: CREATE
  detail: 设置面板内"已授权动作"列表 + 撤销
  - path: devhub/src/renderer/hooks/usePermission.ts
  op: CREATE
  detail: 包装 confirm() 调用
  - path: devhub/src/main/ipc/permissionHandlers.ts
  op: CREATE
  detail: permission:confirm / permission:allowlist:* / permission:reset
  - path: devhub/src/renderer/components/cmdk-actions/permissionActions.ts
  op: CREATE
  detail: cmdk: "查看已授权 / 撤销所有授权"
  - path: 多个调用点（process / window / port / ai-task / inject / etc.）
  op: WIRE_IN
  detail: 危险动作前 await usePermission.confirm(...)
```

---

## 3. data_contracts

### 3.1 危险动作矩阵

```typescript
import { z } from 'zod';

export const riskLevelSchema = z.enum(['low','medium','high','critical']);

export const dangerousActionSchema = z.enum([
  // process
  'process_kill_normal', 'process_kill_system', 'process_dll_inject',
  'process_priority_realtime', 'process_dump_create',
  // window
  'window_send_keys', 'window_force_close',
  // port
  'port_release_external',
  // ai-task / inject
  'ai_inject_text', 'ai_task_force_stop',
  // workflow
  'csv_workflow_with_dangerous_skill',
  'watchdog_restart_externally',
  // skill
  'skill_install_unverified',
  // settings
  'flag_enable_nutjs', 'flag_enable_tree_kill',
  // audit
  'audit_purge_all',
]);

export const dangerousActionMatrixSchema = z.record(dangerousActionSchema, z.object({
  risk: riskLevelSchema,
  default_confirm: z.enum(['always_confirm','remember_24h','remember_session','remember_permanent']),
  allowlist_eligible: z.boolean(),
  copy_zh: z.string(),
  copy_consequence: z.string(),
  requires_typing_confirmation: z.boolean().default(false), // critical 级别要求"键入 yes"
}));

export const dangerousActionMatrix: z.infer<typeof dangerousActionMatrixSchema> = {
  'process_kill_normal':  { risk: 'medium',  default_confirm: 'always_confirm', allowlist_eligible: true,  copy_zh: '结束进程', copy_consequence: '该进程将立即终止，未保存数据可能丢失', requires_typing_confirmation: false },
  'process_kill_system':  { risk: 'critical', default_confirm: 'always_confirm', allowlist_eligible: false, copy_zh: '结束系统进程', copy_consequence: '可能导致系统不稳定，请确认必要性', requires_typing_confirmation: true },
  'process_dll_inject':  { risk: 'critical', default_confirm: 'always_confirm', allowlist_eligible: false, copy_zh: '注入 DLL', copy_consequence: '可能违反目标程序使用条款；可能触发杀软', requires_typing_confirmation: true },
  'process_priority_realtime':  { risk: 'high',  default_confirm: 'always_confirm', allowlist_eligible: true,  copy_zh: '设为实时优先级', copy_consequence: '可能拖慢整机响应', requires_typing_confirmation: false },
  'process_dump_create':  { risk: 'low',  default_confirm: 'remember_24h',  allowlist_eligible: true,  copy_zh: '创建内存转储', copy_consequence: '产生较大文件，可能含敏感信息', requires_typing_confirmation: false },
  'window_send_keys':  { risk: 'high',  default_confirm: 'remember_session', allowlist_eligible: true, copy_zh: '注入按键', copy_consequence: '将向目标窗口注入键盘事件', requires_typing_confirmation: false },
  'window_force_close':  { risk: 'medium',  default_confirm: 'always_confirm', allowlist_eligible: true,  copy_zh: '强制关闭窗口', copy_consequence: '未保存数据可能丢失', requires_typing_confirmation: false },
  'port_release_external':  { risk: 'high',  default_confirm: 'always_confirm', allowlist_eligible: true,  copy_zh: '释放外部可访问端口', copy_consequence: '可能影响其他客户端连接', requires_typing_confirmation: false },
  'ai_inject_text':  { risk: 'high',  default_confirm: 'remember_session', allowlist_eligible: true, copy_zh: '向 AI 工具注入文本', copy_consequence: '注入内容将进入 AI 会话', requires_typing_confirmation: false },
  'ai_task_force_stop':  { risk: 'medium',  default_confirm: 'always_confirm', allowlist_eligible: true,  copy_zh: '强制停止 AI 任务', copy_consequence: '该任务上下文将丢失', requires_typing_confirmation: false },
  'csv_workflow_with_dangerous_skill': { risk: 'high', default_confirm: 'always_confirm', allowlist_eligible: false, copy_zh: '运行含危险 Skill 的工作流', copy_consequence: '该 Skill 标记为危险，逐步审查', requires_typing_confirmation: true },
  'watchdog_restart_externally': { risk: 'medium',  default_confirm: 'remember_session', allowlist_eligible: true, copy_zh: 'Watchdog 自动重启该进程', copy_consequence: 'Watchdog 将代你重启失联进程', requires_typing_confirmation: false },
  'skill_install_unverified':  { risk: 'high',  default_confirm: 'always_confirm', allowlist_eligible: false, copy_zh: '安装未签名 Skill', copy_consequence: 'Skill 来源未签名，请仔细审查', requires_typing_confirmation: true },
  'flag_enable_nutjs':  { risk: 'medium',  default_confirm: 'always_confirm', allowlist_eligible: false, copy_zh: '启用 nut.js 注入', copy_consequence: '将允许键鼠模拟', requires_typing_confirmation: false },
  'flag_enable_tree_kill':  { risk: 'low',  default_confirm: 'remember_24h',  allowlist_eligible: true,  copy_zh: '启用 tree-kill 递归杀进程', copy_consequence: '将允许杀整个进程树', requires_typing_confirmation: false },
  'audit_purge_all':  { risk: 'critical', default_confirm: 'always_confirm', allowlist_eligible: false, copy_zh: '清空全部审计', copy_consequence: '审计历史将永久删除', requires_typing_confirmation: true },
};
```

### 3.2 confirm 请求/响应

```typescript
export const confirmRequestSchema = z.object({
  action: dangerousActionSchema,
  target: z.object({
  kind: z.enum(['process','port','window','ai-task','file','setting','skill','workflow','audit']),
  id: z.string(),
  display: z.string(),
  }),
  context_summary: z.string().min(8),
  initiator: z.enum(['ui','cmdk','watchdog','workflow']),
});

export const confirmResponseSchema = z.object({
  approved: z.boolean(),
  remember_choice: z.enum(['none','session','24h','permanent']),
  audit_id: z.string().uuid(),
});

export const allowlistEntrySchema = z.object({
  action: dangerousActionSchema,
  target_hash: z.string().regex(/^[a-f0-9]{64}$/),
  remember_choice: z.enum(['session','24h','permanent']),
  added_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
});
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: permission:confirm
  direction: renderer -> main
  request_schema: confirmRequestSchema
  response_schema: confirmResponseSchema
  requires_audit: true
  - name: permission:allowlist:list
  request_schema: z.object({})
  response_schema: z.object({ entries: z.array(allowlistEntrySchema) })
  - name: permission:allowlist:revoke
  request_schema: z.object({ action: dangerousActionSchema, target_hash: z.string() })
  response_schema: z.object({ ok: z.boolean() })
  requires_audit: true
  - name: permission:reset
  direction: renderer -> main
  request_schema: z.object({})
  response_schema: z.object({ rows_deleted: z.number().int() })
  requires_audit: true
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| 用户取消 | USER_CANCELLED | upstream caller 决定 | 调用方接 catch |
| typing 未输 yes | TYPING_FAILED | dialog inline error | 重新键入 |
| allowlist 命中且未过期 | (no dialog) | 静默通过 + 审计 OK | continue |
| allowlist 已过期 | EXPIRED_REPROMPT | 弹 dialog | 用户重选 |
| 后端 PermissionService 异常 | PERMISSION_BACKEND_ERROR | toast + dev | upstream 中止 |
| critical 动作 allowlist 试图加入 | ALLOWLIST_DENIED_CRITICAL | toast | 不允许加白 |

---

## 6. acceptance_gwt

```gherkin
Feature: 横切权限二次确认

Scenario A1: kill 系统进程必须键入 yes
  Given pid=4 系统进程
  When 用户尝试 kill
  Then PermissionConfirmDialog 弹出
  And 含输入框 "请键入 yes 以确认"
  When 用户输入 'no'
  Then 提交按钮 disabled
  When 用户输入 'yes'
  Then 提交按钮 enabled
  When 提交
  Then permission:confirm 返回 approved=true
  And audit 含 process_kill 事件 with outcome.result='ok'

Scenario A2: 普通 kill 可记 24h
  Given pid=8812 普通进程
  When 用户 kill 并选 "24h 内不再询问"
  Then allowlist 写入 entry expires_at = now+24h
  And 后续 24h 内同 (action, target_hash) 不再弹

Scenario A3: 用户取消
  Given dialog 弹出
  When 用户点 "取消"
  Then permission:confirm 返回 approved=false
  And caller 收到 USER_CANCELLED
  And audit 含一条 outcome.result='cancelled'

Scenario A4: critical 不可加白
  Given action='process_kill_system'
  When dialog 渲染
  Then "永久允许" / "24h 内不再询问" 选项 disabled
  And 仅可单次确认（且需键入 yes）

Scenario A5: allowlist 撤销
  Given allowlist 含 entry (action='process_kill_normal', target_hash=H)
  When 用户在 PermissionAllowlistPanel 点 "撤销"
  Then 该 entry 删除
  And 下次同 action+target 弹 dialog

Scenario A6: prefers-reduced-motion 影响 dialog
  Given OS prefers-reduced-motion
  When dialog 弹
  Then 无入场动画

Scenario A7: cmdk 入口 "撤销所有授权"
  Given cmdk 打开
  When 输入 "撤销所有授权"
  Then permission:reset 调用
  And allowlist 清空
  And audit 记录 audit_purge / permission:reset
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-11-permission-prompts.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('critical action requires typing yes', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  const promise = win.evaluate(async () =>
  window.devhub.permissions.confirm({
  action: 'process_kill_system',
  target: { kind: 'process', id: '4', display: 'System' },
  context_summary: '清理冻结进程',
  initiator: 'ui',
  })
  );
  await expect(win.locator('[data-permission-dialog="critical"]')).toBeVisible();
  await win.fill('[data-typing-input]', 'no');
  expect(await win.locator('[data-confirm-submit]').isDisabled()).toBe(true);
  await win.fill('[data-typing-input]', 'yes');
  expect(await win.locator('[data-confirm-submit]').isDisabled()).toBe(false);
  await win.click('[data-confirm-submit]');
  const result = await promise;
  expect(result.approved).toBe(true);
  await app.close();
});

test('24h allowlist suppresses subsequent prompts', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  // 第一次
  const p1 = win.evaluate(async () =>
  window.devhub.permissions.confirm({
  action: 'process_kill_normal',
  target: { kind: 'process', id: '8812', display: 'node.exe' },
  context_summary: 'manual cleanup',
  initiator: 'ui',
  })
  );
  await win.click('[data-remember-24h]');
  await win.click('[data-confirm-submit]');
  await p1;
  // 第二次：不应该弹
  const visible = await win.locator('[data-permission-dialog]').isVisible({ timeout: 500 }).catch(() => false);
  const p2 = win.evaluate(async () =>
  window.devhub.permissions.confirm({
  action: 'process_kill_normal',
  target: { kind: 'process', id: '8812', display: 'node.exe' },
  context_summary: 'manual cleanup',
  initiator: 'ui',
  })
  );
  expect(visible).toBe(false);
  const r2 = await p2;
  expect(r2.approved).toBe(true);
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| Dangerous action matrix | macOS / Windows TCC framework |
| Typing-to-confirm | GitHub "delete repo" pattern |
| Modal dialog ARIA | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ |
| Hashed target identity | sha256(action + JSON.stringify(target)) |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 800
breakdown:
  schema + matrix: 220
  PermissionService: 130
  AllowlistStore (electron-store): 90
  PermissionConfirmDialog: 180
  PermissionAllowlistPanel: 90
  usePermission hook: 50
  IPC handlers: 60
  cmdk permissionActions: 30
files_touched: ~12
risk_radius:
  - 现有所有 callers（process_kill / window_send_keys 等）必须接入
  - critical 动作不可加白；测试要严格
  - allowlist 过期与重新弹的边界
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 写 dangerousActionMatrix + schema + 单测
  - step_02: PermissionService（confirm pipeline）
  - step_03: AllowlistStore（按 sha256(action+target) 索引）
  - step_04: PermissionConfirmDialog（含 typing 输入 / 24h / permanent 选项）
  - step_05: PermissionAllowlistPanel UI
  - step_06: IPC + Zod
  - step_07: cmdk permissionActions
  - step_08: 现有所有破坏性 callers 接入 usePermission.confirm
  - step_09: 写 e2e（§7）
verify:
  - pnpm typecheck
  - pnpm test --filter permissions
  - pnpm e2e --grep "spec-11"
  - 手测：危险动作必弹 dialog；critical 必键入 yes；allowlist 24h 命中
```

---

## 11. dependencies

```yaml
blocks:
  - R8.B/spec-* 中所有引入新破坏性动作的 spec
  - R8.C/spec-* 中所有引入 inject / kill / dll-inject 的 spec
blocked_by:
  - spec-03-process-uac-elevation.md (复用 ConfirmDialog 视觉)
  - spec-10-audit-log.md (audit 接入)
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "AllowlistStore 写入失败"
  action: "本会话内存模式；UI banner '当前会话授权未持久化'"
  - cause: "用户连续取消 5 次同 action"
  action: "提示 '若不希望被询问，可加入白名单' 引导"
  - cause: "PermissionConfirmDialog 渲染异常"
  action: "fallback native dialog (electron.dialog.showMessageBox)"
```

---

## 13. performance_budget

```yaml
budgets:
  confirm_dialog_open_p95: 80ms
  allowlist_lookup_p99: 5ms
  hash_target_compute: < 0.5ms
  audit_overhead_per_confirm: < 8ms
  rss_overhead: < 5MB
verification:
  - vitest microbench
  - Playwright trace
```
