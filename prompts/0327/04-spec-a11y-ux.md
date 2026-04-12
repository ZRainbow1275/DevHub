# Accessibility & UX Spec — DevHub 无障碍与用户体验规格

> 优先级: MEDIUM
> 影响范围: renderer 全部交互组件

---

## A11Y-01: 缺失 ARIA 属性

### Tab 导航 (MonitorPanel.tsx)
**当前**: `<button>` 无 `aria-selected`, `aria-controls`
**修复**:
```tsx
<button
  role="tab"
  aria-selected={activeTab === tab.key}
  aria-controls={`panel-${tab.key}`}
  tabIndex={activeTab === tab.key ? 0 : -1}
>
```
对应面板:
```tsx
<div role="tabpanel" id={`panel-${tab.key}`} aria-labelledby={`tab-${tab.key}`}>
```

### 上下文菜单 (ContextMenu.tsx)
**当前**: `role="dialog"` 无 `aria-labelledby`
**修复**:
```tsx
<div role="menu" aria-label="Context menu">
  {items.map(item => (
    <button role="menuitem" key={item.key}>
```

### 下拉选择器 (ScriptSelector.tsx)
**当前**: 无 `aria-haspopup`, 无键盘导航
**修复**:
```tsx
<button aria-haspopup="listbox" aria-expanded={isOpen}>
// dropdown items: role="option", aria-selected
```

### 视图模式切换 (ProcessView, PortView)
**当前**: 无 `aria-pressed`
**修复**: `<button aria-pressed={viewMode === mode}>`

### StatCard 图标
**当前**: 装饰性图标无 aria-hidden
**修复**: `<span aria-hidden="true">{icon}</span>`

---

## A11Y-02: 键盘导航不完整

### ScriptSelector 下拉菜单
**缺失**: 上下箭头选择、Enter 确认、Escape 关闭
**修复**: 参考 WAI-ARIA Listbox Pattern

### MonitorPanel Tab 切换
**缺失**: 左右箭头在 tab 间切换
**修复**: 参考 WAI-ARIA Tabs Pattern

---

## UX-01: 设计系统一致性偏差

### 边框粗细不一致
| 位置 | 当前 | 应该 |
|------|------|------|
| StatCard | `border-l-3` | 统一为 `border-l-2` 或 `border-l-3` |
| ProcessCard | `border-l-2` | 同上 |

### 动画时间不一致
设计系统规定 100-400ms，实际使用:
- 200ms, 300ms, 500ms 混用
- 建议: 定义 CSS 变量 `--duration-fast: 150ms`, `--duration-normal: 250ms`, `--duration-slow: 400ms`

### Section Header 样式不一致
- Sidebar 使用 `.section-header` class
- SettingsDialog 使用手写样式
- 建议: 统一使用 class

---

## UX-02: 错误状态展示

### 监控子视图崩溃
**当前**: 无独立 ErrorBoundary，任一子视图崩溃导致整个监控面板白屏
**修复**:
```tsx
<ErrorBoundary fallback={<ViewErrorFallback viewName="进程监控" onRetry={...} />}>
  <ProcessView />
</ErrorBoundary>
```

### 空状态展示
部分视图在数据为空时无提示，建议添加 EmptyState 组件。
