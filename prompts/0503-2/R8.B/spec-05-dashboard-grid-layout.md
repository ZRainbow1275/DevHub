# Spec R8.B-05 — 可拖拽仪表板（react-grid-layout）

> **flag**: `R8.B.dashboard.grid`
> **priority**: P0（5 大反馈 #1.1 显示太不均匀的核心解药）
> **status**: planning
> **upstream**: R8.A spec-01（react-grid-layout 安装）+ R8.B spec-03（drawer 用户布局对齐）
> **downstream**: R8.B spec-06（treemap widget）/ spec-08（status widget）/ R8.C spec-32（observability widget）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-2.A.1
  answer: "A 保持现有三栏"
  impact: "默认主页面仍为三栏，仪表板作为可选"
  - id: V2-Q-13.I.1
  answer: "D"  # 三栏 + popout + 5 秒法则审视密度
  impact: "Dashboard 是缓解三栏拥挤的高级模式"
  - id: USER-FEEDBACK-1.1
  quote: "显示太不均匀，思考增加多个收纳"
  impact: "Dashboard 让用户能自定义 widget 排列，是收纳的延伸"
```

### 1.2 现状缺陷

```
devhub/src/renderer/components 无 dashboard 概念
仅 MonitorPanel.tsx 提供 4-Tab 但布局固定
无 widget 概念，无可拖拽布局
无 layout 持久化
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 仪表板默认 widget 数 | ≥ 6（进程汇总 / 端口数 / 窗口数 / AI 任务 / 系统资源 / 通知） |
| 拖拽响应 | 60fps |
| 布局持久化 | 命名预设 ≥ 5 个 |
| widget 内容懒加载 | 折叠时不消耗资源 |
| Dashboard ↔ Drawer 联动 | widget 可被"摘出"为 Drawer 内容 |
| 响应式断点 | xs / sm / md / lg / xl 5 档 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/App.tsx
  - devhub/src/renderer/components/monitor/MonitorPanel.tsx
modify:
  - devhub/src/renderer/App.tsx  # 加 Dashboard 路由
new:
  - devhub/src/renderer/components/dashboard/Dashboard.tsx  # 容器
  - devhub/src/renderer/components/dashboard/WidgetHost.tsx
  - devhub/src/renderer/components/dashboard/WidgetRegistry.tsx
  - devhub/src/renderer/components/dashboard/widgets/ProcessSummaryWidget.tsx
  - devhub/src/renderer/components/dashboard/widgets/PortSummaryWidget.tsx
  - devhub/src/renderer/components/dashboard/widgets/WindowSummaryWidget.tsx
  - devhub/src/renderer/components/dashboard/widgets/AiTaskQueueWidget.tsx
  - devhub/src/renderer/components/dashboard/widgets/SystemResourceWidget.tsx
  - devhub/src/renderer/components/dashboard/widgets/NotificationsWidget.tsx
  - devhub/src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx
  - devhub/src/renderer/components/dashboard/widgets/TreemapMiniWidget.tsx
  - devhub/src/renderer/hooks/useDashboardLayout.ts
  - devhub/src/renderer/stores/dashboardStore.ts
  - devhub/src/main/ipc/dashboardHandlers.ts
  - devhub/src/main/services/DashboardLayoutStore.ts
test:
  - devhub/src/renderer/components/dashboard/Dashboard.test.tsx
  - devhub/tests/e2e/dashboard-grid.spec.ts
docs:
  - docs/r8/dashboard.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const WidgetIdSchema = z.enum([
  'process-summary',
  'port-summary',
  'window-summary',
  'ai-task-queue',
  'system-resource',
  'notifications',
  'topology-mini',
  'treemap-mini',
  'sparkline-cpu',
  'sparkline-rss',
  'recent-uri',
  'favorites',
  'custom',
])
export type WidgetId = z.infer<typeof WidgetIdSchema>

export const GridItemSchema = z.object({
  i: z.string(),  // widget instance id
  widgetId: WidgetIdSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  minW: z.number().int().optional(),
  minH: z.number().int().optional(),
  maxW: z.number().int().optional(),
  maxH: z.number().int().optional(),
  static: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).default({}),
})
export type GridItem = z.infer<typeof GridItemSchema>

export const BreakpointSchema = z.enum(['xs', 'sm', 'md', 'lg', 'xl'])

export const DashboardLayoutSchema = z.object({
  name: z.string(),
  layouts: z.record(BreakpointSchema, z.array(GridItemSchema)),
  cols: z.record(BreakpointSchema, z.number().int()).default({
  xs: 4, sm: 6, md: 8, lg: 12, xl: 16,
  }),
  rowHeight: z.number().int().default(50),
  margin: z.tuple([z.number(), z.number()]).default([8, 8]),
  containerPadding: z.tuple([z.number(), z.number()]).default([8, 8]),
})
export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>

export const DASHBOARD_LIMITS = {
  MAX_WIDGETS: 32,
  DEFAULT_LAYOUT_PRESETS: ['default', 'minimal', 'monitor-focus', 'ai-focus'],
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  dashboard:get-layout:
  request: { name?: string }
  response: { layout: DashboardLayout }
  dashboard:save-layout:
  request: DashboardLayoutSchema
  response: { success: boolean }
  dashboard:list-presets:
  response: { names: string[] }
  dashboard:delete-preset:
  request: { name: string }
  dashboard:reset:
  request: { preset?: string }
  response: { layout: DashboardLayout }
  dashboard:morph-widget-to-drawer:
  request: { widgetInstanceId: string, slot: 'right' | 'bottom' }
  response: { drawerState: DrawerState }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'widget id 不存在于 WidgetRegistry'
  code: E_VALIDATION
  handling: '渲染占位 + 红色"未知 widget"'
  - condition: 'widget 数 > 32'
  code: E_RATE_LIMITED
  - condition: '保存的 layout 与当前 cols 不兼容'
  code: E_VALIDATION
  handling: '降级到默认 layout + toast'
  - condition: 'persist 写入失败'
  code: E_INTERNAL
  - condition: '布局碰撞（react-grid-layout 内部错误）'
  code: E_INTERNAL
  fallback: '重置到上一个有效 layout'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — Dashboard 默认布局
Given DevHub 启动 + 用户进入 Dashboard 页面
Then 出现 ≥ 6 个默认 widget
  And cols = 12 (md 断点)

# A2 — 拖拽 widget
Given Dashboard 显示中
When 用户拖拽 process-summary widget 到新位置
Then 60fps 拖拽
  And 释放后 layout 持久化（IPC dashboard:save-layout）

# A3 — 调整 widget 尺寸
Given widget 当前 w=4 h=4
When 用户拖动 resize handle 到 w=6 h=4
Then layout 更新 + persist

# A4 — 响应式断点
Given 窗口宽度 = 1920px (xl)
Then 应用 xl 布局（cols=16）

Given 窗口宽度 = 1024px (md)
Then 应用 md 布局（cols=8）

# A5 — Layout 预设切换
Given 已有 4 个内置预设 + 1 个用户预设 "调试"
When 用户在命令面板输入 "应用布局：调试"
Then dashboard:get-layout(name=调试) 调用
  And 当前布局立即切换

# A6 — Widget 摘出为 Drawer
Given Dashboard 上 widget = topology-mini
When 用户右键 widget → "摘到右侧 Drawer"
Then dashboard:morph-widget-to-drawer 调用
  And widget 从 dashboard 消失
  And right Drawer 打开 + content = topology

# A7 — Widget 配置
Given widget = sparkline-cpu
When 用户点击 widget 设置图标 + 选 "范围: 24h"
Then config.range = '24h' 持久化
  And widget 重新渲染数据

# A8 — Widget 上限
Given Dashboard 已有 32 个 widget
When 用户尝试添加第 33 个
Then 拒绝 + toast "widget 数已达 32 上限"

# A9 — 主内容三栏不变（V1-Q-2.A.1）
Given 用户在主"监控"页面（非 Dashboard）
Then 主内容仍为三栏
  And Dashboard 是独立路由，不替代三栏

# A10 — Reduced motion
Given motionLevel = reduced
When 用户切换 layout 预设
Then 无过渡动画，瞬切
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/dashboard-grid.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('dashboard renders 6+ widgets by default', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-dashboard"]')
  const widgets = await page.getByTestId(/^widget-/).count()
  expect(widgets).toBeGreaterThanOrEqual(6)
  await app.close()
})

test('drag widget persists', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-dashboard"]')
  const w = page.getByTestId('widget-process-summary')
  const handle = w.getByTestId('widget-drag-handle')
  await handle.dragTo(page.getByTestId('widget-port-summary'))
  await page.waitForTimeout(400)

  await app.close()
  const app2 = await launchDevHub()
  const page2 = await app2.firstWindow()
  await page2.click('[data-testid="nav-dashboard"]')
  const w2 = await page2.getByTestId('widget-process-summary').boundingBox()
  // 位置应已变化
  expect(w2).toBeTruthy()
  await app2.close()
})

test('layout preset switch', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-dashboard"]')
  await page.keyboard.press('Control+K')
  await page.getByPlaceholder(/输入命令/).fill('应用布局：minimal')
  await page.keyboard.press('Enter')
  // minimal 预设 widget 数 < 默认
  const widgets = await page.getByTestId(/^widget-/).count()
  expect(widgets).toBeLessThan(6)
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 react-grid-layout 集成

```tsx
import { Responsive, WidthProvider } from 'react-grid-layout'

const ResponsiveGridLayout = WidthProvider(Responsive)

export function Dashboard() {
  const { layout, setLayout } = useDashboardLayout()

  return (
  <ResponsiveGridLayout
  className="dashboard"
  layouts={layout.layouts}
  breakpoints={{ xs: 480, sm: 768, md: 1024, lg: 1440, xl: 1920 }}
  cols={layout.cols}
  rowHeight={layout.rowHeight}
  margin={layout.margin}
  onLayoutChange={(_, all) => setLayout({ ...layout, layouts: all })}
  draggableHandle=".widget-drag-handle"
  compactType="vertical"
  preventCollision={false}
  >
  {layout.layouts.md.map(item => (
  <div key={item.i} data-testid={`widget-${item.widgetId}`}>
  <WidgetHost widgetId={item.widgetId} config={item.config} />
  </div>
  ))}
  </ResponsiveGridLayout>
  )
}
```

### 8.2 WidgetRegistry

```typescript
// 懒加载 + 注册
import { lazy } from 'react'

export const WIDGET_REGISTRY: Record<WidgetId, { Component: React.LazyExoticComponent<any>, label: string }> = {
  'process-summary': { Component: lazy(() => import('./widgets/ProcessSummaryWidget')), label: '进程汇总' },
  // ...
}

export function WidgetHost({ widgetId, config }: { widgetId: WidgetId, config: any }) {
  const entry = WIDGET_REGISTRY[widgetId]
  if (!entry) return <UnknownWidget id={widgetId} />
  const { Component } = entry
  return (
  <Suspense fallback={<WidgetSkeleton />}>
  <Component config={config} />
  </Suspense>
  )
}
```

### 8.3 关键参考链接

- react-grid-layout：https://github.com/react-grid-layout/react-grid-layout
- WidthProvider：https://github.com/react-grid-layout/react-grid-layout#width-provider

---

## 9. impact_radius_loc

```yaml
new_files: 16
modified_files: 1
estimated_loc:
  Dashboard.tsx: 220
  WidgetHost.tsx: 120
  WidgetRegistry.tsx: 90
  各 widget (8 个): 160 * 8 = 1280
  useDashboardLayout.ts: 130
  dashboardStore.ts: 150
  dashboardHandlers.ts: 110
  DashboardLayoutStore.ts: 80
  App.tsx (modify): +40
  tests: 380
total_loc: ~2600
risk_level: medium
```

---

## 10. implement_checklist

- [x] 安装 react-grid-layout ^1.4.4
- [x] 实现 Dashboard.tsx + ResponsiveGridLayout
- [x] 实现 WidgetRegistry（懒加载 8 个内置 widget）
- [x] 实现 8 个内置 widget
- [x] 实现 dashboardStore + 持久化（electron-store）
- [x] dashboard:get-layout / save-layout / list-presets / morph-widget IPC
- [x] 内置 4 个预设：default / minimal / monitor-focus / ai-focus
- [x] App.tsx 加 dashboard 路由
- [x] 与 spec-04 联动（命令面板"应用布局：X"）
- [x] 与 spec-03 联动（widget 摘出 → Drawer）
- [x] 单元 + e2e — targeted unit/service/schema tests and real Electron restart persistence E2E passed.
- [x] 文档：docs/r8/dashboard.md
- [x] 验收"Dashboard 6+ widget 默认显示"

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-01（集成库）
  - R8.B spec-03（Drawer 互转）
sibling_libs:
  - react-grid-layout: ^1.4.4
  - react-resizable: ^3.0.5（dependency of rgl）
downstream_specs:
  - R8.B spec-06（treemap-mini widget）
  - R8.B spec-08（status-bar widget 复用 widgetHost）
  - R8.C spec-32（observability widget 注入）
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: react-grid-layout 加载失败
  action: 退化为静态 grid CSS
  - condition: layout 数据损坏
  action: 重置为 default 预设
  - condition: widget 异常崩溃
  action: 该 widget 单独 ErrorBoundary 隔离
  - condition: 布局碰撞
  action: 重置到上一个有效快照
flag_disable: 关闭 R8.B.dashboard.grid 时 Dashboard 路由 disabled
```

---

## 13. performance_budget

```yaml
budgets:
  drag_fps: 60
  layout_change_persist_ms: 100
  widget_lazy_load_p95_ms: 200
  initial_render_ms: 300
  cols_breakpoint_switch_ms: 100
test_harness:
  - benchmark: bench-dashboard-drag.mjs
  target: 60fps in 1000-iter drag loop
```

---

## 14. implementation_status

```yaml
status: verified
implemented_at: 2026-05-05
implementation_boundary:
  completed:
  - devhub/package.json already carries react-grid-layout ^2.2.3 and the implementation uses its actual v2 Responsive/useContainerWidth API.
  - devhub/src/shared/schemas/r8-runtime.ts adds DashboardWidgetId, DashboardGridItem, DashboardLayout, preset, save, reset, and morph result schemas.
  - devhub/src/main/services/R8RuntimeService.ts persists dashboardLayouts in electron-store, exposes four built-in presets, validates the 32-widget limit, and morphs widget instances into Drawer state.
  - devhub/src/main/ipc/r8RuntimeHandlers.ts registers executable dashboard get/save/list/delete/reset/morph handlers.
  - devhub/src/preload/index.ts and devhub/src/renderer/types/global.d.ts expose the dashboard bridge.
  - devhub/src/renderer/components/dashboard/Dashboard.tsx renders Responsive react-grid-layout with draggable handle, resize handle, preset buttons, and md widget instances.
  - devhub/src/renderer/components/dashboard/WidgetRegistry.tsx lazy-loads eight built-in widgets.
  - devhub/src/renderer/components/dashboard/widgets/* read scanner store or real R8 status aggregate data; no production mock dataset is introduced.
  - devhub/src/renderer/App.tsx adds the Dashboard route/toggle and reacts to spec-04 command events for dashboard open and layout apply.
  - devhub/docs/r8/dashboard.md documents the runtime boundary and unclaimed work.
  - devhub/e2e/example.spec.ts verifies the default dashboard layout persists across a real Electron relaunch and renders the restored widget in the real Dashboard route.
  closed_2026_05_16:
  - devhub/scripts/bench-dashboard-drag.mjs builds the production Dashboard bundle and drives a real Chromium pointer drag over react-grid-layout with 1000 iterations.
  - devhub/src/renderer/components/dashboard/dashboard-widget-config.ts defines widget-specific Zod-backed config schemas.
  - devhub/src/renderer/components/dashboard/Dashboard.tsx exposes a real widget config editor and a real R8.B.dashboard.grid disabled surface.
  - devhub/src/renderer/components/settings/SettingsDialog.tsx exposes the same R8.B.dashboard.grid feature flag through the Advanced settings page.
  - devhub/e2e/example.spec.ts verifies restart persistence, config persistence, and feature-flag disable/enable behavior through real Electron IPC.
  - R8.B spec-06 process treemap ownership is covered by the separate verified spec-06 ledger row and is not an open spec-05 boundary.
verification:
  targeted:
  - pnpm -C devhub test --run src/renderer/components/dashboard/dashboard-model.test.ts src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1
  - pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-05" --workers=1 --reporter=line
  - pnpm -C devhub bench:dashboard
  quality_gates:
  - pnpm -C devhub exec tsc --noEmit --pretty false
  - pnpm -C devhub exec eslint src/renderer/components/dashboard/Dashboard.tsx src/renderer/components/dashboard/WidgetRegistry.tsx src/renderer/components/dashboard/dashboard-model.ts src/renderer/components/dashboard/dashboard-widget-config.ts src/renderer/components/dashboard/widgets/ProcessSummaryWidget.tsx src/renderer/components/dashboard/widgets/PortSummaryWidget.tsx src/renderer/components/dashboard/widgets/WindowSummaryWidget.tsx src/renderer/components/dashboard/widgets/AiTaskQueueWidget.tsx src/renderer/components/dashboard/widgets/SystemResourceWidget.tsx src/renderer/components/dashboard/widgets/NotificationsWidget.tsx src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx src/renderer/components/dashboard/widgets/TreemapMiniWidget.tsx src/renderer/stores/dashboardStore.ts src/renderer/hooks/useDashboardLayout.ts src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx e2e/example.spec.ts scripts/bench-dashboard-drag.mjs
  - pnpm -C devhub check:no-emoji
  - pnpm -C devhub check:zod-sot
  - git -C devhub diff --check -- package.json scripts/bench-dashboard-drag.mjs e2e/example.spec.ts src/renderer/components/dashboard/Dashboard.tsx src/renderer/components/dashboard/WidgetRegistry.tsx src/renderer/components/dashboard/dashboard-model.ts src/renderer/components/dashboard/dashboard-model.test.ts src/renderer/components/dashboard/dashboard-widget-config.ts src/renderer/components/dashboard/widgets/ProcessSummaryWidget.tsx src/renderer/components/dashboard/widgets/PortSummaryWidget.tsx src/renderer/components/dashboard/widgets/WindowSummaryWidget.tsx src/renderer/components/dashboard/widgets/AiTaskQueueWidget.tsx src/renderer/components/dashboard/widgets/SystemResourceWidget.tsx src/renderer/components/dashboard/widgets/NotificationsWidget.tsx src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx src/renderer/components/dashboard/widgets/TreemapMiniWidget.tsx src/renderer/hooks/useDashboardLayout.ts src/renderer/stores/dashboardStore.ts src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx
  - git diff --check -- prompts/0503-2/R8.B/spec-05-dashboard-grid-layout.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md devhub/docs/r8/dashboard.md
  - pnpm -C devhub build
```

---

## 15. implementation_status_2026_05_13_electron_restart_e2e

### Verified In This Pass

- `devhub/e2e/example.spec.ts` now contains the real Electron fixture `R8.B spec-05 dashboard default layout persists across real Electron restart`.
- The fixture resets the real default dashboard layout, persists a modified real `DashboardLayout` through `window.devhub.r8.dashboard.saveLayout`, renders the real Dashboard route, closes Electron, relaunches Electron, and verifies the persisted widget position is restored through `dashboard.getLayout('default')`.
- The fixture verifies the restored dashboard page and concrete `dashboard-grid-item-*` DOM node after relaunch, without mock widgets or simulated storage.

### Verification Evidence

```powershell
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-05 dashboard" --workers=1
pnpm -C devhub exec tsc --noEmit --pretty false
```

- Target Playwright fixture passed on 2026-05-13: 1 test passed in 6.4s.
- File-level ESLint and TypeScript `tsc --noEmit` passed on 2026-05-13.

### Remaining Boundaries In This 2026-05-13 Pass

- 60fps drag benchmark/harness, full widget config editor, spec-06 full process treemap tree, and feature-flag UI disable surface were explicitly not claimed by the 2026-05-13 pass. The 2026-05-16 full-closure pass below supersedes this boundary list.

## 16. implementation_status_2026_05_16_full_closure

### Verified In This Pass

- `devhub/scripts/bench-dashboard-drag.mjs` is a real benchmark harness: it builds the production Dashboard bundle, mounts the real Dashboard in Chromium, drives a 1000-step pointer drag on the installed `react-grid-layout` handle, records `requestAnimationFrame` frame deltas, and verifies the layout save path persisted.
- `devhub/src/renderer/components/dashboard/dashboard-widget-config.ts` defines per-widget config schemas and field metadata. `DashboardWidgetConfigEditor` writes normalized config through `updateWidgetConfig()` and the existing `dashboard:save-layout` IPC path.
- All eight dashboard widgets read `item.config` and normalize it before rendering, so settings change visible behavior rather than only storing inert JSON.
- `R8.B.dashboard.grid` can be disabled from the Dashboard route and from Settings Advanced. The disabled route renders `dashboard-disabled-page` and does not mount the grid or widgets until the flag is re-enabled through real IPC.
- `R8.B spec-06` process treemap ownership is covered by the separate verified spec-06 row in the completion ledger; spec-05 now only claims the `treemap-mini` dashboard widget integration boundary.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/dashboard/dashboard-model.test.ts src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-05" --workers=1 --reporter=line
pnpm -C devhub bench:dashboard
pnpm -C devhub exec eslint src/renderer/components/dashboard/Dashboard.tsx src/renderer/components/dashboard/WidgetRegistry.tsx src/renderer/components/dashboard/dashboard-model.ts src/renderer/components/dashboard/dashboard-widget-config.ts src/renderer/components/dashboard/widgets/ProcessSummaryWidget.tsx src/renderer/components/dashboard/widgets/PortSummaryWidget.tsx src/renderer/components/dashboard/widgets/WindowSummaryWidget.tsx src/renderer/components/dashboard/widgets/AiTaskQueueWidget.tsx src/renderer/components/dashboard/widgets/SystemResourceWidget.tsx src/renderer/components/dashboard/widgets/NotificationsWidget.tsx src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx src/renderer/components/dashboard/widgets/TreemapMiniWidget.tsx src/renderer/stores/dashboardStore.ts src/renderer/hooks/useDashboardLayout.ts src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx e2e/example.spec.ts scripts/bench-dashboard-drag.mjs
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
git -C devhub diff --check -- package.json scripts/bench-dashboard-drag.mjs e2e/example.spec.ts src/renderer/components/dashboard/Dashboard.tsx src/renderer/components/dashboard/WidgetRegistry.tsx src/renderer/components/dashboard/dashboard-model.ts src/renderer/components/dashboard/dashboard-model.test.ts src/renderer/components/dashboard/dashboard-widget-config.ts src/renderer/components/dashboard/widgets/ProcessSummaryWidget.tsx src/renderer/components/dashboard/widgets/PortSummaryWidget.tsx src/renderer/components/dashboard/widgets/WindowSummaryWidget.tsx src/renderer/components/dashboard/widgets/AiTaskQueueWidget.tsx src/renderer/components/dashboard/widgets/SystemResourceWidget.tsx src/renderer/components/dashboard/widgets/NotificationsWidget.tsx src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx src/renderer/components/dashboard/widgets/TreemapMiniWidget.tsx src/renderer/hooks/useDashboardLayout.ts src/renderer/stores/dashboardStore.ts src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx
git diff --check -- prompts/0503-2/R8.B/spec-05-dashboard-grid-layout.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md devhub/docs/r8/dashboard.md
pnpm -C devhub build
```

- Targeted unit tests passed: 2 files, 9 tests.
- Targeted Playwright Electron tests passed: 2 tests in 11.2s.
- Dashboard drag benchmark passed with `averageFps: 60`, `p95: 16.7ms`, `dragIterations: 1000`, `moved: true`, `persisted: true`, and `saveCountDelta: 2`.
- `check:no-emoji` passed with no emoji in 630 files.
- `check:zod-sot` passed.
- Production build passed; the remaining Monaco dynamic/static import warning is pre-existing and unrelated to the dashboard slice.

### Remaining Boundaries

- No open `R8.B spec-05` implementation boundary remains in this ledger pass.
- Broader `prompts/0503-2` completion still depends on other partial rows in the completion ledger.
