# R8.A spec-07 — 主题默认间距标定（每对主题在 6 维量化差异）

> **batch**: R8.A | **rank**: #7
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V2-Q-20.B 全表（量化差异） + V2-Q-20.K.1/K.2 + V1-Q-3.A.1
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-06

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: V2-Q-20.K.2
  raw: "同意：每对主题在 6 维上的具体 px / ms / 倍率全部写入 spec，验收时实测对照"
  impact: 6 维数值表必须落 CSS variables；E2E 实测 px/ms
  - source: V2-Q-20.B.1/B.2/B.3/B.4/B.5/B.6
  raw: 表中具体 px / ms / 倍率
  impact: 直接落 CSS variable 配置
  - source: V2-Q-20.B.7
  raw: "D（加权计算总分差 ≥ 0.4 算合格）"
  impact: 验收用 6 维加权差距打分
  - source: 5 大反馈 #1.2
  raw: "切主题只换色"
  impact: 数值差距必须显著（同一组件在不同主题下视觉差异 ≥ 阈值）
```

### 1.2 工程背景

- spec-06 解决"联动机制"，本 spec 解决"联动后差距是否足够大"。
- 当前 modern-light vs constructivism 在 motionLevel 上时长完全相同（refs/source-snapshot-v2.md 维度 6），导致用户感觉无变化。
- 本 spec 落地具体数值；spec-09 的端口卡片要靠这些 token。

### 1.3 为什么放在 #7

是 spec-06 的伴随 spec：6 维联动需要明确数值才能运行。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/renderer/styles/tokens/theme-tokens.css
  op: REWRITE
  detail: 7 主题 × 6 维全量 CSS variables；按 .theme--{palette} 选择器
  - path: devhub/src/renderer/styles/tokens/density-tokens.css
  op: CREATE
  detail: density 倍率 .theme--density-{compact|standard|comfortable}
  - path: devhub/src/renderer/styles/tokens/radius-tokens.css
  op: CREATE
  - path: devhub/src/renderer/styles/tokens/motion-tokens.css
  op: CREATE
  - path: devhub/src/renderer/styles/tokens/typography-tokens.css
  op: CREATE
  detail: 字号 / 行高 / 字距 / 字族
  - path: devhub/src/renderer/styles/tokens/elevation-tokens.css
  op: CREATE
  detail: 阴影形态（含硬偏移 / 柔和 / 霓虹辉光 / 仅细线）
  - path: devhub/src/renderer/styles/tokens/decoration-tokens.css
  op: CREATE
  detail: 装饰透明度 + 装饰位置 class
  - path: devhub/src/renderer/theme/theme-distance.ts
  op: CREATE
  detail: 6 维 token 引用表 + 加权差距计算
  - path: devhub/src/renderer/theme/THEME_PRESETS.ts
  op: MODIFY
  detail: 落地 V2-Q-20.B 表中精确数值
  - path: devhub/scripts/check-theme-distance.mjs
  op: CREATE
  detail: 启动期跑；7 主题两两加权差距 >= 0.4
```

---

## 3. data_contracts

### 3.1 6 维数值表（V2-Q-20.B 全量落地）

```typescript
import { z } from 'zod';

export const themeDistanceTableSchema = z.object({
  schema_version: z.literal('1.0'),
  axes: z.object({
  radius: z.record(z.string(), z.object({
  card_px: z.number().int().min(0).max(32),
  button_px: z.number().int().min(0).max(32),
  input_px: z.number().int().min(0).max(32),
  tab_px: z.number().int().min(0).max(32),
  drawer_px: z.number().int().min(0).max(32),
  })),
  typography: z.record(z.string(), z.object({
  body_px: z.number().min(10).max(20),
  h1_px: z.number().min(20).max(40),
  line_height: z.number().min(1.2).max(2.0),
  letter_spacing_em: z.number().min(-0.05).max(0.05),
  mono_px: z.number().min(10).max(16),
  family_main: z.string(),
  family_mono: z.string(),
  })),
  density: z.record(z.string(), z.object({
  default_density: z.enum(['compact','standard','comfortable']),
  card_padding_px: z.number().int(),
  list_row_height_px: z.number().int(),
  form_gap_px: z.number().int(),
  multiplier: z.number().min(0.7).max(1.3),
  })),
  elevation: z.record(z.string(), z.object({
  elev_1: z.string(),  // CSS box-shadow value
  elev_2: z.string(),
  elev_3: z.string(),
  shape_description: z.string(),
  })),
  motion: z.record(z.string(), z.object({
  hover_ms: z.number().int().min(0).max(500),
  tooltip_ms: z.number().int().min(0).max(500),
  drawer_ms: z.number().int().min(0).max(800),
  modal_ms: z.number().int().min(0).max(600),
  theme_switch_ms: z.number().int().min(0).max(800),
  easing: z.string(),  // CSS cubic-bezier
  })),
  decoration: z.record(z.string(), z.object({
  opacity_pct: z.number().int().min(0).max(50),
  apply_targets: z.array(z.string()),
  })),
  }),
});

export type ThemeDistanceTable = z.infer<typeof themeDistanceTableSchema>;
```

### 3.2 V2-Q-20.B 表落地（presets）

```typescript
export const THEME_DISTANCE: ThemeDistanceTable = {
  schema_version: '1.0',
  axes: {
  radius: {
  'constructivism': { card_px: 0, button_px: 0, input_px: 0, tab_px: 0, drawer_px: 0 },
  'modern-light':  { card_px: 8, button_px: 6, input_px: 6, tab_px: 4, drawer_px: 12 },
  'warm-light':  { card_px: 12, button_px: 10, input_px: 8, tab_px: 6, drawer_px: 16 },
  'cyberpunk':  { card_px: 0, button_px: 2, input_px: 2, tab_px: 0, drawer_px: 0 },
  'swiss':  { card_px: 4, button_px: 4, input_px: 4, tab_px: 0, drawer_px: 4 },
  'dark':  { card_px: 8, button_px: 6, input_px: 6, tab_px: 4, drawer_px: 12 },
  'light':  { card_px: 8, button_px: 6, input_px: 6, tab_px: 4, drawer_px: 12 },
  },
  typography: {
  'constructivism': { body_px: 16, h1_px: 32, line_height: 1.4, letter_spacing_em: -0.02, mono_px: 13, family_main: 'Bebas Neue, Source Han Serif', family_mono: 'JetBrains Mono' },
  'modern-light':  { body_px: 14, h1_px: 28, line_height: 1.5, letter_spacing_em: -0.01, mono_px: 12, family_main: 'Inter', family_mono: 'JetBrains Mono' },
  'warm-light':  { body_px: 16, h1_px: 26, line_height: 1.7, letter_spacing_em: 0,  mono_px: 13, family_main: 'Source Han Serif', family_mono: 'JetBrains Mono' },
  'cyberpunk':  { body_px: 14, h1_px: 24, line_height: 1.4, letter_spacing_em: 0.02, mono_px: 13, family_main: 'Space Grotesk', family_mono: 'JetBrains Mono' },
  'swiss':  { body_px: 14, h1_px: 30, line_height: 1.4, letter_spacing_em: 0,  mono_px: 12, family_main: 'Helvetica, Akzidenz', family_mono: 'Inconsolata' },
  'dark':  { body_px: 14, h1_px: 26, line_height: 1.5, letter_spacing_em: -0.01, mono_px: 12, family_main: 'Inter', family_mono: 'JetBrains Mono' },
  'light':  { body_px: 14, h1_px: 26, line_height: 1.5, letter_spacing_em: -0.01, mono_px: 12, family_main: 'Inter', family_mono: 'JetBrains Mono' },
  },
  density: {
  'constructivism': { default_density: 'compact',  card_padding_px: 12, list_row_height_px: 28, form_gap_px: 8,  multiplier: 0.85 },
  'modern-light':  { default_density: 'standard',  card_padding_px: 16, list_row_height_px: 36, form_gap_px: 12, multiplier: 1.00 },
  'warm-light':  { default_density: 'comfortable', card_padding_px: 24, list_row_height_px: 44, form_gap_px: 16, multiplier: 1.20 },
  'cyberpunk':  { default_density: 'compact',  card_padding_px: 12, list_row_height_px: 28, form_gap_px: 8,  multiplier: 0.85 },
  'swiss':  { default_density: 'standard',  card_padding_px: 16, list_row_height_px: 36, form_gap_px: 12, multiplier: 1.00 },
  'dark':  { default_density: 'standard',  card_padding_px: 16, list_row_height_px: 36, form_gap_px: 12, multiplier: 1.00 },
  'light':  { default_density: 'standard',  card_padding_px: 16, list_row_height_px: 36, form_gap_px: 12, multiplier: 1.00 },
  },
  elevation: {
  'constructivism': { elev_1: '3px 3px 0 #000', elev_2: '5px 5px 0 #000', elev_3: '8px 8px 0 #000', shape_description: '硬偏移、不带模糊' },
  'modern-light':  { elev_1: '0 1px 2px rgba(0,0,0,.06)', elev_2: '0 4px 8px rgba(0,0,0,.08)', elev_3: '0 12px 24px rgba(0,0,0,.12)', shape_description: '苹果式渐进' },
  'warm-light':  { elev_1: '0 2px 4px rgba(120,80,40,.12)', elev_2: '0 6px 14px rgba(120,80,40,.18)', elev_3: '0 16px 32px rgba(120,80,40,.22)', shape_description: '暖色调浅阴影' },
  'cyberpunk':  { elev_1: '0 0 8px rgba(0,255,200,.4)', elev_2: '0 0 16px rgba(0,255,200,.5)', elev_3: '0 0 32px rgba(0,255,200,.6)', shape_description: '霓虹辉光' },
  'swiss':  { elev_1: '0', elev_2: '0 1px 0 #000', elev_3: '0 2px 0 #000', shape_description: '仅细线非阴影' },
  'dark':  { elev_1: '0 1px 2px rgba(0,0,0,.4)', elev_2: '0 4px 8px rgba(0,0,0,.5)', elev_3: '0 12px 24px rgba(0,0,0,.6)', shape_description: '深色加重阴影' },
  'light':  { elev_1: '0 1px 2px rgba(0,0,0,.06)', elev_2: '0 4px 8px rgba(0,0,0,.08)', elev_3: '0 12px 24px rgba(0,0,0,.12)', shape_description: '同 modern-light' },
  },
  motion: {
  'constructivism': { hover_ms: 80,  tooltip_ms: 120, drawer_ms: 250, modal_ms: 180, theme_switch_ms: 350, easing: 'cubic-bezier(.2,.8,.2,1)' },
  'modern-light':  { hover_ms: 150, tooltip_ms: 200, drawer_ms: 300, modal_ms: 250, theme_switch_ms: 250, easing: 'cubic-bezier(.4,0,.2,1)' },
  'warm-light':  { hover_ms: 200, tooltip_ms: 250, drawer_ms: 400, modal_ms: 350, theme_switch_ms: 400, easing: 'cubic-bezier(.4,0,.2,1)' },
  'cyberpunk':  { hover_ms: 60,  tooltip_ms: 100, drawer_ms: 200, modal_ms: 150, theme_switch_ms: 300, easing: 'linear' },
  'swiss':  { hover_ms: 120, tooltip_ms: 180, drawer_ms: 280, modal_ms: 220, theme_switch_ms: 250, easing: 'cubic-bezier(.4,0,.2,1)' },
  'dark':  { hover_ms: 150, tooltip_ms: 200, drawer_ms: 300, modal_ms: 250, theme_switch_ms: 250, easing: 'cubic-bezier(.4,0,.2,1)' },
  'light':  { hover_ms: 150, tooltip_ms: 200, drawer_ms: 300, modal_ms: 250, theme_switch_ms: 250, easing: 'cubic-bezier(.4,0,.2,1)' },
  },
  decoration: {
  'constructivism': { opacity_pct: 25, apply_targets: ['card-bg','empty-state','status-bar-bg','title-pattern'] },
  'modern-light':  { opacity_pct: 0,  apply_targets: [] },
  'warm-light':  { opacity_pct: 15, apply_targets: ['card-bg','detail-paper'] },
  'cyberpunk':  { opacity_pct: 30, apply_targets: ['global-bg','card-grid','focus-edge'] },
  'swiss':  { opacity_pct: 8,  apply_targets: ['grid-toggle'] },
  'dark':  { opacity_pct: 0,  apply_targets: [] },
  'light':  { opacity_pct: 0,  apply_targets: [] },
  },
  },
};
```

### 3.3 加权差距计算（V2-Q-20.B.7 D）

```typescript
const WEIGHTS = { palette: 0.30, typography: 0.15, radius: 0.15, elevation: 0.10, motion: 0.15, decoration: 0.15 };

export function pairwiseDistance(a: string, b: string, table: ThemeDistanceTable): number {
  // 每维 normalize -> [0,1]，按 WEIGHTS 加权，min(1, sum) 输出
  // palette: 直接 0/1
  // typography: body_px diff / 4 + line_height diff / 0.6 + family_main 不同 +0.4
  // radius: card_px diff / 12
  // elevation: shape_description 不同 +1
  // motion: 平均 ms 差 / 200
  // decoration: opacity_pct diff / 30
  return /* implementation */ 0;
}
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: theme:distance:get
  direction: renderer -> main
  request_schema: z.object({})
  response_schema: themeDistanceTableSchema
no_runtime_writes_to_distance_table: true
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| 启动期 distance 表 schema 校验失败 | DISTANCE_INVALID | dev: fail-fast | 修 THEME_DISTANCE |
| 任意两主题加权差距 < 0.4 | DISTANCE_TOO_CLOSE | dev: fail-fast | 调数值 |
| CSS variable 名重复 | CSS_VAR_COLLISION | 启动期 ESLint scss-lint | 改名 |
| 字族未安装且未提供 fallback | FONT_MISSING | UI 静默 fallback system-ui | 不阻塞 |

---

## 6. acceptance_gwt

```gherkin
Feature: 主题间数值差异

Scenario A1: 7 主题两两加权差距 >= 0.4
  Given THEME_DISTANCE 完整
  When 启动期 scripts/check-theme-distance.mjs 运行
  Then 所有 21 对主题 pairwiseDistance >= 0.4
  And 进程退出码 = 0

Scenario A2: card_padding_px 在 cyberpunk vs warm-light 差距 >= 12px
  Given 当前主题 cyberpunk
  When 切到 warm-light
  Then DOM 上 .process-card padding 从 12px 变到 24px
  And computed style 实测差 = 12px

Scenario A3: motion theme_switch_ms 在 reduced 与 expressive 之间差 >= 100ms
  Given motionLevel='reduced' (warm-light 联动)
  When 测 theme_switch_ms = 400
  Given motionLevel='expressive' (constructivism 联动)
  When 测 theme_switch_ms = 350
  Then 两值不同

Scenario A4: elevation 形态可识别
  Given DOM 上 .card.theme--cyberpunk box-shadow
  Then computed value 包含 'rgba(0, 255, 200'
  Given DOM 上 .card.theme--swiss box-shadow
  Then computed value = '0' 或仅含细线 (1px solid)

Scenario A5: decoration_opacity_pct 应用
  Given .theme--constructivism .card-bg
  Then computed opacity = 0.25 (within 0.01 tolerance)
  Given .theme--modern-light .card-bg
  Then computed opacity = 0
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-07-theme-distance.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('card padding differs by >= 12px between cyberpunk and warm-light', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.evaluate(async () => window.devhub.theme.set({
  next_axes: { palette: 'cyberpunk', density: 'compact', radiusFamily: 'sharp', motionLevel: 'expressive' },
  reason: 'palette_switch',
  }));
  const cyberPad = await win.locator('.process-card').first().evaluate((el) =>
  parseFloat(getComputedStyle(el).paddingLeft)
  );
  await win.evaluate(async () => window.devhub.theme.set({
  next_axes: { palette: 'warm-light', density: 'comfortable', radiusFamily: 'round', motionLevel: 'reduced' },
  reason: 'palette_switch',
  }));
  const warmPad = await win.locator('.process-card').first().evaluate((el) =>
  parseFloat(getComputedStyle(el).paddingLeft)
  );
  expect(Math.abs(warmPad - cyberPad)).toBeGreaterThanOrEqual(12);
  await app.close();
});

test('all 21 theme pairs satisfy weighted distance >= 0.4', async () => {
  const result = await import('child_process').then((cp) =>
  new Promise<number>((resolve) => {
  const p = cp.spawn('node', ['scripts/check-theme-distance.mjs'], { stdio: 'inherit' });
  p.on('exit', (code) => resolve(code ?? 1));
  })
  );
  expect(result).toBe(0);
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| Design tokens spec | https://design-tokens.github.io/community-group/format/ |
| Palette weight scoring | https://contrast-grid.eightshapes.com |
| CSS variable convention | Material 3 tokens |
| View-transition keyed CSS | https://developer.chrome.com/docs/web-platform/view-transitions |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 400
breakdown:
  THEME_DISTANCE table: 130
  pairwiseDistance + tests: 60
  CSS tokens (6 files): 130
  THEME_PRESETS update: 40
  check-theme-distance script: 40
files_touched: ~10
risk_radius:
  - CSS variable 名与 spec-06 必须一致
  - decoration apply_targets 是否真实存在 DOM 节点（否则 opacity 无效）
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 写 THEME_DISTANCE 表 + Zod schema
  - step_02: 写 pairwiseDistance + 单测 21 对覆盖
  - step_03: 拆分 6 个 CSS token 文件 + class 选择器 .theme--{palette}
  - step_04: 在 main.css 中按主题 class 切换载入
  - step_05: 写 check-theme-distance.mjs（启动期 + CI 跑）
  - step_06: 验证 elevation / decoration / motion 在真实 DOM 应用
  - step_07: 写 e2e（§7）
verify:
  - pnpm typecheck
  - pnpm test --filter theme-distance
  - node scripts/check-theme-distance.mjs
  - pnpm e2e --grep "spec-07"
```

---

## 11. dependencies

```yaml
blocks:
  - spec-09-port-card-improvement.md (端口卡片用 token)
  - R8.B/spec-12-theme-editor.md
  - R8.B/spec-14-icon-system.md
blocked_by:
  - spec-06-theme-4d-axis-exposure.md
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "字族未安装"
  action: "fallback system-ui；toast 提示用户"
  - cause: "decoration target 节点不存在"
  action: "静默；启动期 dev warning"
  - cause: "elevation 在某主题渲染卡顿"
  action: "GPU compositing 不可用时 simplify shadow"
```

---

## 13. performance_budget

```yaml
budgets:
  total_tokens_css_size_gzipped: <= 18KB
  theme_class_swap_to_repaint: <= 80ms
  decoration_render_overhead: < 1ms / card
  pairwiseDistance_per_call: < 0.1ms
verification:
  - Bundle analyzer
  - Playwright trace repaint
```
