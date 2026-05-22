# Spec R8.B-17 — 4 套图标库混用 + 官方品牌 Logo（禁 Emoji）

> **flag**: `R8.B.icon.library`
> **priority**: P1（V1-Q-3.K + 用户决策）
> **status**: verified
> **upstream**: R8.A spec-01（图标库已安装）
> **downstream**: 全 R8.B / R8.C 图标使用 token 引用

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-3.K.2
  answer: "EXTEND"  # 4 套混用：lucide / tabler / radix / heroicons
  - id: V1-Q-3.K.3
  answer: "EXTEND"  # 官方品牌 Logo（@icons-pack/react-simple-icons）
  - id: V1-Q-3.K.x
  note: "明确禁 Emoji 在 UI 中作为图标使用"
  - id: USER-FEEDBACK-1.2
  quote: "主题切换只换了颜色"
  impact: "图标统一 token 让主题轴可控制 stroke / weight / size"
```

### 1.2 现状缺陷

```
devhub/src/renderer 散落硬编码 SVG / 部分 emoji
无统一图标 token 协议
无品牌 Logo 库
图标尺寸 / stroke 无主题轴联动
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 4 套图标库 | lucide / tabler / radix / heroicons |
| 品牌 Logo | @icons-pack/react-simple-icons |
| Token 协议 | "lucide:Search" / "tabler:Box" / "brand:OpenAI" |
| 主题轴联动 | size / strokeWidth / 默认色 由 theme 控制 |
| 禁 Emoji | ESLint rule 禁文本中字符 \u{1F300}-\u{1FAFF} 用作 UI 图标 |
| Tree-shaking | 仅使用的图标进入 bundle |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer 现有 svg / emoji
modify:
  - devhub/src/renderer/components 现有图标使用点 → 替换为 Icon token
new:
  - devhub/src/renderer/components/icon/Icon.tsx
  - devhub/src/renderer/components/icon/IconResolver.ts
  - devhub/src/renderer/components/icon/registry.ts  # 库映射
  - devhub/src/renderer/components/icon/BrandLogo.tsx
  - devhub/src/renderer/components/icon/EmojiBlocker.tsx  # dev mode 警告
  - devhub/src/renderer/hooks/useIcon.ts
  - devhub/src/main/ipc/iconHandlers.ts
  - .eslintrc.cjs (modify)  # no-emoji rule
test:
  - devhub/src/renderer/components/icon/Icon.test.tsx
  - devhub/tests/e2e/icon-mix.spec.ts
docs:
  - docs/r8/icon-library.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const IconLibrarySchema = z.enum(['lucide', 'tabler', 'radix', 'heroicons', 'brand'])
export type IconLibrary = z.infer<typeof IconLibrarySchema>

// === Token 格式 ===
// "lucide:Search"
// "tabler:Box"
// "radix:Cross1"
// "heroicons:Bell"
// "brand:OpenAI"
export const ICON_TOKEN_REGEX = /^([a-z]+):([A-Za-z0-9]+)$/

export const IconResolveSchema = z.object({
  library: IconLibrarySchema,
  name: z.string(),
  size: z.number().int().min(8).max(128).optional(),
  strokeWidth: z.number().min(0.5).max(4).optional(),
  color: z.string().optional(),
})

export const ICON_LIMITS = {
  DEFAULT_SIZE: 16,
  TILE_SIZE: 20,
  STATUS_SIZE: 14,
  HERO_SIZE: 24,
  STROKE_DEFAULT: 1.5,
  STROKE_THICK: 2,
  BUNDLE_KB_MAX: 200,
} as const

// === 4 库使用规则 ===
export const ICON_LIBRARY_USAGE = {
  'lucide':  '主功能图标 / 操作按钮 / 卡片头部 / 状态栏',
  'tabler':  '设置 / 详细 form / 装饰 / 边缘场景',
  'radix':  'cmdk 内 / Dialog 内 / 系统级 (cross / chevron / dot)',
  'heroicons':  '主营销 / 大尺寸 hero icon / 空态占位',
  'brand':  'AI 工具品牌 (OpenAI / Anthropic / Google / GitHub)',
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  icon:list-libraries:
  response: { libraries: IconLibrary[], counts: Record<IconLibrary, number> }
  icon:resolve-token:
  request: { token: string }
  response: { resolved: IconResolveSchema, available: boolean }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'token 格式不合法'
  code: E_VALIDATION
  handling: '退化为占位图标 + dev: console.warn'
  - condition: 'library 不存在'
  code: E_VALIDATION
  - condition: '图标名不存在于库中'
  code: E_NOT_FOUND
  handling: '退化为 fallback 图标 (lucide:HelpCircle) + dev warn'
  - condition: 'UI 中检测到 emoji 字符'
  code: E_LINT
  handling: 'ESLint fail-fast in dev / build error'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 4 库都可用
Given 用户在 Icon component 用 token "lucide:Search"
Then 渲染 Lucide Search SVG

Given token "tabler:Box"
Then 渲染 Tabler Box

Given token "radix:Cross1"
Then 渲染 Radix Cross

Given token "heroicons:Bell"
Then 渲染 Heroicons Bell

Given token "brand:OpenAI"
Then 渲染 OpenAI 官方 Logo（react-simple-icons）

# A2 — token 不合法 fallback
Given token "weird:NoSuchIcon"
Then 渲染 lucide:HelpCircle 占位
  And dev 模式 console.warn

# A3 — 主题轴联动
Given 主题 = constructivism (sharp / 大粗线)
Then 默认 strokeWidth = 2
  And size = 16

Given 主题 = modern-light (soft / 细线)
Then 默认 strokeWidth = 1.5
  And size = 16

# A4 — Bundle tree-shaking
Given 编译产物
Then 仅 imported 的 icon 进入 bundle
  And 总图标体积 < 200KB

# A5 — 禁 Emoji
Given 开发者在源码写一个 Emoji 字符（如 U+1F680 火箭）
When 运行 ESLint
Then 报错 + 提示用 token

# A6 — Brand Logo 在 AI 工具感测
Given 进程列表显示 codex.exe / claude.exe
Then 用 brand:OpenAI / brand:Anthropic 显示 logo
  And cmdk 的 AI 命令组也用 brand logo

# A7 — 主题切换图标色
Given 主题切到 cyberpunk
Then 默认图标颜色 = 霓虹绿
  And focus / hover 状态变化
  And 不变 SVG 路径只变 currentColor

# A8 — 图标可访问性
Given <Icon token="lucide:Bell" aria-label="通知"/>
Then SVG 有 role="img" + aria-label
  And 装饰性图标 aria-hidden="true"

# A9 — 图标 token 验证 IPC
Given 用户调用 icon:resolve-token { token: "lucide:Search" }
Then 返回 { resolved: { library: 'lucide', name: 'Search' }, available: true }

# A10 — 库的使用规则文档
Given docs/r8/icon-library.md
Then 列出 ICON_LIBRARY_USAGE 4+1 库的使用边界
  And 给出禁 Emoji 的明确原因
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/icon-mix.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('lucide search icon renders', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.keyboard.press('Control+K')
  await expect(page.locator('[data-icon-token="lucide:Search"]')).toBeVisible()
  await app.close()
})

test('brand logo for AI tools', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="process"]')
  // 假设有 codex.exe → brand:OpenAI
  await expect(page.locator('[data-icon-token="brand:OpenAI"]')).toBeVisible()
  await app.close()
})

test('no emoji in UI', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  const text = await page.textContent('body')
  // U+1F300 - U+1FAFF 范围
  expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 Icon component + 注册表

```tsx
// Icon.tsx
import * as Lucide from 'lucide-react'
import * as Tabler from '@tabler/icons-react'
import * as Radix from '@radix-ui/react-icons'
import * as Heroicons from '@heroicons/react/24/outline'
import * as SimpleIcons from '@icons-pack/react-simple-icons'
import { ICON_TOKEN_REGEX, ICON_LIMITS } from '@shared/icon'

const REGISTRY = {
  lucide: Lucide as any,
  tabler: Tabler as any,
  radix: Radix as any,
  heroicons: Heroicons as any,
  brand: SimpleIcons as any,
}

export function Icon({ token, size, strokeWidth, color, ariaLabel, decorative }: IconProps) {
  const m = token.match(ICON_TOKEN_REGEX)
  if (!m) return <FallbackIcon />
  const [, lib, name] = m
  const Lib = REGISTRY[lib]
  if (!Lib) return <FallbackIcon />
  const Comp = Lib[name] ?? Lib['Icon' + name]
  if (!Comp) {
  if (import.meta.env.DEV) console.warn(`[icon] not found: ${token}`)
  return <FallbackIcon />
  }
  return (
  <Comp
  data-icon-token={token}
  width={size ?? ICON_LIMITS.DEFAULT_SIZE}
  height={size ?? ICON_LIMITS.DEFAULT_SIZE}
  strokeWidth={strokeWidth ?? ICON_LIMITS.STROKE_DEFAULT}
  color={color ?? 'currentColor'}
  role="img"
  aria-label={decorative ? undefined : ariaLabel}
  aria-hidden={decorative ? 'true' : undefined}
  />
  )
}
```

### 8.2 主题轴联动

```typescript
// useIcon.ts
export function useIconDefaults() {
  const theme = useTheme()
  const stroke = theme.radiusFamily === 'sharp' ? ICON_LIMITS.STROKE_THICK : ICON_LIMITS.STROKE_DEFAULT
  return { strokeWidth: stroke, size: theme.density === 'compact' ? 14 : 16 }
}
```

### 8.3 ESLint no-emoji rule

```javascript
// .eslintrc.cjs
'no-restricted-syntax': [
  'error',
  {
  selector: "Literal[value=/[\\u{1F300}-\\u{1FAFF}]/u]",
  message: 'UI 中禁用 Emoji，请改用 <Icon token="..."/>',
  },
],
```

### 8.4 关键参考链接

- lucide-react：https://lucide.dev/
- @tabler/icons-react：https://tabler-icons.io/
- @radix-ui/react-icons：https://www.radix-ui.com/icons
- @heroicons/react：https://heroicons.com/
- @icons-pack/react-simple-icons：https://github.com/icons-pack/react-simple-icons

---

## 9. impact_radius_loc

```yaml
new_files: 7
modified_files: 全 renderer（约 50 个文件用 Icon 组件替换 hardcode SVG / emoji）
estimated_loc:
  Icon.tsx: 130
  IconResolver.ts: 90
  registry.ts: 60
  BrandLogo.tsx: 60
  EmojiBlocker.tsx: 50
  useIcon.ts: 60
  iconHandlers.ts: 70
  ESLint config: +30
  现有组件替换: ~400 LoC（净减少，移除 hardcode SVG）
  tests: 220
total_loc: ~1170
risk_level: low
```

---

## 10. implement_checklist

- [x] 确认 R8.A spec-01 已安装 4 套图标库 + react-simple-icons
- [x] 实现 Icon component + 4 库 dispatch + brand logo
- [x] 主题轴联动（useIconDefaults）
- [x] no-emoji gate：`pnpm lint` 前置运行 `check:no-emoji`
- [x] 替换现有 hardcode SVG / emoji 为 Icon token（逐文件 PR）— 2026-05-13 已将 legacy `components/icons/index.tsx` 和剩余真实 UI 图标入口迁移为 token adapter；保留的 `<svg>` 均为图表、拓扑、sparkline 或主题装饰，不作为图标 token 迁移对象。
- [x] AI 工具感测时使用 brand logo（codex / claude / gemini）
- [x] icon:list-libraries / resolve-token IPC
- [x] 文档：docs/r8/icon-library.md（包含 4+1 库使用边界 + 禁 emoji 原因）
- [x] 单元 + e2e（单元测试已补，Electron E2E 已于 2026-05-13 覆盖 command palette token、真实 codex-like AI task 品牌 logo token 与无 Emoji 扫描）
- [x] 验收"全 UI 无 Emoji"

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-01（库已安装）
sibling_libs:
  - lucide-react: ^0.475.0
  - @tabler/icons-react: ^3.30.0
  - @radix-ui/react-icons: ^1.3.2
  - @heroicons/react: ^2.2.0
  - @icons-pack/react-simple-icons: 已存在
downstream_specs:
  - 全 R8.B / R8.C UI 组件
external: 无
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: 库未加载
  action: 显示 lucide:HelpCircle 占位
  - condition: 图标名不存在
  action: dev warn + fallback
  - condition: brand logo 缺失（不支持的工具）
  action: 显示通用 Box icon
  - condition: ESLint emoji rule 误报
  action: 用注释 disable + 加入白名单
flag_disable: 关闭 R8.B.icon.library 时退化到 hardcode SVG
```

---

## 13. performance_budget

```yaml
budgets:
  bundle_kb_max: 200
  icon_render_ms: 1
  resolve_token_us: 100
  brand_logo_lazy_load_ms: 50
test_harness:
  - benchmark: bench-icon-render.mjs
  target: 1000 个 Icon 同时渲染 p99 < 16ms
  - bundle-analyzer:
  target: 仅使用的图标进入产物
```

---

## 14. implementation_status

```yaml
status: verified
updated_at: 2026-05-06
evidence:
  code:
  - devhub/src/shared/icon-library.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/IconRegistryService.ts
  - devhub/src/main/ipc/iconHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/src/renderer/components/icon/registry.tsx
  - devhub/src/renderer/components/icon/IconResolver.ts
  - devhub/src/renderer/components/icon/Icon.tsx
  - devhub/src/renderer/components/icon/BrandLogo.tsx
  - devhub/src/renderer/components/icon/useIcon.ts
  - devhub/src/renderer/components/command/R8CommandPalette.tsx
  docs:
  - devhub/docs/r8/icon-library.md
  - devhub/docs/r8bc-implementation-report.md
  tests:
  - devhub/src/main/services/IconRegistryService.test.ts
  - devhub/src/renderer/components/icon/Icon.test.tsx
  - devhub/src/renderer/components/command/R8CommandPalette.test.tsx
  - devhub/e2e/example.spec.ts includes R8.B spec-17 icon tokens cover command palette brand logo and no emoji
verified_commands:
  - pnpm -C devhub test --run src/main/services/IconRegistryService.test.ts src/renderer/components/icon/Icon.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx --maxWorkers=1
  - pnpm -C devhub typecheck
  - pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1
  - pnpm -C devhub lint
  - pnpm -C devhub check:zod-sot
  - pnpm -C devhub check:no-emoji
  - python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
  - git -C devhub diff --check
  - git diff --check
historical_not_claimed_complete_closed_by_section_17:
  - bundle_size_tree_shaking_evidence
  - icon_render_benchmark_evidence
```

## 15. implementation_status_2026_05_13_playwright_icon_tokens

### Verified In This Pass

- `devhub/e2e/example.spec.ts` now includes `R8.B spec-17 icon tokens cover command palette brand logo and no emoji`.
- The fixture launches a real Electron app and a real codex-like Node child process rather than injecting synthetic task rows.
- The fixture runs the executable `aiTask.scan()` path until the child process is classified as `toolType === "codex"`, verifies the AI task card renders `data-tool-logo="codex"`, and verifies the nested icon token is `brand:OpenAI`.
- The fixture opens the real command palette with `Control+K` and verifies the `lucide:Search` token in the rendered palette.
- The fixture scans the live page body text with the existing `EMOJI_PATTERN` and asserts no Emoji are present.

### Verification Evidence

```powershell
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-17" --workers=1
```

- ESLint passed for `devhub/e2e/example.spec.ts` on 2026-05-13.
- Playwright Electron grep passed on 2026-05-13: 1 test passed in 7.8s.

### Remaining Boundary

- Superseded by section 17.

## 16. implementation_status_2026_05_13_legacy_svg_token_migration

### Verified In This Pass

- `devhub/src/renderer/components/icons/index.tsx` was converted from 50+ hardcoded SVG icon components into a backward-compatible token adapter over `devhub/src/renderer/components/icon/Icon.tsx`.
- `devhub/src/renderer/components/icon/registry.tsx` now exposes the lucide tokens needed by the legacy adapter, including process, window, network, layout, status, sort, upload/download, and navigation icons.
- Remaining direct UI icon SVGs were migrated to existing token adapters in:
  - `devhub/src/renderer/components/ErrorBoundary.tsx`
  - `devhub/src/renderer/components/monitor/AITaskView.tsx`
  - `devhub/src/renderer/components/ui/ScriptSelector.tsx`
  - `devhub/src/renderer/components/monitor/PortRelationshipGraph.tsx`
  - `devhub/src/renderer/components/monitor/topology/NeuralGraph.tsx`
- A renderer-wide `<svg>` search now leaves only graphing/visualization/decorative surfaces: TopologyMiniWidget, DevObservabilityPanel, AIProgressTimeline, ProcessSparkline, ProcessTreemapView, ProcessDetailDrawer, Sparkline, ThemeDecoration, and MetricChart.

### Verification Evidence

```powershell
pnpm -C devhub exec eslint src/renderer/components/icons/index.tsx src/renderer/components/icon/registry.tsx src/renderer/components/ErrorBoundary.tsx src/renderer/components/monitor/AITaskView.tsx src/renderer/components/ui/ScriptSelector.tsx src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/topology/NeuralGraph.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec vitest run src/renderer/components/icon/Icon.test.tsx src/renderer/components/icons/AIToolBrandLogo.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-17" --workers=1
pnpm -C devhub check:no-emoji
```

- Modified-file ESLint passed on 2026-05-13.
- TypeScript `tsc --noEmit` passed on 2026-05-13.
- Focused icon/brand/cmdk Vitest passed on 2026-05-13: 3 files, 20 tests.
- Production build passed on 2026-05-13 with the pre-existing Monaco dynamic/static import warning only.
- Playwright Electron grep passed on 2026-05-13: 1 test passed in 6.1s after rebuilding.
- No-emoji guard passed on 2026-05-13: `No emoji found in 606 files.`

### Remaining Boundary

- Superseded by section 17.

## 17. implementation_status_2026_05_15_bundle_and_render_proof

### Verified In This Pass

- `devhub/scripts/bench-icon-library.mjs` builds the renderer icon registry in Vite library mode with React externalized, rejects namespace imports from the approved icon libraries, and measures the emitted bundle bytes against the 200KB budget.
- `devhub/src/renderer/components/icon/Icon.test.tsx` now contains a mixed token render benchmark that uses `renderToStaticMarkup()` for a pure component-render measurement and asserts sub-1ms average render time per icon token on the local fixture path.
- The benchmark run reported 56,454 raw bytes and 13,891 gzip bytes for the registry bundle, both well under the 200KB threshold.
- The mixed icon render benchmark passed with the static-render path and kept the per-icon budget under 1ms in the focused test run.

### Verification Evidence

```powershell
pnpm -C devhub bench:icons
pnpm -C devhub test --run src/renderer/components/icon/Icon.test.tsx --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/components/icon/Icon.test.tsx devhub/scripts/bench-icon-library.mjs
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
```

- Bundle proof passed on 2026-05-15: `bench:icons` reported 56,454 raw bytes / 13,891 gzip bytes and zero namespace imports from the approved icon libraries.
- The focused icon component benchmark passed on 2026-05-15 with 8 tests total.

### Remaining Boundary

- Renderer graphing / visualization / decorative `<svg>` surfaces remain intentionally outside token migration; they are not counted as icon-library gaps.
