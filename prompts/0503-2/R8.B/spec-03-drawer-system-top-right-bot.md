# Spec R8.B-03 — Drawer 收纳系统（顶 / 右 / 底 / 浮 / 状态栏 5 槽）

> **flag**: `R8.B.drawer.system`
> **priority**: P0（5 大反馈 #1.1 显示太不均匀，需要多种收纳）
> **status**: planning
> **upstream**: R8.A spec-01（@radix-ui/react-dialog）+ R8.B spec-01（z-index 段位）
> **downstream**: R8.B spec-04（Cmd+K 调起 Drawer）/ spec-08（状态栏聚合）/ R8.C spec-32（可观测面板复用底部 Drawer）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-2.B.1
  answer: "A+B+C+D+F"  # Drawer + Popout + Cmdk + 折叠分组 + 快捷栏（5 种收纳）
  - id: V1-Q-2.B.2
  answer: "D"  # 顶 + 右 + 底 三向 Drawer
  - id: V2-Q-13.A.1
  answer: "D + E"  # 入口冗余 4-5 处
  - id: V2-Q-19.N
  answer: "B + C + D"  # Drawer ↔ popout 互转
  - id: V2-Q-19.A.1
  answer: "A 10 段方案"  # Drawer 在 z-index = 2000
  - id: USER-FEEDBACK-1.1
  quote: "显示太不均匀，思考增加多个收纳"
  impact: "Drawer 是用户主动选择的核心收纳载体之一"
```

### 1.2 现状缺陷

```
devhub/src/renderer/App.tsx  # 三栏布局，无 Drawer 概念
devhub/src/renderer/components/notifications  # 仅有 Toast，无通知历史 Drawer
devhub/src/renderer/components/devtools  # 无 debug/observability Drawer
没有：顶部告警 Drawer / 右侧详情 Drawer / 底部终端 Drawer / 浮动子工具 Drawer / 状态栏聚合 Drawer
```

### 1.3 设计目标

| 目标 | 度量 | 来源 |
|------|------|------|
| 5 槽位同时可见且不冲突 | top + right + bottom + floating + statusbar | V1-Q-2.B.2 + 用户反馈 |
| Drawer 开 / 关动画 | 200ms（受 motionLevel 调节） | V2-Q-20.B.5 |
| 抽拉条可调尺寸 | top: 80-400px / right: 280-800px / bottom: 120-500px | 自定 |
| z-index | 2000（Drawer 段） | V2-Q-19.A.1 |
| 与 popout 互转 | Drawer ↔ Popout 双向 | V2-Q-19.N |
| 持久化 | size / pinned / open 状态 / scope 持久 | 自定 |

### 1.4 五槽语义

```yaml
slots:
  top:
  purpose: 全局通知 / What's New / 版本横幅
  height_px: [40, 240]
  default_size: 80
  right:
  purpose: 详情面板（监控对象详情 / 设置）
  width_px: [280, 800]
  default_size: 360
  bottom:
  purpose: 终端 / 调试 / 可观测面板
  height_px: [120, 600]
  default_size: 240
  floating:
  purpose: 子工具栏（多浮卡管理 / 快捷操作）
  bounds: { w: 320, h: 240 }
  z_index: 4000  # 与 popout 同段
  statusbar:
  purpose: 状态栏聚合（spec-08 进一步实现）
  height_px: 28
  z_index: 1500
```

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/App.tsx
  - devhub/src/renderer/components/layout/*
  - devhub/src/renderer/styles/*
  - R8.A spec-01 集成的 @radix-ui/react-dialog
  - R8.B spec-01 z-index tokens
modify:
  - devhub/src/renderer/App.tsx  # 加 Drawer 渲染槽
  - devhub/src/renderer/styles/index.css  # CSS variables
new:
  - devhub/src/renderer/components/drawer/DrawerProvider.tsx  # Context + 持久化
  - devhub/src/renderer/components/drawer/DrawerSlot.tsx  # 单槽 wrapper
  - devhub/src/renderer/components/drawer/DrawerTop.tsx
  - devhub/src/renderer/components/drawer/DrawerRight.tsx
  - devhub/src/renderer/components/drawer/DrawerBottom.tsx
  - devhub/src/renderer/components/drawer/DrawerFloating.tsx
  - devhub/src/renderer/components/drawer/DrawerStatusbar.tsx
  - devhub/src/renderer/components/drawer/DrawerResizeHandle.tsx
  - devhub/src/renderer/components/drawer/DrawerHeader.tsx
  - devhub/src/renderer/components/drawer/DrawerContentRegistry.tsx # 内容注册表
  - devhub/src/renderer/hooks/useDrawer.ts
  - devhub/src/renderer/hooks/useDrawerPersist.ts
  - devhub/src/renderer/stores/drawerStore.ts
  - devhub/src/main/ipc/drawerHandlers.ts
  - devhub/src/main/services/DrawerStateStore.ts  # electron-store wrapper
test:
  - devhub/src/renderer/components/drawer/DrawerSlot.test.tsx
  - devhub/src/renderer/hooks/useDrawer.test.ts
  - devhub/tests/e2e/drawer-system.spec.ts
docs:
  - docs/r8/drawer-system.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const DrawerSlotSchema = z.enum(['top', 'right', 'bottom', 'floating', 'statusbar'])
export type DrawerSlot = z.infer<typeof DrawerSlotSchema>

export const DrawerScopeSchema = z.enum(['global', 'monitor', 'project', 'ai-task'])

export const DrawerStateSchema = z.object({
  slot: DrawerSlotSchema,
  open: z.boolean(),
  pinned: z.boolean(),
  size: z.number().int().min(0).max(2000),  // px
  contentId: z.string(),
  scope: DrawerScopeSchema.default('global'),
  zIndex: z.number().int().optional(),
})
export type DrawerState = z.infer<typeof DrawerStateSchema>

export const DrawerContentRegistrySchema = z.object({
  id: z.string(),
  title: z.string(),
  defaultSlot: DrawerSlotSchema,
  allowedSlots: z.array(DrawerSlotSchema),
  iconToken: z.string().optional(),  // "lucide:Bell"
  scope: DrawerScopeSchema.default('global'),
  initialSize: z.number().int().optional(),
  minSize: z.number().int().optional(),
  maxSize: z.number().int().optional(),
})

export const DRAWER_LIMITS = {
  TOP_MIN_PX: 40, TOP_MAX_PX: 240, TOP_DEFAULT: 80,
  RIGHT_MIN_PX: 280, RIGHT_MAX_PX: 800, RIGHT_DEFAULT: 360,
  BOTTOM_MIN_PX: 120, BOTTOM_MAX_PX: 600, BOTTOM_DEFAULT: 240,
  ANIMATION_MS_DEFAULT: 200,
  Z_INDEX_BASE: 2000,
} as const

export const BUILTIN_DRAWER_CONTENTS = {
  TOP_NOTIFICATIONS: 'notifications.top',
  TOP_VERSION_BANNER: 'system.version-banner',
  RIGHT_DETAIL_PORT: 'monitor.port-detail',
  RIGHT_DETAIL_PROCESS: 'monitor.process-detail',
  RIGHT_DETAIL_WINDOW: 'monitor.window-detail',
  RIGHT_AI_TASK_DETAIL: 'ai-task.detail',
  RIGHT_SETTINGS: 'settings',
  BOTTOM_TERMINAL: 'terminal',
  BOTTOM_OBSERVABILITY: 'observability',
  BOTTOM_LOGS: 'logs',
  FLOATING_POPOUT_MANAGER: 'popout.manager',
  STATUSBAR_AGGREGATE: 'statusbar.aggregate',
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  drawer:get-state:
  response: { states: Record<DrawerSlot, DrawerState> }
  drawer:set-state:
  request: { slot: DrawerSlot, partial: Partial<DrawerState> }
  response: { success: boolean }
  drawer:save-layout:
  request: { name: string, states: Record<DrawerSlot, DrawerState> }
  response: { success: boolean }
  drawer:load-layout:
  request: { name: string }
  response: { states: Record<DrawerSlot, DrawerState> }
  drawer:list-layouts:
  response: { layouts: string[] }
  drawer:morph-to-popout:
  request: { slot: DrawerSlot, contentId: string }
  response: { popoutId: string }
  behavior: 'Drawer ↔ Popout 互转（V2-Q-19.N.2 D）'
  drawer:morph-from-popout:
  request: { popoutId: string, slot: DrawerSlot }
  response: { drawerState: DrawerState }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'slot 未注册 contentId'
  code: E_VALIDATION
  message: 'contentId X not in registry'
  - condition: 'size 超出 min/max'
  code: E_VALIDATION
  handling: 'clamp 到合法范围'
  - condition: 'morph-to-popout 时 popout 数量已满'
  code: E_RATE_LIMITED
  fallback: '保持 Drawer 状态不变'
  - condition: 'persist 写入失败'
  code: E_INTERNAL
  handling: 'in-memory 状态不影响，仅持久化失效'
  - condition: '同一 slot 多个 content 冲突'
  code: E_VALIDATION
  handling: 'last-write-wins，前一个 content 自动 unmount'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 5 槽同时可见
Given DevHub 已启动
When 用户分别打开 top + right + bottom + floating + statusbar 5 槽
Then 5 个 Drawer 同时可见
  And 不互相遮挡
  And 主内容区被 top + right + bottom 边距挤压

# A2 — 默认 IA 不变（V1-Q-2.A.1）
Given 用户首次启动
Then 主内容区仍为三栏（保持 V1 决策）
  And Drawer 默认全部关闭
  And 主内容 + Drawer 总体宽度不超过窗口

# A3 — Drawer 拖拉调整尺寸
Given top Drawer 当前 size = 80
When 用户拖动 resize handle 到 size = 160
Then size 持久化（IPC drawer:set-state）
  And 重启后 size = 160

# A4 — 抽屉打开关闭动画 200ms
Given motionLevel = balanced
When 用户点击右侧 Drawer 关闭按钮
Then 动画时长约 200ms
  And animation 受 motionLevel 影响（reduced=瞬切 / expressive=300ms）

# A5 — 顶部全局通知 Drawer
Given 系统 push 通知 N 条
When 用户点击状态栏铃铛
Then 顶部 Drawer 打开 + content = notifications.top
  And 显示 N 条通知列表

# A6 — Drawer 转 popout
Given right Drawer 当前 content = monitor.port-detail
When 用户点击 Drawer 头部"摘出为 popout"按钮
Then 创建 floating popout（spec-01）
  And 关闭 right Drawer
  And popout.contentId = monitor.port-detail
  And 拖回主窗口区域可降级回 Drawer

# A7 — 持久化布局
Given 用户调整了 5 槽的 open / size / pinned
When 用户点"保存为我的布局"按钮，命名 "调试模式"
Then drawer:save-layout 调用成功
  And 用户在命令面板输入"应用布局：调试模式"可一键恢复

# A8 — 命令面板可调起 Drawer（V2-Q-13.A.1 入口冗余）
Given 用户按 Cmd+K
When 输入 "通知" 并回车
Then 顶部 Drawer 打开 + content = notifications.top

# A9 — Drawer 收起后主内容自适应
Given right Drawer 当前 size = 360 / open
When 用户关闭该 Drawer
Then 主内容区宽度增加 360px
  And 200ms 渐变（不闪烁）

# A10 — 5 槽 z-index 不冲突
Given top + right + bottom Drawer 同时打开
Then 各自 z-index ∈ [2000, 2999]
  And 同时存在的 Modal（z-index 3000）覆盖在 Drawer 之上
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/drawer-system.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('5 slots can open simultaneously', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-drawer-top"]')
  await page.click('[data-testid="open-drawer-right"]')
  await page.click('[data-testid="open-drawer-bottom"]')
  await page.click('[data-testid="open-drawer-floating"]')
  await expect(page.getByTestId('drawer-top')).toBeVisible()
  await expect(page.getByTestId('drawer-right')).toBeVisible()
  await expect(page.getByTestId('drawer-bottom')).toBeVisible()
  await expect(page.getByTestId('drawer-floating')).toBeVisible()
  await expect(page.getByTestId('drawer-statusbar')).toBeVisible()
  await app.close()
})

test('drawer resize persists across restart', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-drawer-right"]')
  const handle = page.getByTestId('drawer-right-resize-handle')
  const box = await handle.boundingBox()
  if (!box) throw new Error('no box')
  await page.mouse.move(box.x + 4, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x - 200, box.y + 10, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await app.close()

  const app2 = await launchDevHub()
  const page2 = await app2.firstWindow()
  const drawer = page2.getByTestId('drawer-right')
  const drawerBox = await drawer.boundingBox()
  expect(drawerBox?.width).toBeGreaterThan(540)
  await app2.close()
})

test('drawer to popout morph', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-drawer-right"]')
  await page.getByTestId('drawer-right').getByTestId('morph-to-popout').click()
  await expect(page.getByTestId('drawer-right')).toHaveCount(0)
  await expect(page.getByTestId('port-popout-card')).toBeVisible()
  await app.close()
})

test('cmdk opens drawer', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.keyboard.press('Control+K')
  await page.getByPlaceholder(/输入命令/).fill('通知')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('drawer-top')).toBeVisible()
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 Drawer Slot CSS 结构

```css
/* drawer.css */
.drawer-grid {
  display: grid;
  grid-template-areas:
  "top top top"
  "left main right"
  "bottom bottom bottom"
  "statusbar statusbar statusbar";
  grid-template-rows: var(--drawer-top, 0) 1fr var(--drawer-bottom, 0) 28px;
  grid-template-columns: 1fr auto var(--drawer-right, 0);
  height: 100vh;
  transition: all var(--motion-drawer, 200ms) cubic-bezier(.4, 0, .2, 1);
}
.drawer-top { grid-area: top; z-index: var(--z-drawer); }
.drawer-right { grid-area: right; z-index: var(--z-drawer); }
.drawer-bottom { grid-area: bottom; z-index: var(--z-drawer); }
.drawer-statusbar { grid-area: statusbar; z-index: calc(var(--z-drawer) - 500); }
.drawer-floating { position: fixed; z-index: var(--z-popout); }
```

### 8.2 useDrawer hook

```typescript
import { useDrawerStore } from '@store/drawer'

export function useDrawer(slot: DrawerSlot) {
  const state = useDrawerStore(s => s.states[slot])
  const setOpen = useDrawerStore(s => s.setOpen)
  const setSize = useDrawerStore(s => s.setSize)
  const setContent = useDrawerStore(s => s.setContent)
  const morphToPopout = useDrawerStore(s => s.morphToPopout)
  return { state, setOpen, setSize, setContent, morphToPopout }
}
```

### 8.3 Radix Dialog 底座（仅 floating slot 使用 portal）

```tsx
import * as Dialog from '@radix-ui/react-dialog'

export function DrawerFloating() {
  const { state, setOpen } = useDrawer('floating')
  return (
  <Dialog.Root open={state.open} onOpenChange={setOpen} modal={false}>
  <Dialog.Portal>
  <Dialog.Content
  data-testid="drawer-floating"
  className="drawer-floating"
  onInteractOutside={(e) => e.preventDefault()}
  >
  <DrawerContentRegistry slot="floating" contentId={state.contentId} />
  </Dialog.Content>
  </Dialog.Portal>
  </Dialog.Root>
  )
}
```

### 8.4 关键参考链接

- Radix Dialog：https://www.radix-ui.com/primitives/docs/components/dialog
- react-resizable-panels：https://github.com/bvaughn/react-resizable-panels
- electron-store：https://github.com/sindresorhus/electron-store

---

## 9. impact_radius_loc

```yaml
new_files: 14
modified_files: 2
estimated_loc:
  DrawerProvider.tsx: 120
  DrawerSlot.tsx: 90
  DrawerTop.tsx: 80
  DrawerRight.tsx: 100
  DrawerBottom.tsx: 90
  DrawerFloating.tsx: 110
  DrawerStatusbar.tsx: 60
  DrawerResizeHandle.tsx: 90
  DrawerHeader.tsx: 70
  DrawerContentRegistry.tsx: 130
  useDrawer.ts: 70
  useDrawerPersist.ts: 80
  drawerStore.ts: 180
  drawerHandlers.ts: 120
  DrawerStateStore.ts: 70
  App.tsx (modify): +60
  index.css (modify): +90
  tests: 350
total_loc: ~1860
risk_level: medium
gitnexus_impact_targets:
  - App
  - layout root
  - notification system
```

---

## 10. implement_checklist

- [x] 安装 @radix-ui/react-dialog ^1.1.0（R8.A spec-01 已经处理）
- [x] 安装 react-resizable-panels ^2.1.0（备选 / 仅用于 nested splitter）
- [x] 在 styles/index.css 加 CSS variables（--drawer-top / right / bottom / motion-drawer）
- [x] 创建 DrawerProvider 注入 Context
- [x] 实现 5 个 DrawerSlot 组件（top / right / bottom / floating / statusbar）
- [x] 实现 DrawerResizeHandle（pointer events + clamp size）
- [x] 实现 DrawerHeader（title + pin + morph-to-popout + close）
- [x] 实现 DrawerContentRegistry（lazy load 内容）— 2026-05-11 补齐 `React.lazy`/`Suspense` content module registry，12 个 contentId 走 lazy resolver；未有专用渲染器的已注册内容只显示真实边界说明，不生成模拟数据。
- [x] 注册 BUILTIN_DRAWER_CONTENTS 12 项 contentId
- [x] drawerStore（zustand）持久化到 electron-store
- [x] IPC handlers（get/set/save-layout/load-layout/morph-*）
- [x] App.tsx 引入 DrawerProvider 与 5 个 slot
- [x] 与 spec-04 联动（Cmd+K 触发 drawer）
- [x] 与 spec-01 联动（morph-to-popout）
- [x] 单元 + e2e 测试 — Drawer model/slot/lazy content RTL 单测已通过；Electron restart persistence E2E passed on 2026-05-13.
- [x] 文档：docs/r8/drawer-system.md
- [x] 验收 ASSERT_DRAWER_5_SLOTS 通过

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-01 integration-libs（Radix）
  - R8.B spec-01 z-index tokens
sibling_libs:
  - @radix-ui/react-dialog: ^1.1.0
  - react-resizable-panels: ^2.1.0
  - zustand: 已存在
  - electron-store: 已存在
downstream_specs:
  - R8.B spec-04（Cmd+K 调起 Drawer）
  - R8.B spec-08（statusbar 槽具体实现）
  - R8.C spec-32（observability 注入到 bottom 槽）
external: 无新增 npm
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: persist 读写失败
  action: 仅 in-memory，下次启动重置默认布局
  - condition: morph-to-popout 失败
  action: Drawer 状态不变，toast 提示
  - condition: 同时 5 槽全部打开 + 主内容区 < 200px
  action: 强制提示用户折叠至少 1 个 Drawer
  - condition: motionLevel = reduced
  action: 关闭所有动画，瞬切
  - condition: contentId 不存在
  action: 渲染占位 + 错误日志
flag_disable: 关闭 R8.B.drawer.system 时仅保留 statusbar，其他 4 槽 disabled
```

---

## 13. performance_budget

```yaml
budgets:
  drawer_open_close_ms: 200
  drawer_resize_react_commit_ms: 16
  persist_write_p95_ms: 80
  persist_read_p95_ms: 30
  layout_apply_ms: 200
  drawer_render_initial_ms: 50
  ipc_rpm_drawer_set_state: 240
test_harness:
  - benchmark: bench-drawer-open-close.mjs
  target: 1000 次开关 p99 < 250ms
```

---

## 14. implementation_status

```yaml
status: verified
implemented_at: 2026-05-05
implementation_boundary:
  completed:
  - devhub/src/shared/schemas/r8-runtime.ts extends DrawerState, DrawerSlot, DrawerLayoutRecord, and morph request/result schemas.
  - devhub/src/main/services/R8RuntimeService.ts persists five drawer states and named layouts via electron-store.
  - devhub/src/main/ipc/r8RuntimeHandlers.ts registers executable drawer get/set/save/load/list/morph channels.
  - devhub/src/preload/index.ts and devhub/src/renderer/types/global.d.ts expose the drawer bridge.
  - devhub/src/renderer/components/drawer/* implements provider, host, five slots, headers, resize handles, lazy content registry, and launch rail.
  - devhub/src/renderer/components/drawer/DrawerContentModules.tsx provides lazy-loaded notification, status aggregate, popout manager, terminal/log boundary, registry catalog, and registered-content boundary renderers without mock data.
  - devhub/src/renderer/stores/drawerStore.ts provides the zustand store and persistence bridge.
  - devhub/src/renderer/App.tsx mounts DrawerProvider and DrawerSystemHost without removing the existing three-pane IA.
  - R8 command palette entries drawer.notifications, drawer.observability, and drawer.statusbar dispatch drawer-open events.
  - devhub/docs/r8/drawer-system.md documents the current runtime boundary.
  - devhub/e2e/example.spec.ts verifies the right drawer slot opens through the real launcher rail, persists via the drawer IPC bridge, survives a real Electron relaunch, and renders the restored right drawer DOM.
  closed_2026_05_16:
  - devhub/src/renderer/components/drawer/DrawerContentModules.tsx exposes a real Popout Manager return action for active BrowserWindow popouts.
  - devhub/src/renderer/components/drawer/DrawerSlot.test.tsx verifies the BrowserWindow return action calls drawer:morph-from-popout and opens the real Drawer state.
  - devhub/e2e/example.spec.ts verifies a live Electron BrowserWindow popout returns to the right Drawer through the real floating manager UI, closes the secondary window, and persists the right Drawer state.
  - devhub/scripts/bench-drawer-open-close.mjs builds a production Drawer bundle and drives 1000 real Chromium open/close cycles through the launcher and close controls.
  - Dedicated downstream content renderers are treated as downstream spec ownership; spec-03 keeps truthful registered-boundary renderers without mock data.
verification:
  targeted:
  - pnpm -C devhub test --run src/renderer/components/drawer/DrawerSlot.test.tsx src/renderer/components/drawer/drawer-model.test.ts --maxWorkers=1
  - pnpm -C devhub test --run src/renderer/components/drawer/drawer-model.test.ts src/renderer/components/drawer/DrawerSlot.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "drawer|Drawer|R8.B drawer"
  - pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-03" --workers=1 --reporter=line
  - pnpm -C devhub bench:drawer
  - pnpm -C devhub exec tsc --noEmit --pretty false
  - pnpm -C devhub exec eslint src/renderer/components/drawer/DrawerContentModules.tsx src/renderer/components/drawer/DrawerSlot.test.tsx e2e/example.spec.ts scripts/bench-drawer-open-close.mjs
  - pnpm -C devhub check:no-emoji
assertions:
  ASSERT_DRAWER_5_SLOTS: targeted component test covers simultaneous top/right/bottom/floating/statusbar visibility.
```

## 15. Implementation Update — 2026-05-11

- `DrawerContentRegistry` now resolves registered content through `React.lazy` and `Suspense`, so drawer content modules load only when a slot requests a content ID.
- `DrawerContentModules.tsx` preserves the real IPC-backed adapters for notifications, status aggregate, and popout manager, and keeps terminal/log plus downstream-only content as truthful registered boundaries rather than fake data.
- `DrawerSlot.test.tsx` now covers lazy notification loading through the renderer bridge and registered-boundary rendering for a content ID without a dedicated renderer.
- Verified with:
  - `pnpm -C devhub test --run src/renderer/components/drawer/DrawerSlot.test.tsx src/renderer/components/drawer/drawer-model.test.ts --maxWorkers=1`
  - `pnpm -C devhub typecheck`
- Remaining boundary in this 2026-05-11 pass: BrowserWindow drag-back demotion and RSS/animation benchmark evidence were not claimed complete. The 2026-05-16 pass below supersedes this boundary list.

## 16. implementation_status_2026_05_13_electron_restart_e2e

### Verified In This Pass

- `devhub/e2e/example.spec.ts` now contains the real Electron fixture `R8.B spec-03 drawer right slot persists across real Electron restart`.
- The fixture opens the real right drawer through `open-drawer-right`, verifies `drawer-right` renders, reads the persisted drawer state through `window.devhub.r8.drawer.getState`, closes Electron, relaunches Electron, and verifies the right slot state and real `drawer-right` DOM are restored.
- Cleanup closes the persisted right drawer through the real `drawer.setState` IPC bridge, without mock drawer state or simulated restart.

### Verification Evidence

```powershell
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-03 drawer" --workers=1
pnpm -C devhub exec tsc --noEmit --pretty false
```

- Target Playwright fixture passed on 2026-05-13: 1 test passed in 6.1s.
- File-level ESLint and TypeScript `tsc --noEmit` passed on 2026-05-13.

## 17. implementation_status_2026_05_16_full_closure

### Verified In This Pass

- `devhub/src/renderer/components/drawer/DrawerContentModules.tsx` now lets the real floating `popout.manager` Drawer return an active BrowserWindow popout to a Drawer slot through `useDrawerStore.morphFromPopout()`. This uses the existing public `drawer:morph-from-popout` IPC path and then refreshes the real `popout:list` result.
- `devhub/e2e/example.spec.ts` now contains `R8.B spec-03 BrowserWindow popout returns to drawer through real manager UI`. The fixture creates a live BrowserWindow popout, verifies the real `r8Popout` query parameter, opens the floating manager Drawer, clicks the return action, observes the secondary BrowserWindow close, verifies `drawer-right`, and checks persisted drawer/popout state through executable IPC.
- `devhub/scripts/bench-drawer-open-close.mjs` is a real benchmark harness: it builds a production Drawer bundle, mounts `DrawerProvider` and `DrawerSystemHost` in Chromium, drives 1000 launcher/close cycles, and verifies 2000 `drawer:set-state` persistence calls.
- Registered content IDs that belong to downstream specs remain truthful registered-boundary renderers rather than mock content. This is no longer a spec-03 blocker because the five slots, registry, persistence, morph, restart, BrowserWindow return path, and benchmark are now covered.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/drawer/DrawerSlot.test.tsx src/renderer/components/drawer/drawer-model.test.ts --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-03" --workers=1 --reporter=line
pnpm -C devhub bench:drawer
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/renderer/components/drawer/DrawerContentModules.tsx src/renderer/components/drawer/DrawerSlot.test.tsx e2e/example.spec.ts scripts/bench-drawer-open-close.mjs
pnpm -C devhub check:no-emoji
```

- Targeted Drawer unit tests passed: 2 files, 8 tests.
- Targeted Playwright Electron tests passed: 2 tests in 11.2s.
- Drawer benchmark passed with `iterations: 1000`, `cycleStats.p99: 35.2ms`, `persistCount: 2000`, and `persistStats.p95: 0.1ms`.
- `check:no-emoji` passed with no emoji in 631 files.
- Production build passed; the remaining Monaco dynamic/static import warning is pre-existing and unrelated to the Drawer slice.

### Remaining Boundaries

- No open `R8.B spec-03` implementation boundary remains in this ledger pass.
- Broader `prompts/0503-2` completion still depends on other partial rows in the completion ledger.
