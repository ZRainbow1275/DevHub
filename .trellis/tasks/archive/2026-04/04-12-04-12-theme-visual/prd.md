# 主题视觉传达体系

## Goal
将主题系统从"换颜色"升级为"完整的视觉传达体系"。每个主题在颜色、排版、圆角、阴影、动效、装饰、信息密度方面有本质差异。

## Requirements
- 7 层 CSS Token 架构（色彩 + 排版 + 空间 + 效果 + 动效 + 组件 + 装饰）
- 至少 3 套有本质差异的完整主题：
  - Soviet Constructivism（当前，增强几何感）
  - Cyberpunk Neon（赛博朋克，发光/全息）
  - Swiss Minimal（极简瑞士风，留白/网格）
- 所有组件使用 CSS 变量，无硬编码圆角/阴影/字体
- 主题切换同时改变所有维度

## Acceptance Criteria
- [ ] 三套主题在颜色/字体/圆角/阴影/动效/装饰/密度均有肉眼可见差异
- [ ] 切换主题后所有组件自适应
- [ ] 无硬编码视觉属性
- [ ] 主题切换无闪烁无布局跳动

## Technical Notes
- 详细 spec: `prompts/0411/07-theme-visual-system-spec.md`
- 批次: 第三批 (P2)
- 层级: Frontend
