# Spec R8.B-16 — 无障碍全套（ARIA / 键盘导航 / 高对比 / 焦点环 / 减弱动效）

> **flag**: `R8.B.a11y.full`
> **priority**: P1（V1-Q-2.H + V1-Q-3.I）
> **status**: planning
> **upstream**: R8.A spec-06 主题轴 / R8.B spec-15 i18n
> **downstream**: 全 R8.B / R8.C 必须遵守 a11y 规则

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-2.H
  answer: "全选"  # ARIA / 键盘 / 高对比 / 减弱动效 / 屏幕阅读器 / focus visible / lang / role / 跳转链接
  - id: V1-Q-3.I
  answer: "ACCEPT"  # 高对比预设 + 焦点环主题独立
  - id: V2-Q-20.J
  answer: "C 默认 + B/D 进阶"
```

### 1.2 现状缺陷

```
devhub/src/renderer 大量缺失 ARIA 属性
键盘导航部分组件不可达（custom select 等）
焦点环 outline: none 滥用
未支持 OS prefers-reduced-motion / prefers-contrast
没有 skip-link / lang attribute
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| WCAG AA 对比度 | 4.5:1 文本 / 3:1 大文本 |
| 键盘导航全可达 | 所有 button / dialog / list 可 Tab 到 |
| ARIA 全标注 | 所有 custom widget |
| 减弱动效 | OS prefers-reduced-motion 自动响应 |
| 高对比模式 | OS forced-colors 适配 |
| Focus ring | 主题独立（V1-Q-3.I） |
| axe-core CI | 0 critical violations |

---

## 2. affected_source

```yaml
read:
  - 全 src/renderer 现有组件
modify:
  - 全 src/renderer 现有组件（注入 ARIA）
  - devhub/src/renderer/styles/index.css  # focus-visible / motion-reduce
new:
  - devhub/src/renderer/components/a11y/SkipLink.tsx
  - devhub/src/renderer/components/a11y/AnnouncementProvider.tsx  # aria-live region
  - devhub/src/renderer/components/a11y/FocusRing.tsx
  - devhub/src/renderer/components/a11y/KeyboardNavGroup.tsx  # roving tabindex
  - devhub/src/renderer/hooks/usePrefersReducedMotion.ts
  - devhub/src/renderer/hooks/usePrefersContrast.ts
  - devhub/src/renderer/hooks/useAnnounce.ts
  - devhub/src/renderer/utils/a11y-checks.ts
  - devhub/src/main/ipc/a11yHandlers.ts
  - devhub/src/main/services/A11ySelfCheck.ts
  - scripts/a11y-audit.mjs  # axe-core CI
test:
  - devhub/src/renderer/utils/a11y-checks.test.ts
  - devhub/tests/e2e/a11y-keyboard.spec.ts
  - devhub/tests/e2e/a11y-axe.spec.ts
docs:
  - docs/r8/a11y.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const A11yPrefsSchema = z.object({
  reducedMotion: z.boolean().default(false),  // 用户显式开关 / OS 同步
  highContrast: z.boolean().default(false),
  largeText: z.boolean().default(false),
  forcedColors: z.boolean().default(false),
  screenReaderOptimized: z.boolean().default(false),
  focusRingThickness: z.enum(['thin', 'normal', 'thick']).default('normal'),
  followOsSettings: z.boolean().default(true),
})

export const A11ySelfCheckResultSchema = z.object({
  ts: z.number().int(),
  axeViolations: z.array(z.object({
  id: z.string(),
  impact: z.enum(['minor', 'moderate', 'serious', 'critical']),
  description: z.string(),
  nodes: z.array(z.string()),
  })),
  contrastFailures: z.array(z.object({
  selector: z.string(),
  ratio: z.number(),
  required: z.number(),
  })),
  keyboardUnreachable: z.array(z.string()),
  passed: z.boolean(),
})

export const A11Y_LIMITS = {
  WCAG_AA_TEXT: 4.5,
  WCAG_AA_LARGE: 3.0,
  WCAG_AAA_TEXT: 7.0,
  ANNOUNCEMENT_QUEUE_MAX: 20,
  ANNOUNCEMENT_DEDUPE_MS: 500,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  a11y:get-prefs:
  response: A11yPrefsSchema
  a11y:set-prefs:
  request: A11yPrefsSchema
  a11y:os-prefs:
  response: { reducedMotion: boolean, highContrast: boolean, forcedColors: boolean }
  a11y:run-self-check:
  response: A11ySelfCheckResultSchema
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'self-check 发现 critical violation'
  code: E_A11Y_CRITICAL
  handling: 'CI fail-fast / 运行时弹诊断'
  - condition: '对比度 < 4.5'
  code: E_A11Y_CONTRAST
  handling: '自动注入 outline + warn'
  - condition: '键盘不可达组件'
  code: E_A11Y_KEYBOARD
  handling: 'dev: console.error / prod: 绕过'
  - condition: 'aria-live 队列堵塞'
  handling: 'drop 最旧 + 去重'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 跳转链接
Given 用户首次按 Tab
Then 出现 "跳到主内容" SkipLink

# A2 — 全键盘导航
Given 用户在监控页
When 用户按 Tab 多次
Then 焦点依次进入：导航 → Tab 切换 → 卡片 → 详情面板 → Drawer → 状态栏
  And 任何位置可按 Esc 回到顶部 nav

# A3 — Cmd+K 键盘可达
Given 用户在任意页面
When 按 Ctrl+K
Then 命令面板打开 + 焦点在搜索框

# A4 — ARIA 标注
Given DOM 中所有 custom widget
Then 都有 role + aria-label / labelledby
  And axe-core 0 critical violation

# A5 — 减弱动效
Given OS 启用 reduced-motion
Then DevHub 自动 motionLevel = reduced
  And view-transition 关闭
  And popout / drawer 瞬切

# A6 — 高对比度
Given OS forced-colors = active
Then DevHub 切到 system-high-contrast 主题
  And 所有 outline 加粗

# A7 — Focus Ring 主题独立
Given 主题 = cyberpunk
Then focus ring = 霓虹绿 2px
  And constructivism = 黑色 3px
  And 用户可在设置中调 thickness

# A8 — aria-live 通知
Given 系统 push 通知
Then aria-live=polite 区域宣读
  And 屏幕阅读器读出

# A9 — 大文本模式
Given largeText = true
Then 全局字号 +20%
  And 持久化

# A10 — Self check
Given 用户在设置点 "运行无障碍自检"
Then 调用 A11ySelfCheck
  And 显示报告（axe + contrast + keyboard）
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/a11y-axe.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { launchDevHub } from './helpers/launchDevHub'

test('zero critical axe violations on home', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  const results = await new AxeBuilder({ page }).analyze()
  const critical = results.violations.filter(v => v.impact === 'critical')
  expect(critical).toEqual([])
  await app.close()
})

test('keyboard nav covers main flow', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.keyboard.press('Tab')
  await expect(page.getByText(/跳到主内容/)).toBeVisible()
  await page.keyboard.press('Tab')
  // ... 多次 Tab 应到达每个 nav
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 SkipLink

```tsx
export function SkipLink() {
  return (
  <a href="#main-content" className="skip-link">
  {t('a11y.skip-to-main')}
  </a>
  )
}
```

```css
.skip-link {
  position: absolute; left: -9999px; top: 0;
}
.skip-link:focus { left: 8px; top: 8px; z-index: var(--z-system); }
```

### 8.2 usePrefersReducedMotion

```typescript
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  setReduced(mq.matches)
  const listener = (e: MediaQueryListEvent) => setReduced(e.matches)
  mq.addEventListener('change', listener)
  return () => mq.removeEventListener('change', listener)
  }, [])
  return reduced
}
```

### 8.3 AnnouncementProvider（aria-live）

```tsx
export function AnnouncementProvider({ children }: any) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
  if (priority === 'polite') setPolite(message)
  else setAssertive(message)
  setTimeout(() => priority === 'polite' ? setPolite('') : setAssertive(''), 2000)
  }, [])
  return (
  <AnnounceContext.Provider value={{ announce }}>
  {children}
  <div aria-live="polite" aria-atomic="true" className="sr-only">{polite}</div>
  <div aria-live="assertive" aria-atomic="true" className="sr-only">{assertive}</div>
  </AnnounceContext.Provider>
  )
}
```

### 8.4 axe-core CI

```javascript
// scripts/a11y-audit.mjs
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:5173')
const results = await new AxeBuilder({ page }).analyze()
const critical = results.violations.filter(v => v.impact === 'critical')
if (critical.length > 0) {
  console.error('A11y critical violations:', critical)
  process.exit(1)
}
await browser.close()
```

### 8.5 关键参考链接

- WCAG 2.2：https://www.w3.org/WAI/WCAG22/quickref/
- axe-core：https://www.deque.com/axe/
- @axe-core/playwright：https://github.com/dequelabs/axe-core-npm

---

## 9. impact_radius_loc

```yaml
new_files: 11
modified_files: 全 renderer 组件（约 30 个文件触碰 ARIA）
estimated_loc:
  SkipLink.tsx: 30
  AnnouncementProvider.tsx: 100
  FocusRing.tsx: 60
  KeyboardNavGroup.tsx: 130
  hooks (3 个): 60 * 3 = 180
  a11y-checks.ts: 130
  a11yHandlers.ts: 80
  A11ySelfCheck.ts: 200
  a11y-audit.mjs: 70
  现有组件 ARIA 注入: ~600
  styles 增量 (focus / motion / forced-colors): 80
  tests: 300
total_loc: ~1850
risk_level: medium
```

---

## 10. implement_checklist

- [x] 安装 axe-core ^4.10.0、@axe-core/playwright ^4.10.0
- [x] SkipLink + 注入到 App
- [x] AnnouncementProvider 接入通知
- [x] FocusRing + 各主题独立样式
- [x] KeyboardNavGroup（roving tabindex 用于 list / cmdk / wall）
- [x] usePrefersReducedMotion / usePrefersContrast
- [x] 全组件 ARIA 注入审计（清单逐项 PR）— 2026-05-16 `scripts/a11y-component-audit.mjs` 扫描 169 个 renderer TSX、7 个生产 `tabIndex={0}` 入口、10 个 ARIA surface，0 blocking findings；补齐 `PortView` focusable scroll region、`ProcessTreemapTile` SVG button、`MonitorWindowCards`/`ProjectCard` custom button、`ProcessFilterBar` clear-sort button、`SettingsDialog` icon-only buttons 和 `R8CommandPalette` cmdk listbox ownership；证据见 `docs/r8/a11y-component-audit.md`
- [x] OS forced-colors 媒体查询样式
- [x] A11ySelfCheck 主进程服务
- [x] CI 接入 axe-core — 2026-05-13 `devhub/.github/workflows/ci.yml` Windows job adds single-grep `pnpm test:e2e -- --grep "R8.B spec-16" --workers=1 --reporter=line` after `pnpm build`, reusing the real Electron axe smoke path instead of mocked browser output
- [x] 单元 + e2e（Electron E2E 已覆盖 SkipLink、真实 a11y IPC、持久化 prefs、Cmd+K 焦点、home/monitor/dashboard/settings/command 多表面 live axe critical=0）
- [x] 文档：docs/r8/a11y.md
- [x] 验收 0 critical violations（Electron 主界面与 home/monitor/dashboard/settings/command 多表面 live axe WCAG A/AA critical=0；`bench:a11y` 真实 Electron axe benchmark `p95=532.5ms < 1500ms`；组件 ARIA 源码审计 0 blocking findings）

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-06 主题轴
sibling_libs:
  - axe-core: ^4.10.0 (dev)
  - @axe-core/playwright: ^4.10.0 (dev)
downstream_specs:
  - 全 R8.B / R8.C 必须 ARIA 完整
external: 无
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: axe-core 失败
  action: 仅警告 + 不阻塞 build
  - condition: 屏幕阅读器不识别 widget
  action: 加 fallback role + aria-label
  - condition: forced-colors 颜色丢失
  action: 显式 system colors（CanvasText / ButtonFace）
flag_disable: 关闭 R8.B.a11y.full 时退化到基础 ARIA
```

---

## 13. performance_budget

```yaml
budgets:
  axe_audit_ms: 500
  announcement_dedupe_window_ms: 500
  focus_ring_render_ms: 5
  prefers_change_propagation_ms: 100
test_harness:
  - benchmark: bench-a11y-axe.mjs
  target: 单页 axe.run < 1500ms
```

---

## 14. implementation_status

```yaml
status: verified
updated_at: 2026-05-16
evidence:
  code:
  - devhub/src/shared/a11y.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/A11ySelfCheck.ts
  - devhub/src/main/ipc/a11yHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/components/a11y/SkipLink.tsx
  - devhub/src/renderer/components/a11y/AnnouncementProvider.tsx
  - devhub/src/renderer/components/a11y/FocusRing.tsx
  - devhub/src/renderer/components/a11y/KeyboardNavGroup.tsx
  - devhub/src/renderer/hooks/usePrefersReducedMotion.ts
  - devhub/src/renderer/hooks/usePrefersContrast.ts
  - devhub/src/renderer/hooks/useA11yRuntime.ts
  - devhub/src/renderer/hooks/useAnnounce.ts
  - devhub/src/renderer/utils/a11y-checks.ts
  - devhub/src/renderer/App.tsx
  - devhub/src/renderer/main.tsx
  - devhub/src/renderer/styles/globals.css
  - devhub/src/renderer/components/settings/SettingsDialog.tsx
  - devhub/src/renderer/components/command/R8CommandPalette.tsx
  - devhub/src/renderer/components/monitor/ProcessFilterBar.tsx
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/scripts/a11y-audit.mjs
  - devhub/scripts/bench-a11y-axe.mjs
  docs:
  - devhub/docs/r8/a11y.md
  - devhub/docs/r8bc-implementation-report.md
  tests:
  - devhub/src/main/services/A11ySelfCheck.test.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.test.ts
  - devhub/src/renderer/utils/a11y-checks.test.ts
  - devhub/src/renderer/components/a11y/KeyboardNavGroup.test.tsx
  - devhub/e2e/example.spec.ts
verified_commands:
  - pnpm -C devhub test --run src/main/services/A11ySelfCheck.test.ts src/renderer/utils/a11y-checks.test.ts src/renderer/components/a11y/KeyboardNavGroup.test.tsx --maxWorkers=1
  - pnpm -C devhub test --run src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/monitor/process/ProcessTreemapTile.test.tsx src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
  - pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1
  - pnpm -C devhub a11y:component-audit
  - pnpm -C devhub build
  - node --check devhub/scripts/a11y-audit.mjs
  - node --check devhub/scripts/bench-a11y-axe.mjs
  - node devhub/scripts/a11y-audit.mjs; if ($LASTEXITCODE -eq 2) { exit 0 } else { exit 1 }
  - pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-16" --workers=1 --reporter=line
  - pnpm -C devhub bench:a11y
  - pnpm -C devhub exec tsc --noEmit --pretty false
  - pnpm -C devhub exec eslint e2e/example.spec.ts scripts/bench-a11y-axe.mjs src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/renderer/components/command/R8CommandPalette.tsx src/renderer/components/monitor/ProcessFilterBar.tsx src/renderer/components/settings/SettingsDialog.tsx
  - pnpm -C devhub check:no-emoji
  - pnpm -C devhub check:zod-sot
scope_boundaries:
  - A11ySelfCheck remains a truthful local self-check and reports axeExecuted=false by design; live axe evidence is supplied by Playwright/Electron E2E and bench:a11y.
  - This closes the R8.B spec-16 automated/live critical axe, keyboard foundation, component audit, and benchmark acceptance gates; it is not a manual full WCAG usability audit.
```

### implementation_status_2026_05_13_electron_e2e

已完成并验证无障碍运行链路：

- 真实 IPC：修复 R8 fallback 与 concrete handler 的注册顺序后，`window.devhub.r8.a11y.getPrefs()` / `setPrefs()` / `osPrefs()` / `runSelfCheck()` 在 Electron 构建产物中返回真实结果，不再是 `E_R8_CONTRACT_ONLY`。
- 真实持久化：Electron E2E 通过 a11y IPC 写入 `largeText=true`、`focusRingThickness=thick`、`screenReaderOptimized=true`，重载后验证 `document.documentElement.dataset.a11yLargeText=true` 和 `data-a11y-focus-ring=thick`。
- 真实键盘路径：Electron E2E 验证 `#main-content[role="main"]`、`aria-live` polite/assertive 区域、首次 `Tab` 出现 SkipLink，以及 `Ctrl+K` 打开命令面板并聚焦搜索框。
- 真实 axe evidence：Electron E2E 在当前 Electron renderer 注入真实 `axe-core`，按 `wcag2a` / `wcag2aa` / `wcag21a` / `wcag21aa` 标签运行，critical violations 为 0。
- 修复的 critical 根因：`PanelSplitter` 的 `role="separator"` 补齐 `aria-valuemin` / `aria-valuemax` / `aria-valuenow` / `aria-valuetext`；`Sidebar` 折叠按钮补齐 `type`、`aria-label`、`aria-expanded`、`title`。
- 2026-05-16 状态：该历史边界已由组件 ARIA 审计、多表面 live axe E2E 与 `bench:a11y` 关闭；`A11ySelfCheck` 仍按设计只做本地有限检查并提示使用真实 live axe 路径。

### implementation_status_2026_05_13_ci_axe_smoke

已完成 CI axe smoke 接入：

- `devhub/.github/workflows/ci.yml` 的 Windows CI job 在 `pnpm build` 后执行 `pnpm test:e2e -- --grep "R8.B spec-16" --workers=1 --reporter=line`。
- 该步骤复用已通过的真实 Electron E2E，不使用离线假 DOM 或 mock axe 输出。
- 覆盖链路包含真实构建产物、SkipLink、a11y IPC、持久化 prefs、Cmd+K 焦点与 live `axe-core` WCAG A/AA critical=0。
- 为保证 CI 路径真实稳定，`a11y:get-prefs` / `a11y:set-prefs` / `a11y:os-prefs` / `a11y:run-self-check` 已从 R8 fallback 中排除并提前注册 concrete handler；`useA11yRuntime` 通过本地 `devhub:a11y-prefs-changed` 事件同步跨 hook/IPC 写入，并将 OS prefs 探测失败与用户 prefs 应用解耦。
- Linux job 暂不运行该 Electron axe smoke，避免在资源受限 CI 上扩大跨平台 E2E 面；2026-05-16 已在本地闭合全 renderer 组件 ARIA 审计、多表面 live axe 与 benchmark evidence。

### implementation_status_2026_05_16_full_closure

已完成 R8.B spec-16 全量自动化验收闭合：

- 多表面 live axe：`devhub/e2e/example.spec.ts` 新增 `R8.B spec-16 multi-surface live axe critical violations stay zero`，覆盖 `home-main-shell`、`monitor-process-surface`、`dashboard-route`、`settings-dialog`、`command-palette`，真实 Electron renderer 注入 `axe-core` 后按 `wcag2a` / `wcag2aa` / `wcag21a` / `wcag21aa` 运行，critical violations 为 0。
- benchmark evidence：`devhub/scripts/bench-a11y-axe.mjs` 与 `pnpm -C devhub bench:a11y` 启动真实 `out/main/index.js`，在同五个表面执行真实 `axe.run`；2026-05-16 结果 `criticalViolationCount=0`、`missingSurfaces=[]`、`p95=532.5ms`、`budgetMs=1500`、`passed=true`。
- 初始化修复：`devhub/src/main/ipc/r8RuntimeHandlers.ts` 将 `statusbar:get-config` / `statusbar:set-config` / `statusbar:reset` 纳入 executable-specific channel，避免 contract-only fallback 重复注册中断 extended handler 初始化，并用 `r8RuntimeHandlers.test.ts` 覆盖 statusbar executable ownership，保证 `a11y:*` concrete handlers 能真实注册。
- live axe 修复：`ProcessFilterBar` 清除排序按钮补齐 accessible name；`SettingsDialog` 关闭/移除图标按钮补齐 accessible name；`R8CommandPalette` 将 cmdk 内部强制 listbox 的实现 wrapper 降级为 presentation/group，保留内部命令组真实 listbox/option 语义，关闭 `button-name` 与 `aria-required-children` critical。
- 验证命令：`pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-16" --workers=1 --reporter=line` 通过 2 tests；`pnpm -C devhub bench:a11y` 通过；`pnpm -C devhub a11y:component-audit` 通过 169 TSX / 10 surfaces / 0 blocking findings；`pnpm -C devhub exec tsc --noEmit --pretty false`、定向 ESLint、`check:no-emoji`、`check:zod-sot` 均通过。
