# Design: 主题运行时管理器

> 日期: 2026-04-13
> 文件: `src/renderer/hooks/useTheme.ts`

---

## 当前状态

- `useTheme.ts` 管理主题名（`ThemeName`），设置 `data-theme` 属性
- `preloadFontsForTheme()` 通过 `document.fonts.load()` fire-and-forget，返回 void
- 过渡动画：`data-theme-transitioning` 属性 + 硬编码 `THEME_TRANSITION_MS = 250`
- CSS 7 层 token 架构已完整（theme-tokens.css），但 JS 无感知

---

## 问题清单

1. **字体加载无 JS 感知**: `preloadFontsForTheme()` 返回 void，组件无法知道字体就绪状态
2. **JS 无法访问 token 值**: 需要 `getComputedStyle` 手动读取，无封装
3. **过渡与字体无编排**: 两条时序线独立，字体加载可能在过渡完成后产生二次闪烁
4. **无用户自定义 token 覆盖机制**

---

## 推荐方案

### 阶段 1：字体状态感知（最高优先）

扩展 `useTheme` 返回 `fontStatus: 'idle' | 'loading' | 'loaded' | 'failed'`：
- 切换主题时并行启动字体加载 + 过渡
- `await Promise.race([fontsPromise, timeout(1500ms)])` 后再移除 transitioning
- 读取 CSS `--duration-theme` 替代硬编码 250ms

### 阶段 2：Token 访问工具函数

新建 `src/renderer/utils/theme-tokens.ts`：
```typescript
export function getToken(name: string): string
export function getTokenMs(name: string, fallback: number): number
```

### 阶段 3：用户自定义（后续迭代）

通过 `document.documentElement.style.setProperty()` 覆盖 CSS 变量，白名单限制仅允许 Layer 3-7 无色 token。

---

## 影响文件

| 文件 | 说明 |
|------|------|
| `src/renderer/hooks/useTheme.ts` | 新增 fontStatus，改进时序 |
| `src/renderer/utils/theme-tokens.ts` | 新建工具函数 |
| `src/renderer/components/settings/SettingsDialog.tsx` | 可选：展示加载指示器 |
