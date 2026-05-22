# R8.A spec-08 — Always-on-Top（已实现内核暴露 UI）

> **batch**: R8.A | **rank**: #8 | **user-perception-assert**: ASSERT_ALWAYS_ON_TOP_FUNCTIONAL
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-6.D.* + V2-Q-13 入口可见性 + 5 大反馈 P4
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-01

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: 5 大反馈 P4
  raw: "always-on-top 按钮没反应"
  impact: 主进程 IPC 已实现（WINDOW_SET_TOPMOST:424），UI 触发缺失
  - source: V1-Q-6.D
  raw: 窗口操作矩阵全选
  impact: always-on-top 必须可达
  - source: master §9 ASSERT_ALWAYS_ON_TOP_FUNCTIONAL
  raw: 点 always-on-top 按钮 -> IPC 返回 success=true 且 SetWindowPos 已调用
```

### 1.2 工程背景

- refs/source-snapshot-v2.md 维度 4：`windowHandlers.ts:424` WINDOW_SET_TOPMOST 已实现 + Zod 验证 + 速率限制。
- 渲染端 UI 没有暴露按钮，导致用户感觉"按钮没反应"。
- 本 spec 仅做 UI 暴露 + 状态回读 + 跨视图同步，不动主进程。

### 1.3 为什么放在 #8

是 5 大反馈中"按钮没反应"的直接修复 + 用户感知断言 #4，工作量最小但最显眼。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/main/ipc/windowHandlers.ts
  lines: "424 WINDOW_SET_TOPMOST"
  op: KEEP
  detail: 已实现，不动；新增配套 WINDOW_GET_TOPMOST 状态查询
  - path: devhub/src/main/ipc/windowHandlers.ts
  op: ADD_HANDLER
  detail: WINDOW_GET_TOPMOST channel；返回当前 topmost 状态
  - path: devhub/src/main/services/window/WindowTopmostState.ts
  op: CREATE
  detail: 单点存当前 topmost set；启动重读
  - path: devhub/src/renderer/components/monitor/WindowDetailPanel.tsx
  op: MODIFY
  detail: 顶部加 always-on-top toggle 按钮 + 状态徽章
  - path: devhub/src/renderer/components/monitor/WindowView.tsx
  op: MODIFY
  detail: 卡片右上角 always-on-top mini 图标
  - path: devhub/src/renderer/components/monitor/WindowDetailDrawer.tsx
  op: MODIFY
  - path: devhub/src/renderer/hooks/useWindowTopmost.ts
  op: CREATE
  - path: devhub/src/renderer/components/cmdk-actions/windowActions.ts
  op: CREATE
  detail: cmdk 注册 "置顶当前窗口" / "取消置顶"
  - path: devhub/src/renderer/components/statusbar/TopmostBadge.tsx
  op: CREATE
  detail: 状态栏 "N 窗口置顶" 计数徽章
```

---

## 3. data_contracts

```typescript
import { z } from 'zod';

export const setTopmostRequestSchema = z.object({
  hwnd: z.string().regex(/^0x[0-9a-fA-F]+$/),
  topmost: z.boolean(),
});

export const setTopmostResponseSchema = z.object({
  success: z.boolean(),
  before: z.boolean(),
  after: z.boolean(),
  set_window_pos_called: z.boolean(),
  error_code: z.enum(['OK','HWND_NOT_FOUND','PERMISSION_DENIED','OS_ERROR','THROTTLED']).default('OK'),
});

export const getTopmostRequestSchema = z.object({
  hwnd: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export const getTopmostResponseSchema = z.object({
  hwnd: z.string(),
  is_topmost: z.boolean(),
  fetched_at: z.string().datetime(),
});

export const topmostListResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  windows: z.array(z.object({
  hwnd: z.string(),
  title: z.string(),
  pid: z.number().int(),
  pinned_at: z.string().datetime(),
  })),
});
```

---

## 4. ipc_contracts

```yaml
existing_channel:
  - name: WINDOW_SET_TOPMOST
  file: src/main/ipc/windowHandlers.ts:424
  request_schema: setTopmostRequestSchema
  response_schema: setTopmostResponseSchema
  rate_limit: 10/s per hwnd

new_channels:
  - name: WINDOW_GET_TOPMOST
  direction: renderer -> main
  request_schema: getTopmostRequestSchema
  response_schema: getTopmostResponseSchema
  p95_target_ms: 50
  - name: WINDOW_LIST_TOPMOST
  direction: renderer -> main
  request_schema: z.object({})
  response_schema: topmostListResponseSchema
  - name: WINDOW_TOPMOST_CHANGED
  direction: main -> renderer (event)
  payload_schema: z.object({ hwnd: z.string(), is_topmost: z.boolean() })
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| hwnd 已不存在 | HWND_NOT_FOUND | toast | 关闭详情面板 |
| 系统拒绝（如已被强制 topmost） | OS_ERROR | toast + 详细日志按钮 | 不重试 |
| 速率限制触发 | THROTTLED | toast | 1s backoff |
| 主进程未响应（>1s） | TIMEOUT | toast | 自动重试 1 次 |
| 状态徽章与实际不符（dev 检测） | STATE_DIVERGED | dev: console.error | 强制 WINDOW_GET_TOPMOST 回查 |

---

## 6. acceptance_gwt

```gherkin
Feature: always-on-top UI 与状态同步

Scenario A1: ASSERT_ALWAYS_ON_TOP_FUNCTIONAL 必过
  Given 窗口 hwnd=0x12345 当前非 topmost
  When 用户在 WindowDetailPanel 点 "置顶" 按钮
  Then WINDOW_SET_TOPMOST 请求返回 success=true
  And response.set_window_pos_called=true
  And UI 按钮态从 inactive 变 active
  And 状态栏 TopmostBadge 计数 +1

Scenario A2: 取消置顶
  Given 窗口已置顶
  When 用户再次点按钮
  Then WINDOW_SET_TOPMOST { topmost: false } 被调用
  And UI 按钮态变 inactive
  And 状态栏计数 -1

Scenario A3: 卡片角标也可触发
  Given 卡片视图 hwnd=0x12345
  When 用户点卡片右上 pin 图标
  Then 同 IPC 被调用
  And 卡片 / 详情面板 / 状态栏 三处 UI 同步刷新

Scenario A4: cmdk 入口
  Given cmdk 打开
  When 输入 "置顶"
  Then 出现 "置顶当前焦点窗口" 选项
  And 选择后 IPC 调用

Scenario A5: 速率限制
  Given 用户连续点按钮 12 次
  When 第 11 次发送
  Then 错误码 THROTTLED 返回
  And UI toast 提示 "操作过于频繁"

Scenario A6: 多视图状态同步
  Given panel/drawer/card/statusbar 同时存在
  When WINDOW_TOPMOST_CHANGED 推送
  Then 所有 4 处 UI 在 200ms 内同步刷新
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-08-always-on-top.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('ASSERT_ALWAYS_ON_TOP_FUNCTIONAL', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=窗口');
  const targetHwnd = await win.evaluate(async () => {
  const list = await window.devhub.window.scan();
  return list.find((w: any) => w.title.includes('记事本'))?.hwnd;
  });
  if (!targetHwnd) test.skip();
  await win.click(`[data-hwnd="${targetHwnd}"]`);
  const result = await win.evaluate(async (hwnd) =>
  window.devhub.window.setTopmost({ hwnd, topmost: true }),
  targetHwnd
  );
  expect(result.success).toBe(true);
  expect(result.set_window_pos_called).toBe(true);
  expect(result.after).toBe(true);
  // UI 状态
  await expect(win.locator('[data-topmost-button][data-state="active"]')).toBeVisible();
  await app.close();
});

test('UI sync across panel, card, statusbar', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.evaluate(async () => window.devhub.window.setTopmost({ hwnd: '0x1234', topmost: true }));
  await Promise.all([
  win.waitForSelector('[data-topmost-button][data-state="active"]', { timeout: 200 }),
  win.waitForSelector('[data-topmost-card-icon][data-state="active"]', { timeout: 200 }),
  win.waitForSelector('[data-topmost-badge-count="1"]', { timeout: 200 }),
  ]);
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| SetWindowPos HWND_TOPMOST | https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos |
| Toggle button accessibility | https://www.w3.org/WAI/ARIA/apg/patterns/button/ |
| Status bar pattern | VS Code statusbar |
| Event broadcast pattern | Electron BrowserWindow.webContents.send |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 400
breakdown:
  WindowTopmostState: 80
  WINDOW_GET_TOPMOST handler: 40
  WINDOW_LIST_TOPMOST handler: 50
  useWindowTopmost hook: 60
  WindowDetailPanel button: 40
  WindowDetailDrawer button: 30
  Card mini icon: 30
  TopmostBadge statusbar: 40
  cmdk windowActions: 30
files_touched: ~10
risk_radius:
  - WINDOW_TOPMOST_CHANGED 事件订阅泄露（必须 useEffect cleanup）
  - 状态栏徽章在多视图同时打开时计数正确性
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 创建 WindowTopmostState 服务（main 单例）
  - step_02: 注册 WINDOW_GET_TOPMOST / WINDOW_LIST_TOPMOST IPC + Zod
  - step_03: WINDOW_SET_TOPMOST 内部调 WindowTopmostState.update + 推 event
  - step_04: useWindowTopmost hook（订阅 + 取消订阅）
  - step_05: WindowDetailPanel/Drawer 加按钮 + 状态徽章
  - step_06: WindowCard 右上 mini icon
  - step_07: TopmostBadge in statusbar
  - step_08: cmdk windowActions
  - step_09: dev mode state divergence 检查器
  - step_10: 写 e2e（§7）
verify:
  - pnpm typecheck
  - pnpm test --filter window
  - pnpm e2e --grep "spec-08"
  - 手测 ASSERT_ALWAYS_ON_TOP_FUNCTIONAL 通过
```

---

## 11. dependencies

```yaml
blocks:
  - R8.B/spec-09-window-pinning-multi.md
blocked_by:
  - spec-01-integration-libs.md (radix dropdown / lucide)
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "WINDOW_TOPMOST_CHANGED 事件丢失"
  action: "useWindowTopmost 每 5s polling getTopmost 兜底"
  - cause: "rate-limited"
  action: "UI 按钮 disabled 1s + toast"
```

---

## 13. performance_budget

```yaml
budgets:
  set_topmost_p50: 30ms
  set_topmost_p95: 100ms
  get_topmost_p95: 50ms
  ui_sync_after_event_p95: 200ms
  topmost_badge_render_overhead: < 0.5ms
verification:
  - Playwright trace
  - manual stress: 连续 set 100 次
```
