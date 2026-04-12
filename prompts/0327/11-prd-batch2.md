# PRD — Batch 2: 性能 + 无障碍 + UX 修复

> 优先级: HIGH
> 类型: frontend (renderer)
> 预估修改文件: 10-15 个

---

## Goal

优化监控视图性能，补全无障碍支持，统一设计系统实现。

---

## Requirements

### R1: 监控视图虚拟化 (PERF-01)
- 为 ProcessView Grid/List 模式添加 `@tanstack/react-virtual`
- 为 PortView 添加虚拟化
- 为 AITaskView history 列表添加虚拟化
- 参考 ProjectList.tsx 的实现模式

### R2: 动画延迟修复 (PERF-02)
- 限制 `animationDelay` 最大值为 500ms
- 使用 `Math.min(index * 50, 500)` 或 viewport-aware 方案

### R3: 可见性感知轮询 (PERF-03)
- 创建 `hooks/useVisibilityAwarePolling.ts`
- 替换 ProcessView, PortView, AITaskView, Sidebar 中的 setInterval
- 应用最小化或标签页不可见时暂停轮询

### R4: Memo 优化 (PERF-04)
- StatusBar 中 `runningProjects.filter()` 包裹 useMemo
- PortView 中 `filteredPorts.filter()` 包裹 useMemo

### R5: LogPanel key 稳定性 (PERF-05)
- 为 LogEntry 添加 `id` 字段（递增计数器）
- ProcessManager 生成日志时赋予唯一 ID
- LogPanel 使用 `log.id` 作为 key

### R6: ARIA 属性补全 (A11Y-01)
- MonitorPanel tabs: 添加 `role="tab"`, `aria-selected`, `aria-controls`
- ContextMenu: 改为 `role="menu"` + `role="menuitem"`
- ScriptSelector: 添加 `aria-haspopup="listbox"`, `aria-expanded`
- ViewModeToggle: 添加 `aria-pressed`
- StatCard icons: 添加 `aria-hidden="true"`

### R7: 键盘导航补全 (A11Y-02)
- ScriptSelector: 上下箭头 + Enter + Escape
- MonitorPanel: 左右箭头切换 tab

### R8: 设计一致性修复 (UX-01)
- 统一边框粗细（`border-l-2` 或 `border-l-3`，全局统一）
- 定义 CSS 变量: `--duration-fast`, `--duration-normal`, `--duration-slow`
- 统一 section header 样式

---

## Acceptance Criteria

- [ ] ProcessView/PortView/AITaskView 使用虚拟化渲染
- [ ] 动画延迟不超过 500ms
- [ ] 应用最小化时轮询暂停（通过 console.log 验证）
- [ ] 所有 tab 按钮有 `aria-selected`
- [ ] ScriptSelector 支持键盘导航
- [ ] 边框粗细全局统一
- [ ] `pnpm build` 成功
- [ ] `pnpm typecheck` 通过

---

## Files to Modify (Estimated)

### New Files
- `src/renderer/hooks/useVisibilityAwarePolling.ts`

### Modified Files
- `src/renderer/components/monitor/ProcessView.tsx` — 虚拟化 + 动画限制
- `src/renderer/components/monitor/PortView.tsx` — 虚拟化 + 动画限制
- `src/renderer/components/monitor/AITaskView.tsx` — 虚拟化
- `src/renderer/components/monitor/MonitorPanel.tsx` — ARIA tabs
- `src/renderer/components/layout/StatusBar.tsx` — useMemo
- `src/renderer/components/layout/Sidebar.tsx` — 可见性感知轮询
- `src/renderer/components/ui/ContextMenu.tsx` — ARIA menu
- `src/renderer/components/ui/ScriptSelector.tsx` — ARIA + 键盘导航
- `src/renderer/components/ui/StatCard.tsx` — aria-hidden
- `src/renderer/components/log/LogPanel.tsx` — stable key
- `src/shared/types.ts` — LogEntry 添加 id 字段
- `src/main/services/ProcessManager.ts` — 生成 log id
- `src/renderer/index.css` — CSS 变量定义

---

## Technical Notes

- 虚拟化依赖 `@tanstack/react-virtual` 已在 package.json 中
- 可见性感知使用 `document.visibilitychange` 事件
- ARIA 修改纯属性添加，不改变视觉表现
- LogEntry id 使用简单递增计数器（无需 uuid）
