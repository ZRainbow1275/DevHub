# Spec R8.B-07 — 主题装饰几何扩充 + 用户 SVG 上传 + 主题独立音色

> **flag**: `R8.B.theme.decorations`
> **priority**: P1（V1-Q-3.A.2 + 用户加项）
> **status**: verified
> **upstream**: R8.A spec-06/07 主题 4 维轴 + 联动机制
> **downstream**: 无（最终视觉层）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-3.A.2
  answer: "C"  # 默认绑定 + 可独立调整
  - id: V1-Q-3.F
  answer: "8 内置 + SVG 上传"
  - id: V2-Q-20.A.4
  answer: "接受装饰矩阵"
  - id: V2-Q-20.B.6
  answer: "接受 6 主题装饰透明度表"
  - id: USER-FEEDBACK-1.2
  quote: "目前的主题切换依然都只算是换了个颜色，而没有从布局、组件表现等各类情况给出不同的表现"
  impact: "装饰几何是主题视觉差异的核心载体之一"
```

### 1.2 现状缺陷

```
devhub/src/renderer/theme/theme-language.ts
  - 仅定义颜色 / 字体 / 圆角 / 动效 4 维
  - 无装饰图层概念
devhub/src/renderer/components/theme/ThemeProvider.tsx
  - 不渲染装饰背景层
没有：装饰几何 8 内置 / 用户上传 SVG / sanitize / 透明度 / 应用位置
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 内置装饰几何 | ≥ 8（对角线 / 大色块 / 纸纹 / 扫描线 / 网格 / 黄金分割 / 苏维埃几何 / 噪点） |
| 用户自定义 SVG 上传 | DOMPurify SVG profile 校验 |
| 装饰透明度可调 | 0–50% 滑块 |
| 应用位置可选 | 卡片 / 详情面板 / 全局背景 / 状态栏 |
| 主题独立音色 | 7 主题各自 hover/click/notify 音效 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/theme/theme-language.ts
  - devhub/src/renderer/components/theme/ThemeProvider.tsx
  - devhub/src/renderer/styles/index.css
modify:
  - devhub/src/renderer/theme/theme-language.ts  # 加 decorationSet 字段
  - devhub/src/renderer/components/theme/ThemeProvider.tsx  # 注入装饰背景层
new:
  - devhub/src/renderer/components/theme/DecorationLayer.tsx
  - devhub/src/renderer/components/theme/decorations/SovietGeo.tsx
  - devhub/src/renderer/components/theme/decorations/Diagonals.tsx
  - devhub/src/renderer/components/theme/decorations/Paper.tsx
  - devhub/src/renderer/components/theme/decorations/Scanline.tsx
  - devhub/src/renderer/components/theme/decorations/Grid.tsx
  - devhub/src/renderer/components/theme/decorations/Golden.tsx
  - devhub/src/renderer/components/theme/decorations/Noise.tsx
  - devhub/src/renderer/components/theme/decorations/Blocks.tsx
  - devhub/src/renderer/components/theme/CustomSvgUploader.tsx
  - devhub/src/renderer/services/SvgSanitizer.ts  # DOMPurify SVG profile
  - devhub/src/renderer/services/ThemeSounds.ts  # howler 整合
  - devhub/src/renderer/hooks/useDecoration.ts
  - devhub/src/renderer/hooks/useThemeSound.ts
  - devhub/src/main/ipc/themeDecorationHandlers.ts
  - devhub/src/main/services/CustomSvgStore.ts  # electron-store 存自定义 SVG
test:
  - devhub/src/renderer/services/SvgSanitizer.test.ts
  - devhub/src/renderer/components/theme/DecorationLayer.test.tsx
  - devhub/tests/e2e/theme-decoration.spec.ts
docs:
  - docs/r8/theme-decorations.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const DecorationKindSchema = z.enum([
  'none',
  'soviet-geo',  // 苏维埃几何
  'diagonals',  // 对角线
  'paper',  // 纸纹
  'scanline',  // 扫描线
  'grid',  // 网格
  'golden',  // 黄金分割
  'noise',  // 噪点
  'blocks',  // 大色块
  'custom-svg',  // 用户上传
])

export const DecorationApplyPositionSchema = z.enum([
  'card-background',
  'detail-panel-background',
  'global-background',
  'statusbar-background',
  'empty-state',
  'header',
])

export const ThemeDecorationConfigSchema = z.object({
  kind: DecorationKindSchema,
  customSvgId: z.string().optional(),
  opacity: z.number().min(0).max(0.5).default(0.15),  // V2-Q-20.B.6 不超过 50%
  positions: z.array(DecorationApplyPositionSchema).default([]),
  blendMode: z.enum(['normal', 'multiply', 'overlay', 'screen']).default('normal'),
  scale: z.number().min(0.5).max(4).default(1),
  motionRespect: z.boolean().default(true),  // 遵守 prefers-reduced-motion
})
export type ThemeDecorationConfig = z.infer<typeof ThemeDecorationConfigSchema>

export const CustomSvgEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(64),
  sanitizedContent: z.string(),  // 已经 DOMPurify SVG profile
  uploadedAt: z.number().int(),
  size: z.number().int(),
  hash: z.string(),
})

export const ThemeSoundConfigSchema = z.object({
  themeId: z.string(),
  enabled: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(0.3),
  events: z.object({
  hover: z.string().optional(),
  click: z.string().optional(),
  notify: z.string().optional(),
  error: z.string().optional(),
  success: z.string().optional(),
  }),
})

export const DECORATION_LIMITS = {
  MAX_OPACITY: 0.5,
  MIN_OPACITY: 0,
  MAX_CUSTOM_SVG_KB: 200,
  MAX_CUSTOM_SVGS: 50,
  ALLOWED_SVG_TAGS: ['svg', 'g', 'path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line', 'defs', 'pattern', 'mask', 'use', 'symbol'],
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  theme:decoration-list:
  response: { kinds: DecorationKind[], customSvgs: CustomSvgEntry[] }
  theme:decoration-set:
  request: ThemeDecorationConfigSchema
  response: { success: boolean }
  theme:custom-svg-upload:
  request: { name: string, content: string }
  response: { id: string, sanitizedContent: string }
  theme:custom-svg-list:
  response: { items: CustomSvgEntry[] }
  theme:custom-svg-remove:
  request: { id: string }
  theme:sound-config:
  request: ThemeSoundConfigSchema
  response: { success: boolean }
  theme:sound-config-get:
  request: { themeId: string }
  response: ThemeSoundConfigSchema
```

---

## 5. error_matrix

```yaml
errors:
  - condition: 'SVG sanitize 检测到 <script> / 事件处理 / 外部链接'
  code: E_SECURITY_SVG
  handling: '拒绝上传 + 详细原因 toast'
  - condition: 'SVG 文件 > 200KB'
  code: E_VALIDATION
  handling: '拒绝 + 提示压缩'
  - condition: '自定义 SVG 数 > 50'
  code: E_RATE_LIMITED
  handling: '提示用户清理'
  - condition: 'SVG XML 解析错误'
  code: E_VALIDATION
  - condition: '装饰透明度 > 50%'
  code: E_VALIDATION
  handling: 'clamp 到 50%'
  - condition: 'howler 加载失败'
  code: E_INTERNAL
  handling: '禁用音效，UI 不影响'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 8 内置装饰
Given 用户进入 Theme Editor
Then 显示 8 个内置装饰几何选项 + "无"
  And 每个有缩略图

# A2 — 装饰主题联动
Given 当前主题 = constructivism
Then 默认装饰 = soviet-geo + 透明度 25% + 位置 [card-background, header]

# A3 — 装饰透明度滑块
Given 用户调整滑块到 30%
Then 装饰背景层 opacity = 0.3
  And 持久化

# A4 — SVG 上传
Given 用户选择本地 .svg 文件
When 上传
Then SvgSanitizer 校验通过 → 保存
  And 出现在装饰选项列表

# A5 — 恶意 SVG 拒绝
Given 用户上传含 <script> 的 SVG
When 上传
Then 拒绝 + toast "SVG 含禁止标签：script，请移除"
  And 文件未保存

# A6 — 装饰位置选择
Given 装饰 kind = grid
When 用户勾选 positions = [global-background]
Then grid 装饰仅在全局背景层渲染
  And 卡片不叠加

# A7 — prefers-reduced-motion
Given OS 设置启用减弱动效
  And motionRespect = true
Then 动态装饰（如 scanline 滚动）暂停为静态

# A8 — 主题独立音色
Given 当前主题 = cyberpunk
  And ThemeSoundConfig.enabled = true
When 用户 hover 卡片
Then 播放 cyberpunk hover.mp3（howler）

# A9 — 切换主题音效跟随
Given 切到 modern-light
Then 卡片 hover 音效 = modern-light hover.mp3

# A10 — 装饰渲染不阻塞
Given 装饰层 SVG 复杂
Then 主内容渲染 P95 < 16ms
  And 装饰层独立 layer (will-change: transform)
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/theme-decoration.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'
import path from 'node:path'

test('built-in 8 decorations available', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-theme-editor"]')
  const options = await page.getByTestId(/^decoration-option-/).count()
  expect(options).toBeGreaterThanOrEqual(8)
  await app.close()
})

test('upload safe svg', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-theme-editor"]')
  const input = page.locator('input[type="file"][data-testid="svg-upload"]')
  await input.setInputFiles(path.join(__dirname, 'fixtures/safe-pattern.svg'))
  await expect(page.getByTestId('decoration-option-custom-svg')).toBeVisible()
  await app.close()
})

test('reject malicious svg', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="open-theme-editor"]')
  const input = page.locator('input[type="file"][data-testid="svg-upload"]')
  await input.setInputFiles(path.join(__dirname, 'fixtures/script-svg.svg'))
  await expect(page.getByText(/SVG 含禁止标签/)).toBeVisible()
  await app.close()
})
```

---

## 8. reference_impl

### 8.1 SvgSanitizer（DOMPurify SVG profile）

```typescript
import DOMPurify from 'dompurify'
import { DECORATION_LIMITS } from '@shared/decoration'

export class SvgSanitizer {
  sanitize(content: string): string {
  if (content.length > DECORATION_LIMITS.MAX_CUSTOM_SVG_KB * 1024) {
  throw new Error('E_VALIDATION: SVG 超过 200KB')
  }
  const clean = DOMPurify.sanitize(content, {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'foreignObject', 'a', 'iframe'],
  FORBID_ATTR: ['onload', 'onclick', 'onmouseover', 'href', 'xlink:href'],
  })
  if (!clean.includes('<svg')) {
  throw new Error('E_VALIDATION: 不是合法 SVG')
  }
  if (/javascript:/i.test(clean) || /<script/i.test(clean)) {
  throw new Error('E_SECURITY_SVG: 含 script 或 javascript URL')
  }
  return clean
  }
}
```

### 8.2 DecorationLayer

```tsx
export function DecorationLayer({ config }: { config: ThemeDecorationConfig }) {
  if (config.kind === 'none') return null
  if (config.kind === 'custom-svg') return <CustomSvgLayer id={config.customSvgId!} {...config} />

  const Comp = DECORATION_COMPONENTS[config.kind]
  return (
  <div
  className="decoration-layer"
  style={{
  opacity: config.opacity,
  mixBlendMode: config.blendMode,
  transform: `scale(${config.scale})`,
  pointerEvents: 'none',
  }}
  aria-hidden="true"
  >
  <Comp />
  </div>
  )
}
```

### 8.3 howler 主题音色

```typescript
import { Howl } from 'howler'

class ThemeSoundManager {
  private sounds = new Map<string, Howl>()
  load(themeId: string, config: ThemeSoundConfig) {
  this.sounds.clear()
  if (!config.enabled) return
  Object.entries(config.events).forEach(([event, src]) => {
  if (!src) return
  this.sounds.set(`${themeId}:${event}`, new Howl({ src: [src], volume: config.volume }))
  })
  }
  play(themeId: string, event: string) {
  this.sounds.get(`${themeId}:${event}`)?.play()
  }
}
```

### 8.4 关键参考链接

- DOMPurify SVG profile：https://github.com/cure53/DOMPurify#svg-support
- howler.js：https://howlerjs.com/

---

## 9. impact_radius_loc

```yaml
new_files: 16
modified_files: 3
estimated_loc:
  DecorationLayer.tsx: 110
  装饰组件 (8 个): 80 * 8 = 640
  CustomSvgUploader.tsx: 140
  SvgSanitizer.ts: 90
  ThemeSounds.ts: 120
  useDecoration.ts: 70
  useThemeSound.ts: 60
  themeDecorationHandlers.ts: 110
  CustomSvgStore.ts: 90
  theme-language.ts (modify): +60
  ThemeProvider.tsx (modify): +40
  index.css (modify): +50
  tests: 320
total_loc: ~1900
risk_level: medium
```

---

## 10. implement_checklist

- [x] 安装 dompurify ^3.1.0、howler ^2.2.4
- [x] 实现 SvgSanitizer（DOMPurify SVG profile + 黑名单）
- [x] 创建 8 个内置装饰组件
- [x] DecorationLayer Provider 注入到 ThemeProvider
- [x] CustomSvgUploader 上传 / 预览 / 删除 UI
- [x] CustomSvgStore（electron-store + 限 50 个 + 200KB）
- [x] ThemeSounds（howler 加载主题音效）
- [x] IPC：decoration-list / decoration-set / custom-svg-* / sound-config*
- [x] 与 R8.A spec-06/07 主题轴联动（切换主题时装饰跟随）
- [x] 与 spec-15 i18n 对齐（装饰名称翻译键）
- [x] 单元 + e2e
- [x] 文档：docs/r8/theme-decorations.md
- [x] 验收 ASSERT_THEME_DECORATION_8_PLUS_CUSTOM 通过

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-06 主题 4 维轴
  - R8.A spec-07 默认距离拉大
sibling_libs:
  - dompurify: ^3.1.0
  - howler: ^2.2.4
  - electron-store: 已存在
downstream_specs: 无
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: SVG 上传失败
  action: 回退到内置 + toast
  - condition: howler 不可用
  action: 静音模式
  - condition: 装饰渲染卡顿
  action: opacity = 0 + 提示用户降低复杂度
  - condition: 自定义 SVG 文件损坏
  action: 删除 + 重新上传
flag_disable: 关闭 R8.B.theme.decorations 时仅纯色背景
```

---

## 13. performance_budget

```yaml
budgets:
  decoration_render_ms: 16
  svg_sanitize_p95_ms: 50
  custom_svg_upload_to_ready_ms: 200
  sound_play_latency_ms: 30
  decoration_load_kb_max: 80
test_harness:
  - benchmark: bench-decoration-render.mjs
  target: 8 装饰各 100 次切换 p99 < 16ms
```

---

## 14. implementation_status

```yaml
status: verified
implemented_at: 2026-05-16
completed:
  - shared appearance decoration contract with persisted defaults
  - 8 built-in non-interactive renderer decorations
  - palette default decoration linkage through the existing theme axis
  - document-level decoration metadata and CSS variable application
  - useDecoration settings bridge for persisted renderer updates
  - root global-background decoration layer in App
  - header, card-background, detail-panel-background, statusbar-background, and empty-state decoration layer injection with one shared resolved config
  - SettingsDialog controls for kind, position, opacity, scale, blend mode, custom SVG upload/delete, and theme sound config
  - dompurify dependency and renderer SvgSanitizer SVG profile with strict shared validation
  - main-process CustomSvgStore with electron-store persistence, 50-entry limit, 200KB limit, SHA256 metadata, and malformed-row drop
  - executable theme:decoration-list, theme:decoration-set, theme:custom-svg-upload/list/remove, theme:sound-config, and theme:sound-config-get IPC channels
  - preload/global typings for theme decoration list/set/custom SVG/sound config/getCustomSvgContent
  - howler dependency and ThemeSoundManager with theme-specific local data-URI tones, disabled default, load-error fail-closed behavior, and play-error silent fallback
  - spec-15 i18n translation-key alignment through THEME_DECORATION_I18N_KEYS and THEME_DECORATION_POSITION_I18N_KEYS in SettingsDialog
  - Electron Playwright coverage for built-in count, safe SVG upload, persisted custom SVG config, custom SVG rendering, malicious SVG rejection, multi-position layers, and sound config
  - production Electron benchmark harness for 8 built-ins plus custom SVG under the 16ms render budget
  - documentation at devhub/docs/r8/theme-decorations.md
  - theme-language, sanitizer, store, sound, IPC, and i18n unit coverage
not_claimed_complete: []
verification:
  - pnpm -C devhub test --run src/renderer/services/SvgSanitizer.test.ts src/main/services/CustomSvgStore.test.ts src/renderer/services/ThemeSounds.test.ts src/renderer/theme/theme-language.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
  - pnpm -C devhub test --run src/renderer/services/ThemeSounds.test.ts src/renderer/i18n/i18n.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
  - pnpm -C devhub test --run src/renderer/services/ThemeSounds.test.ts src/renderer/theme/theme-language.test.ts src/renderer/i18n/i18n.test.ts --maxWorkers=1
  - pnpm -C devhub test --run src/renderer/theme/theme-language.test.ts --maxWorkers=1 -t "decoration|theme language|palette"
  - pnpm -C devhub build
  - pnpm -C devhub test:e2e --grep "R8.B spec-07 theme decoration custom SVG" --reporter=line
  - pnpm -C devhub bench:theme-decoration
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub check:zod-sot
  - pnpm -C devhub check:no-cloud-deps
  - pnpm -C devhub check:no-ocr-deps
  - python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
completion_boundary:
  checked: 13
  open: 0
  reason: "The verified slice closes built-in decorations, theme-axis linkage, custom SVG upload/sanitize/store/render/delete, theme sounds, IPC/preload/types, i18n keys, multi-position rendering, Electron E2E, and the render benchmark with local evidence."
```
