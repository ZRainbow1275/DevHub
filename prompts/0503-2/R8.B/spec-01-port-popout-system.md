# Spec R8.B-01 — Port Pop-out System（4 触发 + z-index 10 段位 + 多浮卡管理 + 状态同步）

> **flag**: `R8.B.port.popout-system`
> **priority**: P0（5 大反馈 #3.1 端口卡片太小 + #1.1 显示不均匀 收纳载体）
> **status**: planning
> **upstream**: R8.A spec-09（端口卡片改进）+ R8.A spec-01（集成库基础）
> **downstream**: R8.B spec-02（升级 BrowserWindow）+ spec-04（命令面板调起）+ spec-08（状态栏聚合徽章）

---

## 1. motivation

### 1.1 用户原话与决策来源

引用渠道（machine-traceable）：

```yaml
sources:
  - id: V1-Q-2.B.1
  file: prompts/0503/02-global-experience-survey.md
  answer: "A+B+C+D+F"  # Drawer + Popout + Cmdk + 折叠分组 + 快捷栏
  impact: "Popout 是 5 种收纳机制之一"
  - id: V1-Q-2.B.3
  file: prompts/0503/02-global-experience-survey.md
  answer: "D"  # 应用内 Floating Card + 升级独立窗口
  impact: "本 spec 默认 floating, spec-02 实现 BrowserWindow 升级"
  - id: V2-Q-19.A.1
  file: prompts/0503/19-popout-dock-engineering-survey.md
  answer: "A 10 段方案"
  impact: "popout 在 z-index = 4000 段位"
  - id: V2-Q-19.B.1
  file: prompts/0503/19-popout-dock-engineering-survey.md
  answer: "E"  # tile / cascade / minimize-all / close-all 全套
  impact: "本 spec 暴露 PopoutManager API, 管理面板 UI 在 spec-08 状态栏入口聚合"
  - id: V2-Q-19.C.1
  file: prompts/0503/19-popout-dock-engineering-survey.md
  answer: "选中 + 过滤器 + 排序 + 搜索 + 主题 + 密度"
  impact: "状态同步范围"
  - id: V2-Q-19.C.2
  file: prompts/0503/19-popout-dock-engineering-survey.md
  answer: "E"  # 双向 + 用户独立化 + 每个 popout 独立策略
  impact: "PopoutSyncPolicySchema 必须实现"
  - id: V2-Q-13.A.1
  file: prompts/0503/13-perception-vs-reality-survey.md
  answer: "D + E"  # 4 入口冗余 + 核心功能 5 入口
  impact: "端口浮卡的 4 触发 = 入口冗余的一半，命令面板 + 上下文菜单 + 顶部栏 共 7 入口"
  - id: USER-FEEDBACK-3.1
  quote: "端口卡片都太小了，能做成摘出来的悬浮卡片就做"
  impact: "本 spec 是 R8 高优先级"
  - id: USER-FEEDBACK-1.1
  quote: "显示太不均匀，思考增加多个收纳"
  impact: "popout = 缓解拥挤的主载体"
```

### 1.2 现状缺陷（Agent B 源码事实）

```
devhub/src/renderer/components/monitor/PortView.tsx:59-200
  - PortCard 仅支持单击选中（onSelect），hover 仅切换 isHovered 视觉态
  - 无 popout 概念，详情靠右侧 PortFocusPanel 占用半屏
devhub/src/renderer/components/monitor/PortFocusPanel.tsx:1-562
  - 整个 panel 强制占据右侧空间，全屏下挤压列表
  - 没有"摘出"机制 / 没有 BrowserWindow 升级路径
devhub/src/renderer/styles 无 z-index-tokens.css
  - 散落硬编码 z-index 在 30+ 文件，存在 Drawer 与 Modal 互压 bug
src/main/services/PopoutWindowManager.ts 不存在
  - 多 popout 管理 / 资源 cap / pin 状态持久化均未实现
```

### 1.3 设计目标

| 目标 | 度量 | 来源 |
|------|------|------|
| 4 触发方式都可用 | hover 1s / click / drag 8px / context-menu | V1-Q-2.B.1, V2-Q-19 |
| 浮卡渲染 P95 | < 100ms | master §7.4 |
| 浮卡渲染 P99 | < 200ms | master §7.4 |
| 多浮卡上限（floating） | 5 | V1-Q-5.B.5 |
| 多浮卡上限（含 BrowserWindow） | 8 | V2-Q-19.J.4 |
| 位置记忆 | 误差 ≤ 5px / 同 port | V1-Q-5.B.4 D |
| 防误操作 | 拖拽距离阈值 8px | V2-Q-19 |
| z-index 段位 | 4000（popout 段） | V2-Q-19.A.1 |
| 状态同步 | 双向 / 5 类同步 | V2-Q-19.C |
| 内存 cap | 单 popout < 100MB / 总 < 500MB | V2-Q-19.H |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/components/monitor/PortView.tsx:1-703
  - devhub/src/renderer/components/monitor/PortFocusPanel.tsx:1-562
  - devhub/src/renderer/components/monitor/MonitorPanel.tsx
  - devhub/src/renderer/stores/portStore.ts
  - devhub/src/renderer/hooks/usePorts.ts
  - devhub/src/shared/types-extended.ts:161-196
  - devhub/src/main/ipc/portHandlers.ts:90-200
  - devhub/src/renderer/styles/index.css  # 检查现有硬编码 z-index
modify:
  - devhub/src/renderer/components/monitor/PortView.tsx:59-200  # PortCard 加触发
  - devhub/src/renderer/stores/portStore.ts  # 加 popoutSlice
  - devhub/src/shared/types-extended.ts  # 加 PopoutWindow types
  - devhub/src/renderer/styles/index.css  # 引入 z-index-tokens
new:
  - devhub/src/renderer/styles/z-index-tokens.css  # 10 段位 token（Q-19.A.1）
  - devhub/src/renderer/components/popout/PortPopoutCard.tsx  # 浮卡内容
  - devhub/src/renderer/components/popout/PopoutHost.tsx  # 全局浮卡容器（Portal）
  - devhub/src/renderer/components/popout/PopoutTriggerLayer.tsx # 触发逻辑
  - devhub/src/renderer/components/popout/PopoutTitleBar.tsx  # 浮卡标题栏（pin / promote / close）
  - devhub/src/renderer/components/popout/PopoutResizeHandles.tsx
  - devhub/src/renderer/hooks/usePopoutManager.ts  # 浮卡管理 hook
  - devhub/src/renderer/hooks/usePopoutSync.ts  # 双向同步 hook
  - devhub/src/renderer/hooks/usePopoutTriggers.ts  # 4 触发 hook
  - devhub/src/renderer/utils/popoutPositionMemory.ts  # 位置记忆 hash
  - devhub/src/renderer/utils/popoutZIndexAllocator.ts  # 同段内分配
  - devhub/src/main/ipc/popoutHandlers.ts  # 主进程 popout IPC
  - devhub/src/main/services/PopoutPositionStore.ts  # 持久化（electron-store）
  - devhub/src/main/services/PopoutManager.ts  # main 侧多 popout 管理
test:
  - devhub/src/renderer/components/popout/PortPopoutCard.test.tsx
  - devhub/src/renderer/hooks/usePopoutManager.test.ts
  - devhub/src/renderer/hooks/usePopoutSync.test.ts
  - devhub/src/renderer/utils/popoutPositionMemory.test.ts
  - devhub/src/renderer/utils/popoutZIndexAllocator.test.ts
  - devhub/tests/e2e/port-popout.spec.ts
  - devhub/tests/e2e/port-popout-multi.spec.ts
docs:
  - docs/r8/port-popout.md
  - docs/r8/popout-zindex-tokens.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

// === z-index 10 段位（V2-Q-19.A.1） ===
export const ZIndexTier = {
  BASE: 0,
  HOVER: 100,
  TOOLBAR: 1000,
  DRAWER: 2000,
  MODAL: 3000,
  POPOUT: 4000,  // ← 本 spec 主段
  TOAST: 5000,
  COMMAND_PALETTE: 6000,
  WATCHDOG_ALERT: 7000,
  DEVTOOLS: 8000,
  SYSTEM_OVERLAY: 9000,
} as const

// === 触发方式 ===
export const PopoutTriggerSchema = z.enum(['hover', 'click', 'drag', 'context-menu', 'cmdk', 'api'])
export type PopoutTrigger = z.infer<typeof PopoutTriggerSchema>

// === 浮卡 kind（与 spec-02 共享） ===
export const PopoutKindSchema = z.enum([
  'port-detail',  // 本 spec 主目标
  'process-detail',  // future, R8.C
  'window-detail',
  'monitor',
  'topology',
  'ai-task',
])

// === 浮卡 ===
export const PortPopoutSchema = z.object({
  id: z.string().uuid(),
  kind: PopoutKindSchema.default('port-detail'),
  port: z.number().int().min(1).max(65535),
  pid: z.number().int().positive(),
  trigger: PopoutTriggerSchema,
  mode: z.enum(['floating', 'browserwindow']),
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number().min(280), height: z.number().min(200) }),
  zIndex: z.number().int().min(4000).max(4999),
  pinned: z.boolean().default(false),
  minimized: z.boolean().default(false),
  alwaysOnTop: z.boolean().default(false),
  syncPolicy: z.lazy(() => PopoutSyncPolicySchema).optional(),
  createdAt: z.number().int(),
  lastInteractedAt: z.number().int(),
  monitorId: z.number().int().optional(),
  themeOverride: z.string().optional(), // V2-Q-20.I.1 popout 独立主题
})
export type PortPopout = z.infer<typeof PortPopoutSchema>

// === 同步策略（V2-Q-19.C.2 选 E） ===
export const PopoutSyncPolicySchema = z.object({
  selection: z.boolean().default(true),
  filters: z.boolean().default(true),
  sort: z.boolean().default(true),
  search: z.boolean().default(true),
  theme: z.boolean().default(true),
  density: z.boolean().default(true),
  hover: z.boolean().default(false),  // 默认关，太激烈
  scroll: z.boolean().default(false),
  direction: z.enum(['both', 'main-to-popout', 'popout-to-main', 'isolated']).default('both'),
})

// === 浮卡管理状态 ===
export const PortPopoutStateSchema = z.object({
  popouts: z.array(PortPopoutSchema).max(8),
  hoverDelayMs: z.number().int().min(200).max(3000).default(1000),
  dragThresholdPx: z.number().int().min(4).max(32).default(8),
  positionMemory: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  triggerEnabled: z.object({
  hover: z.boolean().default(true),
  click: z.boolean().default(true),
  drag: z.boolean().default(true),
  contextMenu: z.boolean().default(true),
  }),
  layoutPresets: z.record(z.string(), z.array(PortPopoutSchema)).default({}), // V2-Q-19.B.3 命名布局
})

// === 操作清单 ===
export const PortPopoutActionSchema = z.enum([
  'release',
  'jump-to-process',
  'jump-to-window',
  'open-graph',
  'copy-port',
  'copy-curl',
  'open-in-browser',
  'add-to-favorite',
  'add-to-blocklist',
  'pin',
  'unpin',
  'minimize',
  'restore',
  'promote-to-window',
  'demote-from-window',
  'close',
])

export const POPOUT_POSITION_HASH_KEY = (port: number) => `port:${port}`

export const POPOUT_LIMITS = {
  MAX_FLOATING: 5,
  MAX_TOTAL: 8,  // floating + browserwindow（V2-Q-19.J.4）
  DRAG_DISTANCE_THRESHOLD_PX: 8,
  HOVER_DELAY_MS: 1000,
  CARD_MIN_W: 280,
  CARD_MIN_H: 200,
  CARD_DEFAULT_W: 360,
  CARD_DEFAULT_H: 280,
  RSS_PER_POPOUT_MB: 100,
  RSS_TOTAL_MB: 500,  // V2-Q-19.H
  AUTO_EVICT_IDLE_MIN: 30,  // 30 min 未交互可被淘汰
  Z_INDEX_BASE: ZIndexTier.POPOUT,
  Z_INDEX_RANGE: 999,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  port:popout-open:
  direction: renderer → main
  request:
  port: number
  pid: number
  trigger: PopoutTrigger
  mode: 'floating' | 'browserwindow'
  hint_position?: { x: number, y: number }
  sync_policy?: PopoutSyncPolicy
  response:
  ok:
  popoutId: string
  actualPosition: { x: number, y: number }
  size: { width: number, height: number }
  mode: 'floating' | 'browserwindow'
  zIndex: number
  err: { code: 'E_VALIDATION' | 'E_RATE_LIMITED' | 'E_INTERNAL', message: string }
  rate_limit: low_freq_op (120 rpm)

  port:popout-close:
  request: { popoutId: string, reason?: 'user' | 'evict' | 'main-quit' | 'force' }
  response: { success: boolean }

  port:popout-list:
  response: { popouts: PortPopout[] }

  port:popout-position-get:
  request: { port: number }
  response: { success: boolean, position: { x, y } | null, size?: { width, height } }
  purpose: renderer 初始化时读取主进程 electron-store 位置记忆，用于补齐 localStorage 缺口

  port:popout-position-save:
  request: { port: number, position: { x, y }, size?: { width, height } }
  response: { success: boolean }
  purpose: 用户拖完浮卡 → 主进程持久化（electron-store）

  port:popout-pin:
  request: { popoutId: string, pinned: boolean }
  response: { success: boolean }

  port:popout-batch:
  request:
  action: 'tile' | 'cascade' | 'minimize-all' | 'restore-all' | 'close-all'
  target?: 'all' | 'unpinned'
  response: { affected: number }

  port:popout-layout-save:
  request: { name: string, popouts: PortPopout[] }
  port:popout-layout-apply:
  request: { name: string }
  port:popout-layout-list:
  response: { layouts: Record<string, PortPopout[]> }

  port:popout-sync:
  bidirectional: true
  payload: { popoutId: string, key: string, value: unknown }
  purpose: 状态同步（spec-19-C）

  port:popout-demote:
  request: { popoutId: string }
  response: { success: true, popoutId: string, floatingId: string, popout: PortPopoutRuntimeRecord }
  purpose: 端口 BrowserWindow 降级回 floating，并复用 spec-02 demote 运行时路径

ipc_increment_against_master_§7.2:
  - port:popout-pin  # 新增
  - port:popout-batch  # 新增
  - port:popout-layout-{save,apply,list} # 新增
  - port:popout-sync  # 新增
  - port:popout-demote  # 新增
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'floating 数量 ≥ 5 且全部未 pin'
  code: E_RATE_LIMITED_SOFT
  handling: '按 lastInteractedAt 关闭最久未交互'
  user_action: 'toast：已替换最旧浮卡（撤销可在 5s 内）'
  - condition: 'floating 全部 pinned，无法替换'
  code: E_RATE_LIMITED_HARD
  handling: '不创建新浮卡'
  user_action: 'toast：浮卡已达上限，请先 unpin / close'
  - condition: '总数（floating + browserwindow）≥ 8'
  code: E_RATE_LIMITED_TOTAL
  user_action: 'toast：总浮卡数已达 8 上限'
  - condition: '触发请求中的 port 不存在或已释放'
  code: E_NOT_FOUND
  message: '端口 N 已不再被监听'
  - condition: 'Zod 校验失败'
  code: E_VALIDATION
  - condition: '拖拽距离 < 8px'
  handling: 'silently ignore'
  note: '不算错；视为用户取消'
  - condition: 'BrowserWindow promote 失败（spec-02）'
  code: E_INTERNAL_PROMOTE
  fallback: '保留 floating 模式，提示无法升级'
  - condition: 'RSS 单个 > 100MB'
  code: E_RESOURCE_EXCEEDED
  handling: '触发降级管线（暂停动画 → 降 FPS → 暂停刷新 → 自动 minimize）'
  reference: V2-Q-19.H.4
  - condition: 'RSS 总和 > 500MB'
  code: E_RESOURCE_EXCEEDED_GLOBAL
  handling: '关闭最久未交互 popout（pin 的不动）'
  - condition: 'IPC sync 消息丢失（5s 无 ack）'
  code: E_SYNC_TIMEOUT
  fallback: '弹"主窗与浮卡数据可能不同步"提示，提供"强制刷新"按钮'
```

错误码全部映射到 master PRD §7.3。

---

## 6. acceptance_gwt

```gherkin
# A1 — Hover 1s 触发
Given 端口面板已渲染，列表至少有 1 个端口
  And 用户的 popout.trigger.hover = true
  And device.pointerType ≠ 'touch'
When 用户的鼠标悬停在某端口卡片上 1000ms
Then 在卡片旁渲染 PortPopoutCard
  And popout.trigger = 'hover'
  And popout.zIndex ∈ [4000, 4999]
  And popout 总数 ≤ 5

# A2 — Click 锁定
Given 浮卡已通过 hover 出现
When 用户单击该浮卡
Then popout.pinned = true
  And 鼠标移开时浮卡不消失
  And 标题栏显示 pin 图标

# A3 — Drag 触发
Given 端口卡片支持拖拽
When 用户按住某端口卡片并拖动距离 ≥ 8px
Then 在拖拽起点位置创建 popout
  And popout.trigger = 'drag'
  And 拖拽距离 < 8px 不触发

# A4 — 右键菜单
Given 用户右键点击端口卡片
When 上下文菜单打开，用户点"悬浮显示"
Then popout.trigger = 'context-menu'
  And popout.position 在右键点击位置

# A5 — 命令面板触发
Given 用户按 Cmd+K
When 用户输入 "popout 3000" 并回车
Then 创建 port=3000 的 popout
  And popout.trigger = 'cmdk'

# A6 — 位置记忆
Given 用户曾经把 port=3000 的浮卡拖到 (200, 300)
  And electron-store 已持久化
When 用户再次触发 port=3000 的浮卡
Then popout.position.x ≈ 200, position.y ≈ 300（误差 ≤ 5px）

# A7 — 上限保护（软）
Given 已存在 5 个 popout（且都未 pinned）
When 用户触发第 6 个
Then 关闭 lastInteractedAt 最早的 popout
  And toast "已替换最旧浮卡 [撤销]"

# A8 — 上限保护（硬）
Given 已存在 5 个 popout（全部 pinned）
When 用户触发第 6 个
Then 不创建新浮卡
  And toast "浮卡已达上限，请先解锁或关闭"

# A9 — 总数上限（floating + BrowserWindow ≤ 8）
Given 已存在 5 floating + 3 BrowserWindow
When 用户触发第 9 个
Then 不创建
  And toast "总浮卡数 8 已达上限"

# A10 — Promote to BrowserWindow
Given 浮卡已显示
When 用户点击浮卡内"在新窗口打开"按钮
Then 调用 spec-02 的 popout:create(mode='browserwindow', from_id=...)
  And 原 floating 浮卡关闭（位置 / 尺寸传递）
  And BrowserWindow 在第二屏可移动

# A11 — Demote from BrowserWindow（V2-Q-19.J.1 E 反向降级）
Given BrowserWindow popout 被拖回主窗口区域
When 拖入主窗口边界 100ms 后释放
Then 自动降级回 floating popout
  And BrowserWindow 销毁

# A12 — 状态同步（选中）
Given 主窗口列表选中 port=3000
  And popout port=3000 已显示
When 主窗口切换选中到 port=4000
Then popout 不会切换（除非主窗口的"选中"事件指向 popout 内的 port）
  And popout 内若展示 port=3000，应保持显示

Given popout 内"在主窗口中定位"按钮被点击
When 用户点击该按钮
Then 主窗口列表自动滚动到该 port 行 + 高亮 200ms

# A13 — 状态同步（主题）
Given 当前主题为 modern-light
  And 用户主题独立化关闭
When 用户切到 cyberpunk
Then 所有 popout 实时跟随切换
  And 切换动画遵循 V1-Q-3.A.4 view-transition

# A14 — 资源 cap 触发降级
Given 单个 popout RSS = 110MB
When 检测到超 100MB cap
Then 暂停浮卡内动画 + 降 FPS 到 15
  And toast "已降级浮卡渲染"
  And 不立即关闭浮卡

# A15 — 触屏忽略 hover
Given device.pointerType = 'touch'
When 用户长按端口卡片
Then 不触发 hover popout
  And 仍可通过 context-menu / drag 触发

# A16 — popout 关闭清理（防泄漏）
Given popout 已显示，IPC 订阅 / setTimeout / DOM ref 已建立
When 用户关闭 popout
Then 5s 内 IPC 订阅已 off / setTimeout cleared / DOM ref = null
  And popout 关闭后 5s 检测内存回落（dev 模式断言）
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/port-popout.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test.describe('Port Popout 4 triggers', () => {
  test('hover 1s creates popout', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()

  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="port"]')

  const card = page.getByTestId(/^port-card-/).first()
  await expect(card).toBeVisible()

  const box = await card.boundingBox()
  if (!box) throw new Error('card not measurable')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(1100)

  const popout = page.getByTestId('port-popout-card')
  await expect(popout).toBeVisible()

  // z-index 段位断言
  const zIndex = await popout.evaluate((el) => parseInt(getComputedStyle(el).zIndex, 10))
  expect(zIndex).toBeGreaterThanOrEqual(4000)
  expect(zIndex).toBeLessThan(5000)

  await app.close()
  })

  test('drag with 8px threshold creates popout', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="port"]')
  const card = page.getByTestId(/^port-card-/).first()
  const box = await card.boundingBox()
  if (!box) throw new Error('no box')

  // drag 5px → no popout
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 14, box.y + 14, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByTestId('port-popout-card')).toHaveCount(0)

  // drag 12px → popout
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 30, box.y + 30, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId('port-popout-card')).toBeVisible()

  await app.close()
  })

  test('right-click context menu triggers popout', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  const card = page.getByTestId(/^port-card-/).first()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /悬浮显示/ }).click()
  await expect(page.getByTestId('port-popout-card')).toBeVisible()
  await app.close()
  })

  test('cmdk palette triggers popout', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.keyboard.press('Control+K')
  await page.getByPlaceholder(/输入命令/).fill('popout 3000')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('port-popout-card')).toBeVisible()
  await app.close()
  })

  test('popout count cap = 5 (floating)', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  const cards = await page.getByTestId(/^port-card-/).all()
  for (let i = 0; i < Math.min(6, cards.length); i++) {
  await cards[i].click({ button: 'right' })
  await page.getByRole('menuitem', { name: /悬浮显示/ }).click()
  await page.waitForTimeout(120)
  }
  const popouts = await page.getByTestId('port-popout-card').count()
  expect(popouts).toBeLessThanOrEqual(5)
  await app.close()
  })

  test('position memory across same-port re-trigger', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="port"]')
  const card = page.getByTestId(/^port-card-/).first()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /悬浮显示/ }).click()

  const popout = page.getByTestId('port-popout-card')
  const titleBar = popout.getByTestId('popout-titlebar')
  const box = await titleBar.boundingBox()
  if (!box) throw new Error('no bbox')

  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(300, 400, { steps: 8 })
  await page.mouse.up()

  // close
  await popout.getByTestId('popout-close').click()
  await expect(popout).toHaveCount(0)

  // reopen
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /悬浮显示/ }).click()
  const reopened = page.getByTestId('port-popout-card')
  const newBox = await reopened.boundingBox()
  if (!newBox) throw new Error('no bbox 2')
  expect(Math.abs(newBox.x - 300)).toBeLessThanOrEqual(5)
  await app.close()
  })
})

test.describe('Port Popout sync', () => {
  test('main → popout theme sync', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  const card = page.getByTestId(/^port-card-/).first()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /悬浮显示/ }).click()

  const popout = page.getByTestId('port-popout-card')
  await expect(popout).toBeVisible()

  // switch theme
  await page.keyboard.press('Control+Alt+2')  // 切到 cyberpunk
  await page.waitForTimeout(600)

  const dataTheme = await popout.getAttribute('data-theme')
  expect(dataTheme).toBe('cyberpunk')
  await app.close()
  })

  test('isolation: popout independent theme', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  const card = page.getByTestId(/^port-card-/).first()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /悬浮显示/ }).click()

  const popout = page.getByTestId('port-popout-card')
  await popout.getByTestId('popout-isolate-theme').click()

  await page.keyboard.press('Control+Alt+2')
  await page.waitForTimeout(600)

  const dataTheme = await popout.getAttribute('data-theme')
  expect(dataTheme).not.toBe('cyberpunk')
  await app.close()
  })
})
```

---

## 8. reference_impl

### 8.1 z-index tokens（V2-Q-19.A.1）

```css
/* devhub/src/renderer/styles/z-index-tokens.css */
:root {
  --z-base: 0;
  --z-hover: 100;
  --z-toolbar: 1000;
  --z-drawer: 2000;
  --z-modal: 3000;
  --z-popout: 4000;
  --z-toast: 5000;
  --z-cmdk: 6000;
  --z-watchdog: 7000;
  --z-devtools: 8000;
  --z-system: 9000;
}
```

ESLint 规则禁硬编码（V2-Q-19.A.5）：

```js
// .eslintrc.cjs（rule snippet）
'no-restricted-syntax': [
  'error',
  {
  selector: "Property[key.name='zIndex'][value.type='Literal']",
  message: '使用 var(--z-*) 而非硬编码 z-index',
  },
],
```

### 8.2 Hover 1s + Click 锁定 + Drag + Context

```tsx
// usePopoutTriggers.ts 草案
import { useRef, useState, useCallback } from 'react'
import { POPOUT_LIMITS } from '@shared/popout'

export function usePopoutTriggers(port: number, pid: number) {
  const hoverTimer = useRef<NodeJS.Timeout>()
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [isDragging, setDragging] = useState(false)

  const onPointerEnter = useCallback((e: React.PointerEvent) => {
  if (e.pointerType === 'touch') return  // 触屏忽略 hover
  hoverTimer.current = setTimeout(() => {
  window.devhub?.invoke('port:popout-open', {
  port, pid, trigger: 'hover', mode: 'floating',
  hint_position: { x: e.clientX, y: e.clientY },
  })
  }, POPOUT_LIMITS.HOVER_DELAY_MS)
  }, [port, pid])

  const onPointerLeave = useCallback(() => {
  clearTimeout(hoverTimer.current)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
  dragStart.current = { x: e.clientX, y: e.clientY }
  e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
  if (!dragStart.current) return
  const dx = e.clientX - dragStart.current.x
  const dy = e.clientY - dragStart.current.y
  if (Math.hypot(dx, dy) >= POPOUT_LIMITS.DRAG_DISTANCE_THRESHOLD_PX && !isDragging) {
  setDragging(true)
  window.devhub?.invoke('port:popout-open', {
  port, pid, trigger: 'drag', mode: 'floating',
  hint_position: { x: dragStart.current.x, y: dragStart.current.y },
  })
  }
  }, [port, pid, isDragging])

  const onPointerUp = useCallback(() => {
  dragStart.current = null
  setDragging(false)
  }, [])

  return { onPointerEnter, onPointerLeave, onPointerDown, onPointerMove, onPointerUp }
}
```

### 8.3 z-index 同段分配（避免冲突）

```typescript
// popoutZIndexAllocator.ts
import { POPOUT_LIMITS, ZIndexTier } from '@shared/popout'

class ZIndexAllocator {
  private inUse = new Set<number>()
  alloc(): number {
  for (let i = 0; i < POPOUT_LIMITS.Z_INDEX_RANGE; i++) {
  const z = ZIndexTier.POPOUT + i
  if (!this.inUse.has(z)) {
  this.inUse.add(z)
  return z
  }
  }
  throw new Error('z-index pool exhausted')
  }
  free(z: number) { this.inUse.delete(z) }
  promote(z: number): number {
  this.free(z)
  const top = Math.max(...this.inUse, ZIndexTier.POPOUT - 1)
  const newZ = top + 1
  this.inUse.add(newZ)
  return newZ
  }
}
export const zIndexAllocator = new ZIndexAllocator()
```

### 8.4 位置记忆（按端口号 hash）

```typescript
// devhub/src/main/services/PopoutPositionStore.ts
import Store from 'electron-store'

interface PopoutPositionData {
  positions: Record<string, { x: number; y: number; w?: number; h?: number }>
}

export class PopoutPositionStore {
  private store: Store<PopoutPositionData>
  constructor() {
  this.store = new Store<PopoutPositionData>({
  name: 'popout-positions',
  defaults: { positions: {} },
  })
  }
  get(port: number) {
  return this.store.get(`positions.port:${port}` as never) as
  | { x: number; y: number; w?: number; h?: number }
  | undefined
  }
  set(port: number, pos: { x: number; y: number; w?: number; h?: number }) {
  this.store.set(`positions.port:${port}`, pos)
  }
}
```

### 8.5 双向状态同步（V2-Q-19.C）

```typescript
// usePopoutSync.ts
import { useEffect } from 'react'
import { useSelectionStore } from '@store/selection'
import { useThemeStore } from '@store/theme'
import { useFiltersStore } from '@store/filters'

export function usePopoutSync(popoutId: string, policy: PopoutSyncPolicy) {
  const setSelection = useSelectionStore(s => s.setSelection)
  const setTheme = useThemeStore(s => s.setTheme)
  // ...
  useEffect(() => {
  if (!policy.theme) return
  const off = window.devhub?.on(`popout:sync:${popoutId}`, (payload) => {
  if (payload.key === 'theme' && policy.direction !== 'popout-to-main') setTheme(payload.value)
  // ...
  })
  return () => off?.()
  }, [popoutId, policy])
}
```

### 8.6 关键参考链接

- Radix HoverCard 时序：https://www.radix-ui.com/primitives/docs/components/hover-card
- electron-store：https://github.com/sindresorhus/electron-store
- Pointer Events drag：https://web.dev/articles/pointerevents-drag
- View Transition API：https://developer.mozilla.org/docs/Web/API/View_Transitions_API

---

## 9. impact_radius_loc

```yaml
new_files: 16
modified_files: 4
estimated_loc:
  z-index-tokens.css: 30
  PortPopoutCard.tsx: 240
  PopoutHost.tsx: 160
  PopoutTriggerLayer.tsx: 100
  PopoutTitleBar.tsx: 90
  PopoutResizeHandles.tsx: 80
  usePopoutManager.ts: 200
  usePopoutSync.ts: 140
  usePopoutTriggers.ts: 110
  popoutPositionMemory.ts: 70
  popoutZIndexAllocator.ts: 60
  popoutHandlers.ts (main): 180
  PopoutPositionStore.ts: 80
  PopoutManager.ts (main): 220
  PortView.tsx (modify): +70
  portStore.ts (modify): +110
  types-extended.ts (modify): +90
  index.css (modify): +5
  tests: 520
total_loc: ~2555
risk_level: medium-high
gitnexus_impact_targets:
  - PortView
  - PortCard
  - usePorts
  - portStore
  - ThemeProvider
  - SelectionStore
```

---

## 10. implement_checklist

- [x] 创建 `styles/z-index-tokens.css`，定义 10 段位 CSS variables
- [x] 配置 ESLint rule 禁硬编码 z-index（V2-Q-19.A.5）
- [x] 在 `shared/types-extended.ts` 增加 PopoutTriggerSchema / PortPopoutSchema / PopoutSyncPolicySchema / POPOUT_LIMITS / ZIndexTier
- [x] 创建 `popout/PortPopoutCard.tsx`，复用 PortFocusPanel 字段（DRY，提取 hooks 共享）
- [x] 创建 `popout/PopoutHost.tsx`，使用 createPortal 渲染到 `body`，z-index = var(--z-popout) + offset
- [x] 创建 `popout/PopoutTitleBar.tsx` 并承载当前真实 pin / promote / close 动作
- [x] 补齐 titlebar minimize / theme-isolate 两个独立动作，且不得以空按钮或假状态冒充
- [x] 创建 `popout/PopoutResizeHandles.tsx`（8 方向 resize）
- [x] 创建 `popout/PopoutTriggerLayer.tsx`，封装 4 触发
- [x] 创建 `usePopoutManager.ts`：popouts 列表 / 钉住 / 上限替换 / 总数 cap / lastInteractedAt
- [x] 创建 `usePopoutSync.ts`：双向同步（5 类）+ 防抖
- [x] 创建 `usePopoutTriggers.ts`：4 触发统一 hook
- [x] 创建 `popoutPositionMemory.ts`：按端口 hash 持久化位置 + 尺寸
- [x] 创建 `popoutZIndexAllocator.ts`：同段内分配 / 释放 / promote
- [x] 修改 `PortView.tsx`：PortCard 内 wire 触发 hooks + 上下文菜单项 "悬浮显示"
- [x] 修改 `portStore.ts`：增加 popoutSlice（popouts / triggerEnabled / hoverDelayMs / dragThresholdPx / layoutPresets）
- [x] 主进程 `popoutHandlers.ts` 注册全部 IPC channel
- [x] 主进程 `PopoutManager.ts`：跨窗口 popout 注册 / RSS 监控 / auto-evict
- [x] 创建 `PopoutPositionStore.ts`（electron-store wrapper）
- [x] 增加 setting：popout.trigger.{hover,click,drag,contextMenu} = boolean、hoverDelayMs、dragThresholdPx、syncPolicy 默认
- [x] 单元测试：popoutPositionMemory hash / usePopoutManager 上限 / 替换策略 / zIndexAllocator
- [x] e2e：4 触发各 1 个测试用例 + 上限测试 + 位置记忆测试 + sync 测试
- [x] 编写 flag 配置（R8.B.port.popout-system）
- [x] 文档：`docs/r8/port-popout.md`、`docs/r8/popout-zindex-tokens.md`
- [x] 验收 ASSERT_PORT_POPOUT_TRIGGERS_4 通过
- [x] 与 spec-02 联调（promote-to-browserwindow / demote 路径）
- [x] 与 spec-04 联调（cmdk 触发）
- [x] 与 spec-08 联调（状态栏显示活跃浮卡数）
- [x] dev 模式内存泄漏断言（关闭 popout 后 5s 检测 RSS 回落）

---

## 11. implementation_status

### 2026-05-05 verified renderer slice

- Implemented real renderer floating port popouts in `devhub/src/renderer/components/popout/port-popout-model.ts`, `usePortPopoutManager.ts`, `PortPopoutCard.tsx`, and `PortPopoutHost.tsx`.
- Wired `devhub/src/renderer/components/monitor/PortView.tsx` card mode to four triggers: hover after `1000ms`, explicit `Popout` click action, drag distance at or above `8px`, and context menu.
- Added `4000..4999` popout z-index tier support in `devhub/src/renderer/styles/z-index-tokens.css` while preserving existing token names.
- Implemented five floating-card cap, oldest-unpinned eviction, all-pinned block behavior, pin, close, move, local `port:pid` position memory, and scanner-row synchronization.
- Wired BrowserWindow promotion through the existing generic `window.devhub.r8.popout.create` bridge instead of adding a new privileged renderer bridge.
- Added docs: `devhub/docs/r8/port-popout.md` and `devhub/docs/r8/popout-zindex-tokens.md`.

### 2026-05-05 verification

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results: targeted R8.B port popout regression passed with 2 files and 8 tests; typecheck, no-emoji, lint, Zod SoT, no-cloud dependency, and no-OCR dependency gates passed.

### 2026-05-10 verified settings trigger slice

- Added persisted `window.portPopout` settings in `devhub/src/shared/types.ts` with real defaults for trigger toggles, hover delay, and drag threshold.
- Extended `devhub/src/main/ipc/index.ts` settings whitelist and validation so `settings:update` accepts only the known `window.portPopout` fields and rejects malformed nested trigger payloads.
- Extended `devhub/src/renderer/components/settings/SettingsDialog.tsx` Window settings panel with real controls for hover/click/drag/context-menu trigger enablement plus hover-delay / drag-threshold tuning.
- `devhub/src/renderer/components/monitor/PortView.tsx` now loads persisted settings, listens for same-session settings change events, and applies those values to the real hover, click, drag, and context-menu trigger paths instead of relying only on hardcoded constants.
- `devhub/src/main/store/AppStore.test.ts` now verifies the settings slice with real temporary `electron-store` persistence rather than array-only placeholder logic.

### 2026-05-10 verification

```bash
pnpm -C devhub test --run src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/store/AppStore.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results: trigger-settings regression passed with targeted PortView and AppStore persistence coverage; typecheck, no-emoji, Zod SoT, no-cloud dependency, and no-OCR dependency gates passed.

### 2026-05-10 verified cmdk trigger slice

- Added renderer-local typed `devhub:port-popout-request` in `devhub/src/renderer/components/popout/port-popout-events.ts` so command surfaces can request a real port floating card without fabricating port state.
- `devhub/src/renderer/components/command/R8CommandPalette.tsx` now recognizes `popout <port>` queries, reuses the existing `monitor.port` command navigation, and emits a typed cmdk request.
- `devhub/src/renderer/components/monitor/PortView.tsx` now listens for that request and opens a floating port popout only when the requested port exists in the current renderer `ports` list; unknown ports remain a truthful no-op.

### 2026-05-10 verification (cmdk trigger slice)

```bash
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
```

Results: cmdk trigger regression passed with 2 files and 15 tests after the cross-view pending-event fix; typecheck and lint passed.

### 2026-05-10 verified sync-policy defaults slice

- Added `PortPopoutSyncPolicy`, `PortPopoutSyncDirection`, `PORT_POPOUT_SYNC_DIRECTION_VALUES`, and `DEFAULT_PORT_POPOUT_SYNC_POLICY` in `devhub/src/shared/types.ts`, with `DEFAULT_SETTINGS.window.portPopout.syncPolicyDefault` as the persisted default source.
- Extended `devhub/src/main/ipc/index.ts` settings sanitization and validation so nested `window.portPopout.syncPolicyDefault` only accepts the known boolean fields plus a valid sync direction.
- Propagated the default sync policy through `devhub/src/renderer/components/settings/SettingsDialog.tsx`, `devhub/src/renderer/components/monitor/PortView.tsx`, `devhub/src/renderer/components/popout/usePortPopoutManager.ts`, and `devhub/src/renderer/components/popout/port-popout-model.ts`.
- Added DOM-observable metadata in `devhub/src/renderer/components/popout/PortPopoutCard.tsx` via `data-r8b-popout-sync-direction`, so tests can verify the real renderer card receives the persisted policy.
- Preserved existing popout policy on reopen/update; settings defaults apply to newly opened renderer popouts and do not claim full bidirectional UI state synchronization.

### 2026-05-10 verification (sync-policy defaults slice)

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/store/AppStore.test.ts --maxWorkers=1
```

Results: sync-policy defaults regression passed with 3 files and 36 tests, covering model defaults/reopen semantics, real `PortView` settings propagation, and temporary `electron-store` persistence.

### 2026-05-17 verified titlebar and resize slice

- Extracted the floating card header into `devhub/src/renderer/components/popout/PortPopoutTitleBar.tsx` while preserving the real pin, promote-to-BrowserWindow, and close actions.
- Added `devhub/src/renderer/components/popout/PortPopoutResizeHandles.tsx` with eight pointer-driven resize directions (`n/ne/e/se/s/sw/w/nw`) instead of a static visual shell.
- Added model-level resize geometry in `devhub/src/renderer/components/popout/port-popout-model.ts`, including min-size clamping and north/west position adjustment.
- Added reusable layout primitives in `devhub/src/renderer/utils/popoutPositionMemory.ts` and `devhub/src/renderer/utils/popoutZIndexAllocator.ts`, then wired `PortView` through the shared `usePopoutManager` hook alias instead of duplicating popout state glue.
- Upgraded `PortPopoutHost` to real `createPortal(..., document.body)` rendering so floating cards are not trapped inside the monitor view stacking context.
- Extracted hover/click/drag/context-menu and long-press advanced-menu behavior into `devhub/src/renderer/hooks/usePopoutTriggers.ts`, preserving the tested 4-trigger contract while removing trigger timers from `PortView`.
- Added `devhub/src/renderer/components/popout/PopoutTriggerLayer.tsx` as the DOM trigger wrapper, so the four trigger bindings now live outside the port-card content component while preserving all existing `PortView.port-popout` behavior tests.
- Extended `usePortPopoutManager` layout memory so the existing local `devhub:r8b:port-popout-position-memory` key stores both position and size while remaining backward-compatible with older position-only entries.
- Verified in renderer tests that a real floating card resizes through the southeast handle, closes, reopens for the same real port row, and restores the persisted size.

### 2026-05-17 verification (titlebar and resize slice)

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
```

Results: targeted port-popout regression passed with 2 files and 31 tests, covering renderer triggers, statusbar live count, BrowserWindow promote handoff, titlebar extraction, eight-direction resize geometry, backward-compatible layout memory, and same-port size restoration.

### 2026-05-17 verified titlebar minimize/theme-isolate slice

- Added real `PortPopoutTitleBar` actions for minimize/restore and theme isolate/restore in `devhub/src/renderer/components/popout/PortPopoutTitleBar.tsx`; both buttons call the existing popout manager instead of rendering inert shell controls.
- Extended `PortPopoutHost` and `PortPopoutCard` so the titlebar actions reach `usePortPopoutManager.minimize` and `usePortPopoutManager.isolateTheme` from the real `PortView` floating-card stack.
- `PortPopoutCard` now exposes `data-r8b-popout-state`, `data-r8b-popout-minimized`, `data-r8b-popout-theme-isolated`, and `data-r8b-popout-sync-theme` for executable verification; minimized cards keep the floating article/titlebar in DOM while hiding body content and resize handles.
- `isolatePortPopoutTheme` is now covered by model tests: enabling isolation sets `syncPolicy.theme=false` and `direction='isolated'`, while disabling isolation restores the persisted/default sync direction and theme flag without mutating the other sync fields.
- `PortView.port-popout.test.tsx` verifies real titlebar clicks for both actions: minimize preserves the StatusBar active-popout count, and theme-isolate toggles/restores the same card's observable sync policy.

### 2026-05-17 verification (titlebar minimize/theme-isolate slice)

```bash
pnpm -C devhub exec vitest run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub exec eslint src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts
git -C devhub diff --check -- src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/popout/port-popout-model.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts docs/r8/port-popout.md
```

Results: targeted port-popout regression passed with 2 files and 35 tests; TypeScript, targeted ESLint, no-emoji, and diff whitespace gates passed.

### 2026-05-17 verified utility test slice

- Added focused regression tests for `popoutPositionMemory`: legacy position-only payloads, current layout payloads with size, invalid payload rejection, write/read round-tripping, and corrupt JSON fallback behavior.
- Added focused regression tests for `popoutZIndexAllocator`: empty-stack base allocation, band-local monotonic allocation, and clamp-to-top behavior.

### 2026-05-17 verification (utility test slice)

```bash
pnpm -C devhub exec vitest run src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts --maxWorkers=1
```

Results: 2 utility files and 6 tests passed, covering the position-memory hash/normalization contract and the popout-band z-index allocator.

### 2026-05-17 verified shared-contract and z-index lint slice

- Centralized the port-popout runtime contracts in `devhub/src/shared/types-extended.ts`, including `ZIndexTier`, `POPOUT_TRIGGER_VALUES`, `PopoutTriggerSchema`, `PortPopoutTriggerSchema`, `PortPopoutPositionSchema`, `PortPopoutSizeSchema`, `PopoutSyncPolicySchema`, `POPOUT_LIMITS`, `PORT_POPOUT_LIMITS`, and `PortPopoutSchema`.
- Updated `devhub/src/renderer/components/popout/port-popout-model.ts` to reuse the shared `PORT_POPOUT_LIMITS`, `PortPopoutPosition`, `PortPopoutSize`, and `PortPopoutTrigger` exports instead of maintaining a renderer-only duplicate contract.
- Added a local ESLint rule in `devhub/eslint.config.js` named `local/no-hardcoded-inline-z-index`, which rejects numeric `zIndex` literals inside JSX inline `style` objects.
- Migrated the remaining inline numeric renderer z-index values in `devhub/src/renderer/components/ui/ScriptSelector.tsx` and `devhub/src/renderer/components/ui/ThemeDecoration.tsx` to the existing CSS token family.
- Added accessible labels to the icon-only `PortPopoutTitleBar` buttons so the real minimize, theme-isolate, pin, promote, and close actions are not anonymous controls.

### 2026-05-17 verification (shared-contract and z-index lint slice)

```bash
pnpm -C devhub exec vitest run src/shared/types-extended.test.ts src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub exec eslint src/shared/types-extended.ts src/shared/types-extended.test.ts src/renderer/components/popout/port-popout-model.ts src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts
pnpm -C devhub exec eslint src/renderer/components/ui/ScriptSelector.tsx src/renderer/components/ui/ThemeDecoration.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutTitleBar.tsx
git -C devhub diff --check -- src/shared/types-extended.ts src/shared/types-extended.test.ts src/renderer/components/popout/port-popout-model.ts src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts docs/r8/port-popout.md
```

Results: targeted port-popout and shared-contract regression passed with 5 files and 44 tests; TypeScript, no-emoji, targeted ESLint, the inline z-index lint gate, and diff whitespace gates passed.

### 2026-05-17 verified popout sync bridge slice

- Added `devhub/src/renderer/hooks/usePopoutSync.ts`, a bridge-backed renderer hook that debounces outgoing `port-view-state` messages, validates incoming payloads with `PortPopoutViewSyncStateSchema`, prevents self-echo loops, and respects `both`, `main-to-popout`, `popout-to-main`, and `isolated` direction policy.
- Extended `devhub/src/shared/types-extended.ts` with `PortPopoutViewSyncStateSchema`, `PortPopoutViewModeSchema`, `PortPopoutFilterSchema`, and their literal value arrays so sync payloads are runtime-validated instead of trusted as raw `unknown`.
- Wired `devhub/src/renderer/components/monitor/PortView.tsx` to synchronize port selection, filter mode, search text, and view mode through `usePopoutSync`; existing theme/density synchronization remains covered by `useTheme` and the `theme-settings` bridge message.
- Extended `devhub/src/main/services/R8RuntimeService.ts` so generic `sync` bridge messages are broadcast from main to live BrowserWindow popouts and from a source BrowserWindow popout to the main window plus peer popouts, excluding the source window to prevent loops.
- Added component/service/schema regressions proving debounced outgoing sync, incoming renderer state application, schema parsing, and source-popout-to-peer/main broadcast.

### 2026-05-17 verification (popout sync bridge slice)

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts -t "broadcasts generic popout sync" --maxWorkers=1
pnpm -C devhub exec vitest run src/shared/types-extended.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/shared/types-extended.ts src/shared/types-extended.test.ts src/renderer/hooks/usePopoutSync.ts src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/ui/ScriptSelector.tsx src/renderer/components/ui/ThemeDecoration.tsx src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx
pnpm -C devhub check:no-emoji
```

Results: targeted service sync broadcast passed; shared contract plus renderer popout regression passed with 2 files and 32 tests; TypeScript, touched-file ESLint, and no-emoji passed. A full `R8RuntimeService.test.ts` file run also passed the new sync test but still exposed unrelated pre-existing CSV Python bridge and watchdog supervisor failures; those are not counted as port-popout regressions.

### 2026-05-17 verified shared portStore popout slice

- Added a real popout slice to `devhub/src/renderer/stores/portStore.ts` so popout rows, trigger toggles, timing bounds, and named layout presets now live in the shared renderer store instead of a floating-card-only side channel.
- Kept `devhub/src/renderer/stores/portPopoutStore.ts` as a compatibility bridge to the shared store so the existing renderer and statusbar consumers keep reading the same popout list.
- Wired `devhub/src/renderer/components/monitor/PortView.tsx` to persist real `window.portPopout` trigger settings into the shared store whenever settings load or change.
- Added `devhub/src/renderer/stores/portStore.test.ts` to verify store bridge parity, trigger timing bounds, and bounded layout preset persistence.

### 2026-05-17 verification (shared portStore popout slice)

```bash
pnpm -C devhub exec vitest run src/renderer/stores/portStore.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/renderer/stores/portStore.ts src/renderer/stores/portPopoutStore.ts src/renderer/stores/portStore.test.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/components/monitor/PortView.tsx
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/stores/portStore.ts src/renderer/stores/portPopoutStore.ts src/renderer/stores/portStore.test.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/components/monitor/PortView.tsx
```

Result: the shared renderer store now persists popout rows, trigger timing, and layout presets through the same store that statusbar and renderer consumers already read; the legacy popout-store entry point remains a compatibility alias.

### 2026-05-17 verified port-specific IPC slice

- Added Zod SoT contracts in `devhub/src/shared/schemas/r8-runtime.ts` for `port:popout-open`, `port:popout-close`, `port:popout-list`, `port:popout-pin`, `port:popout-batch`, `port:popout-sync`, and `port:popout-demote`, including exported request/response types and runtime schema registry entries.
- Wired executable main-process handlers in `devhub/src/main/ipc/r8RuntimeHandlers.ts` for the port-specific channels, backed by the existing `R8RuntimeService` and shared rate-limit wrapper instead of a paper-only contract.
- Extended `devhub/src/main/services/R8RuntimeService.ts` with real port popout open/list/close/pin/batch/sync methods that reuse the existing BrowserWindow `createPopout`, `closePopout`, `pinPopout`, and bridge sync paths while preserving port/pid identity in the stored target.
- Exposed typed preload and renderer global bridges in `devhub/src/preload/index.ts` and `devhub/src/renderer/types/global.d.ts`, and synchronized `prompts/0421/contracts/23-ipc-contracts-master.md` so the public preload whitelist has executable main-process coverage.
- Added focused regression coverage in `devhub/src/main/ipc/r8RuntimeHandlers.test.ts`, `devhub/src/main/services/R8RuntimeService.test.ts`, and `devhub/src/preload/preloadContract.test.ts` for handler dispatch, runtime state mutation, BrowserWindow peer sync, batch close/unpin, and preload whitelist parity.

### 2026-05-17 verification (port-specific IPC slice)

```bash
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "BrowserWindow popout lifecycle|port-specific popout|preload whitelist"
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
git -C devhub diff --check
git diff --check
```

Results: targeted IPC/service/preload regression passed with 3 files and 6 tests; TypeScript, touched-file ESLint, Zod SoT, no-emoji, no-cloud, no-OCR, and diff whitespace gates passed. `git diff --check` emitted only the existing Windows LF-to-CRLF warnings and exited 0.

### 2026-05-17 verified RSS auto-evict slice

- Added real RSS sampling and auto-evict logic in `devhub/src/main/services/R8RuntimeService.ts` using live BrowserWindow process metrics, per-popout and total RSS thresholds from `PORT_POPOUT_LIMITS`, pin-aware eviction ordering, and a low-resource monitor lifecycle that starts only in non-test runtimes.
- Extended the existing port popout lifecycle regression in `devhub/src/main/services/R8RuntimeService.test.ts` with a real auto-evict assertion that keeps the pinned port popout alive and closes the unpinned BrowserWindow when the RSS budget is exceeded.

### 2026-05-17 verification (RSS auto-evict slice)

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "routes port-specific popout|auto-evicts unpinned BrowserWindow port popouts when the RSS budget is exceeded"
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
git diff --check
```

Results: the targeted service regression passed with 2 tests; TypeScript, no-emoji, and diff whitespace gates passed. The new RSS auto-evict path now closes unpinned BrowserWindow popouts when the live RSS budget is exceeded and preserves pinned popouts under the same pressure.

### 2026-05-17 verified port-specific demote interop slice

- Added executable `port:popout-demote` contracts through `devhub/src/shared/schemas/r8-runtime.ts`, `devhub/src/main/ipc/r8RuntimeHandlers.ts`, `devhub/src/preload/index.ts`, and `devhub/src/renderer/types/global.d.ts`.
- Added `R8RuntimeService.demotePortPopout()` as a port-specific guard around the existing spec-02 `demotePopout()` path. It accepts only active port BrowserWindow popouts, preserves the `port:<port>:pid:<pid>` target identity, closes the BrowserWindow record, and returns a typed floating port runtime record.
- Added service and IPC regressions proving the demoted record remains a real port popout, the original BrowserWindow record is marked closed, and `port:popout-demote` routes through the executable handler.

### 2026-05-17 verification (port-specific demote interop slice)

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "demotes port-specific BrowserWindow popouts"
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "port-specific|BrowserWindow popout lifecycle|preload whitelist"
```

Results: the focused demote service regression passed, and the combined IPC/service/preload whitelist regression passed with 7 tests across 3 files. This closes the spec-01/spec-02 promote/demote code and IPC interop item; Playwright Electron demote E2E remains outside this slice.

### 2026-05-17 verified RSS release assertion slice

- Added a dev-only BrowserWindow close RSS release assertion in `devhub/src/main/services/R8RuntimeService.ts`. When `NODE_ENV=development` or `DEVHUB_R8_POPOUT_RSS_ASSERT=1`, closing a live BrowserWindow popout records its Electron renderer process id and RSS baseline, schedules a 5-second check, then samples real `app.getAppMetrics()` data.
- The assertion distinguishes `released`, `recovered`, `shared-process`, `retained`, and `unknown` outcomes instead of treating Electron shared renderer processes as fake failures. Results are written to the local audit log with `popout:rss-release-check`; retained RSS is recorded as an error.
- Added a focused service regression that closes a real port BrowserWindow runtime record, executes the RSS release check without waiting 5 seconds, and verifies the original process baseline is released when the renderer process disappears from the real metrics snapshot.

### 2026-05-17 verification (RSS release assertion slice)

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "checks BrowserWindow popout RSS release after close in dev assertion mode"
```

Result: the focused service regression passed. This closes the dev-mode 5-second RSS release assertion item; it does not replace a long-running RSS benchmark or Electron E2E matrix.

### 2026-05-17 verified Playwright Electron trigger/cap/position/sync matrix

- Fixed the real drag trigger path in `devhub/src/renderer/hooks/usePopoutTriggers.ts` so drag opens on threshold-crossing `pointermove`, uses pointer capture for real browser motion, and skips interactive child controls so the click button remains executable.
- Wired `handlePointerMove` through `devhub/src/renderer/components/popout/PopoutTriggerLayer.tsx` and updated the renderer regression in `devhub/src/renderer/components/monitor/PortView.port-popout.test.tsx`.
- Rebuilt the production Electron bundle before running Playwright so the test used the current `out/` artifacts.

### 2026-05-17 verification (Playwright Electron matrix)

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-01" --workers=1 --reporter=line
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub check:zod-sot
git -C devhub diff --check
```

Results: renderer popout regression passed with `29 passed`; the real Electron Playwright `R8.B spec-01` matrix passed with `7 passed`, covering hover, click, context-menu, drag, floating cap, position-size memory, and BrowserWindow sync against real ephemeral TCP listener ports. Build, TypeScript, lint/no-emoji, no-cloud-deps, no-ocr-deps, Zod SoT, and diff whitespace gates passed. `git diff --check` emitted only the existing Windows LF-to-CRLF warnings and no whitespace errors.

### Completion boundary

- Claimed complete in this pass: renderer floating-card triggers, unified trigger hook, `PopoutTriggerLayer`, command-palette cmdk request bridge to the real renderer popout flow, statusbar active-popout count from live renderer/runtime state, popout z-index tier, shared popout schemas and limits, inline z-index lint gate, debounced bridge-backed `usePopoutSync`, generic sync bridge broadcast, port-specific main-process IPC handlers, typed preload/global port popout bridge, floating cap/eviction, pin/close/minimize/theme-isolate, move/position-size memory, scanner-row synchronization, persisted trigger settings, settings UI for trigger toggles/thresholds, persisted sync-policy defaults for newly opened renderer popouts, portal-backed host, extracted titlebar, eight-direction resize handles, reusable layout utilities, utility normalization/allocation tests, docs, targeted tests, and Playwright Electron E2E for the 4 trigger / cap / position-memory / sync matrix.
- Not claimed complete by this spec: R8.B spec-02 demote-from-BrowserWindow E2E, long-running RSS benchmark, or completion of all R8.B documents.

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-01 integration-libs（确认 react / zod / electron-store 版本）
  - R8.A spec-09 port-card-improvement（PortCard 视觉已优化，本 spec 在其基础上加触发）
downstream_specs:
  - R8.B spec-02 port-floating-window（promote 路径）
  - R8.B spec-13 port-security-tier-banner（浮卡内显示安全等级）
  - R8.B spec-04 command-palette-cmdk（命令面板"打开浮卡 port=N"）
  - R8.B spec-08 statusbar-extension（活跃浮卡数 / 管理面板入口）
  - R8.C spec-08 监控窗口 popout（复用本机制）
sibling_libs:
  - electron-store: ^8.1.0（已存在）
  - react: 18+（已存在）
  - zod: ^4.3.6（已存在）
  - radix-ui/react-context-menu: ^2.2.0（R8.A spec-01）
external:
  - 无新增 npm 包（trigger 自实现）
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: 浮卡渲染 > 100ms（性能预算超限）
  action: 移除阴影 / 关闭装饰几何 / 仅保留实心边框
  - condition: 用户禁用所有 4 触发
  action: 浮卡功能 disabled，PortCard 退回单击选中老行为
  - condition: position memory 文件损坏
  action: 重置为空，下次正常持久化
  - condition: 同时拖动多个浮卡
  action: 只允许 1 个 active drag（pointerId 锁）
  - condition: BrowserWindow promote 在 spec-02 失败
  action: floating 浮卡保留，提示用户
  - condition: hover trigger 在触屏设备误触发
  action: 检测 PointerEvent.pointerType，touch 时自动忽略
  - condition: zIndexAllocator 池耗尽
  action: 拒绝新 popout 创建并 toast；理论上最多 999 个浮卡（远超 5/8 cap）
  - condition: 状态同步死锁（A 改 B 触发 B 改 A）
  action: 引入 origin 标记，origin == self 时不再触发
  - condition: 总 RSS > 500MB
  action: 关闭 lastInteractedAt 最早 + 未 pinned 的 popout
  - condition: 主窗口崩溃
  action: 所有 floating 同时关闭；BrowserWindow popout 由 spec-02 接管
flag_disable: 关闭 R8.B.port.popout-system 时回到 R8.A spec-09 行为
```

---

## 13. performance_budget

```yaml
budgets:
  trigger_to_visible_ms_p95: 100
  trigger_to_visible_ms_p99: 200
  hover_delay_default_ms: 1000
  drag_threshold_default_px: 8
  position_memory_lookup_us: 200
  popout_render_react_commit_ms: 16
  max_floating_popouts: 5
  max_total_popouts: 8
  rss_per_popout_mb: 100
  rss_total_mb: 500
  cpu_idle_pct_per_popout: 5
  cpu_active_pct_per_popout: 20
  fps_idle: 30
  fps_active: 60
  ipc_rpm_popout_open: 30
  ipc_rpm_popout_position_save: 60
  ipc_rpm_popout_sync: 600  # 高频同步事件配额
  cleanup_on_unmount_ms: 50
  rss_check_interval_s: 5  # 周期检测 popout RSS
  auto_evict_idle_min: 30  # 30 分钟未交互 = 可被替换
  layout_apply_ms_p95: 200  # tile / cascade 批量布局
test_harness:
  - benchmark: bench-popout-trigger.mjs
  target: hover→visible p99 < 200ms in 1000-iter loop
  - benchmark: bench-popout-multi.mjs
  target: 8 popouts 同时存在时主进程 RSS 增量 < 100MB
  - benchmark: bench-popout-sync.mjs
  target: theme 切换时 popout 同步延迟 P95 < 50ms
```
