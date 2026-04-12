# Spec-01: 监控面板响应式增强

> **关联 PRD**: prd-master.md → G1
> **优先级**: P0 | **预估复杂度**: Medium

---

## 1. 问题分析

### 1.1 当前实现

**HeroStats.tsx** (51 行):
- 使用 `flex-1` 平均分配宽度
- 数值渲染依赖 globals.css 中的 `.hero-number` 类
- 无任何容器感知逻辑

**globals.css** `.hero-number` 规则:
```css
.hero-number {
  font-size: 48px;          /* 桌面 */
}
@media (max-width: 1024px) {
  .hero-number { font-size: 32px; }  /* 平板 */
}
@media (max-width: 640px) {
  .hero-number { font-size: 24px; }  /* 手机 */
}
```

**StatCard.tsx** (65 行):
- 使用 `clamp(14px, 2.5vw, 24px)` 做响应
- 基于 viewport 宽度而非容器宽度
- 数值截断依赖 `text-ellipsis overflow-hidden`

### 1.2 具体问题

| # | 问题 | 复现条件 | 根因 |
|---|------|----------|------|
| 1 | Hero 数字过大溢出 | 窗口宽度 < 500px + 侧栏打开 | viewport media query 不感知侧栏 |
| 2 | StatCard 数值截断 | 数值 > 4 位 + 窗口 < 800px | clamp 基于 vw，不感知容器实际宽度 |
| 3 | 断点过渡生硬 | 窗口在 640px/1024px 附近 | 离散断点，无平滑过渡 |
| 4 | 四列统计在窄容器挤压 | MonitorPanel 内嵌使用 | grid-cols-4 不随容器变化 |

---

## 2. 设计方案

### 2.1 核心策略: Container Queries + 自适应格式化

```
┌─ Container (MonitorPanel 内容区) ────────────────────────┐
│  @container (width >= 800px) → 完整模式                   │
│  @container (width >= 500px) → 紧凑模式                   │
│  @container (width < 500px)  → 极简模式                   │
│                                                           │
│  ┌─ HeroStats ──────────────────────────────────────┐    │
│  │  完整: "12,345" (48px)                            │    │
│  │  紧凑: "12.3K"  (32px)                            │    │
│  │  极简: "12K"    (24px) + icon                     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─ StatCards ──────────────────────────────────────┐    │
│  │  完整: 4列 grid, 图标+标签+数值                    │    │
│  │  紧凑: 2列 grid, 图标+数值                        │    │
│  │  极简: 横向 scroll, 数值only                       │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 2.2 实现细节

#### A. 容器查询基础设施

```css
/* 在 MonitorPanel 的内容区域上设置 containment */
.monitor-content {
  container-type: inline-size;
  container-name: monitor;
}
```

#### B. ResponsiveMetric 组件

新建统一的数值展示组件，替代直接渲染数字:

```typescript
interface ResponsiveMetricProps {
  value: number
  label: string
  icon?: ReactNode
  variant?: 'hero' | 'stat' | 'inline'
  format?: 'number' | 'percent' | 'bytes' | 'duration'
  color?: ColorVariant
}

// 自动格式化逻辑:
// - 容器 >= 800px: formatFull(12345) → "12,345"
// - 容器 >= 500px: formatCompact(12345) → "12.3K"
// - 容器 < 500px:  formatMinimal(12345) → "12K"
```

#### C. 格式化策略

| 模式 | 整数 | 百分比 | 字节 | 时长 |
|------|------|--------|------|------|
| 完整 | `12,345` | `87.3%` | `1.23 GB` | `2h 15m 30s` |
| 紧凑 | `12.3K` | `87%` | `1.2G` | `2h 15m` |
| 极简 | `12K` | `87` | `1G` | `2:15` |

#### D. Hero 数值自适应

```css
@container monitor (width >= 800px) {
  .hero-number {
    font-size: clamp(36px, 5cqi, 56px);  /* cqi = container query inline */
  }
}

@container monitor (width >= 500px) and (width < 800px) {
  .hero-number {
    font-size: clamp(24px, 4cqi, 36px);
  }
}

@container monitor (width < 500px) {
  .hero-number {
    font-size: clamp(18px, 6cqi, 28px);
  }
}
```

#### E. StatCard Grid 自适应

```css
@container monitor (width >= 800px) {
  .stat-grid { grid-template-columns: repeat(4, 1fr); }
}

@container monitor (width >= 500px) and (width < 800px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}

@container monitor (width < 500px) {
  .stat-grid {
    grid-template-columns: 1fr;
    /* 或横向滚动 */
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
}
```

---

## 3. 文件修改清单

| 文件 | 修改类型 | 内容 |
|------|----------|------|
| `globals.css` | 修改 | 替换 `@media` 为 `@container`，hero-number 规则重写 |
| `HeroStats.tsx` | 修改 | 集成 ResponsiveMetric，添加格式化逻辑 |
| `StatCard.tsx` | 修改 | 集成 ResponsiveMetric，移除 vw-based clamp |
| `MonitorPanel.tsx` | 修改 | 内容区添加 `container-type: inline-size` |
| `ProcessView.tsx` | 修改 | 统计行使用 `stat-grid` 容器查询类 |
| `PortView.tsx` | 修改 | 统计行使用 `stat-grid` 容器查询类 |
| 新建 `ResponsiveMetric.tsx` | 新增 | 统一数值展示组件 |
| 新建 `formatMetric.ts` | 新增 | 数值格式化工具函数 |

---

## 4. 验收标准

- [ ] 400px 宽度: 数值以极简模式完整显示，无截断
- [ ] 500px 宽度: 数值以紧凑模式显示
- [ ] 800px 宽度: 数值以完整模式显示
- [ ] 2560px 宽度: 数值不过分稀疏，合理间距
- [ ] 侧栏展开/收起时平滑过渡，无闪烁
- [ ] StatCard grid 在各宽度下合理排列
- [ ] HeroStats 数字在断点过渡区平滑缩放（无跳变）

---

## 5. 技术约束

- Electron 28 = Chromium 120，完全支持 CSS Container Queries
- `cqi` 单位 (container query inline) 在 Chromium 115+ 可用
- 不引入额外 JS resize observer（CSS 原生解决）
