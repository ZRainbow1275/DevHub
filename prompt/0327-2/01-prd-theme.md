# PRD 1: 多主题系统

> 优先级: P2
> 类型: frontend
> 复杂度: Medium

## Goal
将单一暗色主题重构为多主题系统，保留苏联构成主义作为选项，新增明亮积极的主题。

## Requirements

### R1.1: 主题架构
- colors.css 中当前颜色包裹在 `:root` + `[data-theme="constructivism"]`
- 新主题通过 `[data-theme="modern-light"]` 和 `[data-theme="warm-light"]` 覆盖
- 使用相同的 CSS 变量名，组件代码零修改

### R1.2: Modern Light 主题
- 背景：浅灰到白（#f8f9fa → #ffffff）
- 文字：深色（#1a1a2e → #6b7280）
- 强调色：蓝色系（#3b82f6）
- 语义色：标准（绿/黄/红/蓝）
- 风格：干净、现代、专业

### R1.3: Warm Light 主题
- 背景：奶油/象牙（#faf8f5 → #f5f0e8）
- 文字：暖棕（#3d2c1e → #8a7c6c）
- 强调色：铜/锈红（#b85c38）+ 金色（#c9a227）
- 风格：构成主义的亮色伙伴，温暖催人奋进

### R1.4: 主题切换 UI
- SettingsDialog 新增"主题"区域
- 3 个主题卡片（带颜色预览色块）
- 点击即切换，即时生效
- 持久化到 AppSettings.theme

### R1.5: 主题应用机制
- 新建 useTheme.ts hook
- 启动时读取 settings.theme，设置 document.documentElement.dataset.theme
- 切换时实时更新 data-theme 属性

### R1.6: 向后兼容
- `theme: 'dark'` → 映射为 'constructivism'
- `theme: 'light'` → 映射为 'modern-light'
- 新值：'constructivism' | 'modern-light' | 'warm-light'

## Acceptance Criteria
- [ ] 3 个主题均可通过设置切换
- [ ] 切换不需要重启/刷新
- [ ] 原苏联构成主义外观完全保留
- [ ] 两个亮色主题通过 WCAG AA 对比度
- [ ] 主题跨重启持久化
- [ ] 组件 TSX 零修改

## Files

### New
- `src/renderer/hooks/useTheme.ts`

### Modified
- `src/renderer/styles/tokens/colors.css` — 主题包裹 + 新主题
- `src/renderer/main.tsx` — 启动时应用主题
- `src/renderer/components/settings/SettingsDialog.tsx` — 主题选择器
- `src/shared/types.ts` — AppSettings.theme 类型扩展
- `src/main/ipc/index.ts` — theme 验证更新
- `tailwind.config.js` — shadow CSS 变量化
- `src/renderer/styles/globals.css` — 确保无硬编码颜色
