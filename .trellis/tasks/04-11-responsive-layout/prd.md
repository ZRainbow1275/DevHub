# Spec: 响应式布局与信息密度优化

> 关联 PRD: `00-prd-round3.md` § 3.2 + R2-2.4
> 优先级: P1
> 层级: Frontend

---

## 1. 问题描述

- 界面元素紧密排列，文字被截断
- 卡片间距不足，整体观感拥挤
- 不同窗口尺寸下组件表现不佳
- 无响应式断点系统

---

## 2. 断点系统

### 2.1 断点定义
```css
/* Container Query 断点 */
--bp-xs: 0px;       /* < 640px */
--bp-sm: 640px;     /* 640px - 999px */
--bp-md: 1000px;    /* 1000px - 1399px */
--bp-lg: 1400px;    /* 1400px - 1799px */
--bp-xl: 1800px;    /* ≥ 1800px */
```

### 2.2 各断点行为
| 断点 | 列数 | 侧边栏 | 卡片间距 | 内边距 | 字体缩放 |
|------|------|--------|---------|--------|---------|
| xs | 1 | 折叠（图标） | 8px | 8px | 0.875x |
| sm | 1-2 | 折叠（图标） | 10px | 12px | 0.9375x |
| md | 2-3 | 展开 | 12px | 16px | 1x |
| lg | 3-4 | 展开 | 16px | 20px | 1x |
| xl | 4+ | 展开 | 20px | 24px | 1x |

---

## 3. 间距与内边距调整

### 3.1 卡片间距
```css
/* 当前（过于紧凑） */
gap: 4px; /* 估计值 */

/* 目标 */
--gap-card: var(--spacing-md, 12px); /* 最小 12px */
```

### 3.2 面板内边距
```css
/* 目标 */
--padding-panel: var(--spacing-lg, 16px); /* 最小 16px */
```

### 3.3 文字截断处理
- 长文本：`text-overflow: ellipsis` + **tooltip 显示完整内容**
- 进程名/路径：hover 时显示完整路径
- 端口信息：确保关键数据不被截断

---

## 4. 信息密度可调

### 4.1 三级密度
| 级别 | 卡片高度 | 行间距 | 字体大小 | 适用场景 |
|------|---------|--------|---------|---------|
| 紧凑 | 64px | 1.25 | 12px | 高信息密度需求 |
| 标准 | 80px | 1.5 | 14px | 默认 |
| 宽松 | 100px | 1.75 | 14px | 低信息密度偏好 |

### 4.2 切换与持久化
- 设置面板中提供"信息密度"选项（三级选择）
- 选择后立即生效，持久化到 `electron-store`
- CSS 变量驱动：`[data-density="compact"]`, `[data-density="standard"]`, `[data-density="comfortable"]`

---

## 5. 侧边栏折叠

### 5.1 折叠行为
- 折叠时：仅显示图标（宽度 48px）
- 展开时：图标 + 文字标签（宽度 200px）
- 折叠/展开按钮：侧边栏底部或顶部的 chevron 图标
- 记住状态：持久化到 localStorage

### 5.2 折叠动画
- 宽度过渡：`transition: width 200ms ease`
- 文字标签：折叠时 `opacity: 0`，展开时 `opacity: 1`

---

## 6. 面板可拖拽调整

### 6.1 PanelSplitter 增强
- 当前已有 `PanelSplitter` 组件
- 确认是否支持：
  - 拖拽时实时预览
  - 最小尺寸约束（`PANEL_MIN_PX`）
  - 双击恢复默认比例
  - 尺寸持久化（已有 `SPLIT_STORAGE_KEY`）

---

## 7. 验收标准

- [ ] 窗口 800px 宽时不出现挤压/截断
- [ ] 窗口 1920px 宽时充分利用空间
- [ ] 卡片间距最小 12px
- [ ] 长文本有 tooltip
- [ ] 三级密度切换正常
- [ ] 侧边栏折叠/展开正常

---

## 8. 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `tailwind.config.js` | 修改 | 添加 container query 配置 |
| `src/renderer/styles/tokens/` | 修改 | 添加间距/密度 token |
| `src/renderer/components/layout/Sidebar.tsx` | 修改 | 折叠/展开功能 |
| `src/renderer/components/monitor/*.tsx` | 修改 | 响应式卡片布局 |
| `src/renderer/components/ui/PanelSplitter.tsx` | 检查 | 确认拖拽功能 |
| `src/renderer/App.tsx` | 修改 | 断点逻辑 |
