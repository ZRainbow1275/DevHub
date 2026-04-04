# Task: theme-system-overhaul

## Overview

主题系统全面革新：不只颜色切换，需包含排版/布局/字体/视觉传达。设计 Design Token 系统，至少3个完整主题（暗色专业/明亮现代/温暖自然）。分析 styles/ 和 tailwind.config.js。

## Requirements

### R1: Design Token 系统架构

- 定义完整的 token 层次：primitive tokens → semantic tokens → component tokens
- Token 类别：颜色(color)、排版(typography)、间距(spacing)、圆角(radius)、阴影(shadow)、边框(border)、动画(animation)
- 使用 CSS 自定义属性（CSS Variables）作为 token 载体
- 兼容现有 Tailwind 配置，token 可被 Tailwind 类名消费

### R2: 三套完整主题

- **暗色专业 (Dark Professional)**: 当前 constructivism 风格的演进版本，保持苏联构成主义设计语言
- **明亮现代 (Modern Light)**: 现代简约风格，浅色背景，圆润过渡
- **温暖自然 (Warm Natural)**: 暖色调，自然材质质感，柔和阴影

每套主题需覆盖：
- 完整色板（背景/前景/强调/警告/成功/信息/边框/hover/active 状态）
- 排版规范（标题/正文/辅助文字 字号、行高、字重）
- 间距系统（组件内间距、组件间距、布局间距）
- 视觉效果（阴影深度、边框样式、圆角大小、装饰元素）

### R3: 主题切换机制增强

- 保持现有 5 套主题切换功能兼容
- 支持实时预览切换效果（无闪烁）
- 主题变量通过 `data-theme` 属性或 CSS class 切换
- 切换动画过渡（颜色渐变 200-300ms）

### R4: 排版系统

- 定义字体层次：Display / Heading / Body / Caption / Mono
- 支持中文排版优化（行高、字间距）
- 响应式字体大小（基于 viewport 或 container）

### R5: 与现有组件的集成

- 所有现有组件（StatCard、ProcessView、PortView、WindowView 等）自动继承主题变量
- 不需要修改每个组件的内部样式，通过 token 系统自动传递
- 确保 Bebas Neue display 字体在所有主题中正确应用

## Acceptance Criteria

- [ ] Design Token 系统定义在独立的 CSS/TS 文件中
- [ ] 3 套完整主题均可正确切换
- [ ] 每套主题包含完整的色板、排版、间距、视觉效果定义
- [ ] 主题切换无闪烁，有平滑过渡动画
- [ ] 现有 constructivism 主题功能完全保留
- [ ] 所有现有组件在新主题下正确渲染
- [ ] Tailwind 类名可消费 token 变量
- [ ] TypeScript 类型安全的主题配置

## Technical Notes

1. **现有主题系统**: 项目已有 5 套主题（constructivism、modern-light、warm-light、dark、light），在 `styles/` 目录中通过 CSS Variables 定义。需要分析现有实现并在此基础上扩展。

2. **Tailwind 配置**: `tailwind.config.js` 中已有自定义 colors、fontSize、spacing 等配置，新的 token 系统需要与之兼容。

3. **Electron 环境**: 无需考虑 SSR，可自由使用 `window` 对象和 DOM API。

4. **字体资源**: 项目已包含 Bebas Neue 字体（display 用途），可能需要引入额外的中文友好字体。

## Out of Scope

- 用户自定义主题创建器
- 主题市场/分享功能
- 基于系统偏好自动切换明暗主题
- 组件级别的主题覆盖 API
