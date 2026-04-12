# Spec-05: 主题视觉传达系统

> **关联 PRD**: prd-master.md → G6
> **优先级**: P2 | **预估复杂度**: High

---

## 1. 问题分析

### 1.1 当前主题系统

**colors.css** (303 行): 3 个主题的颜色 token 系统
- `[data-theme="constructivism"]` — 暖色深色
- `[data-theme="modern-light"]` — 冷色浅色
- `[data-theme="warm-light"]` — 暖色浅色

**globals.css** (627 行): 统一的组件样式，使用 CSS 变量
- 所有主题共享相同的：布局、间距、圆角、阴影、动效
- 唯一差异：颜色

**useTheme.ts** (84 行): 切换 `data-theme` 属性

### 1.2 核心问题

**三个主题看起来像"换了滤镜的同一个页面"**，缺乏真正的设计语言差异:

| 维度 | 应有差异 | 当前状态 |
|------|----------|----------|
| 布局结构 | 不同主题用不同网格/排列 | 完全相同 |
| 排版层级 | 不同字阶/字重/对齐方式 | 完全相同 |
| 装饰元素 | 不同几何/纹理/分隔方式 | 只有颜色不同的斜线 |
| 动效节奏 | 不同 easing/duration/方向 | 完全相同 |
| 信息密度 | 不同间距/留白策略 | 完全相同 |
| 圆角/边框 | 不同几何感受 | 微小差异 (2px vs 4px) |
| 图标风格 | 不同线条/填充风格 | 完全相同 |

---

## 2. 设计方案

### 2.1 主题设计语言定义

#### 构成主义 (Constructivism)

**设计灵感**: 苏联构成主义海报、包豪斯工业设计、仪表盘面板

```
视觉特征:
├── 几何: 锐角、斜切、不对称、梯形
├── 色彩: 红/金/钢三色系、高对比
├── 排版: 大标题(全大写) + 紧密正文、强烈层级
├── 装饰: 对角线条纹、几何色块、工业编号
├── 动效: 机械平移(linear)、齿轮旋转、卡片翻转
├── 密度: 高密度、仪表盘风格、数据优先
└── 氛围: 工业、严肃、权威、高效
```

**关键视觉元素**:
- 卡片: 左侧红色/金色竖条 + 斜切右上角 (clip-path polygon)
- 标题: 全大写、letter-spacing 0.1em、下划线装饰
- 分隔线: 对角线 (45° linear-gradient)
- 背景: 暗色纹理 + 对角网格叠加
- 数据展示: 工业仪表盘风格、粗进度条、高对比数字
- 按钮: 梯形 clip-path、悬停平移 2px

#### 现代光明 (Modern Light)

**设计灵感**: Apple HIG、Material Design 3、Vercel Dashboard

```
视觉特征:
├── 几何: 圆角、对称、均衡、柔和
├── 色彩: 蓝/紫渐变、低对比、大面积留白
├── 排版: 均匀字阶、中性权重、居中对齐多
├── 装饰: 极简线条、微妙阴影、半透明层
├── 动效: 弹性缩放(ease-out)、流畅滑入、模糊过渡
├── 密度: 中等密度、留白充分、呼吸感
└── 氛围: 现代、清爽、专业、友好
```

**关键视觉元素**:
- 卡片: 统一圆角 (12px) + 微阴影 + 白色背景
- 标题: 正常大小写、字重区分、无装饰
- 分隔线: 水平细线 (1px, 10% opacity)
- 背景: 纯色或极微渐变 (白到浅灰)
- 数据展示: 现代图表风格、渐变填充、动画数字
- 按钮: 圆角 pill 形、悬停缩放 1.02x + 阴影加深

#### 温暖光明 (Warm Light)

**设计灵感**: 牛皮纸质感、复古仪表、手工艺设计

```
视觉特征:
├── 几何: 大圆角、有机形状、不规则边缘
├── 色彩: 棕/橙/奶油、自然色调、低饱和
├── 排版: 衬线+无衬线混排、手写感数字、文学排版
├── 装饰: 纸质纹理、水彩渐变、印章图案
├── 动效: 缓入缓出(ease-in-out)、自然呼吸、缓慢展开
├── 密度: 低密度、阅读友好、故事叙事风格
└── 氛围: 温馨、复古、手工、有温度
```

**关键视觉元素**:
- 卡片: 大圆角 (16px) + 纸质纹理背景 + 柔和阴影
- 标题: 衬线字体(Playfair Display) + 正常大小写
- 分隔线: 虚线或波浪线
- 背景: 奶油色 + 微妙纸质纹理叠加
- 数据展示: 有机图形、气泡图表、手写数字风格
- 按钮: 大圆角 + 柔和渐变 + 悬停发光

---

### 2.2 实现架构

#### A. CSS 变量扩展

当前 colors.css 只有颜色变量。扩展为完整的设计 token 系统:

```css
/* === 布局 Token === */
[data-theme="constructivism"] {
  /* 间距 */
  --space-card-padding: 12px 16px;
  --space-section-gap: 8px;
  --space-content-gap: 4px;
  
  /* 几何 */
  --radius-card: 2px;
  --radius-button: 2px;
  --radius-input: 2px;
  --radius-badge: 0px;         /* 方形 badge */
  
  /* 边框 */
  --border-card: 1px solid var(--surface-700);
  --border-card-accent: 3px solid var(--red-500);
  --border-section: 2px solid var(--gold-500);
  
  /* 阴影 */
  --shadow-card: 2px 2px 0 rgba(0,0,0,0.3);     /* 硬阴影 */
  --shadow-card-hover: 4px 4px 0 rgba(0,0,0,0.4);
  --shadow-elevated: 6px 6px 0 rgba(0,0,0,0.5);
  
  /* 装饰 */
  --deco-clip-card: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%);
  --deco-background: repeating-linear-gradient(
    -45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 11px
  );
  --deco-divider: linear-gradient(135deg, var(--red-500) 33%, var(--gold-500) 33%, var(--gold-500) 66%, var(--steel-500) 66%);
  --deco-divider-height: 3px;
  
  /* 动效 */
  --motion-duration-fast: 150ms;
  --motion-duration-normal: 250ms;
  --motion-duration-slow: 400ms;
  --motion-easing: linear;           /* 机械感 */
  --motion-hover: translateX(2px);   /* 平移而非缩放 */
  
  /* 排版 */
  --typo-heading-transform: uppercase;
  --typo-heading-spacing: 0.1em;
  --typo-heading-weight: 800;
  --typo-heading-family: var(--font-display);
  --typo-body-spacing: 0.02em;
  
  /* 信息密度 */
  --density-card-min-height: 60px;
  --density-list-row-height: 36px;
  --density-grid-gap: 8px;
}

[data-theme="modern-light"] {
  --space-card-padding: 16px 20px;
  --space-section-gap: 16px;
  --space-content-gap: 8px;
  
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-input: 8px;
  --radius-badge: 999px;        /* pill badge */
  
  --border-card: 1px solid rgba(0,0,0,0.08);
  --border-card-accent: none;
  --border-section: none;
  
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-card-hover: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-elevated: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
  
  --deco-clip-card: none;        /* 无斜切 */
  --deco-background: none;
  --deco-divider: var(--surface-200);
  --deco-divider-height: 1px;
  
  --motion-duration-fast: 100ms;
  --motion-duration-normal: 200ms;
  --motion-duration-slow: 350ms;
  --motion-easing: cubic-bezier(0.2, 0, 0, 1);  /* Material ease */
  --motion-hover: scale(1.02);
  
  --typo-heading-transform: none;
  --typo-heading-spacing: -0.01em;
  --typo-heading-weight: 600;
  --typo-heading-family: var(--font-ui);
  --typo-body-spacing: 0;
  
  --density-card-min-height: 80px;
  --density-list-row-height: 44px;
  --density-grid-gap: 16px;
}

[data-theme="warm-light"] {
  --space-card-padding: 20px 24px;
  --space-section-gap: 20px;
  --space-content-gap: 12px;
  
  --radius-card: 16px;
  --radius-button: 12px;
  --radius-input: 10px;
  --radius-badge: 999px;
  
  --border-card: 1px solid rgba(139,90,43,0.12);
  --border-card-accent: none;
  --border-section: none;
  
  --shadow-card: 0 2px 8px rgba(139,90,43,0.08);
  --shadow-card-hover: 0 4px 12px rgba(139,90,43,0.12);
  --shadow-elevated: 0 8px 24px rgba(139,90,43,0.15);
  
  --deco-clip-card: none;
  --deco-background: url("data:image/svg+xml,...");  /* 纸质纹理 SVG */
  --deco-divider: repeating-linear-gradient(90deg, var(--surface-300) 0, var(--surface-300) 4px, transparent 4px, transparent 8px);
  --deco-divider-height: 2px;
  
  --motion-duration-fast: 200ms;
  --motion-duration-normal: 350ms;
  --motion-duration-slow: 500ms;
  --motion-easing: cubic-bezier(0.4, 0, 0.2, 1);  /* 自然 ease */
  --motion-hover: scale(1.01) translateY(-1px);
  
  --typo-heading-transform: none;
  --typo-heading-spacing: 0;
  --typo-heading-weight: 500;
  --typo-heading-family: 'Playfair Display', var(--font-ui);  /* 衬线 */
  --typo-body-spacing: 0.01em;
  
  --density-card-min-height: 100px;
  --density-list-row-height: 52px;
  --density-grid-gap: 20px;
}
```

#### B. 组件消费 Token

所有组件统一使用 CSS 变量，**不写主题判断代码**:

```css
/* globals.css — 组件样式只用变量 */
.card {
  padding: var(--space-card-padding);
  border-radius: var(--radius-card);
  border: var(--border-card);
  box-shadow: var(--shadow-card);
  clip-path: var(--deco-clip-card);
  min-height: var(--density-card-min-height);
  transition: all var(--motion-duration-normal) var(--motion-easing);
}

.card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: var(--motion-hover);
}

.section-title {
  font-family: var(--typo-heading-family);
  font-weight: var(--typo-heading-weight);
  text-transform: var(--typo-heading-transform);
  letter-spacing: var(--typo-heading-spacing);
}

.divider {
  height: var(--deco-divider-height);
  background: var(--deco-divider);
}
```

#### C. 装饰组件系统

```typescript
// DecorationSet.tsx — 主题感知装饰组件
interface DecorationProps {
  type: 'divider' | 'corner' | 'background' | 'accent-bar' | 'badge-frame'
  position?: 'top' | 'bottom' | 'left' | 'right'
}

// 纯 CSS 驱动，不需要 JS 主题判断:
// <Decoration type="divider" /> 
//   → <div class="deco-divider" />
//   → CSS: height: var(--deco-divider-height); background: var(--deco-divider);
//
// 构成主义: 3px 三色斜线
// 现代光明: 1px 浅灰线
// 温暖光明: 2px 虚线
```

#### D. 字体系统

```css
/* typography.css 扩展 */
:root {
  --font-display: 'Bebas Neue', 'Oswald', var(--font-ui);
  --font-ui: 'Inter', 'Noto Sans SC', system-ui;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', monospace;
  --font-serif: 'Playfair Display', 'Noto Serif SC', serif;
}

/* 标题字体随主题切换 */
[data-theme="constructivism"] {
  --typo-heading-family: var(--font-display);  /* 宽大展示字体 */
}
[data-theme="modern-light"] {
  --typo-heading-family: var(--font-ui);       /* 现代无衬线 */
}
[data-theme="warm-light"] {
  --typo-heading-family: var(--font-serif);    /* 优雅衬线 */
}
```

#### E. 动效 Presets

```css
/* animations.css 扩展 */

/* 按钮悬停 — 各主题不同 */
.btn-primary:hover {
  transform: var(--motion-hover);
  transition: transform var(--motion-duration-fast) var(--motion-easing);
}
/* 构成主义: translateX(2px) linear → 机械感平移 */
/* 现代光明: scale(1.02) ease-out → 弹性缩放 */
/* 温暖光明: scale(1.01) translateY(-1px) ease → 柔和浮起 */

/* 卡片进入动画 — 各主题不同 */
@keyframes card-enter-constructivism {
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes card-enter-modern {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes card-enter-warm {
  from { transform: translateY(10px); opacity: 0; filter: blur(4px); }
  to { transform: translateY(0); opacity: 1; filter: blur(0); }
}

[data-theme="constructivism"] .card-enter {
  animation: card-enter-constructivism var(--motion-duration-normal) var(--motion-easing);
}
[data-theme="modern-light"] .card-enter {
  animation: card-enter-modern var(--motion-duration-normal) var(--motion-easing);
}
[data-theme="warm-light"] .card-enter {
  animation: card-enter-warm var(--motion-duration-slow) var(--motion-easing);
}
```

#### F. 数据可视化主题

```
构成主义:
  ├── 进度条: 粗实心 + 斜线纹理填充 + 金色刻度线
  ├── 图表: 工业仪表盘风格, 刻度盘, 等高线
  ├── 状态灯: 方形 LED 指示灯
  └── 数字: 大号等宽粗体, tabular-nums

现代光明:
  ├── 进度条: 圆角渐变填充 + 动画光泽扫过
  ├── 图表: Material style, 渐变面积图, 平滑曲线
  ├── 状态灯: 圆形 + 微发光 (box-shadow glow)
  └── 数字: 中号 proportional-nums, 轻字重

温暖光明:
  ├── 进度条: 大圆角 + 渐变 + 缓慢脉动
  ├── 图表: 有机风格, 气泡图, 手绘线条感
  ├── 状态灯: 柔和圆点 + 自然呼吸动画
  └── 数字: 衬线字体数字, 手写感
```

---

### 2.3 布局差异化

#### 构成主义布局
```
┌──────────────────────────────────────────────┐
│ ╲  DEVHUB MONITOR  ╲  [ Process | Port ]    │  ← 斜切标题区
├──────────────────────────────────────────────┤
│ ┌─────┬─────┬─────┬─────┐                   │
│ │ 128 │ 45  │ 12  │  3  │  ← 高密度统计行   │
│ │进程  │端口  │窗口  │告警  │                   │
│ └─────┴─────┴─────┴─────┘                   │
│ ┌─────────────────────┬─────────────────┐   │
│ │ 进程列表 (紧凑行)   │ 详情面板        │   │  ← 双列布局
│ │ ....                │ (右侧固定宽度)  │   │
│ └─────────────────────┴─────────────────┘   │
└──────────────────────────────────────────────┘
```

#### 现代光明布局
```
┌──────────────────────────────────────────────┐
│  DevHub Monitor         Process  Port  ...   │  ← 简洁标题
│                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │   128    │ │   45     │ │   12     │     │  ← 宽松统计卡片
│  │ Processes│ │  Ports   │ │ Windows  │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                               │     (留白)
│  ┌─────────────────────────────────────┐     │
│  │ 进程列表 (宽松行)                    │     │  ← 全宽列表
│  │ ....                                │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  详情面板 (底部抽屉或遮罩层)                   │
└──────────────────────────────────────────────┘
```

#### 温暖光明布局
```
┌──────────────────────────────────────────────┐
│                                               │
│    DevHub Monitor                             │  ← 居中标题，大间距
│    Process · Port · Window                    │
│                                               │
│  ┌────────────────────────────────────────┐  │
│  │ 128 Processes  ·  45 Ports  ·  12 Win │  │  ← 单行内联统计
│  └────────────────────────────────────────┘  │
│                                               │
│  ┌──────────────┐  ┌──────────────┐          │
│  │              │  │              │          │  ← 大卡片网格
│  │  node.exe    │  │  chrome.exe  │          │
│  │  CPU: 45%    │  │  CPU: 12%    │          │
│  │              │  │              │          │
│  └──────────────┘  └──────────────┘          │
│                                               │
└──────────────────────────────────────────────┘
```

---

## 3. 文件修改清单

| 文件 | 修改类型 | 内容 |
|------|----------|------|
| `colors.css` | **扩展** | 新增 layout/deco/motion/typo/density token |
| `globals.css` | **重写** | 所有组件样式改用扩展后的 CSS 变量 |
| `typography.css` | 修改 | 新增主题相关字体变量 |
| `animations.css` | **扩展** | 主题相关入场/交互/状态动画 |
| `useTheme.ts` | 修改 | 字体预加载、主题切换动画增强 |
| `tailwind.config.js` | 修改 | 扩展 theme 配置以映射 CSS 变量 |
| 新建 `theme-tokens.css` | 新增 | 集中管理所有非颜色的主题 token |
| 新建 `DecorationSet.tsx` | 新增 | 主题感知装饰组件 |
| 多个组件 | 修改 | 消费新的 CSS 变量 (card, button, divider, etc.) |

---

## 4. 验收标准

### 视觉差异化
- [ ] 构成主义: 斜切卡片 + 对角装饰 + 大写粗体标题 + 硬阴影
- [ ] 现代光明: 圆角卡片 + 极简线条 + 正常标题 + 柔阴影
- [ ] 温暖光明: 大圆角卡片 + 纸质纹理 + 衬线标题 + 暖色阴影
- [ ] 三个主题截图对比有明显视觉传达差异（非仅颜色不同）

### 动效差异化
- [ ] 构成主义: 按钮悬停平移 2px，线性过渡
- [ ] 现代光明: 按钮悬停缩放 1.02x，弹性过渡
- [ ] 温暖光明: 按钮悬停浮起 1px，自然过渡
- [ ] 卡片入场动画三主题各不同

### 排版差异化
- [ ] 构成主义: 展示字体(Bebas/Oswald) + 全大写 + 宽字距
- [ ] 现代光明: UI 字体(Inter) + 正常大小写 + 紧字距
- [ ] 温暖光明: 衬线字体(Playfair) + 正常大小写 + 正常字距

### 信息密度差异化
- [ ] 构成主义: 紧凑间距, 小卡片, 窄行高
- [ ] 现代光明: 中等间距, 标准卡片, 标准行高
- [ ] 温暖光明: 宽松间距, 大卡片, 大行高

### 性能
- [ ] 主题切换 < 300ms 无闪烁
- [ ] 新增 CSS 变量不影响渲染性能
- [ ] 字体按需加载（非阻塞）
