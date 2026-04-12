# PRD 4: 布局修复

> 优先级: P2
> 类型: frontend
> 复杂度: Low-Medium

## Goal
修复固定布局导致的显示问题，实现响应式设计。

## Requirements

### R4.1: 项目列表面板响应式
- `w-[340px]` → `min-w-[280px] max-w-[400px] w-[25vw]`
- 添加可拖拽边框（ResizeHandle 组件）
- 拖拽宽度保存到 localStorage

### R4.2: HeroStats 适配
- 窄屏（<1024px）：数字字号 48px → 32px，padding 缩小
- 可选：点击折叠/展开

### R4.3: StatusBar 防溢出
- 运行项目名 max-w 响应式：180px → lg:300px
- 超过 3 个项目："proj1, proj2 +N more"

### R4.4: Sidebar 持久化
- 折叠状态保存到 AppSettings 或 localStorage
- 窗口 < 1024px 时自动折叠

### R4.5: 最小窗口适配
- 800x600 最小窗口下布局不溢出
- 无水平滚动条
- 无组件重叠

## Acceptance Criteria
- [ ] 项目面板宽度 280-400px 范围内自适应
- [ ] 可拖拽调整面板宽度
- [ ] 800px 宽度下 HeroStats 缩小但可读
- [ ] StatusBar 3+ 项目显示 "+N more"
- [ ] Sidebar 折叠跨重启持久
- [ ] 800x600 窗口无溢出

## Files

### New
- `src/renderer/components/ui/ResizeHandle.tsx`
- `src/renderer/hooks/useWindowSize.ts`

### Modified
- `src/renderer/App.tsx` — 响应式宽度 + ResizeHandle
- `src/renderer/components/ui/HeroStats.tsx` — 响应式字号
- `src/renderer/components/layout/StatusBar.tsx` — "+N more" 逻辑
- `src/renderer/components/layout/Sidebar.tsx` — 持久化折叠
- `src/renderer/styles/globals.css` — 响应式样式
