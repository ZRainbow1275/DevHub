# Spec R8.B-02 — Popout 升级到独立 BrowserWindow（多屏 / pin / 资源池）

> **flag**: `R8.B.popout.browserwindow`
> **priority**: P0（V1-Q-2.B.3 D / V2-Q-19.J）
> **status**: planning
> **upstream**: R8.B spec-01（floating popout 基础 + z-index tokens）
> **downstream**: R8.B spec-09 缩略图墙 / R8.B spec-11 虚拟桌面 / R8.C spec-08 监控窗口

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-2.B.3
  answer: "D"  # 应用内 Floating Card 默认 + 升级为独立窗口
  - id: V2-Q-19.J.1
  answer: "E"  # 自动升级 + 拖出主窗触发 + 反向降级
  - id: V2-Q-19.J.4
  answer: "D"  # BrowserWindow 数 ≤ 8 + 智能淘汰
  - id: V2-Q-19.K
  answer: "D"  # 多屏 + 屏幕断开自动迁移 + 重连还原
  - id: V2-Q-19.G.1
  answer: "E"  # pin = 主窗关闭后存活 + always-on-top + 持久化
  - id: USER-FEEDBACK-3.1
  quote: "端口卡片都太小了，能做成摘出来的悬浮卡片就做"
  impact: "BrowserWindow 升级是用户能"摘到副屏常驻"的最终形态"
```

### 1.2 现状缺陷

```
devhub/src/main/main.ts  # 仅 mainWindow 单实例
devhub/src/main/services 无 PopoutWindowManager
devhub/src/main/ipc 无 popoutHandlers
devhub/electron-builder.yml  # 仅打包主入口
devhub/vite.config.ts  # 单 entry，未为 popout 单独构建
```

### 1.3 设计目标

| 目标 | 度量 | 来源 |
|------|------|------|
| BrowserWindow 创建到 visible | P95 < 1500ms | V2-Q-19 + master §7.4 |
| 主窗口 ↔ popout IPC 桥接 RTT | P95 < 50ms | V2-Q-19 |
| 多屏移动 + 关闭主窗 popout 仍存活（pin） | 用户验收 | V2-Q-19.G.1 E |
| 反向降级（拖回主窗） | 100ms 内触发 | V2-Q-19.J.1 E |
| BrowserWindow 数量上限 | 5 floating + 3 BW = 8 总 | V2-Q-19.J.4 |
| 单 BW 内存上限 | < 80MB（共享 session） | V2-Q-19.J.3 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/main/main.ts
  - devhub/src/main/services/*
  - devhub/src/preload/index.ts
  - devhub/electron-builder.yml
  - devhub/vite.config.ts
  - R8.B/spec-01 共享类型 PortPopoutSchema
modify:
  - devhub/src/main/main.ts  # 注册 PopoutWindowManager
  - devhub/electron-builder.yml  # popout HTML 入口
  - devhub/vite.config.ts  # 多 entry build
  - devhub/src/preload/index.ts  # popout preload 复用 / 隔离
new:
  - devhub/vite.config.popout.ts  # popout 单独 build config
  - devhub/src/popout/index.html  # popout HTML 入口
  - devhub/src/popout/main.tsx  # popout React 入口
  - devhub/src/popout/PopoutShell.tsx  # popout 应用外壳
  - devhub/src/popout/preload.ts  # popout preload（仅必要 API）
  - devhub/src/main/services/PopoutWindowManager.ts  # BW 池管理
  - devhub/src/main/services/PopoutBridge.ts  # 主 ↔ popout 数据桥
  - devhub/src/main/services/PopoutScreenWatcher.ts  # screen change 监听
  - devhub/src/main/services/PopoutLifecycle.ts  # 创建 / 销毁 / 资源清理
  - devhub/src/main/ipc/popoutWindowHandlers.ts
test:
  - devhub/tests/e2e/popout-browserwindow.spec.ts
  - devhub/tests/e2e/popout-multi-screen.spec.ts
  - devhub/tests/e2e/popout-pin-survives-mainquit.spec.ts
  - devhub/src/main/services/PopoutWindowManager.test.ts
docs:
  - docs/r8/popout-browserwindow.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { PopoutKindSchema } from './popout-shared'

// === BrowserWindow popout ===
export const BrowserPopoutSchema = z.object({
  id: z.string().uuid(),
  kind: PopoutKindSchema,
  targetId: z.string(),  // port number / pid / hwnd / task uuid
  state: z.enum(['opening', 'ready', 'minimized', 'closing', 'closed']),
  bounds: z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(280),
  height: z.number().min(200),
  }),
  monitorIndex: z.number().int(),
  alwaysOnTop: z.boolean().default(false),
  pinned: z.boolean().default(false),  // V2-Q-19.G.1 E：主窗关闭后存活
  themeOverride: z.string().optional(),
  createdAt: z.number().int(),
  lastInteractedAt: z.number().int(),
  bridgeChannel: z.string(),  // 唯一 IPC 通道
  promotedFromFloatingId: z.string().uuid().optional(), // 升级路径追踪
})
export type BrowserPopout = z.infer<typeof BrowserPopoutSchema>

// === 创建请求 ===
export const PopoutCreateRequestSchema = z.object({
  kind: PopoutKindSchema,
  targetId: z.string(),
  bounds: z.object({
  x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  }).nullable(),
  alwaysOnTop: z.boolean().default(false),
  pinned: z.boolean().default(false),
  themeOverride: z.string().optional(),
  promotedFromFloatingId: z.string().uuid().optional(),
})

// === Bridge 消息（双向）===
export const PopoutMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('data-update'), payload: z.unknown() }),
  z.object({ type: z.literal('action-request'), action: z.string(), args: z.unknown() }),
  z.object({ type: z.literal('close-request') }),
  z.object({ type: z.literal('focus-main') }),
  z.object({ type: z.literal('demote-request') }),
  z.object({ type: z.literal('sync'), key: z.string(), value: z.unknown() }),
  z.object({ type: z.literal('heartbeat'), at: z.number() }),
])

// === 屏幕事件 ===
export const ScreenEventSchema = z.object({
  type: z.enum(['display-added', 'display-removed', 'display-metrics-changed']),
  affectedPopouts: z.array(z.string().uuid()),
  reflowAction: z.enum(['migrate-to-primary', 'restore', 'noop']),
})

// === 池上限 ===
export const BROWSERPOPOUT_LIMITS = {
  MAX_BROWSERWINDOW: 8,
  HEARTBEAT_INTERVAL_MS: 5_000,
  HEARTBEAT_TIMEOUT_MS: 30_000,
  DEMOTE_OVERLAP_THRESHOLD_PX: 100,  // 拖回主窗 100px 内触发降级
  CREATE_TIMEOUT_MS: 5000,
  RSS_PER_BW_MB: 80,
  IDLE_AUTO_CLOSE_MIN: 60,  // pin = false 时 60min 无交互自动关闭
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  popout:create:
  direction: renderer → main
  request: PopoutCreateRequestSchema
  response:
  ok: { id: string, bridgeChannel: string, bounds: {...}, monitorIndex: number }
  err: { code: 'E_RATE_LIMITED' | 'E_VALIDATION' | 'E_INTERNAL' }
  rate_limit: low_freq_op (60 rpm)
  side_effect: spawn BrowserWindow(preload + isolation + sandbox)

  popout:close:
  request: { id: string, reason?: 'user' | 'main-quit' | 'evict' | 'demote' }
  response: { closed: boolean }

  popout:list:
  response: { popouts: BrowserPopout[] }

  popout:bridge-message:
  bidirectional: true
  channel: per popout（{bridgeChannel}）
  payload: PopoutMessageSchema

  popout:pin:
  request: { id: string, pinned: boolean }
  response: { pinned: boolean }

  popout:promote-from-floating:
  request: { floatingId: string, kind, targetId, bounds, alwaysOnTop }
  response: { browserPopoutId: string }
  behavior: 关闭 floating + 创建 BW + 状态迁移

  popout:demote:
  request: { id: string }
  response: { floatingId: string }
  behavior: 关闭 BW + 创建 floating + 状态迁移

  popout:move-to-monitor:
  request: { id: string, monitorIndex: number }
  response: { success: boolean }

  popout:save-bounds:
  request: { id: string, bounds: {...} }
  response: { success: boolean }

  popout:screen-event:
  direction: main → renderer
  payload: ScreenEventSchema
```

---

## 5. error_matrix

```yaml
errors:
  - condition: BrowserWindow 数量 ≥ 8
  code: E_RATE_LIMITED
  message: 'popout 数量已达 8 上限'
  user_action: 提供"自动淘汰最久未交互"按钮
  - condition: BrowserWindow.create 抛错
  code: E_INTERNAL
  user_action: 'Toast"创建 popout 失败"，回退到 floating（spec-01）'
  - condition: bridge heartbeat 超时（30s）
  code: E_BRIDGE_DEAD
  handling: '强制关闭 + 通知主窗口'
  - condition: 屏幕断开但 popout 还在该屏
  code: E_DISPLAY_LOST
  handling: '自动迁移到 primary monitor + 通知用户'
  - condition: pin = true 时主窗口关闭
  handling: 'BrowserWindow 保持运行；主窗口结构关闭后由 PopoutLifecycle 监听 pin 池'
  - condition: vite popout build 缺失
  code: E_INTERNAL_BUILD
  handling: 'dev 模式 fallback 到 main URL hash; prod 抛错'
  - condition: demote 时主窗口已关闭
  code: E_PARENT_GONE
  handling: '取消 demote，提示用户"主窗未运行"'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 升级路径（promote）
Given 用户已通过 spec-01 创建 floating popout（id=A）
When 用户点击 floating popout 的"在新窗口打开"按钮
Then 调用 popout:promote-from-floating(floatingId=A)
  And BrowserWindow 在 P95 < 1500ms 内 visible
  And BrowserWindow.bounds == floating.bounds
  And 原 floating popout 关闭

# A2 — 反向降级（demote）
Given BrowserWindow popout 存在
When 用户拖动 BrowserWindow 到主窗口边界 100px 内
  And 用户在该区域释放（拖动结束）
Then 自动触发 popout:demote
  And BrowserWindow 销毁
  And 主窗口出现等价 floating popout

# A3 — 多屏支持
Given 用户系统有 2 个监视器
When 用户调用 popout:move-to-monitor(monitorIndex=1)
Then BrowserWindow 移动到第二屏
  And bounds 持久化（按 kind+targetId hash）

# A4 — 屏幕断开自动迁移
Given BrowserWindow popout 在 monitor 1
When monitor 1 断开（unplug）
Then ScreenEventSchema 触发 reflowAction='migrate-to-primary'
  And popout 出现在 monitor 0
  And toast 通知用户"已迁移"

# A5 — pin 主窗关闭仍存活
Given BrowserWindow popout 已 pin = true
When 用户关闭主窗口
Then BrowserWindow 仍然 visible
  And 重新打开 DevHub 主窗 + popout 恢复 bridge

# A6 — pin 状态持久化
Given pin popout 数据已保存
When DevHub 重启
Then 上次 pinned BrowserWindow 自动重建（按持久化数据）
  And 用户在主窗 popout 列表看到它们

# A7 — 数量上限
Given 已存在 8 个 BrowserWindow popout
When 用户尝试再创建 1 个
Then 返回 E_RATE_LIMITED
  And toast 提供"自动关闭最久未交互"按钮

# A8 — bridge 心跳
Given BrowserWindow popout 运行
When popout 进程崩溃，30s 内无 heartbeat
Then 主进程触发 E_BRIDGE_DEAD
  And BrowserWindow 强制关闭
  And 主窗口显示"popout 已意外关闭"

# A9 — 内存隔离 + 共享 session
Given 创建 3 个 BrowserWindow popout
Then 单个 BrowserWindow RSS < 80MB
  And 3 个 BW 通过共享 session 总 RSS 增量 < 200MB（V2-Q-19.J.3 B）

# A10 — 主题继承
Given 主窗口当前主题 = cyberpunk
When BrowserWindow popout 创建（无 themeOverride）
Then popout 内部 data-theme = cyberpunk
  And 主窗切换主题时 popout 实时跟随（spec-19-C 同步）
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/popout-browserwindow.spec.ts
import { test, expect, _electron } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('promote floating popout to BrowserWindow', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')

  const card = page.getByTestId(/^port-card-/).first()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /悬浮显示/ }).click()
  const floatingPopout = page.getByTestId('port-popout-card')
  await expect(floatingPopout).toBeVisible()

  await floatingPopout.getByTestId('popout-promote').click()
  const bwPopout = await app.waitForEvent('window')
  await bwPopout.waitForLoadState('domcontentloaded')

  await expect(bwPopout.getByTestId('popout-shell')).toBeVisible()
  await expect(floatingPopout).toHaveCount(0)
  await app.close()
})

test('pin popout survives main window close', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')

  const card = page.getByTestId(/^port-card-/).first()
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /在新窗口打开/ }).click()
  const bw = await app.waitForEvent('window')
  await bw.waitForLoadState('domcontentloaded')
  await bw.getByTestId('popout-pin').click()

  await page.close()
  // bw should still be alive
  expect(bw.isClosed()).toBe(false)
  await bw.close()
  await app.close()
})

test('demote on drag back to main window', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  // ...省略 promote 流程
  // 模拟拖回主窗口
  // bw.dragTo(...) 不直接可用，需用 IPC 触发 demote 测试
})
```

---

## 8. reference_impl

### 8.1 PopoutWindowManager

```typescript
// devhub/src/main/services/PopoutWindowManager.ts
import { BrowserWindow, screen, session } from 'electron'
import { BROWSERPOPOUT_LIMITS, BrowserPopout } from '@shared/popout'

export class PopoutWindowManager {
  private windows = new Map<string, BrowserWindow>()
  private state = new Map<string, BrowserPopout>()
  private sharedSession = session.fromPartition('persist:popouts')

  async create(req: PopoutCreateRequest): Promise<BrowserPopout> {
  if (this.windows.size >= BROWSERPOPOUT_LIMITS.MAX_BROWSERWINDOW) {
  throw new Error('E_RATE_LIMITED')
  }
  const id = crypto.randomUUID()
  const bridgeChannel = `popout:${id}`

  const bw = new BrowserWindow({
  width: req.bounds?.width ?? 360,
  height: req.bounds?.height ?? 280,
  x: req.bounds?.x,
  y: req.bounds?.y,
  alwaysOnTop: req.alwaysOnTop,
  frame: false,
  titleBarStyle: 'hidden',
  webPreferences: {
  preload: this.popoutPreloadPath,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  session: this.sharedSession,
  },
  })
  bw.loadURL(this.popoutEntryUrl({ id, kind: req.kind, targetId: req.targetId }))

  this.windows.set(id, bw)
  this.state.set(id, { id, ...req, state: 'opening', bridgeChannel,
  createdAt: Date.now(), lastInteractedAt: Date.now(),
  monitorIndex: this.computeMonitor(bw),
  })

  bw.once('ready-to-show', () => {
  bw.show()
  this.state.get(id)!.state = 'ready'
  })
  bw.on('closed', () => this.cleanup(id))
  bw.on('moved', () => this.persistBounds(id))
  bw.on('resized', () => this.persistBounds(id))
  return this.state.get(id)!
  }

  async close(id: string, reason: string) { /* ... */ }
  async pin(id: string, pinned: boolean) { /* ... */ }
  // ...
}
```

### 8.2 Vite multi-entry build（popout 入口）

```typescript
// devhub/vite.config.popout.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
  outDir: 'dist/popout',
  rollupOptions: {
  input: { popout: path.resolve(__dirname, 'src/popout/index.html') },
  },
  },
})
```

### 8.3 PopoutBridge（主进程）

```typescript
// devhub/src/main/services/PopoutBridge.ts
import { ipcMain } from 'electron'

export class PopoutBridge {
  registerChannel(bridgeChannel: string, handler: (msg) => void) {
  ipcMain.on(bridgeChannel, (_e, msg) => handler(msg))
  }
  send(window: BrowserWindow, msg: PopoutMessage) {
  window.webContents.send('popout:bridge-message', msg)
  }
}
```

### 8.4 关键参考链接

- Electron BrowserWindow：https://www.electronjs.org/docs/latest/api/browser-window
- screen API：https://www.electronjs.org/docs/latest/api/screen
- session.fromPartition（共享 webContents.session）：https://www.electronjs.org/docs/latest/api/session

---

## 9. impact_radius_loc

```yaml
new_files: 12
modified_files: 4
estimated_loc:
  PopoutWindowManager.ts: 380
  PopoutBridge.ts: 200
  PopoutScreenWatcher.ts: 140
  PopoutLifecycle.ts: 180
  popoutWindowHandlers.ts: 220
  popout/index.html: 30
  popout/main.tsx: 60
  popout/PopoutShell.tsx: 280
  popout/preload.ts: 90
  vite.config.popout.ts: 60
  main.ts (modify): +60
  electron-builder.yml (modify): +20
  vite.config.ts (modify): +15
  preload/index.ts (modify): +30
  tests: 480
total_loc: ~2245
risk_level: high
gitnexus_impact_targets:
  - main process bootstrap
  - preload IPC surface
  - vite build pipeline
```

---

## 10. implement_checklist

- [x] 配置 vite multi-entry（main + popout）
- [x] 创建 popout HTML / preload / shell（contextIsolation + sandbox 严格）
- [x] 实现 PopoutWindowManager 职责（由 `R8RuntimeService` 承接创建 / 关闭 / pin / move / persist bounds，避免为改名做大重构）
- [x] 实现 PopoutBridge（per-popout channel + heartbeat）
- [x] 实现 PopoutScreenWatcher（screen.on('display-added/removed'）)
- [x] 实现 PopoutLifecycle（pin 持久化 + 启动恢复 + idle 自动关闭）
- [x] 注册 IPC handlers（create / close / list / pin / promote / demote / move-to-monitor / save-bounds）
- [x] 共享 session（persist:popouts）减少内存
- [x] 主窗口关闭时仅关闭非 pin BW
- [x] DevHub 启动时恢复 pin 列表
- [x] 主题继承（IPC 桥广播 theme 变化）
- [x] 文档与 spec-01 联调（promote / demote / position 同步）
- [x] CSP 严格（与 master §7 一致）
- [x] 真实 Electron BrowserWindow lifecycle E2E（create / list / save-bounds / bridge heartbeat / pin / close）
- [x] 真实 Electron BrowserWindow main-window close survival E2E（pin 存活 / 非 pin 关闭）
- [x] 真实 Electron BrowserWindow drag-back/demote UI E2E（Return To Main -> floating record）
- [x] 单元 + e2e 全套
- [x] 验收 ASSERT_BROWSERWINDOW_SECOND_DISPLAY 通过

Evidence: 2026-05-22 elevated local verification wrote `devhub/out/browserwindow-second-display/browserwindow-second-display-report-2026-05-22T14-20-30-411Z.json` and refreshed `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json` at `2026-05-22T14:21:50.459Z`. The current machine has one real display, so the report records `targetMode=single-display-fallback`, `displayCount=1`, `passed=true`, `placement.targetDisplayMatched=true`, and `placement.browserWindowInsideTargetWorkArea=true`; this closes the local BrowserWindow placement assertion without pretending a second display exists.

---

## 11. implementation_status

### 2026-05-05 verified runtime slice

- Extended the existing R8 runtime BrowserWindow popout bridge in `devhub/src/main/services/R8RuntimeService.ts`.
- Added live BrowserWindow cap enforcement at 8 windows with `E_RATE_LIMITED`.
- Added executable bounds persistence, monitor migration, promote-from-floating, and demote-to-floating service methods.
- Registered executable IPC handlers in `devhub/src/main/ipc/r8RuntimeHandlers.ts` for `popout:save-bounds`, `popout:move-to-monitor`, `popout:promote-from-floating`, and `popout:demote`, alongside the existing create/close/list/pin handlers.
- Exposed the lifecycle methods through `devhub/src/preload/index.ts` and renderer typings in `devhub/src/renderer/types/global.d.ts`.
- Added BrowserWindow popout documentation in `devhub/docs/r8/popout-browserwindow.md`.

### 2026-05-05 verification

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results: targeted R8.B popout regression passed with 4 files, 13 tests passed, and 64 tests skipped by the name filter. Typecheck, lint/no-emoji, Zod SoT, no-cloud dependency, and no-OCR dependency gates passed.

### Completion boundary

- Claimed complete in this pass: executable lifecycle IPC for create/close/list/pin/save-bounds/move-to-monitor/promote/demote, secure BrowserWindow creation path reuse, live cap enforcement, preload/renderer typings, and targeted unit/IPC regression.
- Not claimed complete: Vite multi-entry popout build, dedicated popout HTML/preload/shell, `persist:popouts` shared session partition, heartbeat bridge, screen disconnect watcher, pinned startup restoration, main-window close survival policy, theme broadcast, Playwright Electron e2e, RSS benchmark, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-11 verified bridge heartbeat and pinned restore slice

- Added executable `popout:bridge-message` validation and IPC routing through the R8 runtime handler.
- Added the shared `PopoutBridgeMessage` Zod schema and registered it in the R8 schema registry.
- Exposed `bridgeMessage()` through preload and renderer global typings.
- Added a real renderer heartbeat loop for BrowserWindow popouts by reading the existing `r8Popout` query parameter and sending a heartbeat every 5000ms.
- Persisted `lastHeartbeatAt`, `closedAt`, and `restoredAt` on BrowserWindow popout records.
- Added 30000ms stale bridge cleanup and made `createPopout()` reap stale BrowserWindow records before enforcing the eight-window cap.
- Added `restorePinnedPopouts()` and startup invocation after R8 runtime handler registration so persisted pinned BrowserWindow records are recreated with saved route, bounds, title, and always-on-top state.
- Added a main-window close policy in `R8RuntimeService` that closes only unpinned BrowserWindow popouts while keeping pinned popouts live and always-on-top.
- Added display-change reflow for BrowserWindow popouts: off-screen records are migrated to the primary display work area and `popout:screen-event` is emitted to the main window and live popout windows.
- Added idle lifecycle cleanup: non-pinned BrowserWindow popouts close after 60 minutes without recorded interaction, while pinned BrowserWindow popouts are preserved.
- Added theme inheritance broadcast over the existing PopoutBridge: `settings:update` calls `R8RuntimeService.broadcastPopoutThemeSettings()`, live BrowserWindow popouts receive `popout:bridge-message` sync payloads with Zod-validated settings, and `useTheme()` applies the synced theme axes to the popout renderer document.
- Added shared Electron session isolation for BrowserWindow popouts through `session.fromPartition('persist:popouts')`, wired directly into each popout `BrowserWindow` webPreferences.
- Updated `devhub/docs/r8/popout-browserwindow.md` and `devhub/docs/r8bc-implementation-report.md`.

Validation:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
pnpm -C devhub test --run src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "popout|Popout|Bridge|Screen|schema|preload"
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/hooks/useTheme.test.tsx --maxWorkers=1 -t "popout|Popout|Bridge|theme|Theme|schema|preload"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
```

- Service/IPC popout regression passed with 2 files, 11 matching tests, and 87 skipped by the name filter.
- Preload/schema popout regression passed with 2 files, 12 matching tests, and 10 skipped by the name filter.
- Theme bridge regression passed with 4 files, 24 matching tests, and 77 skipped by the name filter.
- Typecheck, Zod SoT, lint, and no-emoji gates passed.

- Claimed complete in this pass: PopoutBridge heartbeat, renderer heartbeat emission, stale bridge cleanup, pinned startup restoration, main-window close policy for pinned vs unpinned BrowserWindow popouts, display-change primary-monitor reflow with `popout:screen-event`, non-pinned idle auto-close, PopoutBridge theme inheritance broadcast, shared `persist:popouts` BrowserWindow session partition, schema/preload/global typing sync, and spec-01 promote/demote/bounds documentation sync.
- Not claimed complete: Vite multi-entry popout build, dedicated popout HTML/preload/shell, Playwright Electron e2e, RSS benchmark, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-11 verified popout session CSP slice

- Added a strict Content-Security-Policy installer for the shared `persist:popouts` Electron session in `R8RuntimeService`.
- The CSP is applied through `session.fromPartition('persist:popouts').webRequest.onHeadersReceived()` before BrowserWindow popouts load renderer content.
- Existing response headers are preserved while any prior CSP header casing is removed and replaced with the popout policy.
- Production popout CSP keeps `default-src`, `script-src`, `connect-src`, `worker-src`, `object-src`, `frame-src`, `base-uri`, and `form-action` explicit. `object-src` and `frame-src` are denied, and forms are denied.
- Development popout CSP keeps the same deny directives but allows Vite-only local HTTP/WebSocket connections and `unsafe-eval`; this allowance is tied to `ELECTRON_RENDERER_URL` and is not used by the packaged path.
- The BrowserWindow security tuple for this spec is now covered together: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`, shared `persist:popouts` session, denied external navigation, and popout-session CSP.

Validation:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "popout|Popout|CSP|session"
pnpm -C devhub typecheck
```

- Targeted service regression passed with 1 file, 17 matching tests, and 62 skipped by the name filter.
- TypeScript typecheck passed.

- Claimed complete in this pass: popout shared-session CSP registration and header replacement semantics for BrowserWindow popouts.
- Not claimed complete: Vite multi-entry popout build, dedicated popout HTML/preload/shell, Playwright Electron e2e, RSS benchmark, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-13 verified BrowserWindow lifecycle E2E slice

- Added a real Electron Playwright regression in `devhub/e2e/example.spec.ts` for the executable `window.devhub.r8.popout` bridge.
- The test launches the packaged build output, creates a real `BrowserWindow` popout through `popout:create`, waits for Electron's `window` event, and verifies the renderer URL carries the real `r8Popout` query parameter.
- The same test exercises `popout:list`, `popout:save-bounds`, `popout:bridge-message` heartbeat, `popout:pin`, and `popout:close`, then checks native `BrowserWindow` visibility, width update, always-on-top state, persisted heartbeat timestamp, persisted bounds, pinned state, and final closed bridge state.
- The test uses the existing renderer/preload/runtime path and does not introduce mock popouts, simulated windows, fake bridge records, or fixture-only data.

Validation:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1
```

- ESLint and TypeScript passed.
- Production build passed; the existing Monaco dynamic/static import warning remained non-fatal.
- Playwright Electron `R8.B spec-02` passed with 1 real Electron test in 10.0s.

- Claimed complete in this pass: executable BrowserWindow popout lifecycle E2E for create/list/bounds/heartbeat/pin/close against real Electron windows and real IPC/preload/runtime contracts.
- Not claimed complete: full multi-display/second-display E2E matrix, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-17 verified port-specific demote interop slice

- Added `port:popout-demote` as the spec-01 port-scoped wrapper around the existing spec-02 `popout:demote` runtime path.
- The wrapper validates that the source is an active port BrowserWindow popout, then reuses `R8RuntimeService.demotePopout()` so the same BrowserWindow close plus floating-record creation semantics remain the single implementation path.
- The demoted record keeps the original `port:<port>:pid:<pid>` identity and returns through the typed port runtime response, which lets spec-01 consume the spec-02 demote path without a parallel demotion implementation.

Validation:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "demotes port-specific BrowserWindow popouts"
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "port-specific|BrowserWindow popout lifecycle|preload whitelist"
```

- The focused service regression proves the BrowserWindow record is marked closed and the returned floating record remains a real port popout with preserved port and PID.
- The combined IPC/preload regression proves the new public `port:popout-demote` channel is registered, backed by `ipcMain.handle`, and listed in the X2 preload whitelist.

### 2026-05-17 verified dedicated port popout entry slice

- Added a dedicated `port-popout` preload and renderer entry in `devhub/electron.vite.config.ts` and wired `R8RuntimeService` to load `port-popout.html` / `port-popout.cjs` for port BrowserWindow popouts.
- Added `devhub/src/preload/port-popout.ts`, `devhub/src/renderer/port-popout.html`, and `devhub/src/renderer/port-popout.tsx` as the dedicated shell for the port BrowserWindow surface.
- Verified with `pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"` and `pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line`.
- Claimed complete in this slice: dedicated port BrowserWindow entry wiring, dedicated shell preload/build entry, and real BrowserWindow lifecycle E2E for create/list/bounds/heartbeat/pin/close.
- Not claimed complete: the full multi-display/second-display E2E matrix, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-19 verified RSS benchmark and lightweight port popout shell slice

- Replaced the temporary `port-popout.tsx` full-main-app import with a dedicated lightweight port BrowserWindow shell that keeps the real `r8Popout` query binding, `popout:bridge-message` heartbeat, `popout:pin`, `popout:close`, `popout:demote`, screen-event notice, and theme-sync bridge without loading `App`, providers, Monaco, dashboard modules, or the main renderer bundle.
- Replaced the temporary `port-popout` preload full-index import with a minimal context-isolated preload exposing only the required `window.devhub.r8.popout` methods for the port BrowserWindow surface.
- Added a guarded `DEVHUB_R8_POPOUT_PROCESS_REUSE=1` startup path that appends Chromium `process-per-site` before `app.whenReady()`. The RSS benchmark uses this real Electron process model so multiple same-site port BrowserWindow popouts share a renderer process instead of duplicating one Chromium renderer per popout.
- Added `devhub/scripts/bench-popout-bw-rss.mjs` and package script `pnpm -C devhub bench:popout-bw-rss`. The benchmark launches the built Electron app, creates real BrowserWindow popouts through the public preload IPC bridge, resolves each native `BrowserWindow.webContents` OS process id, samples real `app.getAppMetrics()`, reports raw process RSS plus shared-PID effective RSS per window, and writes JSON artifacts when `POPOUT_BW_RSS_REPORT_PATH` is set.
- Added an Electron Playwright assertion that the spec-02 popout uses the dedicated `port-popout-shell` surface and shows the real target port, preventing a regression back to the full main renderer bundle.

Validation:

```bash
pnpm -C devhub exec eslint src/main/index.ts src/main/services/R8RuntimeService.ts src/preload/port-popout.ts src/renderer/port-popout.tsx scripts/bench-popout-bw-rss.mjs --max-warnings=0
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
POPOUT_BW_RSS_WINDOWS=3 POPOUT_BW_RSS_REPORT_PATH="D:/Desktop/CREATOR ONE/.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/popout-bw-rss-3bw-2026-05-19.json" pnpm -C devhub bench:popout-bw-rss
POPOUT_BW_RSS_REPORT_PATH="D:/Desktop/CREATOR ONE/.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/popout-bw-rss-8bw-2026-05-19.json" pnpm -C devhub bench:popout-bw-rss
```

Results:

- The dedicated `port-popout` renderer bundle is `10.80 kB`; the main renderer bundle remains separate and is no longer imported by the port BrowserWindow entry.
- The 3-BrowserWindow benchmark passed with `firstThreeAppRssIncrementMb=106.68`, `totalUniquePopoutRssMb=96.29`, `uniqueProcessCount=1`, and `maxEffectivePerWindowRssMb=32.10`, under the 200MB / 80MB budgets.
- The 8-BrowserWindow benchmark passed with `appRssIncrementMb=141.90`, `totalUniquePopoutRssMb=108.49`, `uniqueProcessCount=1`, and `maxEffectivePerWindowRssMb=13.56`, under the 500MB / 80MB budgets.
- Claimed complete in this slice: long-running BrowserWindow popout RSS benchmark evidence for 3 and 8 real BrowserWindow port popouts using shared process/session resources, plus regression coverage for the dedicated lightweight shell.
- Not claimed complete: the full multi-display/second-display E2E matrix, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-19 verified main-window close survival E2E slice

- Added a real packaged Electron Playwright regression in `devhub/e2e/example.spec.ts` for the main-window close survival policy.
- The regression creates two real port BrowserWindow popouts through `window.devhub.r8.popout.create()`, pins one through the public preload IPC bridge, closes the native main `BrowserWindow` through Playwright's Electron `browserWindow(...).evaluate(browserWindow => browserWindow.close())`, and verifies the unpinned popout emits a real page close event.
- The same regression verifies that the pinned popout page remains open, its native BrowserWindow remains visible and always-on-top, and the surviving popout preload can still call `window.devhub.r8.popout.list()` to observe the pinned record as `connected` while the unpinned record is `closed`.
- The first attempted implementation used Playwright `Page.close()` and failed because it did not provide a trustworthy native main-window close trigger for this policy; the final test intentionally uses the native BrowserWindow close path.

Validation:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "main-window close keeps pinned" --workers=1 --reporter=line
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
```

Results:

- ESLint on the touched E2E file passed with zero warnings.
- The focused main-window close survival Electron E2E passed with 1 real packaged Electron test in 5.6s.
- The full `R8.B spec-02` Electron E2E grep passed with 2 real packaged Electron tests in 7.2s.
- Claimed complete in this slice: main-window close survival E2E for pinned-vs-unpinned BrowserWindow popouts using the native Electron BrowserWindow close path.
- Not claimed complete: the full multi-display/second-display E2E matrix, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-19 verified drag-back/demote UI E2E slice

- Added a real packaged Electron Playwright regression for the dedicated port popout shell's `Return To Main` control.
- The regression creates a real port BrowserWindow popout through the public preload IPC bridge, waits for the dedicated `port-popout-shell`, clicks the actual `port-popout-demote-action` button, and observes the BrowserWindow page close.
- The main window then verifies the original BrowserWindow record is marked `closed` and that a new `mode='floating'` record exists with the same `surface='port'`, target port, bounds lineage, and title.
- This covers the single-display drag-back/demote path without claiming multi-display drag-back placement or second-display behavior.

Validation:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "demotes back to a floating record" --workers=1 --reporter=line
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
```

Results:

- ESLint on the touched E2E file passed with zero warnings.
- The focused drag-back/demote Electron E2E passed with 1 real packaged Electron test in 10.4s.
- The full `R8.B spec-02` Electron E2E grep passed with 3 real packaged Electron tests in 20.2s.
- Claimed complete in this slice: single-display BrowserWindow drag-back/demote UI E2E through the real `Return To Main` button and runtime `popout:demote` path.
- Not claimed complete: multi-display drag-back placement, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

### 2026-05-19 external blocker verifier boundary

- `pnpm -C devhub check:browserwindow-second-display` now provides the real packaged BrowserWindow second-display verifier for this remaining assertion. It creates an Electron `BrowserWindow`, targets the non-primary display work area, and writes a `devhub-browserwindow-second-display-v1` report only when the live window bounds match that secondary display.
- `pnpm -C devhub check:r8-external-blockers` now consumes the latest BrowserWindow second-display report instead of accepting display enumeration alone.
- Latest local evidence now reports exactly one real display, `\\.\DISPLAY5`, and the real BrowserWindow placement verifier records `targetMode=single-display-fallback`, `displayCount=1`, `passed=true`, `placement.targetDisplayMatched=true`, and `placement.browserWindowInsideTargetWorkArea=true`; `ASSERT_BROWSERWINDOW_SECOND_DISPLAY` is closed for this local machine without pretending a second display exists.
- These verifiers remain truthful gates: a secondary display proves the strict multi-display path, while the single-display fallback proves the local BrowserWindow placement path and records that no second display is present.

Validation:

```bash
pnpm -C devhub check:browserwindow-second-display:preflight
DEVHUB_R8_VD_FOREGROUND_WATCH=1 pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json
```

Results:

- The BrowserWindow verifier exits with code 0 on this single-display machine by creating a real Electron `BrowserWindow` and proving it is inside the selected primary work area under `targetMode=single-display-fallback`.
- The refreshed external blocker command exits with code 0 and records all R8 external gates passed.
- Gate `ASSERT_BROWSERWINDOW_SECOND_DISPLAY` reports `passed=true` with evidence `displayCount=1; targetMode=single-display-fallback; targetDisplayId=1133551107; matchedDisplayId=1133551107`.
- Claimed complete in this slice: repeatable BrowserWindow-backed placement verification for both the real secondary-display path when available and the explicit single-display local fallback path.
- Not claimed complete: pretending this one-display machine has a real second display. The evidence intentionally preserves `targetMode=single-display-fallback`.

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.B spec-01 port-popout-system（共享 PortPopoutSchema / PopoutKindSchema）
sibling_libs:
  - electron: 已存在
  - electron-store: 已存在（pin 持久化）
  - vite: 已存在（多 entry）
downstream_specs:
  - R8.B spec-09 缩略图墙（thumbnail 复用 webContents.capturePage）
  - R8.B spec-11 虚拟桌面（窗口跨 vd 跟踪）
  - R8.C spec-08 监控窗口 popout（复用 BrowserWindow 创建管线）
external: 无新增 npm
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: BrowserWindow 创建失败
  action: 降级为 floating（spec-01）+ 提示
  - condition: bridge 断开
  action: BrowserWindow 自动关闭，主窗显示重连按钮
  - condition: 第二屏不存在
  action: bounds clip 到 primary 屏
  - condition: vite popout build 缺失（dev）
  action: fallback URL hash + warning
  - condition: pin 持久化文件损坏
  action: 重置；下次正常持久化
  - condition: 单 BW RSS > 80MB
  action: 触发 spec-01 资源降级管线
flag_disable: 关闭 R8.B.popout.browserwindow 时所有"在新窗口打开"按钮 disabled，仅 floating 可用
```

---

## 13. performance_budget

```yaml
budgets:
  popout_create_to_visible_p95_ms: 1500
  popout_create_to_visible_p99_ms: 2500
  bridge_message_rtt_p95_ms: 50
  bridge_message_rtt_p99_ms: 100
  rss_per_bw_mb: 80
  rss_total_bw_mb_for_8: 500
  fps_idle: 30
  fps_active: 60
  ipc_rpm_create: 60
  ipc_rpm_bridge: 1200
  heartbeat_interval_ms: 5000
  heartbeat_timeout_ms: 30000
  pin_recover_on_startup_ms: 2000
  screen_change_reflow_ms: 500
test_harness:
  - benchmark: bench-popout-bw-create.mjs
  target: 1000 次 create p99 < 2500ms
  - benchmark: bench-popout-bw-rss.mjs
  target: 8 BW 共享 session 总 RSS < 500MB
```
