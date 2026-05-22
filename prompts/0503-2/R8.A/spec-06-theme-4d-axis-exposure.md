# R8.A spec-06 — 主题 4 维（palette × density × radius × motion）联动暴露

> **batch**: R8.A | **rank**: #6 | **user-perception-assert**: ASSERT_THEME_NON_COLOR_DELTA
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-3.A.1/A.2/A.3/A.4 + V2-Q-13.I.5 + V2-Q-20 全表 + 5 大反馈 #1.2
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-01

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: 5 大反馈 #1.2
  raw: "目前的主题切换依然都只算是换了个颜色，没有从布局、组件表现等各类情况给出不同的表现"
  impact: 切 palette 必须联动 density / radius / motion / typography / decoration 全部维度
  - source: V1-Q-3.A.1
  raw: "B + C + E（5 + 6 + Preset 维度）"
  impact: 主题为 6 维，本 spec 落地核心 4 维 UI（palette/density/radius/motion）；typography/decoration 在 spec-07
  - source: V1-Q-3.A.2
  raw: "C（默认绑定 + 可独立）"
  impact: 切 palette 默认联动其他维度；用户可锁定某维（V2-Q-20.A.1 E）
  - source: V1-Q-3.A.4
  raw: "D（view-transition API）"
  impact: 切主题用浏览器原生过渡 + framer-motion fallback
  - source: V2-Q-20.A.1
  raw: "E（软联动 + 静默应用 + 可撤销 + 可锁定某维）"
  impact: 切 palette 自动联动 + toast 撤销
  - source: master §9 ASSERT_THEME_NON_COLOR_DELTA
  raw: 切主题前后 density|radiusFamily|motionLevel 至少 1 项不同
```

### 1.2 工程背景

- refs/source-snapshot-v2.md 维度 6：theme-language.ts 行 80-81 仅定义 radiusFamily/motionLevel 默认关联，但**不在切换时触发联动**。
- 用户 6 轮反馈"只换色"= 联动逻辑没接到 useTheme 切换流程。
- 本 spec 修：触发联动 + UI 暴露 4 维滑块 + view-transition 包裹。

### 1.3 为什么放在 #6

是 5 大反馈 #1.2 的直接修复点；R8.A 第三条用户感知断言 ASSERT_THEME_NON_COLOR_DELTA 由本 spec 负责。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/renderer/theme/theme-language.ts
  lines: "80-81 关联区"
  op: MODIFY
  detail: 暴露 applyPresetCoordination 函数；触发器在 useTheme
  - path: devhub/src/renderer/theme/theme-axes.ts
  op: CREATE
  detail: 4 维（+ typography/decoration 占位）轴定义、合法值表、联动矩阵
  - path: devhub/src/renderer/theme/applyPresetCoordination.ts
  op: CREATE
  detail: 切 palette -> 计算其他维度推荐值；考虑用户锁定
  - path: devhub/src/renderer/hooks/useTheme.ts
  op: MODIFY
  detail: 接入 applyPresetCoordination；触发 view-transition
  - path: devhub/src/renderer/hooks/useDensity.ts
  op: MODIFY
  detail: 联动接入；不再独立切换
  - path: devhub/src/renderer/hooks/useThemeAxesLock.ts
  op: CREATE
  detail: 用户锁定某维（V2-Q-20.A.1 E）
  - path: devhub/src/renderer/components/settings/ThemeAxesPanel.tsx
  op: CREATE
  detail: 4 维滑块/分段控件 + 锁定 toggle
  - path: devhub/src/renderer/components/settings/ThemeSwitcher.tsx
  op: CREATE
  detail: 主题选择器 + 联动提示 + 撤销 toast
  - path: devhub/src/renderer/components/notifications/ThemeChangeToast.tsx
  op: CREATE
  detail: 顶部 toast；6s 倒计时；含撤销按钮
  - path: devhub/src/renderer/styles/tokens/theme-tokens.css
  op: MODIFY
  detail: 暴露 4 维 CSS variables（--density-base / --radius-card / --motion-hover / 等）
  - path: devhub/src/renderer/styles/view-transition.css
  op: CREATE
  detail: ::view-transition-old/new 样式；fallback opacity
  - path: devhub/src/renderer/components/cmdk-actions/themeActions.ts
  op: CREATE
  detail: cmdk 注册 "切到下一个主题" / "切到 X 主题"
  - path: devhub/electron-store-keys.ts
  op: MODIFY
  detail: 增 theme.axes.lock 键
```

---

## 3. data_contracts

### 3.1 axes 定义

```typescript
import { z } from 'zod';

export const paletteSchema = z.enum([
  'constructivism','modern-light','warm-light','cyberpunk','swiss','dark','light',
]);
export const densitySchema = z.enum(['compact','standard','comfortable']);
export const radiusFamilySchema = z.enum(['sharp','soft','round']);
export const motionLevelSchema = z.enum(['reduced','balanced','expressive']);

export const themeAxesSchema = z.object({
  palette: paletteSchema,
  density: densitySchema,
  radiusFamily: radiusFamilySchema,
  motionLevel: motionLevelSchema,
});

export const themeAxesLockSchema = z.object({
  palette: z.boolean().default(false),
  density: z.boolean().default(false),
  radiusFamily: z.boolean().default(false),
  motionLevel: z.boolean().default(false),
});

export type ThemeAxes = z.infer<typeof themeAxesSchema>;
export type ThemeAxesLock = z.infer<typeof themeAxesLockSchema>;

export const PRESET_COORDINATION: Record<z.infer<typeof paletteSchema>, ThemeAxes> = {
  'constructivism': { palette: 'constructivism', density: 'compact',  radiusFamily: 'sharp', motionLevel: 'expressive' },
  'modern-light':  { palette: 'modern-light',  density: 'standard',  radiusFamily: 'soft',  motionLevel: 'balanced' },
  'warm-light':  { palette: 'warm-light',  density: 'comfortable', radiusFamily: 'round', motionLevel: 'reduced' },
  'cyberpunk':  { palette: 'cyberpunk',  density: 'compact',  radiusFamily: 'sharp', motionLevel: 'expressive' },
  'swiss':  { palette: 'swiss',  density: 'standard',  radiusFamily: 'soft',  motionLevel: 'balanced' },
  'dark':  { palette: 'dark',  density: 'standard',  radiusFamily: 'soft',  motionLevel: 'balanced' },
  'light':  { palette: 'light',  density: 'standard',  radiusFamily: 'soft',  motionLevel: 'balanced' },
};
```

### 3.2 联动算法

```typescript
export function applyPresetCoordination(
  current: ThemeAxes,
  newPalette: ThemeAxes['palette'],
  lock: ThemeAxesLock,
): { next: ThemeAxes; changed_axes: Array<keyof ThemeAxes> } {
  const preset = PRESET_COORDINATION[newPalette];
  const next: ThemeAxes = {
  palette: newPalette, // palette 由本次切换决定，非 lock 控
  density:  lock.density  ? current.density  : preset.density,
  radiusFamily: lock.radiusFamily ? current.radiusFamily : preset.radiusFamily,
  motionLevel:  lock.motionLevel  ? current.motionLevel  : preset.motionLevel,
  };
  const changed_axes: Array<keyof ThemeAxes> = [];
  (Object.keys(next) as Array<keyof ThemeAxes>).forEach((k) => {
  if (current[k] !== next[k]) changed_axes.push(k);
  });
  return { next, changed_axes };
}
```

### 3.3 toast schema

```typescript
export const themeChangeToastSchema = z.object({
  changed_axes: z.array(z.string()),
  before: themeAxesSchema,
  after: themeAxesSchema,
  ttl_ms: z.number().int().min(1000).max(15_000).default(6000),
  undoable: z.boolean().default(true),
});
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: theme:get
  direction: renderer -> main
  request_schema: z.object({})
  response_schema: z.object({ axes: themeAxesSchema, lock: themeAxesLockSchema })
  - name: theme:set
  direction: renderer -> main
  request_schema: z.object({
  next_axes: themeAxesSchema,
  reason: z.enum(['palette_switch','single_axis_change','undo','reset']),
  })
  response_schema: z.object({ ok: z.boolean(), changed_axes: z.array(z.string()) })
  requires_audit: false  # 主题切换不上审计
  - name: theme:lock-set
  request_schema: z.object({ axis: z.enum(['palette','density','radiusFamily','motionLevel']), locked: z.boolean() })
  response_schema: z.object({ ok: z.boolean() })
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| 切主题前后 4 维全相同（dev 检测） | NO_DELTA | dev: console.error；prod: 上报审计 | spec-07 调差异 |
| view-transition API 不可用（旧 chromium） | VT_UNSUPPORTED | 静默 fallback to opacity transition | framer-motion |
| 用户撤销切换 | UNDO_OK | toast 消失 | 还原 axes |
| applyPresetCoordination 抛错 | PRESET_INVALID | 静态 fallback modern-light | 启动期 schema 校验 |
| prefers-reduced-motion 系统级开 | OS_REDUCED_MOTION | 强制 motionLevel='reduced' | 盖过 lock |

---

## 6. acceptance_gwt

```gherkin
Feature: 主题 4 维联动 + view-transition

Scenario A1: ASSERT_THEME_NON_COLOR_DELTA 必过
  Given 当前主题 modern-light (density=standard, radius=soft, motion=balanced)
  When 用户在 ThemeSwitcher 选 cyberpunk
  Then theme:set 请求体 next_axes 中 density='compact', radius='sharp', motion='expressive'
  And changed_axes.length >= 3
  And view-transition API 被调用
  And ThemeChangeToast 出现，列出 4 项变化

Scenario A2: 用户锁定 density 后切 palette
  Given lock.density = true, density='comfortable'
  When 用户切到 cyberpunk (preset density='compact')
  Then 实际 next.density = 'comfortable'（保持锁定）
  And changed_axes 不含 'density'
  And toast 提示 "density 已锁定，未参与联动"

Scenario A3: 撤销
  Given 5s 前刚切到 cyberpunk
  When 用户点 toast 内 "撤销"
  Then 还原至 modern-light + 原 axes
  And view-transition 反向播放

Scenario A4: prefers-reduced-motion 强制 reduced
  Given OS prefers-reduced-motion = true
  When 切到 cyberpunk (preset motion='expressive')
  Then 实际 motionLevel='reduced'
  And view-transition 不播放（瞬切）

Scenario A5: cmdk 切到下一个主题
  Given 当前 palette='modern-light'
  When 在 cmdk 输入 "下一个主题" + Enter
  Then 切到 palette 数组中下一个（warm-light）
  And 联动正常触发

Scenario A6: dev 检测 NO_DELTA
  Given mock applyPresetCoordination 故障 -> changed_axes=[]
  When 启动期 vitest theme parity
  Then 抛 NO_DELTA 错误
  And 进程退出码 != 0
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-06-theme-4d-axes.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('ASSERT_THEME_NON_COLOR_DELTA: switching palette triggers >= 1 non-color axis change', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  const before = await win.evaluate(async () => window.devhub.theme.get());
  await win.click('[data-theme-switcher]');
  await win.click('[data-palette="cyberpunk"]');
  await win.waitForSelector('[data-theme-toast]');
  const after = await win.evaluate(async () => window.devhub.theme.get());
  const nonColorChanges =
  (before.axes.density !== after.axes.density ? 1 : 0) +
  (before.axes.radiusFamily !== after.axes.radiusFamily ? 1 : 0) +
  (before.axes.motionLevel !== after.axes.motionLevel ? 1 : 0);
  expect(nonColorChanges).toBeGreaterThanOrEqual(1);
  await app.close();
});

test('lock prevents axis from auto-coordination', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.evaluate(async () => window.devhub.theme.lockSet({ axis: 'density', locked: true }));
  await win.evaluate(async () => window.devhub.theme.set({
  next_axes: { palette: 'cyberpunk', density: 'comfortable', radiusFamily: 'soft', motionLevel: 'balanced' },
  reason: 'palette_switch',
  }));
  const after = await win.evaluate(async () => window.devhub.theme.get());
  expect(after.axes.density).toBe('comfortable');
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| view-transition API | https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API |
| Framer Motion shared layout | https://www.framer.com/motion/animate-presence |
| Radix Slider for axes | https://www.radix-ui.com/primitives/docs/components/slider |
| Theme axis design | Material 3 design tokens |
| Axis lock pattern | Figma "lock theme variable" |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 1100
breakdown:
  schema + PRESET_COORDINATION: 130
  applyPresetCoordination + tests: 110
  useTheme refactor: 90
  ThemeAxesPanel UI: 240
  ThemeSwitcher: 120
  ThemeChangeToast: 90
  view-transition.css + tokens: 130
  cmdk theme actions: 60
  IPC handlers: 80
  useThemeAxesLock + electron-store integration: 80
files_touched: ~13
risk_radius:
  - useDensity 现有 callers 需迁移到联动模式
  - view-transition API 兼容性（Electron 28 ChromeVersion）
  - PRESET_COORDINATION 数值与 spec-07 量化表必须一致
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 创建 theme-axes.ts schema + PRESET_COORDINATION 表
  - step_02: applyPresetCoordination 函数 + vitest 单测（每对主题 4 维联动正确）
  - step_03: useTheme 接入 applyPresetCoordination；触发 view-transition
  - step_04: useThemeAxesLock + electron-store 持久化
  - step_05: ThemeAxesPanel UI（4 维分段控件 + 锁 toggle）
  - step_06: ThemeSwitcher（7 主题缩略图 + 联动提示）
  - step_07: ThemeChangeToast（含撤销 + ttl 倒计时）
  - step_08: cmdk 注册 themeActions（next/prev/by-name）
  - step_09: prefers-reduced-motion 监听 + 强制覆盖
  - step_10: 写 e2e（§7）
verify:
  - pnpm typecheck
  - pnpm test --filter theme
  - pnpm e2e --grep "spec-06"
  - 手测 ASSERT_THEME_NON_COLOR_DELTA 通过
```

---

## 11. dependencies

```yaml
blocks:
  - spec-07-theme-default-distance.md
  - spec-09-port-card-improvement.md
  - R8.B/spec-12-theme-editor.md
  - R8.B/spec-14-icon-system.md
blocked_by:
  - spec-01-integration-libs.md (framer-motion / radix)
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "view-transition API 不可用"
  action: "fallback framer-motion crossfade 250ms"
  - cause: "applyPresetCoordination 输入非法 palette"
  action: "默认 modern-light + 上报"
  - cause: "用户撤销超 ttl"
  action: "toast 消失；保持当前；提供 settings 内 'recent themes' 列表"
```

---

## 13. performance_budget

```yaml
budgets:
  theme_set_to_visible_change_p50: 200ms
  theme_set_to_visible_change_p95: 350ms
  view_transition_total: <= 500ms
  cmdk_theme_action_match: < 30ms
  bundle_tokens_css_size: <= 12KB gzipped
  applyPresetCoordination_overhead: < 1ms
verification:
  - Playwright trace
  - vitest microbench
```
