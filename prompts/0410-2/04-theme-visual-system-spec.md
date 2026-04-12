# 主题视觉传达体系 — 技术设计 Spec（第二轮增补）

> 对应 PRD: 2.3 主题视觉传达 (P2)
> 基于: `prompts/0410/04-theme-system-spec.md` 增补
> 变更: 再次强调"主题不是换色"，补充具体的差异化实现方案

---

## 0. 核心强调

**两轮测试均确认：当前主题切换仅改变颜色。**

主题是一套 **完整的设计语言**，不是一张调色板。每个主题必须在以下 **全部 8 个维度** 产生可感知的差异：

```
1. 色彩系统        — 主色/辅色/语义色/表面色
2. 组件排布/布局    — 紧凑 vs 宽松、卡片 vs 列表、列数、间距
3. 字体与排版      — 字体家族、字号阶梯、行高、字间距、大写规则
4. 圆角策略        — 方角 vs 圆角、圆角半径
5. 阴影与层次      — 无阴影/边框 vs 发光 vs 极淡阴影
6. 动效风格        — 刚性快速 vs 流畅弹性 vs 极简功能性
7. 装饰元素        — 几何线条 vs 粒子网格 vs 无装饰
8. 信息密度        — 高(紧凑) vs 中 vs 低(宽松)
```

---

## 1. 三套主题的全维度对比

### 1.1 Soviet Constructivism（构成主义 — 当前主题增强）

```
设计灵感: 苏维埃构成主义海报 + 包豪斯工业设计
情感基调: 力量、秩序、革命、机械精密

┌──────────────────────────────────────────────────────────┐
│ 维度           │ 具体实现                                 │
├──────────────────────────────────────────────────────────┤
│ 色彩           │ Soviet Red #C41E3A + Gold #D4A900        │
│                │ Carbon Black #0D0D0D 底色                │
│                │ 高对比度，红/金/黑三色体系                │
├──────────────────────────────────────────────────────────┤
│ 组件排布       │ 紧凑高密度，4px 基准间距                  │
│                │ 2-4 列网格，卡片小而密集                   │
│                │ 不对称布局，刻意的错位感                   │
│                │ 侧边栏窄 (240px)                         │
├──────────────────────────────────────────────────────────┤
│ 字体           │ Display: JetBrains Mono (等宽/机械感)     │
│                │ Body: Inter (清晰可读)                    │
│                │ 标题全大写 + 宽字间距 (0.1em)             │
│                │ 粗体强调，强对比字号（大标题+小正文）       │
├──────────────────────────────────────────────────────────┤
│ 圆角           │ 0px - 2px（几乎纯方角）                   │
│                │ 棱角分明的几何感                          │
├──────────────────────────────────────────────────────────┤
│ 阴影/层次      │ 不使用阴影                               │
│                │ 通过 2px solid 边框 区分层级               │
│                │ 边框颜色用主色调半透明                     │
├──────────────────────────────────────────────────────────┤
│ 动效           │ 刚性 cubic-bezier(0.4, 0, 0.2, 1)       │
│                │ 150ms 快速过渡，无弹跳                    │
│                │ 机械感平移动画                            │
├──────────────────────────────────────────────────────────┤
│ 装饰           │ 45° 对角线条纹背景纹理                    │
│                │ 红色竖线分隔符                            │
│                │ 几何形状角标（三角形、梯形）               │
│                │ 星形/齿轮形装饰图标                       │
├──────────────────────────────────────────────────────────┤
│ 信息密度       │ 高密度 (density-factor: 0.85)            │
│                │ 减少留白，信息优先                        │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Cyberpunk Neon（赛博朋克）

```
设计灵感: Cyberpunk 2077 + Blade Runner + TRON Legacy
情感基调: 未来感、霓虹、全息投影、数字废墟

┌──────────────────────────────────────────────────────────┐
│ 维度           │ 具体实现                                 │
├──────────────────────────────────────────────────────────┤
│ 色彩           │ Neon Cyan #00FFFF + Hot Pink #FF00AA     │
│                │ Deep Space #0A0A12 底色                  │
│                │ 高饱和荧光色，暗底色对比                   │
│                │ 渐变色边框和文字                          │
├──────────────────────────────────────────────────────────┤
│ 组件排布       │ 适中密度，8px 基准间距                    │
│                │ 2-3 列网格，给发光效果留空间               │
│                │ 卡片有微微倾斜的视觉效果                   │
│                │ 侧边栏中等 (280px)                       │
├──────────────────────────────────────────────────────────┤
│ 字体           │ Display: Orbitron / Exo 2 (未来科技感)   │
│                │ Body: Roboto Mono (终端风)                │
│                │ 发光文字效果 (text-shadow: 0 0 10px)      │
│                │ 中等字号阶梯                              │
├──────────────────────────────────────────────────────────┤
│ 圆角           │ 4px - 8px (柔和圆角)                     │
│                │ 某些卡片带有斜切角 (clip-path)            │
├──────────────────────────────────────────────────────────┤
│ 阴影/层次      │ 发光阴影 (glow)                          │
│                │ box-shadow: 0 0 15px rgba(0,255,255,0.3) │
│                │ 层级越高发光越强                          │
│                │ 边框也带发光效果                          │
├──────────────────────────────────────────────────────────┤
│ 动效           │ 流畅 cubic-bezier(0.25, 0.1, 0.25, 1)   │
│                │ 250ms 中速过渡                            │
│                │ 全息闪烁 (glitch) 效果（低频使用）         │
│                │ 扫描线动画背景                            │
│                │ 数据流粒子效果                            │
├──────────────────────────────────────────────────────────┤
│ 装饰           │ 网格线背景 (1px, 低透明度)               │
│                │ 扫描线动画 (CSS animation)                │
│                │ 全息投影边框 (渐变+动画)                   │
│                │ 小型数据流粒子 (Canvas)                    │
│                │ HUD 风格的角标和状态指示器                 │
├──────────────────────────────────────────────────────────┤
│ 信息密度       │ 中密度 (density-factor: 1.0)             │
│                │ 适度留白，平衡信息和视觉效果               │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Swiss Minimal（瑞士极简）

```
设计灵感: 国际主义平面设计 + Helvetica + Dieter Rams
情感基调: 克制、精确、优雅、功能至上、Less is More

┌──────────────────────────────────────────────────────────┐
│ 维度           │ 具体实现                                 │
├──────────────────────────────────────────────────────────┤
│ 色彩           │ Swiss Black #1A1A1A + Signal Red #FF0000 │
│                │ Pure White #FFFFFF 底色                   │
│                │ 极度克制的用色，红色仅用于极少量点缀       │
│                │ 大量灰阶层次                              │
├──────────────────────────────────────────────────────────┤
│ 组件排布       │ 宽松低密度，8px 基准间距                  │
│                │ 1-2 列网格（小屏1列，大屏2列）            │
│                │ 大量留白，严格网格对齐                     │
│                │ 侧边栏宽 (320px)                         │
│                │ 内容区域有明确的呼吸空间                   │
├──────────────────────────────────────────────────────────┤
│ 字体           │ Display: Helvetica Neue / Inter           │
│                │ Body: Inter (高可读性无衬线)               │
│                │ 严格的模块化字号阶梯                       │
│                │ 正常字间距，中等行高 (1.6)                 │
│                │ 不使用粗体强调，通过字号和间距区分层级      │
├──────────────────────────────────────────────────────────┤
│ 圆角           │ 0px（纯方角）                             │
│                │ 通过留白和排版组织信息，不依赖圆角柔化      │
├──────────────────────────────────────────────────────────┤
│ 阴影/层次      │ 不使用或极淡阴影                          │
│                │ 通过色彩明度差异区分层级                    │
│                │ 极细边框 (1px solid #E5E5E5)              │
│                │ 白/浅灰/中灰三级表面色                     │
├──────────────────────────────────────────────────────────┤
│ 动效           │ 极简 150-200ms                            │
│                │ 仅功能性过渡（hover/focus/展开收起）        │
│                │ 无装饰性动画                              │
│                │ 无粒子/无闪烁/无扫描线                     │
├──────────────────────────────────────────────────────────┤
│ 装饰           │ 无装饰                                    │
│                │ 调试模式可显示网格辅助线                    │
│                │ 信息通过排版和空间组织传达                  │
│                │ 唯一装饰: Signal Red 细线分隔符            │
├──────────────────────────────────────────────────────────┤
│ 信息密度       │ 低密度 (density-factor: 1.2)              │
│                │ 大量留白，每个元素有充分呼吸空间            │
│                │ 卡片大、间距大、内容区宽                    │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Token 架构实现

### 2.1 CSS Variable 层级

```css
/* 基础 Token — 每个主题覆盖 */
:root[data-theme="soviet"] {
  /* === 色彩 === */
  --color-primary: 196 30 58;
  --color-accent: 212 169 0;
  --color-bg: 13 13 13;
  --color-surface: 26 26 26;
  --color-surface-elevated: 42 42 42;
  --color-text: 240 240 240;
  --color-text-muted: 160 160 160;

  /* === 排版 === */
  --font-display: 'JetBrains Mono', monospace;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --letter-spacing-display: 0.1em;
  --text-transform-display: uppercase;
  --font-weight-display: 700;
  --line-height-body: 1.4;

  /* === 空间 === */
  --spacing-base: 4px;
  --density-factor: 0.85;
  --container-padding: 12px;
  --card-gap: 8px;
  --sidebar-width: 240px;

  /* === 形状 === */
  --radius-sm: 0px;
  --radius-md: 2px;
  --radius-lg: 2px;
  --border-width: 2px;
  --border-style: solid;

  /* === 层次 === */
  --elevation-type: border;
  --elevation-1: inset 0 0 0 2px rgb(var(--color-primary) / 0.2);
  --elevation-2: inset 0 0 0 2px rgb(var(--color-primary) / 0.4);

  /* === 动效 === */
  --motion-duration-fast: 100ms;
  --motion-duration-normal: 150ms;
  --motion-easing: cubic-bezier(0.4, 0, 0.2, 1);

  /* === 布局 === */
  --grid-cols-sm: 1;
  --grid-cols-md: 2;
  --grid-cols-lg: 3;
  --grid-cols-xl: 4;
  --card-variant: compact;
}

:root[data-theme="cyberpunk"] {
  /* === 色彩 === */
  --color-primary: 0 255 255;
  --color-accent: 255 0 170;
  --color-bg: 10 10 18;
  --color-surface: 20 20 40;
  --color-surface-elevated: 30 30 60;
  --color-text: 220 240 255;
  --color-text-muted: 120 140 170;

  /* === 排版 === */
  --font-display: 'Orbitron', 'Exo 2', sans-serif;
  --font-body: 'Roboto Mono', monospace;
  --font-mono: 'Roboto Mono', monospace;
  --letter-spacing-display: 0.05em;
  --text-transform-display: uppercase;
  --font-weight-display: 600;
  --line-height-body: 1.5;

  /* === 空间 === */
  --spacing-base: 8px;
  --density-factor: 1.0;
  --container-padding: 16px;
  --card-gap: 12px;
  --sidebar-width: 280px;

  /* === 形状 === */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --border-width: 1px;
  --border-style: solid;

  /* === 层次 === */
  --elevation-type: glow;
  --elevation-1: 0 0 10px rgb(var(--color-primary) / 0.15);
  --elevation-2: 0 0 20px rgb(var(--color-primary) / 0.3);

  /* === 动效 === */
  --motion-duration-fast: 150ms;
  --motion-duration-normal: 250ms;
  --motion-easing: cubic-bezier(0.25, 0.1, 0.25, 1);

  /* === 布局 === */
  --grid-cols-sm: 1;
  --grid-cols-md: 2;
  --grid-cols-lg: 3;
  --grid-cols-xl: 3;
  --card-variant: normal;
}

:root[data-theme="swiss"] {
  /* === 色彩 === */
  --color-primary: 26 26 26;
  --color-accent: 255 0 0;
  --color-bg: 255 255 255;
  --color-surface: 250 250 245;
  --color-surface-elevated: 245 245 240;
  --color-text: 26 26 26;
  --color-text-muted: 120 120 120;

  /* === 排版 === */
  --font-display: 'Helvetica Neue', 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
  --letter-spacing-display: 0;
  --text-transform-display: none;
  --font-weight-display: 400;
  --line-height-body: 1.6;

  /* === 空间 === */
  --spacing-base: 8px;
  --density-factor: 1.2;
  --container-padding: 24px;
  --card-gap: 16px;
  --sidebar-width: 320px;

  /* === 形状 === */
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --border-width: 1px;
  --border-style: solid;

  /* === 层次 === */
  --elevation-type: none;
  --elevation-1: none;
  --elevation-2: 0 1px 3px rgb(0 0 0 / 0.05);

  /* === 动效 === */
  --motion-duration-fast: 100ms;
  --motion-duration-normal: 150ms;
  --motion-easing: ease;

  /* === 布局 === */
  --grid-cols-sm: 1;
  --grid-cols-md: 1;
  --grid-cols-lg: 2;
  --grid-cols-xl: 3;
  --card-variant: large;
}
```

### 2.2 组件适配示例

每个组件通过 CSS variable 自动适配主题，**不需要条件判断**：

```tsx
// 卡片组件 — 所有主题共用一套 JSX，通过 token 差异化
function MonitorCard({ title, value, trend }: Props) {
  return (
    <div
      className="transition-all"
      style={{
        borderRadius: 'var(--radius-md)',
        border: 'var(--border-width) var(--border-style) rgb(var(--color-primary) / 0.2)',
        boxShadow: 'var(--elevation-1)',
        padding: `calc(var(--spacing-base) * 3 * var(--density-factor))`,
        gap: `calc(var(--spacing-base) * 2 * var(--density-factor))`,
        transition: `all var(--motion-duration-normal) var(--motion-easing)`,
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: 'var(--letter-spacing-display)',
          textTransform: 'var(--text-transform-display)',
          fontWeight: 'var(--font-weight-display)',
        }}
      >
        {title}
      </h3>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  )
}
```

### 2.3 装饰层组件

```tsx
// 每个主题独立的装饰组件
function ThemeDecoration() {
  const theme = useTheme()

  switch (theme) {
    case 'soviet':
      return (
        <>
          {/* 对角线条纹背景 */}
          <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)' }}
          />
          {/* 几何角标 */}
          <div className="absolute top-0 right-0 w-8 h-8 bg-[rgb(var(--color-primary))]"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
          />
        </>
      )

    case 'cyberpunk':
      return (
        <>
          {/* 网格线背景 */}
          <div className="fixed inset-0 pointer-events-none opacity-[0.05]"
            style={{ backgroundImage: 'linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />
          {/* 扫描线动画 */}
          <div className="fixed inset-0 pointer-events-none animate-scanline" />
        </>
      )

    case 'swiss':
      return null  // 无装饰
  }
}
```

---

## 3. 验收标准

- [ ] 三个主题在色彩上有明显差异 (当前已实现)
- [ ] 三个主题在 **组件间距/密度** 上有可感知差异
- [ ] 三个主题在 **字体** 上有可感知差异（至少 display 字体不同）
- [ ] 三个主题在 **圆角** 上有可感知差异
- [ ] 三个主题在 **层次表达（阴影/边框/发光）** 上有可感知差异
- [ ] 三个主题在 **装饰元素** 上有可感知差异
- [ ] 三个主题在 **网格列数/信息密度** 上有可感知差异
- [ ] 主题切换 < 300ms，无闪烁/跳动
- [ ] 新增组件时只需使用 CSS variable，无需为每个主题写条件分支
