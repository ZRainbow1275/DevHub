# Spec: 主题视觉传达体系

> 关联 PRD: `00-prd-round3.md` § 3.5 + R1-2.8 + R2-2.3
> 优先级: P2
> 层级: Frontend
> **三轮测试持续强调：主题 ≠ 换颜色**

---

## 1. 问题描述

三轮测试反复确认：切换主题后仅颜色变化，组件排布、字体、圆角、阴影、动效、信息密度等维度无差异。

**核心原则**：每个主题是一套 **完整的设计语言**，不是一张调色板。

---

## 2. 多维度 Token 架构

### 2.1 Token 层级
```
Layer 1: 基础色彩变量（--surface-*, --text-*, --red-*, ...）   ← 当前只有这层
Layer 2: 排版变量（--font-*, --line-height-*, --letter-spacing-*）
Layer 3: 空间变量（--radius-*, --gap-*, --padding-*）
Layer 4: 效果变量（--shadow-*, --glow-*, --blur-*）
Layer 5: 动效变量（--duration-*, --easing-*, --delay-*）
Layer 6: 组件变量（--card-*, --button-*, --input-*）
Layer 7: 装饰变量（--deco-*, --bg-pattern-*）
```

### 2.2 每层的主题差异

#### Layer 2: 排版
```css
/* Soviet Constructivism */
[data-theme="constructivism"] {
  --font-sans: 'JetBrains Mono', 'Noto Sans SC', monospace;
  --font-display: 'Oswald', 'Noto Sans SC', sans-serif;
  --typo-heading-transform: uppercase;
  --typo-heading-spacing: 0.12em;
  --typo-heading-weight: 800;
  --typo-body-spacing: 0.02em;
  --line-height-body: 1.4;
}

/* Cyberpunk Neon */
[data-theme="cyberpunk"] {
  --font-sans: 'Share Tech Mono', 'Noto Sans SC', monospace;
  --font-display: 'Orbitron', 'Noto Sans SC', sans-serif;
  --typo-heading-transform: uppercase;
  --typo-heading-spacing: 0.15em;
  --typo-heading-weight: 700;
  --typo-body-spacing: 0.03em;
  --line-height-body: 1.6;
}

/* Swiss Minimal */
[data-theme="swiss"] {
  --font-sans: 'Inter', 'Helvetica Neue', 'Noto Sans SC', sans-serif;
  --font-display: 'Inter', 'Helvetica Neue', sans-serif;
  --typo-heading-transform: none;
  --typo-heading-spacing: -0.02em;
  --typo-heading-weight: 600;
  --typo-body-spacing: 0;
  --line-height-body: 1.75;
}
```

#### Layer 3: 空间
```css
[data-theme="constructivism"] {
  --radius-sm: 0px;
  --radius-md: 2px;
  --radius-lg: 2px;
  --radius-card: 2px;
  --gap-card: 8px;
  --padding-card: 12px;
}

[data-theme="cyberpunk"] {
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-card: 6px;
  --gap-card: 12px;
  --padding-card: 16px;
}

[data-theme="swiss"] {
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-card: 0px;
  --gap-card: 20px;
  --padding-card: 24px;
}
```

#### Layer 4: 效果
```css
[data-theme="constructivism"] {
  --shadow-card: none;
  --shadow-elevated: none;
  --border-card: 2px solid var(--surface-700);
  --border-accent: 3px solid var(--red-500);
}

[data-theme="cyberpunk"] {
  --shadow-card: 0 0 10px rgba(0, 255, 255, 0.1);
  --shadow-elevated: 0 0 20px rgba(0, 255, 255, 0.2);
  --glow-accent: 0 0 8px var(--accent);
  --border-card: 1px solid rgba(0, 255, 255, 0.2);
}

[data-theme="swiss"] {
  --shadow-card: none;
  --shadow-elevated: 0 1px 3px rgba(0,0,0,0.04);
  --border-card: 1px solid var(--surface-200);
}
```

#### Layer 5: 动效
```css
[data-theme="constructivism"] {
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --easing-default: linear;
  --easing-enter: cubic-bezier(0, 0, 0.2, 1);
  /* 刚性、快速、无弹跳 */
}

[data-theme="cyberpunk"] {
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-enter: cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性 */
  /* 流畅、弹性、发光过渡 */
}

[data-theme="swiss"] {
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --easing-default: ease;
  --easing-enter: ease;
  /* 极简、仅功能性过渡 */
}
```

#### Layer 7: 装饰
```css
[data-theme="constructivism"] {
  --deco-diagonal: repeating-linear-gradient(
    -45deg, transparent, transparent 4px, currentColor 4px, currentColor 5px
  );
  --bg-pattern: none;
}

[data-theme="cyberpunk"] {
  --deco-diagonal: none;
  --bg-pattern: radial-gradient(circle, rgba(0,255,255,0.03) 1px, transparent 1px);
  --bg-pattern-size: 20px 20px;
  --scanline: repeating-linear-gradient(
    0deg, transparent, transparent 2px, rgba(0,255,255,0.02) 2px, rgba(0,255,255,0.02) 4px
  );
}

[data-theme="swiss"] {
  --deco-diagonal: none;
  --bg-pattern: none;
  /* 无装饰 */
}
```

---

## 3. 主题全景对比

| 维度 | Soviet Constructivism | Cyberpunk Neon | Swiss Minimal |
|------|----------------------|----------------|---------------|
| **色调** | 暖灰底 + 革命红 + 工业金 | 深黑底 + 霓虹青 + 电紫 | 纯白底 + 黑字 + 蓝色强调 |
| **组件排布** | 紧凑、高密度、不对称 | 适中密度、有呼吸感 | 宽松、大量留白 |
| **字体** | Mono 刚健、大写标题 | 科技感 Mono、发光 | Helvetica 经典无衬线 |
| **圆角** | 0-2px | 4-8px | 0px |
| **阴影** | 无（粗边框替代） | 发光阴影 | 无/极淡 |
| **动效** | 刚性、快速 | 流畅、弹性 | 极简过渡 |
| **装饰** | 对角线条纹、几何切割 | 网格背景、扫描线 | 无装饰 |
| **卡片** | 粗边框、小间距 | 发光边缘、悬浮 | 极简线框、大间距 |
| **按钮** | 方角、粗实心、大写 | 发光轮廓、悬浮 | 极简线框、小号 |
| **信息密度** | 高 | 中 | 低 |

---

## 4. 组件适配

### 4.1 卡片组件
```tsx
// 卡片应使用 CSS 变量，不硬编码任何视觉属性
<div className="
  bg-surface-800
  border border-[var(--border-card)]
  shadow-[var(--shadow-card)]
  rounded-[var(--radius-card)]
  p-[var(--padding-card)]
  gap-[var(--gap-card)]
  transition-all duration-[var(--duration-normal)]
">
```

### 4.2 按钮组件
- Primary 按钮在不同主题下形态不同
- Constructivism：粗实心方角
- Cyberpunk：发光轮廓 + hover 时 glow 增强
- Swiss：极简线框 + 微妙 hover 色变

### 4.3 装饰元素
- 当前的 `deco-diagonal` 类仅在 Constructivism 主题生效
- Cyberpunk 主题替换为网格背景 + 扫描线效果
- Swiss 主题移除所有装饰

---

## 5. 验收标准

- [ ] 三套主题在以下维度有**肉眼可见的本质差异**：
  - 颜色 ✓
  - 字体/排版 ✓
  - 圆角 ✓
  - 阴影/效果 ✓
  - 动效 ✓
  - 装饰 ✓
  - 信息密度/间距 ✓
- [ ] 切换主题后所有组件自适应新主题变量
- [ ] 无硬编码的圆角/阴影/字体（全部使用 CSS 变量）
- [ ] 主题切换无闪烁、无布局跳动

---

## 6. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/renderer/styles/tokens/colors.css` | 修改 | 增加 cyberpunk/swiss 色彩 |
| `src/renderer/styles/tokens/theme-tokens.css` | 大改 | 全维度 token |
| `src/renderer/styles/tokens/typography.css` | 修改 | 主题字体变量 |
| `tailwind.config.js` | 修改 | 映射新 CSS 变量 |
| `src/renderer/components/**/*.tsx` | 修改 | 硬编码值 → 变量 |
| `src/renderer/hooks/useTheme.ts` | 修改 | 主题切换逻辑 |
