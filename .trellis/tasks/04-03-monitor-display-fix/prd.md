# Task: monitor-display-fix

## Overview
修复监控面板中所有数值显示截断和文字挤压问题，重新设计 StatCard 及相关 monitor 组件的响应式布局，确保在各种窗口尺寸下数值完整可读。

## 问题清单（根因分析）

### 1. StatCard 数值截断（如 `1445MB` 被截断）
- **位置**: `devhub/src/renderer/components/ui/StatCard.tsx` 行 46-56
- **根因**: 值容器 `min-w-0 flex-1` + `whitespace-nowrap`，当容器宽度不足时溢出；字体缩放仅基于 `String(value).length` 做 3 级阶梯（24px/20px/16px），未考虑容器实际可用宽度
- **修复方向**: 改用 CSS `clamp()` 自适应字体 + 移除或条件化 `whitespace-nowrap` + 添加 `overflow` 保护

### 2. 端口号截断（如 `:471...`）
- **位置**: `devhub/src/renderer/components/monitor/PortView.tsx` 行 68-69
- **根因**: PortCard icon box 使用固定 `w-14 h-14`（56x56px），对 5+ 位端口号空间不足
- **修复方向**: 改为 `min-w-14` 自适应，或将端口号从 icon box 移出到独立区域

### 3. 窗口统计文字挤压
- **位置**: `devhub/src/renderer/components/monitor/WindowView.tsx` 行 789
- **根因**: 硬编码 `grid-cols-4 gap-4`，无响应式断点，中文 label 在窄屏被挤压
- **修复方向**: 改为 `grid-cols-2 md:grid-cols-4` 或 `auto-fit`/`auto-fill`

### 4. PID 数值过大显示问题
- **位置**: `devhub/src/renderer/components/monitor/ProcessView.tsx` 行 113-128
- **根因**: ProcessCard 内 `grid-cols-2` metric-display 使用 `text-lg font-bold font-mono`，对 5-6 位 PID 容器过窄
- **修复方向**: 调整 metric-display 字体大小 + 增加格式化（千分位分隔）

### 5. 全局 `.metric-display` 强制截断
- **位置**: `devhub/src/renderer/styles/globals.css` 行 611-619
- **根因**: `.metric-display` 内所有 span 被强制 `truncate max-w-full`，直接导致端口号和 PID 被截断
- **修复方向**: 移除强制 truncate，改为按需溢出处理

## Requirements

### R1: StatCard 响应式重设计
- [ ] 移除 StatCard 值区域的 `whitespace-nowrap` 强制约束
- [ ] 替换 JS 字符串长度阶梯缩放为 CSS 自适应方案（`clamp()` 或 container query）
- [ ] 添加 `overflow-hidden text-ellipsis` 作为最后保护层
- [ ] 确保 `1445MB`、`23.5%`、`47100` 等典型值完整显示

### R2: 所有 StatCard 网格添加响应式断点
- [ ] ProcessView 行 493 的 `grid-cols-4` 改为响应式（如 `grid-cols-2 sm:grid-cols-4`）
- [ ] PortView 行 406 的 `grid-cols-4` 改为响应式
- [ ] WindowView 行 789 的 `grid-cols-4` 改为响应式
- [ ] 保持各视图统一的响应式断点策略

### R3: PortCard 端口号自适应显示
- [ ] 将端口号显示区域从固定 `w-14 h-14` 改为自适应尺寸
- [ ] 确保 1-5 位端口号（如 `:80` 到 `:47100`）均能完整显示
- [ ] 保持与其他 Card 的视觉一致性

### R4: ProcessCard metric-display 修复
- [ ] 调整 metric-display 区域的字体和容器尺寸，适配大 PID（5-6 位数）
- [ ] 修复 globals.css 中 `.metric-display` 的强制 truncate 规则

### R5: 新增数值格式化工具函数
- [ ] 创建 `devhub/src/renderer/utils/formatNumber.ts`
- [ ] 实现 `formatBytes(bytes)`: 如 `1445MB` -> `1.4GB`（可选，根据空间自动选择最佳单位）
- [ ] 实现 `formatPID(pid)`: 如 `47156` -> `47,156`（千分位分隔提升可读性）
- [ ] 在 StatCard 和 metric-display 中集成使用

## Acceptance Criteria
- [ ] `1445MB` 在 StatCard 中完整显示，不被截断
- [ ] 5 位端口号（如 `:47100`）在 PortCard 中完整显示
- [ ] WindowView 的 4 个 StatCard 在窄屏（<768px）下自动换行为 2 列
- [ ] 5-6 位 PID 在 ProcessCard 的 metric-display 中完整显示
- [ ] 所有修改在 1920px、1440px、1024px、768px 宽度下均正常显示
- [ ] 不影响现有 Bebas Neue 字体的视觉风格
- [ ] 格式化函数有合理的单元覆盖

## Technical Notes

1. **字体系统**: 项目使用 `Bebas Neue` 作为 display font（`--font-display`），这是窄体字体，比常规字体占用更少水平空间，但仍需为长数值预留足够空间。

2. **CSS 方案优先于 JS**: 当前 StatCard 的字体缩放基于 JS `String(value).length` 判断，应优先改用纯 CSS 方案（`clamp()`、`fit-content`、container query），减少 JS 计算开销并更好响应容器变化。

3. **AITaskView 一致性**: AITaskView 使用手写 div 实现统计卡片而非 StatCard 组件，其 `rounded-xl` 风格与项目的 constructivism 方形设计不一致。本次修复可选择性将其统一为 StatCard，但不是必须的（属于额外优化）。

4. **格式化工具函数**: 项目当前仅有 `formatDuration.ts`，缺少通用数值格式化。新函数应遵循相同的模块模式和导出约定。

5. **Tailwind 配置**: 自定义 fontSize 和 spacing 已在 `tailwind.config.js` 中定义，响应式断点应使用 Tailwind 默认断点（sm:640px, md:768px, lg:1024px）以保持一致性。

## Out of Scope
- AITaskView 统计卡片的完整重构（仅做响应式断点修复，不强制改用 StatCard）
- 监控数据的实时性能优化
- 新增监控指标或功能
- MonitorPanel tab 切换逻辑
- 后端数据格式变更
