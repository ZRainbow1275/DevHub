# spec/19 — 主题设计语言系统（Theme as a Design Language）

> 严重度：P2
> 对应用户诉求：P8.2（主题切换只换颜色，不换布局/组件形态） — **从 R1 起重复 5 轮**
> 对应验收矩阵：P8.2-a / -b / -c / -d / -e
> 对应债务：D22（density / radius-family / motion-level token 已定义但未真正驱动 UI）
> 对应市面最佳实践：GitHub Primer、Linear dark vs light、Raycast 主题商店、VS Code workbench theme + icon theme

---

## 一、R5 回顾

spec/19 之前版本只规定了"8 个主题 + 颜色 token 分层"，但未规定 **density / radius-family / motion-level** 这三个维度要如何连接到真实组件。结果：

- ThemeTokens.ts 里定义了 `--density-row-height`、`--radius-family-soft`、`--motion-duration-fast`
- 但 `ProcessListRow.tsx` 写死 `className="h-12"`
- `Button.tsx` 写死 `rounded-md`
- `Toast.tsx` 写死 `transition-all duration-200`

用户 5 轮反馈"切主题只是换颜色"的根因 = **token 存在但组件没订阅**。

## 二、R7 目标：主题是 4 维设计语言

```
theme 维度：
  ├─ palette （色板：cyberpunk / synthwave / solarized-dark / nord / ...）
  ├─ density （密度：compact / normal / comfortable）
  ├─ radius-family （圆角族：sharp / soft / round）
  └─ motion-level （动效：reduced / balanced / expressive）
```

每个维度独立可切换；组合数 = 8 × 3 × 3 × 3 = **216 种合法主题**。

---

## 三、受影响源码

| 文件 | 变更 |
|------|------|
| `devhub/src/renderer/theme/tokens.css` | NEW：真实 CSS 变量层 |
| `devhub/src/renderer/theme/ThemeProvider.tsx` | 扩展：4 维切换 |
| `devhub/src/renderer/theme/ThemeContext.tsx` | 存储 4 维状态 |
| `devhub/src/renderer/components/SettingsPanel/ThemePicker.tsx` | 四维选择器 UI |
| `devhub/src/renderer/components/ui/Button.tsx` / `Card.tsx` / `Input.tsx` 等 20+ 组件 | 全面替换硬编码 |
| `devhub/src/main/services/ThemeStore.ts` | 持久化四维状态 |
| NEW: `devhub/src/renderer/theme/theme-presets.ts` | 预设组合（懒人菜单） |

---

## 四、Token 分层架构

```
Layer 1: Primitive Tokens（原子值）
  --color-blue-500, --space-4, --duration-200, ...

Layer 2: Semantic Tokens（语义引用）
  --color-bg-primary: var(--color-gray-900)    /* dark theme */
  --color-bg-primary: var(--color-white)       /* light theme */
  --radius-default: var(--radius-md)           /* soft family */
  --radius-default: 0                          /* sharp family */

Layer 3: Component Tokens（组件特定）
  --button-height: var(--density-row-height)
  --card-padding: calc(var(--space-4) * var(--density-scale))
  --toast-slide-duration: calc(var(--duration-200) * var(--motion-scale))

Layer 4: Component Implementation（组件消费）
  .btn { height: var(--button-height); border-radius: var(--radius-default); }
```

### 4.1 CSS 变量全集示例

```css
/* tokens.css */
[data-palette="cyberpunk"] {
  --color-bg-primary: #0a0a1a;
  --color-accent: #ff00ff;
  --color-text-primary: #e0e0ff;
  /* ... */
}

[data-density="compact"]      { --density-scale: 0.75; --row-height: 28px; }
[data-density="normal"]       { --density-scale: 1;    --row-height: 36px; }
[data-density="comfortable"]  { --density-scale: 1.2;  --row-height: 44px; }

[data-radius-family="sharp"]  { --radius-scale: 0; }
[data-radius-family="soft"]   { --radius-scale: 1; }  /* default 6px */
[data-radius-family="round"]  { --radius-scale: 2; }  /* 12px */

[data-motion-level="reduced"]     { --motion-scale: 0; }   /* 立即切 */
[data-motion-level="balanced"]    { --motion-scale: 1; }
[data-motion-level="expressive"]  { --motion-scale: 1.5; } /* 动效更明显 */
```

### 4.2 ThemeProvider

```tsx
interface ThemeState {
  palette: PaletteName            // 8 种
  density: 'compact' | 'normal' | 'comfortable'
  radiusFamily: 'sharp' | 'soft' | 'round'
  motionLevel: 'reduced' | 'balanced' | 'expressive'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeState>(loadFromStore)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.palette = theme.palette
    root.dataset.density = theme.density
    root.dataset.radiusFamily = theme.radiusFamily
    root.dataset.motionLevel = theme.motionLevel
    ThemeStore.persist(theme)
  }, [theme])
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
```

### 4.3 ThemePicker（设置页）

```tsx
<ThemePicker>
  <Section label="色板">
    <SwatchGrid options={PALETTES} value={theme.palette} onChange={...} />
    {/* 每个 swatch 显示缩略图 + 主色圆 */}
  </Section>
  <Section label="密度">
    <SegmentedControl options={['compact', 'normal', 'comfortable']} value={theme.density} onChange={...} />
    <LivePreview component={<ListRow sample />} />
  </Section>
  <Section label="圆角风格">
    <SegmentedControl options={['sharp', 'soft', 'round']} value={theme.radiusFamily} onChange={...} />
    <LivePreview component={<Card sample />} />
  </Section>
  <Section label="动效水平">
    <SegmentedControl options={['reduced', 'balanced', 'expressive']} value={theme.motionLevel} onChange={...} />
    <LivePreview component={<ToastPreviewButton />} />
  </Section>
  <Section label="预设组合">
    <PresetGrid presets={THEME_PRESETS} />
    {/* 如 "Cyberpunk Expressive", "Nord Compact", "Solarized Round Balanced" */}
  </Section>
</ThemePicker>
```

### 4.4 预设组合示例

```typescript
export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Cyberpunk Immersive',  palette: 'cyberpunk',       density: 'normal',      radiusFamily: 'sharp',  motionLevel: 'expressive' },
  { name: 'Nord Focus',           palette: 'nord',            density: 'compact',     radiusFamily: 'soft',   motionLevel: 'balanced' },
  { name: 'Solarized Writer',     palette: 'solarized-light', density: 'comfortable', radiusFamily: 'round',  motionLevel: 'reduced' },
  { name: 'VS Code Dark+',        palette: 'vscode-dark',     density: 'normal',      radiusFamily: 'soft',   motionLevel: 'balanced' },
  { name: 'Paper Zen',            palette: 'paper',           density: 'comfortable', radiusFamily: 'round',  motionLevel: 'reduced' },
  { name: 'Synthwave Nite',       palette: 'synthwave',       density: 'normal',      radiusFamily: 'round',  motionLevel: 'expressive' },
  { name: 'Hacker Terminal',      palette: 'terminal-green',  density: 'compact',     radiusFamily: 'sharp',  motionLevel: 'reduced' },
  { name: 'Ocean Breeze',         palette: 'ocean',           density: 'normal',      radiusFamily: 'round',  motionLevel: 'balanced' },
]
```

---

## 五、组件改造清单

| 组件 | 旧 | 新 |
|------|-----|----|
| `<Button>` | `rounded-md h-10` | `style={{ borderRadius: 'var(--radius-default)', height: 'var(--button-height)' }}` |
| `<Card>` | `p-4 rounded-lg` | `className="p-card rounded-default"`（新 Tailwind 自定义类读 var） |
| `<Toast>` | `transition-all duration-200` | `transition-duration: calc(200ms * var(--motion-scale))` |
| `<ListRow>` | `h-12` | `height: var(--row-height)` |
| `<Input>` | `py-2` | padding 随 density-scale 缩放 |

tailwind.config.js 新增：

```js
theme: {
  borderRadius: {
    default: 'var(--radius-default)',
    // ...
  },
  spacing: {
    card: 'calc(var(--space-4) * var(--density-scale))',
  },
  transitionDuration: {
    fast: 'calc(150ms * var(--motion-scale))',
  },
}
```

---

## 六、错误矩阵

| 错误码 | 触发 | 文案 |
|-------|-----|------|
| `THEME_PRESET_NOT_FOUND` | 读取到不存在的预设 | 回退到 default |
| `THEME_TOKEN_UNDEFINED` | CSS 变量未定义 | DEV 报警 + fallback |
| `THEME_MIGRATION_V1_TO_V2` | 旧版配置只有 palette | 自动补默认三维 |

---

## 七、验收条件

### E2E-P8.2-a 四维独立切换
```
Given theme = { palette: 'cyberpunk', density: 'normal', radiusFamily: 'soft', motionLevel: 'balanced' }
When 切 density = 'compact'
Then 所有 list row 高度变为 28px；palette 不变；圆角不变；动效不变
```

### E2E-P8.2-b 预设应用
```
When 点 "Nord Focus" 预设
Then 四维同时应用；UI 更新 < 200ms
```

### E2E-P8.2-c 持久化
```
When 切换任意维度
Then electron-store 写入
When 重启
Then 恢复
```

### E2E-P8.2-d 语义 token 覆盖
```
Given 3 个组件使用 --color-bg-primary
When 切 palette
Then 3 个组件背景色同步变化
```

### E2E-P8.2-e reduced motion 兼容
```
Given motionLevel = 'reduced' OR 系统 prefers-reduced-motion
Then 所有动画时长 = 0ms；Toast 无滑入；面板切换无渐变
```

---

## 八、E2E 脚本

```typescript
test('4-axis theme applies independently', async () => {
  const app = await launchDevHub()
  const win = await app.firstWindow()
  await win.click('[data-testid="nav-settings"]')
  await win.click('[data-testid="theme-tab"]')
  // 改 density
  await win.click('[data-testid="density-option-compact"]')
  const rowHeight = await win.locator('[data-testid="process-row"]').first()
    .evaluate(el => getComputedStyle(el).height)
  expect(parseInt(rowHeight)).toBeLessThan(32)  // compact
  // 再改 palette
  await win.click('[data-testid="palette-option-nord"]')
  const bg = await win.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-bg-primary'))
  expect(bg.trim()).toMatch(/^#2e3440/i)
  // density 应保持 compact
  const rowHeight2 = await win.locator('[data-testid="process-row"]').first()
    .evaluate(el => getComputedStyle(el).height)
  expect(rowHeight2).toBe(rowHeight)
  await app.close()
})
```

---

## 九、参考实现 / 库

- GitHub Primer CSS 的 density modes
- shadcn/ui 的 theme system
- Radix UI 的 token layers
- `prefers-reduced-motion` MDN
- Tailwind CSS 的 `data-*` attribute selector

---

## 十、贡献到 contracts/22

- `ThemeState`, `PaletteName`, `DensityLevel`, `RadiusFamily`, `MotionLevel`, `ThemePreset`

## 十一、贡献到 contracts/23

- `theme:set-palette`, `theme:set-density`, `theme:set-radius-family`, `theme:set-motion-level`, `theme:apply-preset`

---

## 十二、2026-04-29 实现快照：P8.2 CODE-DONE

- 新增 `devhub/src/renderer/theme/theme-language.ts`，定义并校验 `ThemeState = palette / density / radiusFamily / motionLevel`，保留 legacy `theme` 映射，提供 palette 默认设计轴、预设组合与 DOM dataset 应用函数。
- `useTheme` 从单一 theme 字符串升级为四维主题状态；每次切换会同时写入 `data-theme`、`data-palette`、`data-density`、`data-radius-family`、`data-motion-level`，并通过现有 `window.devhub.settings.update` 持久化到 electron-store 设置链路。
- `SettingsDialog` 外观页新增设计语言、预设组合、信息密度、圆角风格和动效水平的真实 controls；关闭动画时强制落到 `motionLevel = reduced`。
- `shared/types.ts` 的 `AppearanceSettings` 新增 `radiusFamily` 与 `motionLevel`，`DEFAULT_SETTINGS`、`AppStore.test.ts`、main settings IPC 白名单与字段校验同步更新，保持旧配置由 `migrateSettings()` 自动补默认值。
- `theme-tokens.css` 新增正交 token 层：`data-radius-family` 控制几何，`data-motion-level` 控制 motion scale/duration/transition，`data-density` 控制 button/row 高度；`prefers-reduced-motion` 作为系统级兜底。
- 验证：`theme-language.test.ts` 覆盖四维解析、palette 设计语言默认、invalid axis 拒绝、document dataset 应用；`pnpm typecheck`、targeted Vitest、`pnpm lint` 通过。
- 2026-04-30 验证更新：`E2E-P8.2` 已通过真实 Electron 外观四轴设置、CSS token 计算、设置持久化与重启恢复验证；矩阵已提升为 `[TEST-PASS]`。用户手测 `[USER-VERIFIED]` 仍需用户确认。

---

## 十三、2026-04-30 验证快照：P8.2 TEST-PASS

- `E2E-P8.2-a/b/c/d/e` 已用真实 Electron 应用补齐：测试通过真实设置弹窗操作 `信息密度`、`圆角风格`、`动效水平`、palette button 与 `Paper Zen` 预设组合，不通过 DOM 脚本伪造 UI 状态。
- 验证链路覆盖 `<html data-theme/data-palette/data-density/data-radius-family/data-motion-level>`、`--surface-900`、`--radius-default`、`--motion-scale`、`--duration-theme` 等实际 CSS token，并确认 settings store 中的 `appearance.theme / informationDensity / radiusFamily / motionLevel` 与 UI 一致。
- 持久化验收通过真实重启：第一次 Electron 实例写入 `warm-light / comfortable / round / reduced` 后关闭，第二次启动从 electron-store 恢复同一四轴状态。
- 本轮真实失败暴露出 `theme-tokens.css` 的 `[data-motion-level]` 选择器 specificity 与后导入的 `animations.css :root` 相同，导致 reduced motion 下 `--duration-theme` 被覆盖为 `250ms`；已改为 `html[data-motion-level=...]`，保证 reduced motion 的 `0ms` token 覆盖稳定。
- 验证命令：`pnpm build`、`pnpm typecheck`、`pnpm exec playwright test e2e/example.spec.ts -g "P8.2" --timeout=120000 --workers=1`、`pnpm test:e2e`。定向 E2E 结果：`1 passed (6.2s)`；完整 Electron E2E 在 P3.1 timeout 一致性补丁后为 `13 passed (1.2m)`。
