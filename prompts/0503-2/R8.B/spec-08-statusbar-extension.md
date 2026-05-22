# Spec R8.B-08 — 状态栏扩展（聚合徽章 + 资源磁贴 + 快捷入口）

> **flag**: `R8.B.statusbar.extension`
> **priority**: P1（V1-Q-2.B + V2-Q-13.A.1 入口冗余载体）
> **status**: planning
> **upstream**: R8.B spec-03（statusbar 槽）+ R8.B spec-01（popout 数）+ R8.B spec-04（cmdk 触发）
> **downstream**: R8.C spec-30 通知系统 / spec-32 可观测面板 数据来源

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-2.B.1
  answer: "F"  # 快捷栏 / Pinned Strip
  - id: V2-Q-13.A.1
  answer: "D + E"  # 入口冗余 4-5 处，状态栏是其中之一
  - id: V2-Q-13.B
  answer: "NEW + 未读 + 数字 + 实验性 + 警告 + 错误"
  - id: USER-FEEDBACK-1.1
  quote: "显示太不均匀"
  impact: "状态栏让顶部有限空间承载更多信息"
```

### 1.2 现状缺陷

```
devhub/src/renderer/components/statusbar 不存在
仅在 App.tsx 底部硬编码 "Ready" 文本
无聚合徽章 / 无资源磁贴 / 无 NEW 标记
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 同时显示磁贴 ≥ 7 | CPU / 内存 / 网络 / 电池 / 运行项目 / AI 任务 / 公网端口 / 监听端口 / 通知 / popout 数 |
| 聚合徽章刷新 | 100ms 内 |
| 状态栏高度 | 28px（V2-Q-20.B 各主题统一） |
| 6 类徽章类型 | NEW / 未读 / 数字 / 实验性 / 警告 / 错误 |
| 点击磁贴 | 跳转对应模块 / 打开 Drawer / popout |
| 用户可隐藏磁贴 | 设置中开关 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/App.tsx
  - devhub/src/renderer/stores/* (process / port / window / ai-task)
  - R8.B spec-01 popouts 数据
  - R8.B spec-03 statusbar 槽位
modify:
  - devhub/src/renderer/App.tsx  # 渲染 StatusBar
new:
  - devhub/src/renderer/components/statusbar/StatusBar.tsx
  - devhub/src/renderer/components/statusbar/StatusBarSlot.tsx
  - devhub/src/renderer/components/statusbar/tiles/CpuTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/MemTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/NetTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/BatteryTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/ProjectsTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/AiTasksTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/PublicPortsTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/ListeningPortsTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/NotificationsTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/PopoutManagerTile.tsx
  - devhub/src/renderer/components/statusbar/tiles/ThemeTile.tsx
  - devhub/src/renderer/components/statusbar/Badge.tsx
  - devhub/src/renderer/hooks/useStatusBarAggregate.ts
  - devhub/src/renderer/stores/statusbarStore.ts
  - devhub/src/main/ipc/statusbarHandlers.ts
  - devhub/src/main/services/StatusAggregator.ts
test:
  - devhub/src/renderer/components/statusbar/StatusBar.test.tsx
  - devhub/tests/e2e/statusbar.spec.ts
docs:
  - docs/r8/statusbar.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const StatusTileIdSchema = z.enum([
  'cpu', 'mem', 'net', 'battery',
  'projects', 'ai-tasks', 'public-ports', 'listening-ports',
  'notifications', 'popouts', 'theme', 'cmdk', 'time',
])

export const BadgeTypeSchema = z.enum(['new', 'unread', 'number', 'experimental', 'warning', 'error'])

export const StatusTileSchema = z.object({
  id: StatusTileIdSchema,
  visible: z.boolean().default(true),
  order: z.number().int().min(0).max(20),
  align: z.enum(['left', 'center', 'right']).default('left'),
  badgeType: BadgeTypeSchema.optional(),
  badgeValue: z.union([z.string(), z.number()]).optional(),
  iconToken: z.string().optional(),
  tooltip: z.string().optional(),
  clickAction: z.object({
  type: z.enum(['open-drawer', 'open-popout', 'navigate', 'invoke-cmd', 'open-cmdk']),
  args: z.record(z.string(), z.unknown()).default({}),
  }).optional(),
})
export type StatusTile = z.infer<typeof StatusTileSchema>

export const StatusAggregateSchema = z.object({
  cpuPct: z.number().min(0).max(100),
  memMb: z.number().int(),
  netKbps: z.number(),
  batteryPct: z.number().min(0).max(100).nullable(),
  projectsCount: z.number().int(),
  aiTasksRunning: z.number().int(),
  aiTasksFailed: z.number().int(),
  publicPortsCount: z.number().int(),
  listeningPortsCount: z.number().int(),
  notificationsUnread: z.number().int(),
  popoutsActive: z.number().int(),
  currentTheme: z.string(),
  ts: z.number().int(),
})
export type StatusAggregate = z.infer<typeof StatusAggregateSchema>

export const STATUSBAR_LIMITS = {
  HEIGHT_PX: 28,
  REFRESH_INTERVAL_MS: 1000,
  AGGREGATE_PUSH_DEBOUNCE_MS: 100,
  MAX_VISIBLE_TILES: 14,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  status:aggregate:
  direction: main → renderer
  payload: StatusAggregateSchema
  push: true
  push_interval_ms: 1000
  statusbar:get-config:
  response: { tiles: StatusTile[] }
  statusbar:set-config:
  request: { tiles: StatusTile[] }
  response: { success: boolean }
  statusbar:reset:
  response: { tiles: StatusTile[] }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'aggregate 聚合失败（某子模块异常）'
  handling: '降级显示 N/A，不阻塞其他磁贴'
  - condition: '电池信息不可用（台式机）'
  handling: 'BatteryTile 自动隐藏（visible=false）'
  - condition: 'tile click action 不存在'
  code: E_VALIDATION
  - condition: 'tiles 数量 > 14'
  code: E_VALIDATION
  handling: 'overflow 隐藏到"更多"折叠菜单'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 默认显示 7 磁贴
Given DevHub 启动
Then 状态栏可见 + 默认显示至少 7 个磁贴：CPU / Mem / 项目 / AI 任务 / 公网端口 / 监听端口 / 通知

# A2 — 聚合刷新 100ms
Given AI 任务状态变化（如新增 1 个）
When 1 秒内主进程 push status:aggregate
Then 渲染层在 100ms 内更新对应磁贴数字
  And 数字徽章变化平滑（CSS transition）

# A3 — 磁贴点击跳转
Given 用户点击 ai-tasks 磁贴
Then 触发 clickAction = open-drawer(ai-task.detail)
  And 右侧 Drawer 打开

# A4 — 通知未读徽章
Given 系统有 5 条未读通知
Then notifications 磁贴 badgeType = unread, badgeValue = 5

# A5 — popout 活跃数显示
Given 当前有 3 个浮卡
Then popouts 磁贴 badgeValue = 3
  And 点击磁贴 → 打开 popout-manager Drawer (floating)

# A6 — 用户隐藏磁贴
Given 用户在设置中关闭 battery 磁贴
When 重启
Then 状态栏不再显示 battery

# A7 — NEW 标记
Given 首次启动 R8 后
Then theme 磁贴出现 NEW 徽章（30 天后自动消失）

# A8 — overflow 折叠
Given 14 个磁贴可见
When 用户启用第 15 个
Then 第 15 个被折叠到"更多"按钮
  And 点击展开

# A9 — 主题切换状态栏视觉
Given 当前主题 = constructivism
Then 状态栏背景 = decoration soviet-geo + 字体 Bebas Neue + 圆角 0
  （联动 R8.A 主题 4 维轴）

# A10 — 命令面板入口
Given 用户点击 cmdk 磁贴（图标 Cmd+K）
Then 命令面板打开（spec-04 联动）
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/statusbar.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('statusbar shows 7+ tiles by default', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  const tiles = await page.getByTestId(/^status-tile-/).count()
  expect(tiles).toBeGreaterThanOrEqual(7)
  await app.close()
})

test('clicking ai-tasks opens drawer', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.getByTestId('status-tile-ai-tasks').click()
  await expect(page.getByTestId('drawer-right')).toBeVisible()
  await app.close()
})

test('cmdk tile opens palette', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.getByTestId('status-tile-cmdk').click()
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 StatusAggregator（main）

```typescript
import { EventEmitter } from 'events'

export class StatusAggregator extends EventEmitter {
  private interval?: NodeJS.Timer
  start() {
  this.interval = setInterval(async () => {
  const agg: StatusAggregate = {
  cpuPct: await this.cpu(),
  memMb: await this.mem(),
  netKbps: await this.net(),
  batteryPct: await this.battery(),
  projectsCount: this.projects.count(),
  aiTasksRunning: this.aiTasks.runningCount(),
  aiTasksFailed: this.aiTasks.failedCount(),
  publicPortsCount: this.ports.publicCount(),
  listeningPortsCount: this.ports.listeningCount(),
  notificationsUnread: this.notifications.unreadCount(),
  popoutsActive: this.popouts.activeCount(),
  currentTheme: this.theme.current(),
  ts: Date.now(),
  }
  this.emit('aggregate', agg)
  }, STATUSBAR_LIMITS.REFRESH_INTERVAL_MS)
  }
  stop() { if (this.interval) clearInterval(this.interval) }
}
```

### 8.2 StatusBar React

```tsx
export function StatusBar() {
  const { tiles, aggregate } = useStatusBarAggregate()
  const [visibleTiles, overflowTiles] = useMemo(
  () => splitOverflow(tiles, STATUSBAR_LIMITS.MAX_VISIBLE_TILES),
  [tiles]
  )

  return (
  <div className="statusbar" data-testid="statusbar" style={{ height: STATUSBAR_LIMITS.HEIGHT_PX }}>
  {visibleTiles.map(t => (
  <StatusBarSlot key={t.id} tile={t} aggregate={aggregate} />
  ))}
  {overflowTiles.length > 0 && <OverflowMenu tiles={overflowTiles} />}
  </div>
  )
}
```

### 8.3 关键参考链接

- electron systemPreferences (battery)：https://www.electronjs.org/docs/latest/api/system-preferences
- date-fns formatDistance：https://date-fns.org/

---

## 9. impact_radius_loc

```yaml
new_files: 18
modified_files: 1
estimated_loc:
  StatusBar.tsx: 180
  StatusBarSlot.tsx: 90
  Badge.tsx: 70
  各 tile (12 个): 60 * 12 = 720
  useStatusBarAggregate.ts: 100
  statusbarStore.ts: 130
  statusbarHandlers.ts: 90
  StatusAggregator.ts (main): 220
  App.tsx (modify): +20
  tests: 280
total_loc: ~1900
risk_level: low-medium
```

---

## 10. implement_checklist

- [x] 创建 StatusAggregator 主进程服务（每秒聚合）
- [x] 创建 12 个内置 tile 组件
- [x] StatusBar 渲染 + overflow 折叠
- [x] Badge 组件支持 6 类型
- [x] tile clickAction 路由（drawer / popout / navigate / invoke / cmdk）
- [x] 用户可隐藏磁贴配置持久化（Zod + IPC + preload + renderer apply）
- [x] SettingsDialog 用户可见开关
- [x] tile 顺序持久化配置（Zod + IPC + preload + renderer apply）
- [x] 用户拖拽排序交互
- [x] 与 spec-03 statusbar 槽对齐（status:aggregate 推送通过 IPC）
- [x] 与 spec-04 联动（cmdk 磁贴）
- [x] 与 spec-01 联动（popouts 数）
- [x] 单元覆盖 statusbar model / runtime store / push bridge
- [x] Electron Playwright e2e
- [x] 文档：docs/r8/statusbar.md
- [x] 验收 ASSERT_STATUSBAR_AGGREGATE_BADGES 通过

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.B spec-01 popout 数
  - R8.B spec-03 statusbar 槽
sibling_libs:
  - date-fns: ^4.1.0
  - react-sparklines: ^1.7.0（CPU/Mem mini sparkline）
downstream_specs:
  - R8.C spec-30（通知系统接入 notifications tile）
  - R8.C spec-32（可观测面板复用 aggregate 数据）
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: aggregate 子模块异常
  action: 该 tile 显示 "N/A" + 红点
  - condition: status:aggregate IPC 滞后 > 5s
  action: tile 灰色 + tooltip "数据延迟"
  - condition: 电池 API 不可用
  action: BatteryTile.visible = false
flag_disable: 关闭 R8.B.statusbar.extension 时退化为简单文本
```

---

## 13. performance_budget

```yaml
budgets:
  statusbar_render_ms_p95: 16
  aggregate_push_to_render_ms: 100
  aggregator_compute_ms_p95: 200
  ipc_rpm_aggregate: 60
test_harness:
  - benchmark: bench-statusbar-aggregate.mjs
  target: 1000 次 push p99 < 100ms render
```

---

## 14. implementation_status

```yaml
status: verified
implemented_at: 2026-05-06
completed:
  - shared R8 runtime statusbar tile schemas, badge schemas, click actions, and limits
  - status:aggregate runtime response aligned to the R8.B tile contract
  - 12 built-in statusbar tile definitions rendered through StatusBarSlot
  - StatusBar overflow menu
  - Badge component with new, unread, number, experimental, warning, and error variants
  - tile clickAction routing for drawer, popout-equivalent drawer, monitor navigation, command invocation, and cmdk
  - cmdk tile opens the existing command palette through devhub:open-command-palette
  - popouts tile reads the real runtime popout list
  - renderer hook merging runtime IPC aggregate with local scanner/store reactivity
  - `statusbar:get-config`, `statusbar:set-config`, and `statusbar:reset` executable IPC handlers backed by `electron-store`
  - Zod SoT `StatusbarConfig` / reset request schemas with duplicate tile-id rejection
  - preload and renderer global typings for the statusbar config bridge
  - renderer config application for persisted tile visibility, order, and alignment without replacing live aggregate values
  - `StatusAggregator` main-process service with real one-second interval, immediate publish path, bounded stop lifecycle, and `status:aggregate` webContents push
  - preload `status.onAggregate()` subscription cleanup path and renderer push listener while retaining query fallback
  - SettingsDialog visible statusbar tile toggles and reset control backed by the executable config bridge
  - SettingsDialog drag-and-drop tile ordering persisted through the same executable config bridge
  - `devhub:statusbar-config-changed` local event so saved tile visibility is applied to the mounted statusbar immediately
  - real Electron Playwright E2E for push listener, 12 tiles, 6 badge types, SettingsDialog drag order persistence, tile hiding, live DOM update, and final config restoration
  - `bench-statusbar-aggregate.mjs` 1000-push benchmark using the built Electron app, real preload listener, real StatusAggregator publish path, and statusbar DOM commit marker
  - `ASSERT_STATUSBAR_AGGREGATE_BADGES` closed by E2E badge evidence plus benchmark p99 evidence
  - documentation at devhub/docs/r8/statusbar.md
  - unit coverage for model splitting, merge behavior, 12 tile ids, renderer tile count, cmdk event, topology entrypoint, persisted config application, runtime store round trip, push bridge publish, SettingsDialog tile visibility save/reset, and drag order persistence
not_claimed_complete: []
verification:
  - pnpm -C devhub test --run src/renderer/components/statusbar/statusbar-model.test.ts src/renderer/components/statusbar/StatusBar.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "statusbar|StatusBar|status aggregate|R8.B statusbar"
  - pnpm -C devhub test --run src/renderer/components/statusbar/statusbar-model.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "statusbar|status aggregate|IPC channels"
  - pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/hooks/useStatusBarAggregate.ts src/renderer/components/statusbar/statusbar-model.ts src/renderer/components/statusbar/statusbar-model.test.ts src/main/services/R8RuntimeService.test.ts
  - pnpm -C devhub exec eslint src/main/services/StatusAggregator.ts src/main/services/R8RuntimeService.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/hooks/useStatusBarAggregate.ts src/main/services/R8RuntimeService.test.ts
  - pnpm -C devhub test --run src/renderer/components/settings/SettingsDialog.statusbar.test.tsx src/renderer/components/statusbar/StatusBar.test.tsx src/renderer/components/statusbar/statusbar-model.test.ts --maxWorkers=1 -t "statusbar|SettingsDialog|StatusBar"
  - pnpm -C devhub exec eslint src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx src/renderer/hooks/useStatusBarAggregate.ts src/renderer/components/statusbar/statusbar-model.ts
  - pnpm -C devhub exec tsc --noEmit --pretty false
  - pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1 -t "preload whitelist"
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub build
  - pnpm -C devhub bench:statusbar
  - pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-08" --workers=1 --reporter=line
  - pnpm -C devhub check:zod-sot
  - pnpm -C devhub check:no-cloud-deps
  - pnpm -C devhub check:no-ocr-deps
completion_boundary:
  checked: 16
  open: 0
  reason: "The verified slice closes built-in tiles, rendering, overflow, badges, click routing, cmdk linkage, popout count, config persistence bridge, StatusAggregator push IPC, SettingsDialog visibility and drag-order controls, real Electron E2E, 1000-push render benchmark, ASSERT_STATUSBAR_AGGREGATE_BADGES, docs, and unit tests."
```
