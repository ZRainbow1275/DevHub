# Spec R8.B-04 — 全局命令面板（cmdk + URI 跳转协议）

> **flag**: `R8.B.command.palette`
> **priority**: P0（5 大反馈跨模块跳转 + 入口冗余载体）
> **status**: planning
> **upstream**: R8.A spec-01（cmdk 集成）+ R8.B spec-01/02/03（popout / Drawer 调起）
> **downstream**: R8.B spec-08（状态栏入口）+ R8.C spec-01/10（CLI parser / SKILL）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-2.B.1
  answer: "A+B+C+D+F"  # 包含 cmdk
  - id: V1-Q-2.D.3
  answer: "全选"  # 5 类条目（搜索 / 命令 / 跳转 / AI / 历史）
  - id: V2-Q-12.A.1
  answer: "D"  # 引入 URI + 用户可见 + 外部可粘贴
  - id: V2-Q-12.A.2
  answer: "D"  # devhub://process/8812?host=local
  - id: V2-Q-12.A.4
  answer: "全选"  # URI 入口 8 处
  - id: V2-Q-12.D.3
  answer: "D"  # 命令面板"最近视图"
  - id: V2-Q-13.A.1
  answer: "D + E"  # 入口冗余 4-5 处
```

### 1.2 现状缺陷

```
devhub/src/renderer 无 cmdk 集成
devhub/src/renderer 无统一命令注册中心
跨模块跳转 = hardcode（V2-§12-A 痛点）
全局快捷键散落在各组件，无统一表
```

### 1.3 设计目标

| 目标 | 度量 | 来源 |
|------|------|------|
| Cmd+K 打开延迟 | < 50ms | 自定 |
| 1000 条命令 fuzzy search P99 | < 16ms | master §7.4 |
| 5 类条目支持 | search / command / navigate / ai-action / history | V1-Q-2.D.3 |
| URI 跳转 | devhub://process/8812 | V2-Q-12.A |
| 历史记录最多 | 50 条 | V2-Q-12.F.1 |
| 输入到第一条结果 | < 100ms | 自定 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/App.tsx
  - devhub/src/renderer/components 现有快捷键散落点
  - R8.A spec-01 cmdk 安装记录
modify:
  - devhub/src/renderer/App.tsx  # 注册全局快捷键 Cmd+K
new:
  - devhub/src/renderer/components/cmdk/CommandPalette.tsx
  - devhub/src/renderer/components/cmdk/CommandList.tsx
  - devhub/src/renderer/components/cmdk/CommandGroup.tsx
  - devhub/src/renderer/components/cmdk/CommandItem.tsx
  - devhub/src/renderer/components/cmdk/CommandShortcut.tsx
  - devhub/src/renderer/components/cmdk/UriBar.tsx  # URI 输入框
  - devhub/src/renderer/services/CommandRegistry.ts  # 命令中心
  - devhub/src/renderer/services/UriRouter.ts  # URI 路由
  - devhub/src/renderer/services/CommandSearch.ts  # fuzzy search
  - devhub/src/renderer/hooks/useCommandPalette.ts
  - devhub/src/renderer/hooks/useGlobalShortcuts.ts
  - devhub/src/renderer/stores/commandStore.ts
  - devhub/src/main/ipc/commandHandlers.ts
  - devhub/src/main/services/CommandHistoryStore.ts
  - devhub/src/main/services/CustomCommandStore.ts
  - devhub/src/main/protocols/devhubProtocol.ts  # OS 协议注册（V2-Q-12.A.1 D）
test:
  - devhub/src/renderer/services/CommandRegistry.test.ts
  - devhub/src/renderer/services/UriRouter.test.ts
  - devhub/src/renderer/services/CommandSearch.test.ts
  - devhub/tests/e2e/command-palette.spec.ts
docs:
  - docs/r8/command-palette.md
  - docs/r8/uri-protocol.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const CommandTypeSchema = z.enum([
  'command',  // 普通命令（如"打开设置"）
  'navigate',  // URI 跳转（如 devhub://process/8812）
  'search-result',  // 搜索结果
  'ai-action',  // AI 动作（如"调用 SKILL X"）
  'history',  // 最近访问
  'recent-uri',  // 最近 URI
])

export const CommandPaletteEntrySchema = z.object({
  id: z.string(),
  type: CommandTypeSchema,
  label: z.string(),
  description: z.string().optional(),
  group: z.string().optional(),
  iconToken: z.string().optional(),  // "lucide:Search"
  keywords: z.array(z.string()).default([]),
  shortcut: z.array(z.string()).optional(),  // ["Ctrl", "K"]
  handler: z.string(),  // logical handler key
  scope: z.enum(['global', 'monitor', 'project']).default('global'),
  uri: z.string().optional(),  // devhub://process/8812
  context: z.record(z.string(), z.unknown()).optional(),
})
export type CommandPaletteEntry = z.infer<typeof CommandPaletteEntrySchema>

// === URI Schema（V2-Q-12.A.2 D）===
export const UriScopeSchema = z.enum([
  'process', 'port', 'window', 'ai-task', 'csv-batch', 'project', 'skill', 'snapshot',
])
export const UriSchema = z.object({
  scheme: z.literal('devhub'),
  scope: UriScopeSchema,
  id: z.string(),
  host: z.string().default('local'),
  fallback: z.record(z.string(), z.string()).optional(),  // ?fallback=exe:codex.exe,cwd:/repo/myapp
})
export const URI_REGEX = /^devhub:\/\/([a-z-]+)\/([^?]+)(?:\?(.+))?$/i

// === 历史 ===
export const CommandHistoryEntrySchema = z.object({
  id: z.string(),
  uri: z.string().optional(),
  label: z.string(),
  visitedAt: z.number().int(),
  scope: z.string().optional(),
})

// === 自定义命令 ===
export const CustomCommandSchema = z.object({
  id: z.string(),
  label: z.string(),
  shortcut: z.array(z.string()).optional(),
  handlerScript: z.string(),  // 仅本地，非 eval；以 SKILL 形式存
  enabled: z.boolean().default(true),
})

export const COMMAND_LIMITS = {
  HISTORY_MAX: 50,
  MAX_RESULTS: 50,
  FUZZY_THRESHOLD: 0.3,
  DEBOUNCE_MS: 16,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  command:list:
  response: { entries: CommandPaletteEntry[] }
  command:invoke:
  request: { id: string, args?: any }
  response: { ok: boolean, output?: any }
  command:history-add:
  request: CommandHistoryEntrySchema
  command:history-list:
  response: { entries: CommandHistoryEntry[] }
  command:history-clear: {}
  command:save-custom:
  request: CustomCommandSchema
  command:list-custom:
  response: { commands: CustomCommandSchema[] }
  command:resolve-uri:
  request: { uri: string }
  response: { resolved: { kind, id, monitor?, panel?, fallbackUsed?: bool } }
  command:register-os-protocol:
  request: { register: boolean }
  response: { success: boolean }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'URI 格式不合法'
  code: E_VALIDATION
  message: 'URI 格式: devhub://<scope>/<id>[?fallback=...]'
  - condition: 'URI 引用对象不存在（PID 已变 / port 已释放）'
  code: E_NOT_FOUND
  handling: '尝试 fallback 标识找回（V2-Q-12.K.4 B）'
  fallback: '若仍不存在 → 弹候选列表（V2-Q-12.K.4 D）'
  - condition: 'fuzzy search 1000+ 条 > 16ms'
  code: E_PERFORMANCE
  fallback: '降级为简单 indexOf 搜索 + toast 提示'
  - condition: '快捷键冲突'
  code: E_VALIDATION
  handling: '弹冲突提示 + 用户选择保留谁'
  - condition: '自定义命令 handlerScript 含 eval'
  code: E_SECURITY
  handling: '拒绝保存 + 警告'
  - condition: 'history 写入失败'
  code: E_INTERNAL
  handling: 'in-memory 仍可用'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — Cmd+K 打开
Given DevHub 在任意页面
When 用户按 Ctrl+K
Then 命令面板在 50ms 内打开
  And 焦点在搜索框

# A2 — 5 类条目
Given 命令面板打开
Then 默认显示 5 组：「最近」「命令」「跳转」「AI 动作」「设置」
  And 每组有图标 + 数量徽章

# A3 — fuzzy 搜索 < 16ms
Given 已注册 1000 条命令
When 用户输入 "port 30"
Then 第一批结果 P99 < 16ms 出现
  And 高亮匹配字符

# A4 — URI 跳转
Given 用户输入 "devhub://port/3000" 并回车
Then 跳转到端口模块 + 选中 port=3000
  And 加入 history

# A5 — URI fallback
Given 用户粘贴 "devhub://process/8812?fallback=exe:codex.exe,cwd:/repo/myapp"
  And PID 8812 已不存在
When 回车
Then UriRouter 用 fallback 找到匹配进程（exe + cwd 双键）
  And 跳转成功 + toast "PID 已变（旧 8812 → 新 N），通过 EXE+cwd 重新匹配"

# A6 — URI 找不到候选
Given URI 引用对象彻底不存在 + fallback 失败
When 回车
Then 弹"是否查找类似对象？"对话框
  And 显示 K 个候选

# A7 — OS 协议注册
Given 用户在设置中启用 OS 协议处理
When 用户在浏览器点击 devhub://port/3000
Then 拉起 DevHub 主窗口 + 跳转到 port/3000

# A8 — 历史记录
Given 用户访问过 5 个不同 URI
When 用户打开命令面板（无搜索词）
Then 顶部显示"最近"组 + 5 条访问记录（按时间衰减加权）

# A9 — 自定义命令
Given 用户保存了自定义命令"打开 watchdog"
When 用户输入 "watch"
Then 该自定义命令在结果中显示 + 可绑定快捷键

# A10 — 命令面板调起 Drawer / popout
Given 用户输入 "通知"
When 回车
Then 顶部 Drawer 打开 + content = notifications.top（spec-03 联动）

Given 用户输入 "popout 3000"
When 回车
Then 创建 floating popout port=3000（spec-01 联动）
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/command-palette.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('cmd+k opens palette in <50ms', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  const start = Date.now()
  await page.keyboard.press('Control+K')
  await expect(page.getByTestId('command-palette')).toBeVisible({ timeout: 200 })
  expect(Date.now() - start).toBeLessThan(200)
  await app.close()
})

test('uri navigates to port', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.keyboard.press('Control+K')
  await page.getByPlaceholder(/输入命令/).fill('devhub://port/3000')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/port|monitor/)
  await app.close()
})

test('fuzzy search returns 5 categories', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.keyboard.press('Control+K')
  const groups = await page.getByTestId(/^cmdk-group-/).count()
  expect(groups).toBeGreaterThanOrEqual(5)
  await app.close()
})

test('history persists', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.keyboard.press('Control+K')
  await page.getByPlaceholder(/输入命令/).fill('devhub://port/3000')
  await page.keyboard.press('Enter')
  await app.close()

  const app2 = await launchDevHub()
  const page2 = await app2.firstWindow()
  await page2.keyboard.press('Control+K')
  const history = page2.getByTestId('cmdk-group-history')
  await expect(history).toContainText('3000')
  await app2.close()
})
```

---

## 8. reference_impl

### 8.1 cmdk 集成

```tsx
import { Command } from 'cmdk'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const entries = useCommandPalette().entries

  useGlobalShortcut('Ctrl+K', () => setOpen(o => !o))

  const grouped = useMemo(() => groupBy(entries, 'group'), [entries])

  return (
  <Command.Dialog open={open} onOpenChange={setOpen} label="Global Command">
  <Command.Input value={query} onValueChange={setQuery} placeholder="输入命令、URI 或搜索词..." />
  <Command.List>
  <Command.Empty>未找到匹配命令</Command.Empty>
  {Object.entries(grouped).map(([group, items]) => (
  <Command.Group key={group} heading={group}>
  {items.map(item => (
  <Command.Item key={item.id} onSelect={() => invokeOrNavigate(item)}>
  {item.label}
  {item.shortcut && <CommandShortcut keys={item.shortcut} />}
  </Command.Item>
  ))}
  </Command.Group>
  ))}
  </Command.List>
  </Command.Dialog>
  )
}
```

### 8.2 URI Router

```typescript
export class UriRouter {
  parse(input: string): UriParsed | null {
  const m = input.match(URI_REGEX)
  if (!m) return null
  const [, scope, id, qs] = m
  const fallback: Record<string, string> = {}
  if (qs) qs.split(',').forEach(p => {
  const [k, v] = p.split(':')
  if (k && v) fallback[k] = v
  })
  return { scheme: 'devhub', scope, id, host: 'local', fallback }
  }
  async resolve(uri: UriParsed): Promise<ResolvedTarget> {
  // 1. 尝试主键（PID/port/hwnd）
  const direct = await this.lookupDirect(uri)
  if (direct) return { ...direct, fallbackUsed: false }
  // 2. fallback（exe + cwd / port + protocol / etc.）
  if (uri.fallback) {
  const fb = await this.lookupFallback(uri)
  if (fb) return { ...fb, fallbackUsed: true }
  }
  // 3. 候选列表
  return { kind: 'candidates', candidates: await this.findCandidates(uri) }
  }
}
```

### 8.3 OS 协议注册（Windows）

```typescript
// main/protocols/devhubProtocol.ts
import { app } from 'electron'

export function registerDevhubProtocol() {
  if (process.defaultApp) {
  if (process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('devhub', process.execPath, [process.argv[1]])
  }
  } else {
  app.setAsDefaultProtocolClient('devhub')
  }

  app.on('second-instance', (_e, argv) => {
  const uri = argv.find(a => a.startsWith('devhub://'))
  if (uri) mainWindow.webContents.send('protocol:open', uri)
  })
}
```

### 8.4 fuzzy search（fuse.js 替代手写）

```typescript
import Fuse from 'fuse.js'

const fuse = new Fuse(entries, {
  keys: ['label', 'description', 'keywords'],
  threshold: 0.3,
  includeMatches: true,
  ignoreLocation: true,
})
```

### 8.5 关键参考链接

- cmdk：https://cmdk.paco.me/
- electron protocol：https://www.electronjs.org/docs/latest/api/protocol
- fuse.js：https://www.fusejs.io/

---

## 9. impact_radius_loc

```yaml
new_files: 17
modified_files: 1
estimated_loc:
  CommandPalette.tsx: 280
  CommandList.tsx: 80
  CommandGroup.tsx: 60
  CommandItem.tsx: 110
  CommandShortcut.tsx: 50
  UriBar.tsx: 80
  CommandRegistry.ts: 220
  UriRouter.ts: 200
  CommandSearch.ts: 120
  useCommandPalette.ts: 90
  useGlobalShortcuts.ts: 110
  commandStore.ts: 130
  commandHandlers.ts: 130
  CommandHistoryStore.ts: 80
  CustomCommandStore.ts: 100
  devhubProtocol.ts: 70
  App.tsx (modify): +30
  tests: 520
total_loc: ~2460
risk_level: medium
```

---

## 10. implement_checklist

- [x] 安装 cmdk ^1.0.0、fuse.js ^7.0.0 — 2026-05-14 当前 `package.json` 为 `cmdk` ^1.1.1、`fuse.js` ^7.0.0，lockfile 解析为 `fuse.js` 7.3.0。
- [x] 实现 CommandPalette + cmdk 集成
- [x] 实现 CommandRegistry（默认命令 100+ 条 + 用户自定义）— 2026-05-15 已通过 scanner-backed runtime object commands 闭合 100+ 默认 registry：`command:list` 从真实 scanner cache 生成进程、端口、窗口对象命令，并通过 `uri:open` handler 走 `devhub://` 解析和 `r8:command-event` 跳转；用户自定义命令 storage/list/safe invoke 已在 section 18/25 闭合，Settings Advanced 管理 UI 已在 section 29 闭合。
- [x] 实现 UriRouter（解析 + 直接解析 + fallback + 候选）
- [x] 实现 CommandSearch（fuse.js + 历史加权）— 2026-05-14 由 `src/renderer/components/command/command-search.ts` 生产 helper 闭合，使用 Fuse.js weighted keys、bounded persisted-history boost、title match ranges、stable-entry WeakMap index cache 和大列表 prefilter。
- [x] 实现 useGlobalShortcuts（统一快捷键注册中心）— 2026-05-14 `src/renderer/hooks/useGlobalShortcuts.ts` 统一 Ctrl/Meta 组合键、editable-target 跳过、disabled gating，并由 App 接管 Ctrl+K/Ctrl+T。
- [x] 注册 OS 协议（V2-Q-12.A.1 D，可由用户启用）— 2026-05-14 已实现确认门控的 `command:register-os-protocol` IPC/preload/Zod 合约，Settings 高级页可见注册/取消注册按钮，main `second-instance` / macOS `open-url` 将 `devhub://` 转发到 renderer URI 解析链路；外部浏览器真实 E2E 仍留在测试大项。
- [x] command:resolve-uri IPC + command:history-list / command:history-clear + invoke 写入历史路径
- [x] save-custom-* / command:list-custom / standalone command:history-add — 2026-05-14 闭合可执行 IPC、preload/global typing、electron-store runtime 写入和 focused contract tests；2026-05-15 补 Settings Advanced 真实管理 UI 和 Electron E2E。
- [x] CommandHistoryStore 持久化（最多 50 条 + LFU+LRU 混合）— 2026-05-14 在既有 R8RuntimeService electron-store slice 内闭合，未新增独立 Store 类以避免架构漂移。
- [x] CustomCommandStore 校验 handlerScript 不含 eval — 2026-05-14 由 `customCommandSchema` Zod refine 拒绝 `eval()` / `Function()`，并由 runtime focused tests 覆盖。
- [x] 集成 spec-01/spec-02/spec-03（popout / Drawer 通过命令调起）— 2026-05-14 已验证 Drawer 命令事件由 `DrawerProvider` 消费，`popout.port` 通过 `R8RuntimeService.createPopout()` 创建真实 BrowserWindow port popout，renderer `popout <port>` 先走后端命令，失败才退回既有 renderer floating popout request。
- [x] 单元 + e2e 测试（含 URI fallback / OS 协议 / 历史持久）— 2026-05-15 已补真实 Electron E2E，覆盖 Ctrl+K 聚焦、recent history、五组 IA、`@/#/!` scope filter、URI resolve、`settings.open` 打开真实 SettingsDialog；外部浏览器/packaged OS protocol E2E 仍留边界。
- [x] 文档：docs/r8/command-palette.md + uri-protocol.md
- [x] 验收 ASSERT_COMMAND_PALETTE_5_SCOPES 通过 — 2026-05-14 已由真实 runtime 命令与 renderer DOM 证据闭合：默认 registry 新增可执行 `ai.tasks.open` 与 `settings.open`，`App` 消费 `settings-open` 打开真实 SettingsDialog，palette 在存在持久历史时显示「最近 / 命令 / 跳转 / AI 动作 / 设置」5 组，每组有已安装图标库 icon 和数字 count badge；外部 Playwright 视觉 E2E 仍留在测试大项。

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-01（cmdk / fuse.js 安装）
sibling_libs:
  - cmdk: ^1.0.0
  - fuse.js: ^7.0.0
  - react-hot-keys-hook 或自实现
downstream_specs:
  - R8.B spec-08（statusbar 入口）
  - R8.C spec-01 / spec-10（CLI / SKILL 通过命令面板调起）
external: 无新增 noteworthy
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: fuzzy search 慢
  action: 降级到 indexOf
  - condition: URI fallback 找不到候选
  action: 显示"对象不存在" + 提供"加入收藏夹（待重连）"
  - condition: cmdk 包加载失败
  action: 退化为简单 input + Enter 触发
  - condition: OS 协议注册失败（权限不足）
  action: 仅应用内 URI，提示用户使用 PowerShell"以管理员运行"
  - condition: 自定义命令循环引用
  action: 检测 + 拒绝保存
flag_disable: 关闭 R8.B.command.palette 时仅保留 hardcode 顶栏菜单
```

---

## 13. performance_budget

```yaml
budgets:
  open_ms_p95: 50
  search_p99_ms: 16
  results_first_paint_ms: 100
  uri_resolve_p95_ms: 30
  history_persist_p95_ms: 80
  ipc_rpm_invoke: 600
  registry_size_max: 1000
  history_max: 50
test_harness:
  - benchmark: bench-cmdk-search.mjs
  target: 1000 entries fuzzy search p99 < 16ms
  - benchmark: bench-uri-resolve.mjs
  target: 100 次 resolve p99 < 50ms
```

---

## 14. implementation_status

```yaml
status: partial
implemented_at: 2026-05-05
implementation_boundary:
  completed:
  - devhub/src/renderer/components/command/R8CommandPalette.tsx renders a cmdk-backed palette with data-testid markers, category counts, URI input support, and command invocation.
  - devhub/src/renderer/App.tsx keeps the existing Ctrl+K global shortcut for the palette.
  - devhub/src/shared/schemas/r8-runtime.ts adds command type and devhub URI parse/resolve schemas.
  - devhub/src/main/services/R8RuntimeService.ts includes Drawer command entries and resolveCommandUri for devhub:// scope/id syntax, live scanner direct lookup, and process fallback candidate counts.
  - devhub/src/main/ipc/r8RuntimeHandlers.ts registers executable command:resolve-uri.
  - devhub/src/preload/index.ts and devhub/src/renderer/types/global.d.ts expose command.resolveUri.
  - devhub/src/renderer/components/popout/port-popout-events.ts defines a typed renderer request contract, and `R8CommandPalette.tsx` now recognizes `popout <port>` queries, invokes the backend `popout.port` command to create a real BrowserWindow popout first, then falls back to the existing `PortView`/`usePortPopoutManager` renderer request path only when that backend command rejects.
  - devhub/src/renderer/components/command/R8CommandPalette.tsx recognizes leading `>`, `@`, `#`, and `!` scope prefixes, applies them before rendering both command-registry and recent-history groups, and keeps search text matching active by stripping only the scope prefix from the query.
  - devhub/src/renderer/components/command/command-search.ts uses `fuse.js` weighted keys for typo-tolerant command search, applies a bounded persisted-history boost from `CommandHistoryEntry.useCount` plus LFU/LRU rank, caches Fuse indexes per stable entry list, and prefilters large command sets before running Fuse.
  - devhub/src/main/services/R8RuntimeService.ts registers executable `popout.port` in the command registry, validates the requested port range, and routes it through the existing R8.B spec-02 BrowserWindow `createPopout()` service path with `surface: 'port'` and `mode: 'browserwindow'`.
  - devhub/src/shared/schemas/r8-runtime.ts, devhub/src/main/services/R8RuntimeService.ts, devhub/src/main/ipc/r8RuntimeHandlers.ts, devhub/src/preload/index.ts, devhub/src/renderer/types/global.d.ts, devhub/src/renderer/components/settings/SettingsDialog.tsx, devhub/src/main/index.ts, and devhub/src/renderer/App.tsx now close the executable OS protocol registration and handoff path for `devhub://`.
  - devhub/src/renderer/components/command/R8CommandPalette.tsx consumes Fuse.js title match ranges and renders inline `cmdk-match-highlight` markers without replacing the command option text.
  - devhub/src/shared/schemas/r8-runtime.ts exposes `CustomCommand`, `CustomCommandListResponse`, and `CustomCommandSaveResult` as Zod SoT schemas; unsafe `handlerScript` values containing `eval()` or `Function()` are rejected.
  - devhub/src/main/services/R8RuntimeService.ts persists custom commands through the existing electron-store runtime slice, requires `confirmedBy` for save, lists only schema-valid rows, and exposes standalone `addCommandHistory()` for `command:history-add`.
  - devhub/src/main/services/R8RuntimeService.ts merges enabled custom commands into `command:list` and executes only safe declarative `command:<id>` or `devhub://...` handlerScript forms; unsupported handler forms fail explicitly.
  - devhub/src/main/ipc/r8RuntimeHandlers.ts, devhub/src/preload/index.ts, devhub/src/renderer/types/global.d.ts, and `prompts/0421/contracts/23-ipc-contracts-master.md` expose and whitelist `command:history-add`, `command:list-custom`, and `command:save-custom`.
  - devhub/src/main/services/R8RuntimeService.ts extends `command:list` with scanner-backed runtime object commands for real process, port, and window rows, giving the default registry 100+ executable entries on real scanned systems without fabricating placeholder commands.
  - devhub/src/renderer/hooks/useGlobalShortcuts.ts provides the shared global shortcut registry and App routes Ctrl/Meta+K plus Ctrl/Meta+T through it instead of local keydown branching.
  - devhub/src/renderer/App.tsx records the focused element before opening the command palette and `R8CommandPalette.tsx` restores focus on Escape, command invocation, URI resolution, and port-popout close paths.
  - devhub/docs/r8/command-palette.md and devhub/docs/r8/uri-protocol.md document the current boundary.
  not_claimed:
  - Arbitrary SKILL/script execution decision.
  - External browser/packaged OS protocol E2E.
verification:
  targeted:
  - pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "command|Command|URI|uri"
  - pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
  quality_gates:
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub check:no-emoji
  - pnpm -C devhub check:zod-sot
  - pnpm -C devhub check:no-cloud-deps
  - pnpm -C devhub check:no-ocr-deps
  - python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

## 15. implementation_status_2026_05_14_recent_history

### Verified In This Pass

- `devhub/src/shared/schemas/r8-runtime.ts` now exposes `CommandHistoryEntry` as the Zod SoT for command history rows.
- `devhub/src/main/services/R8RuntimeService.ts` deduplicates command history by `commandId`, increments `useCount`, retains at most 50 entries through LFU+LRU ordering, and keeps the visible list ordered by latest invocation.
- `devhub/src/preload/index.ts` and `devhub/src/renderer/types/global.d.ts` now expose typed `command.history(): Promise<CommandHistoryEntry[]>`.
- `devhub/src/renderer/components/command/R8CommandPalette.tsx` loads command entries and persisted history together, renders a `cmdk-group-history` section, caps the recent group at 10 commands, and invokes the selected real command through the existing executable `command:invoke` bridge.
- This pass closes `prompts/0503/28-final-acceptance-checklist.md` item `A.3.4` for the implemented command set: recent 5-10 command entries are now visible in the command palette when persisted command invocations exist.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts -t "history|command history|CommandPalette|command" --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/preload/index.ts src/renderer/types/global.d.ts
pnpm -C devhub check:zod-sot
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
```

### Remaining Boundary

- 100+ default commands, custom-command execution/full registry UI integration, OS protocol registration, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 16. implementation_status_2026_05_14_scope_prefix_filter

### Verified In This Pass

- `devhub/src/renderer/components/command/R8CommandPalette.tsx` now parses only a leading scope prefix and leaves non-prefixed command search behavior unchanged.
- `>` filters to navigation, monitor, and diagnostics command entries.
- `@` filters to AI/model/agent related command entries through the real entry category plus id/title/description/keyword text.
- `#` filters to port, process, and window object command entries.
- `!` filters to commands whose real registry entry is marked `requiresConfirmation`.
- Recent-history rows are filtered by resolving back to the underlying command entry before the history group is built, so persisted history cannot bypass scope filtering.
- The active scope is surfaced through `data-testid="cmdk-scope-filter"` with a text chip and no emoji.
- This pass closes `prompts/0503/28-final-acceptance-checklist.md` item `A.3.7` for the implemented command registry: special-character queries `>`, `@`, `#`, and `!` now trigger real category filtering in the command palette.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx -t "scope|CommandPalette|command" --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx docs/r8/command-palette.md
git diff --check -- prompts/0503-2/R8.B/spec-04-command-palette-cmdk.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
```

### Remaining Boundary

- This is a prefix category-filtering slice only. 100+ default commands, custom-command execution/full registry UI integration, OS protocol registration, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 17. implementation_status_2026_05_14_fuse_history_weighted_search

### Verified In This Pass

- `devhub/package.json` now declares `fuse.js` ^7.0.0 and `devhub/pnpm-lock.yaml` resolves it to 7.3.0.
- `devhub/src/renderer/components/command/command-search.ts` imports Fuse.js directly in the renderer bundle and indexes real `CommandPaletteEntry` rows by id, title, label, description, category, scope, uri, and keywords.
- Search uses weighted Fuse.js keys for typo-tolerant matching and `shouldFilter={false}` on `cmdk` so renderer-owned scope filtering, Fuse ranking, and history ranking are deterministic instead of being re-sorted by `cmdk`.
- Persisted `CommandHistoryEntry` rows are converted into bounded history stats: `useCount` contributes at most `0.12` boost and LFU/LRU rank contributes at most `0.08` boost. The boost changes ranking only for matching real command entries and never invents commands.
- Fuse.js title match ranges are rendered as inline `cmdk-match-highlight` markers while preserving each option's full command text for selection and accessibility.
- Focused renderer tests verify typo-tolerant Fuse matching and persisted-history ranking where a more-used AI command is promoted ahead of an otherwise earlier matching AI command.
- This pass advances `prompts/0503/28-final-acceptance-checklist.md` command-palette search behavior for the implemented command registry, but does not check the user-owned final acceptance checklist.

### Verification Evidence

```bash
pnpm -C devhub add fuse.js@^7.0.0
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx -t "Fuse|highlight|history|scope|focus|CommandPalette|command" --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx docs/r8/command-palette.md package.json pnpm-lock.yaml
git diff --check -- prompts/0503-2/R8.B/spec-04-command-palette-cmdk.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
```

### Remaining Boundary

- 100+ default commands, custom-command execution/full registry UI integration, OS protocol registration, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 18. implementation_status_2026_05_14_custom_command_store_ipc

### Verified In This Pass

- `devhub/src/shared/schemas/r8-runtime.ts` now defines `customCommandSchema`, `customCommandListResponseSchema`, and `customCommandSaveResultSchema`, exports their TypeScript types, and registers them in `r8RuntimeSchemaRegistry`.
- `customCommandSchema` rejects `handlerScript` values containing `eval()` or `Function()` instead of storing executable string-eval payloads.
- `devhub/src/main/services/R8RuntimeService.ts` adds a real electron-store backed `customCommands` slice, `saveCustomCommand()`, `listCustomCommands()`, and standalone `addCommandHistory()`.
- `saveCustomCommand()` requires `confirmedBy` before writing and caps stored custom command rows at 200.
- `command:history-add`, `command:list-custom`, and `command:save-custom` are owned by `setupR8RuntimeHandlers`, exposed through preload/global types, and added to the outer preload whitelist contract.
- This pass closes the executable storage/IPC part of `save-custom-* / command:list-custom / standalone command:history-add` and the no-eval `CustomCommandStore` validator.

### Verification Evidence

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/main/ipc/r8RuntimeHandlers.test.ts -t "command|custom|history|preload|IPC|schema|schemas|registers" --maxWorkers=1
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/renderer/components/command/R8CommandPalette.test.tsx -t "command|custom|history|preload|IPC|schema|schemas|registers|Fuse|scope|CommandPalette" --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx
pnpm -C devhub check:zod-sot
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
git -C devhub diff --check -- src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx docs/r8/command-palette.md docs/r8bc-implementation-report.md package.json pnpm-lock.yaml
git diff --check -- prompts/0421/contracts/23-ipc-contracts-master.md prompts/0503-2/R8.B/spec-04-command-palette-cmdk.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
```

### Remaining Boundary

- Saved custom commands now execute only safe declarative targets. Full custom command management UI is superseded by section 29; arbitrary SKILL/script execution, 100+ default registry completion, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 19. implementation_status_2026_05_14_global_shortcuts_registry

### Verified In This Pass

- `devhub/src/renderer/hooks/useGlobalShortcuts.ts` now defines a typed `GlobalShortcutRegistration` contract with `keys`, `handler`, `allowInEditable`, `enabled`, and `preventDefault` controls.
- The hook normalizes aliases such as `Cmd`/`Command` to `Meta`, normalizes `Esc` to `Escape`, and compares events against deterministic modifier order.
- Shortcuts skip `input`, `textarea`, `select`, `[contenteditable="true"]`, and `[role="textbox"]` targets by default, while allowing specific registrations to opt in.
- `devhub/src/renderer/App.tsx` now routes command palette toggle (`Ctrl+K` / `Meta+K`) and topology global open (`Ctrl+T` / `Meta+T`) through the shared registry instead of ad hoc local keydown branching.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/hooks/useGlobalShortcuts.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx -t "shortcut|CommandPalette|command|scope|Fuse|history" --maxWorkers=1
```

### Remaining Boundary

- OS-level protocol registration, 100+ default command registry completion, custom command execution/full registry UI integration, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 20. implementation_status_2026_05_14_escape_focus_restore

### Verified In This Pass

- `devhub/src/renderer/App.tsx` records `document.activeElement` before opening the command palette through the host shortcut or `devhub:open-command-palette` event.
- `devhub/src/renderer/components/command/R8CommandPalette.tsx` accepts `returnFocusTo` and uses a single `closePalette()` path for Escape, command invocation, URI resolution, and `popout <port>` close behavior.
- Focus is restored only when the recorded element is still connected, with `preventScroll: true`; disconnected or absent targets are ignored rather than faking focus state.
- This pass closes `prompts/0503/28-final-acceptance-checklist.md` item `A.3.8` for the implemented command palette: Escape closes the palette path and returns focus to the previously active element.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/hooks/useGlobalShortcuts.test.tsx -t "focus|Escape|shortcut|CommandPalette|command" --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/App.tsx src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/hooks/useGlobalShortcuts.ts src/renderer/hooks/useGlobalShortcuts.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
npx gitnexus impact R8CommandPalette --repo devhub --direction upstream --depth 2 --include-tests
npx gitnexus impact App --repo devhub --direction upstream --depth 2 --include-tests
```

`npx gitnexus detect-changes --help` was also checked in the current CLI; this installed GitNexus build exposes `impact/query/context/cypher` but not `detect_changes`, so post-change graph detection is not claimed from that unavailable command.

### Remaining Boundary

- This is a renderer focus-restoration slice only. OS-level protocol registration, 100+ default command registry completion, custom command execution/full registry UI integration, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 21. implementation_status_2026_05_14_fuse_match_highlight

### Verified In This Pass

- `devhub/src/renderer/components/command/R8CommandPalette.tsx` now enables Fuse.js `includeMatches` on the real command search index.
- Search results carry the Fuse-provided title match ranges into the renderer grouping path, including recent-history rows that resolve back to matching real command entries.
- The renderer normalizes overlapping title ranges, clips them to the current title, and renders matched segments with `data-testid="cmdk-match-highlight"` while preserving the full option text.
- This pass advances `prompts/0503/28-final-acceptance-checklist.md` command-palette search readability for the implemented command registry, but does not check the user-owned final acceptance checklist.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx -t "Fuse|highlight|history|scope|focus|CommandPalette|command" --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx docs/r8/command-palette.md
git diff --check -- prompts/0503-2/R8.B/spec-04-command-palette-cmdk.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
npx gitnexus impact R8CommandPalette --repo devhub --direction upstream --depth 2 --include-tests
```

### Remaining Boundary

- This is a title-match highlight slice only. 100+ default commands, custom-command execution/full registry UI integration, OS protocol registration, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 22. implementation_status_2026_05_14_1000_entry_search_benchmark

### Verified In This Pass

- `devhub/src/renderer/components/command/command-search.ts` now owns the production search helper used by `R8CommandPalette`.
- The helper keeps Fuse.js weighted search, persisted-history boosting, and title match ranges, while adding a WeakMap Fuse index cache for stable command entry arrays.
- Large command sets use a lexical prefilter before Fuse; if the prefilter does not return enough candidates, the helper falls back to the full Fuse index rather than dropping fuzzy behavior.
- `devhub/src/renderer/components/command/command-search.test.ts` builds a schema-shaped 1000-entry command workload and verifies search P99 stays under 16ms with non-empty Fuse title matches.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/command/command-search.test.ts --maxWorkers=1
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/command/command-search.test.ts -t "benchmark|Fuse|highlight|history|scope|focus|CommandPalette|command" --maxWorkers=1
```

### Remaining Boundary

- This is a generated 1000-entry search workload benchmark for the production helper. 100+ default commands, custom-command execution/full registry UI integration, OS protocol registration, and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 23. implementation_status_2026_05_14_backend_port_popout_command

### Verified In This Pass

- `devhub/src/main/services/R8RuntimeService.ts` now includes a `popout.port` command entry with `handler: 'popout:create'`, port-oriented keywords, and monitor scope.
- `invokeCommand({ commandId: 'popout.port', args: { port } })` validates the port range and calls the existing R8.B spec-02 BrowserWindow popout service path with `surface: 'port'`, `mode: 'browserwindow'`, `route: '/monitor'`, and a deterministic `DevHub port <port>` title.
- `devhub/src/renderer/components/command/R8CommandPalette.tsx` routes typed `popout <port>` queries to the backend `popout.port` command first, so the primary path creates a real BrowserWindow popout rather than only dispatching a renderer-local request.
- The existing renderer floating popout event remains as a truthful fallback path when the backend command rejects; it is not used as fake proof of a BrowserWindow popout.
- This pass closes the spec-01/spec-02/spec-03 command integration checklist item for the implemented popout and Drawer paths: Drawer command events open Drawer content through `DrawerProvider`, and port popout commands now create real BrowserWindow popouts through `R8RuntimeService.createPopout()`.

### Verification Evidence

```bash
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2 --include-tests
npx gitnexus impact R8CommandPalette --repo devhub --direction upstream --depth 2 --include-tests
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/renderer/components/command/R8CommandPalette.test.tsx -t "command palette|popout <port>|BrowserWindow port popout|drawer slots|command history|scope|focus|Fuse|highlight" --maxWorkers=1
```

### Remaining Boundary

- This is a command-to-popout integration slice. 100+ default commands, full custom-command registry UI integration, Playwright Electron E2E, the combined unit+E2E checklist item, and external browser OS protocol E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 24. implementation_status_2026_05_14_os_protocol_registration

### Verified In This Pass

- `devhub/src/shared/schemas/r8-runtime.ts` now defines `CommandRegisterOsProtocolRequest` and `CommandRegisterOsProtocolResult` as Zod source-of-truth contracts.
- `devhub/src/main/services/R8RuntimeService.ts` implements confirmation-gated `registerOsProtocol()` for the `devhub` scheme using Electron `app.setAsDefaultProtocolClient`, `app.removeAsDefaultProtocolClient`, and `app.isDefaultProtocolClient`.
- The service follows Electron's documented development-mode pattern by using `process.execPath` plus the resolved app entry when `process.defaultApp` is active; packaged mode uses the current executable default.
- `devhub/src/main/ipc/r8RuntimeHandlers.ts`, `devhub/src/preload/index.ts`, and `devhub/src/renderer/types/global.d.ts` expose executable `command:register-os-protocol` without falling back to contract-only IPC.
- `devhub/src/renderer/components/settings/SettingsDialog.tsx` adds a visible Settings -> Advanced -> External URI Protocol section with register/unregister actions and truthful status/error output.
- `devhub/src/main/index.ts` now extracts `devhub://` URIs from Windows/Linux `second-instance` argv and macOS `open-url`, queues early URIs until the main renderer is ready, focuses the main window, and forwards `{ type: 'protocol-open', uri }` through `r8:command-event`.
- `devhub/src/renderer/App.tsx` resolves forwarded protocol URIs through `window.devhub.r8.command.resolveUri()` and routes monitor targets to the monitor surface instead of inventing navigation success.

### Verification Evidence

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts -t "OS protocol|register-os-protocol|protocol|command|IPC|schema|schemas" --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/main/index.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/App.tsx src/renderer/components/settings/SettingsDialog.tsx src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts
pnpm -C devhub exec tsc --noEmit --pretty false
```

### Remaining Boundary

- This is an executable registration, Settings entry, and in-app handoff slice. External browser / packaged-app protocol E2E remains open under the combined unit+E2E checklist item. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 25. implementation_status_2026_05_14_safe_custom_command_execution

### Verified In This Pass

- `devhub/src/main/services/R8RuntimeService.ts` now merges enabled stored custom commands into `listCommands()` as real `CommandPaletteEntry` rows with `handler: 'custom'`, preserved label, shortcut, and handler metadata.
- `invokeCommand()` now routes custom entries through a safe declarative executor instead of ignoring saved commands.
- `command:<id>` custom handlers invoke an existing non-custom built-in command through the same `invokeCommand()` path, preserving command history for both the custom command and the target command.
- `devhub://...` custom handlers reuse `resolveCommandUri()` and forward a `protocol-open` event to the renderer when a live main window exists.
- Unsupported handler forms return `E_UNSUPPORTED_CUSTOM_COMMAND`; custom-to-custom chaining is rejected to avoid cycles; no shell, JavaScript, eval, or SKILL string execution is introduced.

### Verification Evidence

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/renderer/components/command/R8CommandPalette.test.tsx -t "custom commands|custom command|command history|CommandPalette|command|protocol|popout" --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
```

### Remaining Boundary

- This is a safe declarative execution slice only. The full 100+ default command registry and custom-command management UI are superseded by sections 28-29; arbitrary SKILL/script execution decision and Playwright Electron E2E remain open. `ASSERT_COMMAND_PALETTE_5_SCOPES` is superseded by section 26.

## 26. implementation_status_2026_05_14_five_scope_assertion

### Verified In This Pass

- `devhub/src/main/services/R8RuntimeService.ts` now exposes executable default commands for the missing AI-action and settings information-architecture groups:
  - `ai.tasks.open` is category `ai-action` and sends the existing `monitor-navigate` event for the live AI task monitor tab.
  - `settings.open` is category `settings` and sends `settings-open`.
- `devhub/src/renderer/App.tsx` consumes `settings-open` by opening the real `SettingsDialog`; it does not render a fake settings surface.
- `devhub/src/renderer/components/command/R8CommandPalette.tsx` renders command-group headings with installed icon-library tokens and numeric count badges through deterministic test markers.
- The default palette can now show the required five groups when persisted history exists:
  - `cmdk-group-history` for 最近.
  - `cmdk-group-monitor` for 命令.
  - `cmdk-group-navigation` for 跳转.
  - `cmdk-group-ai-action` for AI 动作.
  - `cmdk-group-settings` for 设置.
- `devhub/src/renderer/components/command/R8CommandPalette.test.tsx` verifies all five groups, group labels, group icon tokens, numeric count badges, and non-empty options from the rendered DOM.
- `devhub/src/main/services/R8RuntimeService.test.ts` verifies that the new default AI/settings commands are present in `listCommands()`, invoke real command events, and write command history.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/main/services/R8RuntimeService.test.ts -t "five-scope|ASSERT_COMMAND_PALETTE_5_SCOPES|command palette|scope|CommandPalette|AI task actions|settings.open|executable default commands" --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
git -C devhub diff --check -- src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/command/R8CommandPalette.test.tsx
npx gitnexus impact R8CommandPalette --repo devhub --direction upstream --depth 2 --include-tests
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2 --include-tests
npx gitnexus impact App --repo devhub --direction upstream --depth 2 --include-tests
```

### Remaining Boundary

- This is the unit/runtime DOM assertion for the implemented command registry. 100+ default command registry, Playwright Electron E2E, and custom-command management UI are superseded by sections 27-29; arbitrary SKILL/script execution decision and external browser OS protocol E2E remain open.

## 27. implementation_status_2026_05_15_electron_e2e

### Verified In This Pass

- `devhub/e2e/example.spec.ts` adds `R8.B spec-04 command palette scopes history URI and settings command use real IPC`, a real packaged Electron Playwright scenario rather than a renderer-only unit proof.
- The scenario launches the built Electron app, focuses a real command-search input through `Ctrl+K`, seeds command history through the executable preload bridge, and restores the original command history in `finally`.
- It verifies the visible recent-history group plus the required command, navigation, AI-action, and settings groups from the real DOM.
- It exercises `@`, `#`, and `!` leading scope filters against the installed command registry instead of fabricated command rows.
- It resolves a `devhub://process/...` URI through the executable `command.resolveUri()` preload path and invokes `settings.open`, then asserts the real `SettingsDialog` is visible.
- This closes the Playwright Electron E2E portion of the combined unit+E2E checklist item for spec-04; external browser/packaged OS protocol E2E remains explicitly outside this proof.

### Verification Evidence

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-04" --workers=1 --reporter=line
pnpm -C devhub check:no-emoji
git -C devhub diff --check
git diff --check -- prompts/0503-2/R8.B/spec-04-command-palette-cmdk.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
```

### Remaining Boundary

- The 100+ default command registry target is superseded by section 28. Full custom-command management UI is superseded by section 29; arbitrary SKILL/script execution decision and external browser/packaged OS protocol E2E remain open.

## 28. implementation_status_2026_05_15_scanner_backed_100_registry

### Verified In This Pass

- `devhub/src/main/services/R8RuntimeService.ts` now augments the default command registry with scanner-backed runtime object commands instead of hardcoded filler rows.
- Process rows from the real scanner cache produce `process.open.<pid>` commands with `handler: 'uri:open'`, `category: 'process'`, and `devhub://process/<pid>` URIs.
- Port rows produce `port.open.<port>.<pid>` commands with `category: 'port'` and `devhub://port/<port>` URIs.
- Window rows produce `window.open.<hwnd>` commands with `category: 'window'` and `devhub://window/<hwnd>` URIs.
- `invokeCommand()` now owns the generic `uri:open` handler: it resolves the URI through the executable `resolveCommandUri()` path, rejects stale missing object targets with `E_NOT_FOUND`, emits `protocol-open` to the real renderer command event bridge when a main window exists, and writes command history only after a successful executable path.
- `devhub/src/main/services/R8RuntimeService.test.ts` verifies a 100+ registry with scanner-shaped process/port/window rows and confirms `process.open.4001` dispatches the same `protocol-open` event path used by external URI handoff.
- The packaged Electron `R8.B spec-04` Playwright scenario now waits until `window.devhub.r8.command.list()` reaches at least 100 entries in the real app and confirms scanner-backed `uri:open` object commands are present before exercising palette UI flows.

### Verification Evidence

```bash
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2 --include-tests
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "command registry|scanner object commands|command palette|five-scope|settings.open|popout.port" --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts e2e/example.spec.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-04" --workers=1 --reporter=line
```

### Remaining Boundary

- Full custom-command management UI is superseded by section 29. Arbitrary SKILL/script execution decision and external browser/packaged OS protocol E2E remain open.

## 29. implementation_status_2026_05_15_custom_command_ui

### Verified In This Pass

- `devhub/src/renderer/components/settings/SettingsDialog.tsx` now exposes a Settings Advanced "命令面板自定义命令" management surface.
- The UI loads existing custom commands through the public `window.devhub.r8.command.listCustom()` preload bridge and never reads internal stores directly.
- The form saves `id`, `label`, `handlerScript`, `shortcut`, and `enabled` through `window.devhub.r8.command.saveCustom()` with `confirmedBy: 'settings-dialog'`.
- The UI documents and preserves the safe declarative boundary: supported handlers are `command:<id>` and `devhub://...`; shell, JavaScript, eval, and SKILL string execution remain unsupported by design.
- Existing custom commands can be selected for editing or disabled by saving the same command with `enabled=false`; disabled rows remain visible in `listCustom()` but are excluded from executable `command:list` by the main service.
- `devhub/src/renderer/components/settings/SettingsDialog.statusbar.test.tsx` covers the Advanced UI save path with the typed command bridge contract.
- The packaged Electron `R8.B spec-04` E2E opens the real SettingsDialog through `settings.open`, switches to Advanced, saves `custom.e2e.open-dashboard` through real IPC, verifies it through `command.listCustom()`, and disables the fixed E2E command in cleanup.

### Verification Evidence

```bash
pnpm -C devhub test --run src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx e2e/example.spec.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-04" --workers=1 --reporter=line
```

### Remaining Boundary

- Arbitrary SKILL/script execution decision and external browser/packaged OS protocol E2E remain open.

## 30. implementation_status_2026_05_15_external_protocol_e2e_closure

### Verified In This Pass

- The packaged Electron `R8.B spec-04` E2E now validates the external `devhub://` protocol handoff path instead of stopping at in-app URI resolution.
- The scenario subscribes to the public `window.devhub.r8.command.onEvent` bridge, registers `devhub://` through the executable `command.registerOsProtocol(true, confirmedBy)` preload path when the current app is not already the default handler, then calls Electron `shell.openExternal()` with a real scanner-backed `devhub://process/<pid>` command URI.
- The existing single-instance guard receives the OS-level deep link as a second-instance launch, forwards `{ type: 'protocol-open', uri }` through the main-process `r8:command-event` bridge, and the renderer observes the exact URI through the same public command event stream.
- Cleanup unregisters the protocol only when the E2E registered it, restores command history, and disables the fixed custom command through real `command.saveCustom()`.
- Arbitrary shell, JavaScript, SKILL, and eval-like custom command execution remains intentionally unsupported by design. The safe declarative custom-command contract is complete for `command:<id>` and `devhub://...` handlers, while unsupported handler forms return `E_UNSUPPORTED_CUSTOM_COMMAND` rather than claiming execution success.

### Verification Evidence

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-04" --workers=1 --reporter=line
```

### Remaining Boundary

- None for the R8.B spec-04 checklist. Future arbitrary-code execution, if ever accepted, must be a separate security-reviewed spec rather than an extension of the R8 command palette.

## 31. implementation_status_2026_05_19_theme_entry_and_recency_decay

### Verified In This Pass

- `devhub/src/main/services/R8RuntimeService.ts` now registers executable `theme.apply.*` commands for every local `ThemeOption` palette instead of relying on `settings.open` as the only theme-related command-palette path.
- `invokeCommand()` dispatches a real `r8:command-event` payload `{ type: 'theme-apply', theme }` for theme commands, and command history is written only through the existing successful invocation path.
- `devhub/src/preload/index.ts` and `devhub/src/renderer/types/global.d.ts` now type the command event's optional `theme` payload so the preload bridge, renderer global API, and main-process event contract stay aligned.
- `devhub/src/renderer/App.tsx` consumes `theme-apply`, validates the palette with `paletteNameSchema`, and calls the existing `useTheme().setTheme()` path. This keeps command-palette theme switching on the same persisted settings and theme-axis pipeline used by Settings.
- `devhub/src/renderer/components/command/command-search.ts` now combines use-count boost with a bounded relative recency-decay boost when sorting Fuse search results.
- `R8CommandPalette.test.tsx` verifies visible source groups for process, port, window, AI, theme, settings, and command entries, plus Chinese and English theme lookup.
- `command-search.test.ts` verifies equal text matches are ordered by persisted usage and recency decay.
- `R8RuntimeService.test.ts` verifies `theme.apply.constructivism` is present in the executable registry, dispatches `theme-apply`, and persists command history.

### Verification Evidence

```bash
pnpm -C devhub exec vitest run src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/command/command-search.test.ts src/renderer/hooks/useGlobalShortcuts.test.tsx src/renderer/components/statusbar/StatusBar.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "command palette|command search|global shortcuts|cmdk|executable default commands|theme switching|history boost|source groups|R8CommandPalette|useGlobalShortcuts|StatusBar"
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/App.tsx src/renderer/components/command/command-search.ts src/renderer/components/command/command-search.test.ts src/renderer/components/command/R8CommandPalette.test.tsx --max-warnings=0
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
```

### Remaining Boundary

- None for the R8.B spec-04 checklist. `prompts/0503/28-final-acceptance-checklist.md` remains a user acceptance checklist; the local evidence bridge records A.3.1-A.3.8 and B.1.2 as locally verified but does not mark the user-facing acceptance boxes complete.
