# R8.A spec-04 — Card / List 字段对齐与权限不足统一降级

> **batch**: R8.A | **rank**: #4 | **user-perception-assert**: ASSERT_PROCESS_FIELD_PARITY
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-4.A.1/A.2/A.3 + V1-Q-4.B.1 + V2-Q-13.J 用户感知 + 5 大反馈 #2.1
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-02, spec-03

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: 5 大反馈 #2.1
  raw: "卡片状态资源详情显示权限不足；列表能看；两套不一致"
  impact: 字段集合 + 权限不足 UI 必须统一
  - source: V1-Q-4.A.1
  raw: "E（卡片 + 列表 + 树 + Treemap）"
  impact: 4 视图统一字段（本 spec 落地 Card + List；Tree/Treemap 在 R8.B-spec-08 嵌入）
  - source: V1-Q-4.A.2
  raw: "C + D 混合"
  impact: 两视图共用 useProcessViewModel
  - source: V1-Q-4.B.1
  raw: "B + D（顶部横幅 + 24h 记忆）"
  impact: 权限不足横幅统一组件 ElevationBanner
  - source: V2-Q-13.G.5
  raw: "录屏证据 + 自动暂停"
  impact: 字段对齐失败 -> 自动暂停 R8.B/C
  - source: master §9 ASSERT_PROCESS_FIELD_PARITY
  raw: 卡片视图 PID=N 详情字段集合 ≡ 列表视图 PID=N 字段集合
  impact: 本 spec 必须满足该断言
```

### 1.2 工程背景

- 现有 ProcessDetailPanel（卡片侧滑）与 ProcessDetailDrawer（列表行抽屉）字段差异显著（refs/source-snapshot-v2.md 维度 2）。
- spec-02 已统一数据契约。本 spec 落地 UI 统一，让用户感知层面"两条路径相等"。
- 权限不足时统一走 ElevationBanner（spec-03 提供）。

### 1.3 为什么放在 #4

是 5 大反馈 #2.1 的直接修复点，也是 R8.A 5 条用户感知断言的第一条。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/renderer/components/monitor/ProcessDetailPanel.tsx
  lines: "168 / 314-346 / 674-733"
  op: REWRITE_SECTIONS
  detail: 移除 fallback；统一从 useProcessViewModel 取数；嵌 ElevationBanner
  - path: devhub/src/renderer/components/monitor/ProcessDetailDrawer.tsx
  op: REWRITE_SECTIONS
  detail: 同上
  - path: devhub/src/renderer/components/monitor/process-detail/ProcessDetailLayout.tsx
  op: CREATE
  detail: 共享 layout 组件；接收 vm + mode props
  - path: devhub/src/renderer/components/monitor/process-detail/sections/
  op: CREATE_DIR
  detail: 5 个分区组件
  - path: devhub/src/renderer/components/monitor/process-detail/sections/BasicSection.tsx
  op: CREATE
  - path: devhub/src/renderer/components/monitor/process-detail/sections/ResourcesSection.tsx
  op: CREATE
  - path: devhub/src/renderer/components/monitor/process-detail/sections/NetworkSection.tsx
  op: CREATE
  - path: devhub/src/renderer/components/monitor/process-detail/sections/EnvironmentSection.tsx
  op: CREATE
  - path: devhub/src/renderer/components/monitor/process-detail/sections/ModulesSection.tsx
  op: CREATE
  - path: devhub/src/renderer/components/monitor/process-detail/FieldRow.tsx
  op: CREATE
  detail: 单字段渲染：value | "权限不足"占位 | "数据不全"占位 | sparkline
  - path: devhub/src/renderer/components/monitor/process-detail/PermissionBanner.tsx
  op: CREATE
  detail: ElevationBanner 在 process scope 的封装
  - path: devhub/src/renderer/components/monitor/ProcessView.tsx
  op: MODIFY
  detail: 卡片/列表共用 useProcessViewModel；mode 切换不丢字段集
  - path: devhub/tests/e2e/r8a/spec-04-card-list-parity.spec.ts
  op: CREATE
```

---

## 3. data_contracts

### 3.1 Section 渲染合约

```typescript
import type { ProcessUnifiedViewModel } from '@/shared/viewmodels/ProcessUnifiedViewModel';
import { z } from 'zod';

export const sectionIdSchema = z.enum(['basic','resources','network','environment','modules','security']);

export interface ProcessDetailSectionProps {
  vm: ProcessUnifiedViewModel;
  layoutVariant: 'panel'|'drawer';  // 视觉差异仅 layout，字段集相同
  onElevateRequest: (categories: string[]) => void;
}

export const fieldDisplaySchema = z.object({
  field_key: z.string(),
  value_repr: z.string().nullable(),
  status: z.enum(['ok','permission_denied','data_missing','timeout','degraded']),
  source: z.enum(['wmi','powershell','koffi','etw','cache','degraded']),
  needs_elevation: z.boolean(),
});

export type FieldDisplay = z.infer<typeof fieldDisplaySchema>;
```

### 3.2 视图差异允许清单

```yaml
allowed_visual_differences:
  - layout_orientation:
  panel: vertical scrollable
  drawer: horizontal tab strip
  - max_width:
  panel: 480px
  drawer: viewport - 60px
  - section_collapse:
  panel: 默认全展开
  drawer: 默认仅 basic 展开
forbidden_differences:
  - field count
  - field key set
  - permission message wording
  - elevation flow entry
  - source label
```

---

## 4. ipc_contracts

```yaml
existing_channels_used:
  - process:vm:get-light  (spec-02)
  - process:vm:get-deep  (spec-02)
  - process:vm:subscribe  (spec-02)
  - elevation:request  (spec-03)

no_new_channels: true
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| vm undefined（pid 已退出）| PROCESS_GONE | 关闭 panel/drawer + toast | onClose() |
| vm.permission_summary='partial' | PARTIAL_FIELDS | banner.warning + 提权按钮 | elevation:request |
| vm.permission_summary='denied' | ALL_DENIED | banner.error | 用户决定是否提权 |
| 单字段 envelope.error_code='WMI_TIMEOUT' | FIELD_TIMEOUT | FieldRow 显示 "数据不全 重试" | 单字段 retry button |
| 卡片/列表字段集不一致（dev 检测） | PARITY_VIOLATION | dev: console.error；prod: 上报审计 | 启动期 vitest fail-fast |
| section 内零数据 | SECTION_EMPTY | 空态卡片 + "需要提权"或"无此字段" | — |

---

## 6. acceptance_gwt

```gherkin
Feature: Card/List 字段对齐与权限降级 UI

Scenario A1: ASSERT_PROCESS_FIELD_PARITY 必过
  Given pid=8812 普通进程
  When 卡片视图打开 ProcessDetailPanel
  And 列表视图打开 ProcessDetailDrawer
  Then [data-vm-field] 集合在两视图完全一致
  And 字段 status (ok|degraded|permission_denied|...) 完全一致
  And source 标签完全一致

Scenario A2: 系统进程无提权显示横幅
  Given pid=4 (System) 不可读
  When 卡片视图打开
  Then 顶部 PermissionBanner 显示 "查看完整信息需提权"
  And 6 个 cmdline / modules / handles 字段显示 "权限不足" 占位
  And 列表视图同 pid=4 显示完全相同的横幅 + 占位

Scenario A3: 提权后两视图同时刷新
  Given 卡片视图横幅出现，用户点 "提权"
  When UAC 同意
  Then 卡片视图字段从 "权限不足" 变为实值
  And 同时（< 500ms）列表视图同 pid 也刷新（subscribe 推流）

Scenario A4: 重试单字段
  Given 字段 'modules' status='timeout'
  When 用户点 FieldRow 内 "重试"
  Then 调用 process:vm:get-deep 单字段限定（实际是整 advanced 重取）
  And 该字段 status 变为 'ok' 或 'degraded'

Scenario A5: 视图差异仅限 layout
  Given 字段集合一致
  When dev tool 比对两视图 DOM
  Then 节点数差异 = 0（仅 className / order 不同）

Scenario A6: 字段不一致 -> dev fail-fast
  Given 注入 mock 让 panel 比 drawer 多渲染一字段
  When 启动 vitest run parity
  Then PARITY_VIOLATION 报错
  And 进程退出码 != 0
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-04-card-list-parity.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('ASSERT_PROCESS_FIELD_PARITY: card and drawer share identical field set', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=进程');

  // panel
  await win.click('button:has-text("卡片")');
  await win.click('[data-pid="8812"]');
  await win.waitForSelector('[data-detail-variant="panel"]');
  const panelKeys = await win.locator('[data-vm-field]').evaluateAll((nodes) =>
  nodes.map((n) => n.getAttribute('data-vm-field')!).sort()
  );
  const panelStatuses = await win.locator('[data-vm-field]').evaluateAll((nodes) =>
  nodes.map((n) => `${n.getAttribute('data-vm-field')}=${n.getAttribute('data-vm-status')}`).sort()
  );
  await win.keyboard.press('Escape');

  // drawer
  await win.click('button:has-text("列表")');
  await win.click('[data-pid-row="8812"]');
  await win.waitForSelector('[data-detail-variant="drawer"]');
  const drawerKeys = await win.locator('[data-vm-field]').evaluateAll((nodes) =>
  nodes.map((n) => n.getAttribute('data-vm-field')!).sort()
  );
  const drawerStatuses = await win.locator('[data-vm-field]').evaluateAll((nodes) =>
  nodes.map((n) => `${n.getAttribute('data-vm-field')}=${n.getAttribute('data-vm-status')}`).sort()
  );

  expect(drawerKeys).toEqual(panelKeys);
  expect(drawerStatuses).toEqual(panelStatuses);
  await app.close();
});

test('permission denied banner appears for system process in both views', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=进程');
  await win.click('button:has-text("卡片")');
  await win.click('[data-pid="4"]');
  await expect(win.locator('[data-permission-banner]')).toBeVisible();
  await win.keyboard.press('Escape');
  await win.click('button:has-text("列表")');
  await win.click('[data-pid-row="4"]');
  await expect(win.locator('[data-permission-banner]')).toBeVisible();
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| Layout-agnostic detail components | https://www.patterns.dev/react/presentational-container-pattern |
| Field-level error UI | https://design.gitlab.com/components/banner |
| Subscription-driven refresh | TanStack Query subscribeQuery |
| Section accordion | Radix Accordion (spec-01 引入) |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 600
breakdown:
  ProcessDetailLayout: 110
  Sections (5): 280
  FieldRow + status mapping: 90
  PermissionBanner wrap: 50
  ProcessDetailPanel/Drawer rewrite: 70
files_touched: ~10
risk_radius:
  - layout 改造可能影响主题（spec-06 / spec-07 同期改主题，需 freeze layout API）
  - subscribe 推流双视图同时刷新需防抖（避免重渲染抖动）
  - 字段对齐 dev 检查器需在 prod 关闭（性能）
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 创建 ProcessDetailLayout 与 5 个 sections
  - step_02: FieldRow 实现 5 状态（ok/permission_denied/data_missing/timeout/degraded）
  - step_03: PermissionBanner 嵌入 ElevationBanner（spec-03）
  - step_04: ProcessDetailPanel 替换为 layoutVariant='panel' 调用
  - step_05: ProcessDetailDrawer 替换为 layoutVariant='drawer' 调用
  - step_06: ProcessView 加 view-mode 切换；卡片/列表共用 useProcessViewModel
  - step_07: dev parity checker：useEffect 比对两视图字段集；不一致抛错
  - step_08: subscribe 推流 + 双视图防抖（200ms throttle）
  - step_09: 写 e2e（§7）
  - step_10: 标注 [data-vm-field] / [data-vm-status] / [data-vm-source] 给 e2e
verify:
  - pnpm typecheck
  - pnpm test --filter parity
  - pnpm e2e --grep "spec-04"
  - 手测 ASSERT_PROCESS_FIELD_PARITY 通过
```

---

## 11. dependencies

```yaml
blocks:
  - R8.B/spec-08-process-tree-treemap.md (Tree/Treemap 视图引入)
  - R8.B/spec-04-popout-process.md (popout 复用同 layout)
blocked_by:
  - spec-01-integration-libs.md
  - spec-02-process-unified-vm.md
  - spec-03-process-uac-elevation.md
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "subscribe 推流 backpressure"
  action: "降级为 5s 轮询；UI 顶部显示 'live -> polling'"
  - cause: "section 渲染崩溃"
  action: "ErrorBoundary 包住每个 section；其他 section 仍可见"
  - cause: "字段集合发现不一致 (prod)"
  action: "审计上报 PARITY_VIOLATION 事件 + UI 不打扰用户"
```

---

## 13. performance_budget

```yaml
budgets:
  panel_open_to_first_paint: 120ms
  drawer_open_to_first_paint: 100ms
  field_status_update_to_paint: 80ms
  subscribe_dual_view_throttle: 200ms
  parity_check_overhead_dev: < 5ms / detail-open
  rss_per_open_detail: < 8MB
  fps_when_subscribe_active: >= 55
verification:
  - Playwright trace
  - react-scan dev mode
```
