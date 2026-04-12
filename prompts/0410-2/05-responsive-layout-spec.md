# 视觉布局自适应 — 技术设计 Spec

> 对应 PRD: 2.4 视觉布局自适应 (P1)
> 状态: NEW — 第二轮测试新发现

---

## 1. 问题描述

当前界面元素在不同窗口尺寸下表现不佳：

| 场景 | 问题 |
|------|------|
| 窗口缩小 (< 800px) | 组件挤压变形，文字截断，卡片重叠 |
| 窗口放大 (> 1920px) | 组件未充分利用空间，大量空白浪费 |
| 标准尺寸 (1366px) | 部分面板过于拥挤 |
| 侧边栏展开时 | 主内容区被挤压，无响应式适配 |

根因：
- 使用 viewport-based 的 `clamp()` 做响应式，不够精确
- 缺乏组件级响应式（Container Queries）
- 没有统一的断点系统
- 信息密度/格式化不随空间变化

---

## 2. 断点系统

### 2.1 容器断点定义

使用 CSS Container Queries，以组件容器宽度（而非 viewport）为基准：

```css
/* 容器断点 */
@container (width < 400px)   { /* xs — 极窄 */ }
@container (width < 600px)   { /* sm — 窄 */ }
@container (width < 900px)   { /* md — 中等 */ }
@container (width < 1200px)  { /* lg — 宽 */ }
@container (width >= 1200px) { /* xl — 超宽 */ }
```

### 2.2 每个断点的行为

```
┌───────┬──────────────────────────────────────────────────────┐
│ 断点  │ 行为                                                  │
├───────┼──────────────────────────────────────────────────────┤
│ xs    │ 单列布局                                              │
│       │ 文字最小号（12px body, 16px heading）                  │
│       │ 数值用缩写（1.2K, 3.4M）                              │
│       │ 隐藏次要信息，仅显示核心指标                           │
│       │ 卡片最小间距 (4px)                                     │
│       │ 侧边栏折叠为图标栏                                    │
├───────┼──────────────────────────────────────────────────────┤
│ sm    │ 1-2 列布局                                            │
│       │ 文字小号（13px body, 18px heading）                    │
│       │ 数值用短格式（1,234 → 1.2K when tight）               │
│       │ 进程卡片简化版（名称+PID+CPU+内存）                    │
│       │ 侧边栏可折叠                                          │
├───────┼──────────────────────────────────────────────────────┤
│ md    │ 2-3 列布局                                            │
│       │ 标准文字大小（14px body, 20px heading）                │
│       │ 数值完整格式（1,234,567）                              │
│       │ 进程卡片标准版                                         │
│       │ 侧边栏展开                                            │
├───────┼──────────────────────────────────────────────────────┤
│ lg    │ 3-4 列布局                                            │
│       │ 增加行间信息（趋势图、次要指标）                        │
│       │ 进程卡片增强版（含 sparkline）                          │
│       │ 详情面板可内联展示（不需要抽屉）                        │
├───────┼──────────────────────────────────────────────────────┤
│ xl    │ 4+ 列布局                                             │
│       │ 完整信息密度                                           │
│       │ 可同时显示列表+详情+关系图                             │
│       │ 多面板并排                                             │
└───────┴──────────────────────────────────────────────────────┘
```

---

## 3. 实现方案

### 3.1 Container Query 基础设施

```css
/* 为所有面板容器启用 container */
.panel-container {
  container-type: inline-size;
  container-name: panel;
}

.sidebar-container {
  container-type: inline-size;
  container-name: sidebar;
}

.main-content {
  container-type: inline-size;
  container-name: main;
}
```

### 3.2 响应式网格

```css
/* 自动响应式网格 — 不需要手写每个断点 */
.auto-grid {
  display: grid;
  gap: calc(var(--spacing-base) * 2 * var(--density-factor));
  grid-template-columns: repeat(
    auto-fill,
    minmax(
      calc(280px * var(--density-factor)),
      1fr
    )
  );
}

/* 或使用 Container Query 精确控制 */
@container panel (width < 600px) {
  .card-grid { grid-template-columns: 1fr; }
}
@container panel (600px <= width < 900px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}
@container panel (900px <= width < 1200px) {
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}
@container panel (width >= 1200px) {
  .card-grid { grid-template-columns: repeat(var(--grid-cols-xl), 1fr); }
}
```

### 3.3 响应式数值格式化

```typescript
type DisplayFormat = 'full' | 'short' | 'compact' | 'icon'

function formatMetric(value: number, format: DisplayFormat): string {
  switch (format) {
    case 'full':    return value.toLocaleString()          // 1,234,567
    case 'short':   return value >= 1e6 ? `${(value/1e6).toFixed(1)}M`
                         : value >= 1e3 ? `${(value/1e3).toFixed(1)}K`
                         : String(value)                    // 1.2M / 3.4K / 567
    case 'compact': return value >= 1e6 ? `${Math.round(value/1e6)}M`
                         : value >= 1e3 ? `${Math.round(value/1e3)}K`
                         : String(value)                    // 1M / 3K / 567
    case 'icon':    return ''                               // 仅显示图标
  }
}

// 根据容器宽度选择格式
function useMetricFormat(containerRef: RefObject<HTMLElement>): DisplayFormat {
  const [format, setFormat] = useState<DisplayFormat>('full')

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      if (width < 150) setFormat('icon')
      else if (width < 250) setFormat('compact')
      else if (width < 400) setFormat('short')
      else setFormat('full')
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return format
}
```

### 3.4 可拖拽面板分割

```typescript
// 面板分割器 — 允许用户拖拽调整面板大小
interface PanelSplitProps {
  direction: 'horizontal' | 'vertical'
  defaultSizes: number[]        // 百分比, 例: [30, 70]
  minSizes?: number[]           // 最小像素, 例: [200, 300]
  maxSizes?: number[]           // 最大像素
  children: React.ReactNode[]
  onResize?: (sizes: number[]) => void
}

// 实现: 纯 CSS + pointer events
// 不引入第三方库，保持轻量
// 分割线区域: 4px 可拖拽区域 + cursor: col-resize / row-resize
// 拖拽时: 实时更新 flex-basis / width / height
// 松手后: 持久化到 Zustand store (可选: electron-store)
```

### 3.5 侧边栏折叠

```
展开状态 (>= md):
┌────────────────┬─────────────────────────────────────┐
│ 侧边栏         │ 主内容区                              │
│ (var(--sidebar  │                                     │
│  -width))       │                                     │
│                │                                     │
│ [进程]         │  内容...                             │
│ [端口]         │                                     │
│ [窗口]         │                                     │
│ [AI任务]       │                                     │
└────────────────┴─────────────────────────────────────┘

折叠状态 (< md):
┌──┬───────────────────────────────────────────────────┐
│📊│ 主内容区                                           │
│📡│                                                   │
│🪟│ 内容...                                           │
│🤖│                                                   │
└──┴───────────────────────────────────────────────────┘
  48px

切换: 点击折叠按钮 或 窗口缩小时自动折叠
```

---

## 4. 具体组件的响应式规格

### 4.1 HeroStats (系统摘要面板)

```
xl (≥1200px): 横排 4 个指标卡，完整数值+趋势图+标签
lg (900-1200): 横排 4 个，缩小趋势图
md (600-900):  横排 2 + 换行 2
sm (400-600):  横排 2，紧凑模式，无趋势图
xs (<400px):   纵排 4 个，仅图标+数值
```

### 4.2 进程列表

```
xl: 表格视图（Name, PID, CPU, MEM, 线程, 端口, 操作）
lg: 表格视图（Name, PID, CPU, MEM, 操作）— 隐藏次要列
md: 卡片视图（2 列卡片网格）
sm: 卡片视图（1 列）
xs: 简化列表（仅 Name + CPU 条形图）
```

### 4.3 神经关系图

```
xl: 全屏关系图 + 右侧详情面板
lg: 全屏关系图（点击节点弹出浮层）
md: 简化关系图（减少动画粒子数量）
sm: 列表视图替代（关系图在此尺寸下不实用）
xs: 不显示关系图，仅显示关联列表
```

### 4.4 窗口管理面板

```
xl: 3 列卡片 + 右侧 AI 监控面板
lg: 2 列卡片 + AI 窗口置顶区
md: 2 列卡片
sm: 1 列卡片，简化信息
xs: 窗口名称列表（点击展开详情）
```

---

## 5. 验收标准

- [ ] 应用在 800px ~ 2560px 宽度范围内无组件溢出/截断
- [ ] 窗口缩小到 800px 时，侧边栏自动折叠为图标栏
- [ ] 主内容区使用 Container Queries 实现组件级响应式
- [ ] 数值在空间不足时自动切换为缩写格式
- [ ] 面板间分割线可拖拽调整大小
- [ ] 卡片网格列数随容器宽度自动调整
- [ ] 分割线拖拽位置在会话内保持（刷新不重置）
